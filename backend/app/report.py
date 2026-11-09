"""The Bus A vs Bus B comparison report: one PDF built from the same model results the Optimise page shows.

The server builds the document itself from two scenarios, so the file a user downloads and the file that is emailed are the same, and nobody can use
the mail sender to send content of their own. Every number comes from `run_prediction` / `run_compare`; nothing here is a new model result.
Fonts: DejaVu Sans (shipped with matplotlib) because it has the rupee sign, which the standard PDF fonts do not.
"""
from __future__ import annotations

import io
import os
from datetime import datetime, timezone

import matplotlib
from reportlab.graphics.shapes import Drawing, Line, PolyLine, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

from backend.app.schemas import CompareResult, DISCLAIMER, PredictionResult

RESERVE = 0.2                       # the app's route rule: daily distance plus 20 %
INK, MUTED, RULE, SOFT = colors.HexColor("#18181B"), colors.HexColor("#52525B"), colors.HexColor("#D4D4D8"), colors.HexColor("#F4F4F5")
ACCENT, BUS_A, BUS_B = colors.HexColor("#B45309"), colors.HexColor("#334155"), colors.HexColor("#D97706")
WARN_BG, WARN_LINE = colors.HexColor("#FEF3C7"), colors.HexColor("#F59E0B")
W, H = A4
MARGIN = 18 * mm

_fonts_ready = False


def _fonts() -> None:
    global _fonts_ready
    if _fonts_ready:
        return
    d = os.path.join(matplotlib.get_data_path(), "fonts", "ttf")
    for name, file in (("DV", "DejaVuSans.ttf"), ("DV-B", "DejaVuSans-Bold.ttf"), ("DV-I", "DejaVuSans-Oblique.ttf"), ("DV-BI", "DejaVuSans-BoldOblique.ttf")):
        pdfmetrics.registerFont(TTFont(name, os.path.join(d, file)))
    pdfmetrics.registerFontFamily("DV", normal="DV", bold="DV-B", italic="DV-I", boldItalic="DV-BI")
    _fonts_ready = True


def _styles() -> dict[str, ParagraphStyle]:
    b = dict(fontName="DV", textColor=INK, alignment=TA_LEFT)
    return {
        "title": ParagraphStyle("title", fontSize=20, leading=25, fontName="DV-B", textColor=INK),
        "kicker": ParagraphStyle("kicker", fontSize=8.5, leading=11, fontName="DV-B", textColor=ACCENT),
        "h": ParagraphStyle("h", fontSize=12.5, leading=16, fontName="DV-B", textColor=INK, spaceBefore=14, spaceAfter=6),
        "p": ParagraphStyle("p", fontSize=9.4, leading=13.6, **b),
        "lead": ParagraphStyle("lead", fontSize=11, leading=16, **b),
        "small": ParagraphStyle("small", fontSize=8, leading=11.2, fontName="DV", textColor=MUTED),
        "cell": ParagraphStyle("cell", fontSize=8.6, leading=11.4, **b),
        "cellb": ParagraphStyle("cellb", fontSize=8.6, leading=11.4, fontName="DV-B", textColor=INK),
        "head": ParagraphStyle("head", fontSize=8, leading=10.5, fontName="DV-B", textColor=MUTED),
    }


def _p(text: str, style) -> Paragraph:
    return Paragraph(text, style)


def _val(x):
    """Plain number from a Labelled (or None)."""
    if x is None:
        return None
    v = x.value
    return None if isinstance(v, list) else float(v)


def _arr(x) -> list[float]:
    v = x.value
    return [float(a) for a in v] if isinstance(v, list) else [float(v)]


def _rupees(v: float) -> str:
    a, s = abs(v), "−" if v < 0 else ""
    if a >= 1e7:
        return f"{s}₹{a / 1e7:.2f} crore" if a < 1e8 else f"{s}₹{a / 1e7:.1f} crore"
    if a >= 1e5:
        return f"{s}₹{a / 1e5:.1f} lakh"
    return f"{s}₹{round(a):,}"


def _years(months: float | None) -> str:
    return "beyond the forecast" if months is None else f"{months / 12:.1f} years"


