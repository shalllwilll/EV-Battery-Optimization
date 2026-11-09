"""The Bus A vs Bus B report: PDF download, email send, and the guards around the mail sender."""
import smtplib
from email import message_from_bytes, policy

import pytest
from fastapi.testclient import TestClient

from backend.app import auth, mailer
from backend.app.main import create_app
from backend.app.report import changes, headline, range_at_replacement
from tests.test_api_predict import BODY

A = BODY["scenario"]
B = {**A, "soc_max_pct": 90, "charge_start_hour": 2.5}
REQ = {"scenario_a": A, "scenario_b": B, "fleet_size": 40}
MAIL_ENV = {"EV_SMTP_USER": "sender@example.com", "EV_SMTP_PASSWORD": "app-password-123", "EV_MAIL_FROM": "Pack Horizon <sender@example.com>"}


@pytest.fixture()
def client():
    mailer._sent.clear()
    with TestClient(create_app()) as c:
        yield c
    mailer._sent.clear()


@pytest.fixture()
def outbox(monkeypatch):
    for k, v in MAIL_ENV.items():
        monkeypatch.setenv(k, v)
    sent = []
    monkeypatch.setattr(mailer, "send", lambda st, msg: sent.append(msg))
    return sent


def test_pdf_download_is_a_real_pdf_with_a_filename(client):
    r = client.post("/api/v1/report/pdf", json=REQ)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF-") and r.content.rstrip().endswith(b"%%EOF") and len(r.content) > 10_000
    assert 'filename="pack-horizon-bus-comparison-' in r.headers["content-disposition"] and r.headers["cache-control"] == "no-store"


def test_pdf_works_when_bus_b_equals_bus_a_and_without_a_price(client):
    no_price = {k: v for k, v in A.items() if k != "battery_cost_per_kwh_inr"}
    assert client.post("/api/v1/report/pdf", json={"scenario_a": A, "scenario_b": A}).status_code == 200
    assert client.post("/api/v1/report/pdf", json={"scenario_a": no_price, "scenario_b": {**no_price, "soc_max_pct": 85}}).status_code == 200


def test_pdf_rejects_bad_input_and_extra_fields(client):
    assert client.post("/api/v1/report/pdf", json={**REQ, "html": "<b>x</b>"}).status_code == 422
    assert client.post("/api/v1/report/pdf", json={**REQ, "fleet_size": 0}).status_code == 422
    assert client.post("/api/v1/report/pdf", json={"scenario_a": {**A, "km_per_day": -1}, "scenario_b": B}).status_code == 422


def test_report_endpoints_need_a_login_when_auth_is_on(monkeypatch):
    monkeypatch.setenv("EV_AUTH_REQUIRED", "true"); auth._fails.clear()
    with TestClient(create_app()) as c:
        for path, method in (("/api/v1/report/pdf", "post"), ("/api/v1/report/email", "post"), ("/api/v1/report/status", "get")):
            r = getattr(c, method)(path, **({"json": {**REQ, "to": "a@b.co"}} if method == "post" else {}))
            assert r.status_code == 401, path
        tok = c.post("/api/v1/auth/login", json={"username": "demo", "password": "PackHorizon-2026"}).json()["access_token"]
        assert c.post("/api/v1/report/pdf", json=REQ, headers={"Authorization": f"Bearer {tok}"}).status_code == 200


