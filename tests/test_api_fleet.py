"""POST /api/v1/fleet."""
import json
import time

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from tests.helpers import find_bare_numbers

SCEN = {"pack_kwh": 350, "kwh_per_km": 1.2, "km_per_day": 200, "operating_days_per_year": 340, "charge_power_kw": 120, "battery_cost_per_kwh_inr": 12000}


def body(n=30, **over):
    b = {"as_of": "2026-11-11", "forecast_years": 10,
         "classes": [{"id": "A", "scenario": SCEN}, {"id": "B", "scenario": {**SCEN, "km_per_day": 160, "charge_start_hour": 1.0}}],
         "buses": [{"id": f"B-{i}", "class_id": "A" if i % 2 else "B", **({"in_service": f"{2019 + i % 6}-0{1 + i % 9}"} if i % 5 else {})} for i in range(n)]}
    b.update(over)
    return b


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def test_fleet_ok_shape_labels_and_cache(client):
    r = client.post("/api/v1/fleet", json=body())
    assert r.status_code == 200 and r.headers["X-Cache"] == "MISS"
    j = r.json()
    assert j["mode"] == "prior" and len(j["model_version"]) == 12 and "validated on buses" in j["disclaimer"]
    assert find_bare_numbers(j) == []
    n = len(j["period_labels"])
    assert n >= 10 and j["period_labels"][0] == "FY2026-27" and len(j["buses_expected"]["value"]) == n and len(j["period_edges_months"]["value"]) == n + 1
    assert {c["id"] for c in j["classes"]} == {"A", "B"} and sum(c["n_buses"]["value"] for c in j["cohorts"]) == 30
    assert any("age_unknown" in c["flags"] for c in j["cohorts"])
    again = client.post("/api/v1/fleet", json=body())
    assert again.headers["X-Cache"] == "HIT" and again.json() == j


def test_classes_that_differ_only_in_price_cost_no_extra_model_run(client):
    """Price is not part of the ageing-curve key, so re-pricing a whole fleet reruns no ageing model."""
    from engine.reference.simulate import _curves
    client.post("/api/v1/fleet", json=body())
    before = _curves.cache_info().misses
    b = body()
    for c in b["classes"]:
        c["scenario"] = {**c["scenario"], "battery_cost_per_kwh_inr": 9000}
    r = client.post("/api/v1/fleet", json=b)
    assert r.status_code == 200 and _curves.cache_info().misses == before


def test_unfittable_fleet_is_422_with_a_reason(client):
    b = body(n=3)
    b["buses"][0]["in_service"] = "2005-01"
    r = client.post("/api/v1/fleet", json=b)
    assert r.status_code == 422 and r.json()["error"]["code"] == "fleet_not_forecastable" and "20-year horizon" in r.json()["error"]["message"]
    b = body(n=3)
    b["buses"][0]["in_service"] = "2027-05"
    assert client.post("/api/v1/fleet", json=b).status_code == 422


@pytest.mark.parametrize("mutate", [
    lambda b: b["buses"].append({"id": "B-0", "class_id": "A"}),                      # duplicate bus id
    lambda b: b["classes"].append({"id": "A", "scenario": SCEN}),                    # duplicate class id
    lambda b: b["buses"].__setitem__(0, {"id": "x", "class_id": "nope"}),            # unknown class
    lambda b: b["buses"].__setitem__(0, {"id": "x", "class_id": "A", "in_service": "2023-13"}),
    lambda b: b.update(buses=[]),
    lambda b: b.update(forecast_years=40),
    lambda b: b["buses"][0].update(pack_price_inr=-1),
    lambda b: b.update(extra_field=1),
])
def test_bad_requests_are_rejected(client, mutate):
    b = body(n=5)
    mutate(b)
    assert client.post("/api/v1/fleet", json=b).status_code == 422


def test_limits(client):
    many = body(n=5001)
    assert client.post("/api/v1/fleet", json=many).status_code == 422
    too_many_classes = body(n=3, classes=[{"id": f"C{i}", "scenario": SCEN} for i in range(51)])
    assert client.post("/api/v1/fleet", json=too_many_classes).status_code == 422


def test_unsupported_mode_is_400(client):
    assert client.post("/api/v1/fleet", json=body(n=3, mode="calibrated")).status_code == 400


def test_five_thousand_buses_fit_the_body_limit_and_the_time_budget(client):
    b = body(n=5000)
    assert len(json.dumps(b)) < 1_000_000
    t = time.perf_counter()
    r = client.post("/api/v1/fleet", json=b)
    assert r.status_code == 200 and time.perf_counter() - t < 5


def test_openapi_lists_the_endpoint(client):
    assert "/api/v1/fleet" in client.get("/openapi.json").json()["paths"]