def _signed(v: float, d: int = 1, unit: str = "") -> str:
    return f"{'+' if v >= 0 else '−'}{abs(v):.{d}f}{unit}"


def _hhmm(h: float) -> str:
    m = round((h % 24) * 60) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


# Scenario fields, in the order a fleet manager reads them: label, formatter.
FIELDS: list[tuple[str, str, object]] = [
    ("archetype", "Bus type", lambda v: f"{v} bus"),
    ("pack_kwh", "Pack size", lambda v: f"{v:g} kWh"),
    ("kwh_per_km", "Energy use", lambda v: f"{v:.2f} kWh/km"),
    ("km_per_day", "Distance per day", lambda v: f"{v:g} km"),
    ("operating_days_per_year", "Operating days a year", lambda v: f"{v:g}"),
    ("soc_min_pct", "Lowest charge level", lambda v: f"{v:g} %"),
    ("soc_max_pct", "Charge cap", lambda v: f"{v:g} %"),
    ("charge_power_kw", "Charger power", lambda v: f"{v:g} kW"),
    ("charge_start_hour", "Charging starts", _hhmm),
    ("departure_hour", "Bus departs", _hhmm),
    ("zone", "Climate zone", lambda v: str(v).replace("_", " ")),
    ("heat_rise_c", "Pack heat above air", lambda v: f"{v:g} °C"),
    ("pack_penalty_min", "Weakest-cell penalty, low", lambda v: f"{v * 100:g} %"),
    ("pack_penalty_max", "Weakest-cell penalty, high", lambda v: f"{v * 100:g} %"),
    ("battery_cost_per_kwh_inr", "Battery price", lambda v: "not set" if v is None else f"₹{v:,.0f} per kWh"),
    ("threshold", "Replace when health falls to", lambda v: f"{v * 100:g} %"),
    ("horizon_years", "Forecast length", lambda v: f"{v} years"),
]


def changes(a, b) -> list[tuple[str, str, str]]:
    out = []
    for key, label, fmt in FIELDS:
        va, vb = getattr(a, key), getattr(b, key)
        if va != vb and not (isinstance(va, float) and isinstance(vb, float) and abs(va - vb) < 1e-9):
            out.append((label, fmt(va) if va is not None else "not set", fmt(vb) if vb is not None else "not set"))
    return out


def route_need_km(s) -> float:
    return s.km_per_day * (1 + RESERVE)


def range_at_replacement(p: PredictionResult) -> float:
    return (_val(p.range.new_pack_range_km) or 0.0) * p.scenario.threshold


def life_value_per_bus_year(pa: PredictionResult, pb: PredictionResult) -> float | None:
    """Pack price spread over the median life, A minus B (positive: B is cheaper per year). Needs the same price on both and both medians."""
    ca, cb = _val(pa.cost.battery_cost), _val(pb.cost.battery_cost)
    ma, mb = _val(pa.replacement.months_p50), _val(pb.replacement.months_p50)
    if ca is None or cb is None or abs(ca - cb) >= 1 or not ca or not ma or not mb or ma <= 0 or mb <= 0:
        return None
    return ca / (ma / 12) - ca / (mb / 12)