def test_email_is_off_until_credentials_are_set(client, monkeypatch):
    for k in MAIL_ENV:
        monkeypatch.delenv(k, raising=False)
    assert client.get("/api/v1/report/status").json() == {"email_enabled": False}
    r = client.post("/api/v1/report/email", json={**REQ, "to": "boss@company.com"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "email_not_set_up"


def test_email_sends_one_message_with_the_pdf_attached(client, outbox):
    assert client.get("/api/v1/report/status").json() == {"email_enabled": True}
    r = client.post("/api/v1/report/email", json={**REQ, "to": " boss@company.com "})
    assert r.status_code == 200 and r.json() == {"sent": True, "to": "b***@company.com"}
    assert len(outbox) == 1
    m = message_from_bytes(outbox[0].as_bytes(), policy=policy.default)
    assert m["To"] == "boss@company.com" and m["Cc"] is None and m["Bcc"] is None
    assert m["Subject"] == "Pack Horizon: Bus A vs Bus B comparison report"
    pdf = [p for p in m.walk() if p.get_content_type() == "application/pdf"]
    assert len(pdf) == 1 and pdf[0].get_payload(decode=True).startswith(b"%PDF-")
    assert "validated on buses" in m.get_body(("plain",)).get_content()


@pytest.mark.parametrize("to", ["", "nobody", "a@b", "a@b.com, c@d.com", "a@b.com;c@d.com", "a@b.com\nBcc: x@y.com", "a b@c.com", "<a@b.com>", "a@b.com\r\nSubject: hi", "@b.com"])
def test_email_rejects_anything_but_one_plain_address(client, outbox, to):
    r = client.post("/api/v1/report/email", json={**REQ, "to": to})
    assert r.status_code == 422 and not outbox


def test_email_is_rate_limited(client, outbox):
    for _ in range(mailer.PER_CLIENT):
        assert client.post("/api/v1/report/email", json={**REQ, "to": "boss@company.com"}).status_code == 200
    r = client.post("/api/v1/report/email", json={**REQ, "to": "boss@company.com"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_reports" and len(outbox) == mailer.PER_CLIENT


def test_rate_limit_window_expires():
    mailer._sent.clear()
    for i in range(mailer.PER_CLIENT):
        mailer.record("c", now=1000.0 + i)
    with pytest.raises(Exception):
        mailer.check_rate("c", now=1010.0)
    mailer.check_rate("c", now=1000.0 + mailer.WINDOW_S + 10)
    mailer._sent.clear()


class _Boom:
    def __init__(self, exc): self.exc = exc
    def __call__(self, *a, **k): raise self.exc


@pytest.mark.parametrize("exc,status,code", [
    (smtplib.SMTPAuthenticationError(535, b"bad credentials app-password-123"), 502, "email_not_accepted"),
    (smtplib.SMTPRecipientsRefused({"x@y.com": (550, b"no such user")}), 422, "recipient_refused"),
    (smtplib.SMTPServerDisconnected("gone"), 502, "email_failed"),
    (TimeoutError("slow"), 502, "email_failed"),
])
def test_mail_failures_become_short_messages_that_leak_nothing(client, monkeypatch, exc, status, code):
    for k, v in MAIL_ENV.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setattr(smtplib, "SMTP", _Boom(exc))
    r = client.post("/api/v1/report/email", json={**REQ, "to": "boss@company.com"})
    assert r.status_code == status and r.json()["error"]["code"] == code
    assert "app-password-123" not in r.text and "sender@example.com" not in r.text
    # a failed send does not use up the hourly allowance
    assert len(mailer._sent["*"]) == 0


def test_masking_and_validation_helpers():
    assert mailer.mask("a@b.com") == "a*@b.com" and mailer.mask("alice@x.org") == "a****@x.org"
    assert mailer.valid_address("first.last+tag@sub.company.co.in") and not mailer.valid_address("x" * 250 + "@b.com")


def test_headline_names_a_range_shortfall_on_bus_b(client):
    # a big cut to the charge cap on a route that is already near the limit: Bus B ends up short of the route
    from backend.app import service
    from backend.app.schemas import CompareRequest, PredictRequest
    from engine.bus.scenario import Scenario
    m = client.app.state.models
    a = Scenario.model_validate({**A, "km_per_day": 150}); b = a.model_copy(update={"soc_max_pct": 70})
    pa, pb = (service.run_prediction(PredictRequest(scenario=s), m, "t") for s in (a, b))
    cmp = service.run_compare(CompareRequest(scenarios=[a, b]), m, "t")
    text = " ".join(headline(pa, pb, cmp.deltas[0]))
    assert range_at_replacement(pb) < range_at_replacement(pa)
    assert "Range warning" in text and "below the 180 km the route needs" in text
    assert changes(a, b) == [("Charge cap", "100 %", "70 %")]


class _FakeSMTP:
    log: list = []

    def __init__(self, host, port, timeout=None, context=None):
        _FakeSMTP.log.append(("connect", host, port))

    def __enter__(self): return self
    def __exit__(self, *a): return False
    def starttls(self, context=None): _FakeSMTP.log.append(("starttls",))
    def login(self, u, p): _FakeSMTP.log.append(("login", u, p))
    def send_message(self, m): _FakeSMTP.log.append(("send", m["To"]))


@pytest.mark.parametrize("port,expect", [(587, ["connect", "starttls", "login", "send"]), (465, ["connect", "login", "send"])])
def test_send_uses_tls_before_logging_in(monkeypatch, port, expect):
    from backend.app.config import get_settings
    for k, v in MAIL_ENV.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setenv("EV_SMTP_PORT", str(port))
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP); monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSMTP)
    _FakeSMTP.log = []
    st = get_settings()
    mailer.send(st, mailer.build_message(st, "boss@company.com", b"%PDF-1.4", "r.pdf", ["x"]))
    assert [e[0] for e in _FakeSMTP.log] == expect and _FakeSMTP.log[0][1:] == ("smtp.gmail.com", port)


def test_spaces_in_a_pasted_app_password_are_ignored(monkeypatch):
    from backend.app.config import get_settings
    monkeypatch.setenv("EV_SMTP_PASSWORD", "abcd efgh ijkl mnop ")
    assert get_settings().smtp_password == "abcdefghijklmnop"