def headline(pa: PredictionResult, pb: PredictionResult, d) -> list[str]:
    """The few sentences that say what the comparison found. Plain statements of the numbers in the tables."""
    out: list[str] = []
    ma, mb = _val(pa.replacement.months_p50), _val(pb.replacement.months_p50)
    if ma is not None and mb is not None:
        dm = mb - ma
        if abs(dm) < 0.5:
            out.append(f"Bus B's median battery life is about the same as Bus A's: {ma / 12:.1f} years against {mb / 12:.1f} years.")
        else:
            out.append(f"Bus B's battery lasts about <b>{abs(dm):.1f} months {'longer' if dm > 0 else 'less'}</b> than Bus A's at the median "
                       f"({ma / 12:.1f} years for Bus A, {mb / 12:.1f} years for Bus B).")
    elif ma is None and mb is None:
        out.append("Neither bus reaches the replacement line within the forecast at the median, so the difference in life cannot be measured.")
    else:
        out.append(f"The median replacement date is beyond the forecast for {'Bus A' if ma is None else 'Bus B'}, so the difference in life cannot be measured exactly.")
    later = _val(d.prob_variant_later)
    if later is not None:
        out.append(f"Bus B lasts longer than Bus A in {round(later * 100)} % of the model's reference runs.")
    ca, cb = _val(pa.cost.cost_per_km_p50), _val(pb.cost.cost_per_km_p50)
    if ca is not None and cb is not None:
        dc = cb - ca
        out.append("Battery cost per kilometre is about the same." if abs(dc) < 0.005 else
                   f"Battery cost per kilometre is <b>₹{abs(dc):.2f} {'lower' if dc < 0 else 'higher'}</b> for Bus B (₹{cb:.2f} against ₹{ca:.2f}).")
    ra, rb, need = range_at_replacement(pa), range_at_replacement(pb), route_need_km(pa.scenario)
    a_ok, b_ok = ra >= need - 0.5, rb >= need - 0.5
    if a_ok and b_ok:
        out.append(f"Both buses keep enough range for the route at replacement: Bus A {ra:.0f} km, Bus B {rb:.0f} km against {need:.0f} km needed (daily distance plus a 20 % reserve).")
    elif a_ok:
        out.append(f"<b>Range warning:</b> when Bus B's pack is due for replacement it could drive about {rb:.0f} km on a charge, below the {need:.0f} km the route needs "
                   f"(daily distance plus a 20 % reserve). Bus A would still manage {ra:.0f} km.")
    elif b_ok:
        out.append(f"Bus A falls below the {need:.0f} km the route needs at replacement ({ra:.0f} km), while Bus B keeps {rb:.0f} km.")
    else:
        out.append(f"Neither bus keeps the {need:.0f} km the route needs (daily distance plus a 20 % reserve) at replacement: Bus A {ra:.0f} km, Bus B {rb:.0f} km.")
    return out


# ---- chart -------------------------------------------------------------------------------------------------------------------------------

def _chart(pa: PredictionResult, pb: PredictionResult, width: float, height: float) -> Drawing:
    """Health over time for both buses: Bus A median with its 10th to 90th percentile band, Bus B median (dashed), and the replacement line."""
    months = pa.replacement.months
    ya = {k: [v * 100 for v in _arr(getattr(pa.replacement, f"retention_{k}"))] for k in ("p10", "p50", "p90")}
    yb = {k: [v * 100 for v in _arr(getattr(pb.replacement, f"retention_{k}"))] for k in ("p10", "p50", "p90")}
    horizon = months[-1] / 12
    meds = [_val(pa.replacement.months_p50), _val(pb.replacement.months_p50)]
    xmax = min(horizon, 15 if any(m is None or m / 12 > 9 for m in meds) else 10)
    lo_val = min(min(ya["p10"][: int(xmax * 12) + 1]), min(yb["p50"][: int(xmax * 12) + 1]), pa.scenario.threshold * 100, pb.scenario.threshold * 100)
    ymin = max(0.0, 5 * int((lo_val - 4) // 5))
    L, R, T, B = 36, 8, 8, 24
    d = Drawing(width, height)
    X = lambda yr: L + (width - L - R) * yr / xmax
    Y = lambda v: B + (height - T - B) * (v - ymin) / (100 - ymin)
    d.add(Rect(L, B, width - L - R, height - T - B, fillColor=colors.white, strokeColor=RULE, strokeWidth=0.6))
    step = 5 if 100 - ymin <= 30 else 10
    v = ymin
    while v <= 100 + 1e-9:
        d.add(Line(L, Y(v), width - R, Y(v), strokeColor=RULE, strokeWidth=0.3))
        d.add(String(L - 4, Y(v) - 3, f"{v:g}", fontName="DV", fontSize=7, fillColor=MUTED, textAnchor="end"))
        v += step
    for yr in range(0, int(xmax) + 1, 1 if xmax <= 10 else 2):
        d.add(String(X(yr), B - 11, str(yr), fontName="DV", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    d.add(String(L + (width - L - R) / 2, 1, "years in service", fontName="DV", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    d.add(String(2, height - 8, "% capacity left", fontName="DV", fontSize=7, fillColor=MUTED))
    n = int(xmax * 12)
    pts = lambda ys: [c for i in range(n + 1) for c in (X(months[i] / 12), Y(ys[i]))]
    band = [c for i in range(n + 1) for c in (X(months[i] / 12), Y(ya["p90"][i]))] + [c for i in range(n, -1, -1) for c in (X(months[i] / 12), Y(ya["p10"][i]))]
    d.add(Polygon(band, fillColor=colors.Color(0.2, 0.25, 0.33, alpha=0.13), strokeColor=None))
    thr = pa.scenario.threshold * 100
    d.add(Line(L, Y(thr), width - R, Y(thr), strokeColor=colors.HexColor("#DC2626"), strokeWidth=0.8, strokeDashArray=[3, 2]))
    d.add(String(L + 4, Y(thr) - 8, f"replacement line {thr:g} %", fontName="DV", fontSize=6.8, fillColor=colors.HexColor("#B91C1C")))
    d.add(PolyLine(pts(ya["p50"]), strokeColor=BUS_A, strokeWidth=1.6))
    d.add(PolyLine(pts(yb["p50"]), strokeColor=BUS_B, strokeWidth=1.6, strokeDashArray=[5, 2.5]))
    return d


def _legend(width: float) -> Drawing:
    d = Drawing(width, 14)
    d.add(Line(0, 7, 18, 7, strokeColor=BUS_A, strokeWidth=1.6)); d.add(String(22, 4, "Bus A median", fontName="DV", fontSize=7.5, fillColor=INK))
    d.add(Rect(92, 3, 18, 8, fillColor=colors.Color(0.2, 0.25, 0.33, alpha=0.13), strokeColor=None)); d.add(String(114, 4, "Bus A, 10th to 90th percentile", fontName="DV", fontSize=7.5, fillColor=INK))
    d.add(Line(250, 7, 268, 7, strokeColor=BUS_B, strokeWidth=1.6, strokeDashArray=[5, 2.5])); d.add(String(272, 4, "Bus B median", fontName="DV", fontSize=7.5, fillColor=INK))
    return d


# ---- document ----------------------------------------------------------------------------------------------------------------------------

class _Numbered(canvas.Canvas):
    """Canvas that knows the page count, so every footer can say "page 2 of 3"."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._saved: list[dict] = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self._footer(total)
            super().showPage()
        super().save()

    def _footer(self, total: int):
        self.setStrokeColor(RULE); self.setLineWidth(0.5); self.line(MARGIN, 14 * mm, W - MARGIN, 14 * mm)
        self.setFont("DV", 7.5); self.setFillColor(MUTED)
        self.drawString(MARGIN, 10 * mm, "Pack Horizon · Not yet validated on buses · Prior mode")
        self.drawRightString(W - MARGIN, 10 * mm, f"Page {self._pageNumber} of {total}")


def _table(rows: list[list], widths: list[float], head: bool = True, zebra: bool = True) -> Table:
    t = Table(rows, colWidths=widths, repeatRows=1 if head else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
          ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5), ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE)]
    if head:
        st += [("BACKGROUND", (0, 0), (-1, 0), SOFT), ("LINEBELOW", (0, 0), (-1, 0), 0.8, MUTED)]
    t.setStyle(TableStyle(st))
    return t


def build_pdf(pa: PredictionResult, pb: PredictionResult, cmp: CompareResult, fleet: int = 50, now: datetime | None = None) -> bytes:
    """The full report as PDF bytes. `pa`/`pb` are the predictions for Bus A and Bus B, `cmp` the paired comparison of the same two scenarios."""
    _fonts()
    S = _styles()
    now = now or datetime.now(timezone.utc)
    d = cmp.deltas[0]
    sa, sb = pa.scenario, pb.scenario
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=16 * mm, bottomMargin=20 * mm,
                            title="Pack Horizon: Bus A vs Bus B comparison", author="Pack Horizon", subject="Battery lifecycle comparison, prior mode")
    full = W - 2 * MARGIN
    story: list = []

    story += [_p("PACK HORIZON · E-BUS BATTERY LIFECYCLE", S["kicker"]), Spacer(1, 3),
              _p("Bus A vs Bus B comparison", S["title"]), Spacer(1, 3),
              _p(f"{sa.archetype} bus, {sa.zone.replace('_', ' ')} climate · prepared {now.strftime('%d %B %Y, %H:%M')} UTC · model version {cmp.model_version}", S["small"]), Spacer(1, 8)]
    box = Table([[_p(f"<b>Read this first.</b> {escape(DISCLAIMER)} Every figure is a forecast from the model, not a measurement. "
                     "The 10th to 90th percentile band is the spread between two published cell models, not a statistical confidence interval.", S["small"])]], colWidths=[full])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), WARN_BG), ("BOX", (0, 0), (-1, -1), 0.6, WARN_LINE), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                             ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story += [box]

    # 1. what the comparison found
    story += [_p("What the comparison found", S["h"])]
    lines = headline(pa, pb, d)
    story += [_p(lines[0], S["lead"]), Spacer(1, 4)] + [_p("• " + t, S["p"]) for t in lines[1:]]
    per_bus = life_value_per_bus_year(pa, pb)
    if per_bus is not None and abs(per_bus) >= 1:
        verb = "saves about" if per_bus > 0 else "costs about"
        more = "" if per_bus > 0 else " more"
        story += [Spacer(1, 3), _p(f"• In money, spreading the pack price over its median life, Bus B {verb} <b>{_rupees(abs(per_bus))}</b>{more} per bus per year "
                                   f"(<b>{_rupees(abs(per_bus) * fleet)}</b> a year for {fleet} bus{'es' if fleet != 1 else ''}). Straight-line, undiscounted, first pack only.", S["p"])]

    # 2. what was changed
    ch = changes(sa, sb)
    story += [_p("What was changed on Bus B", S["h"])]
    if ch:
        rows = [[_p("Setting", S["head"]), _p("Bus A", S["head"]), _p("Bus B", S["head"])]] + [[_p(a, S["cell"]), _p(b, S["cell"]), _p(f"<b>{c}</b>", S["cell"])] for a, b, c in ch]
        story += [_table(rows, [full * 0.44, full * 0.28, full * 0.28])]
    else:
        story += [_p("Bus B uses the same settings as Bus A.", S["p"])]

    # 3. results side by side
    def row(label, a, b, diff=""):
        return [_p(label, S["cell"]), _p(a, S["cell"]), _p(b, S["cell"]), _p(diff, S["cellb"])]
    ra, rb, need = range_at_replacement(pa), range_at_replacement(pb), route_need_km(sa)
    mon = lambda r, k: _val(getattr(r.replacement, f"months_{k}"))
    ma, mb = mon(pa, "p50"), mon(pb, "p50")
    rows = [[_p("", S["head"]), _p("Bus A", S["head"]), _p("Bus B", S["head"]), _p("Difference (B − A)", S["head"])],
            row("Replace around (median)", _years(ma), _years(mb), _signed(mb - ma, 1, " months") if ma is not None and mb is not None else "not measurable"),
            row("Earliest tenth reach the line", _years(mon(pa, "p10")), _years(mon(pb, "p10")),
                _signed(mon(pb, "p10") - mon(pa, "p10"), 1, " months") if mon(pa, "p10") is not None and mon(pb, "p10") is not None else ""),
            row("Latest tenth reach the line", _years(mon(pa, "p90")), _years(mon(pb, "p90")),
                _signed(mon(pb, "p90") - mon(pa, "p90"), 1, " months") if mon(pa, "p90") is not None and mon(pb, "p90") is not None else "")]
    ca, cb = _val(pa.cost.cost_per_km_p50), _val(pb.cost.cost_per_km_p50)
    if ca is not None and cb is not None:
        rng = lambda r: f"(₹{_val(r.cost.cost_per_km_p10):.2f} to ₹{_val(r.cost.cost_per_km_p90):.2f})" if r.cost.cost_per_km_p10 and r.cost.cost_per_km_p90 else ""
        rows.append(row("Battery cost per km (median)", f"₹{ca:.2f} {rng(pa)}", f"₹{cb:.2f} {rng(pb)}", f"{'−' if cb < ca else '+'}₹{abs(cb - ca):.2f}"))
    rows += [row("Range on a full charge, new pack", f"{_val(pa.range.new_pack_range_km):.0f} km", f"{_val(pb.range.new_pack_range_km):.0f} km", _signed(_val(pb.range.new_pack_range_km) - _val(pa.range.new_pack_range_km), 0, " km")),
             row(f"Range at replacement ({sa.threshold * 100:g} % health)", f"{ra:.0f} km", f"{rb:.0f} km", _signed(rb - ra, 0, " km")),
             row("Range the route needs", f"{need:.0f} km", f"{route_need_km(sb):.0f} km", ""),
             row("Share of loss from waiting (calendar ageing)", f"{(_val(pa.driver_split.calendar_share) or 0) * 100:.0f} %", f"{(_val(pb.driver_split.calendar_share) or 0) * 100:.0f} %", "")]
    results_block = [_p("Results side by side", S["h"]), _table(rows, [full * 0.34, full * 0.24, full * 0.24, full * 0.18])]

    # 4. chart
    story += [KeepTogether([_p("Battery health over time", S["h"]), _legend(full), Spacer(1, 3), _chart(pa, pb, full, 62 * mm),
                            Spacer(1, 3), _p("The line is each bus's median across the model's runs. The grey band is Bus A's 10th to 90th percentile. "
                                             "The red dashed line is where the pack is due for replacement.", S["small"])])]

    story += [KeepTogether(results_block)]

    # 5. limits and warnings
    tidy = lambda w: w.replace(" (see extrapolation_reasons)", "")
    ext = lambda p: [f"Outside the tested conditions: {r}" for r in p.replacement.extrapolation_reasons]
    wa = [tidy(w) for w in [*pa.warnings, *ext(pa)] if w != DISCLAIMER]
    wb = [tidy(w) for w in [*pb.warnings, *ext(pb)] if w != DISCLAIMER and tidy(w) not in wa]
    wc = [w for w in [*cmp.warnings, *cmp.notes] if w != DISCLAIMER and w not in wa and w not in wb]
    story += [_p("What this report cannot tell you", S["h"])]
    limits = ["Nothing here has been checked against a battery pack in service. Capacity comes from published laboratory cell models; every scenario input is an assumption or your own figure.",
              "Range uses usable energy times battery health divided by energy use. Air conditioning, season and temperature effects on range are not modelled.",
              "Cost per km is the pack price divided by the kilometres driven until replacement. It ignores interest, inflation, resale value and the cost of charging.",
              "Money figures spread the pack price evenly over its median life. They are undiscounted and cover the first pack only."]
    story += [_p("• " + t, S["p"]) for t in limits]
    for title, ws in (("Notes returned for Bus A", wa), ("Notes that apply to Bus B only", wb), ("Notes on the comparison", wc)):
        if ws:
            story += [Spacer(1, 4), _p(title, S["cellb"])] + [_p("• " + escape(w), S["small"]) for w in ws]

    # 6. appendix
    rows = [[_p("Input", S["head"]), _p("Bus A", S["head"]), _p("Bus B", S["head"])]]
    for key, label, fmt in FIELDS:
        va, vb = getattr(sa, key), getattr(sb, key)
        f = lambda v: "not set" if v is None else fmt(v)
        rows.append([_p(label, S["cell"]), _p(f(va), S["cell"]), _p(f(vb) if va == vb else f"<b>{f(vb)}</b>", S["cell"])])
    story += [KeepTogether([_p("Appendix: every input", S["h"]), _table(rows, [full * 0.44, full * 0.28, full * 0.28]),
                            Spacer(1, 3), _p("Bold in the Bus B column means it differs from Bus A.", S["small"])])]

    doc.build(story, canvasmaker=_Numbered)
    return buf.getvalue()


def filename(now: datetime | None = None) -> str:
    return f"pack-horizon-bus-comparison-{(now or datetime.now(timezone.utc)).strftime('%Y%m%d')}.pdf"
