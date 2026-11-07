"""Replacement-window Monte Carlo (Layer 4): when does retention cross the replacement threshold?"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from pydantic import BaseModel

from engine.bus.scenario import Scenario
from engine.bus.translate import CellConditions, translate
from engine.cell.uncertainty import Draws, Models, extrapolation_reasons, load_models, make_draws, simulate_loss
from engine.labels import Labelled, L

DAYS_PER_MONTH = 365.25 / 12


@dataclass
class ScenarioSim:
    scenario: Scenario
    conditions: CellConditions
    months: np.ndarray            # (T,)
    retention: np.ndarray         # (D, T)
    cal_loss: np.ndarray
    cyc_loss: np.ndarray
    pack_penalty: np.ndarray      # (D,)
    cross_months: np.ndarray      # (D,) time to threshold in months, inf if not reached within horizon
    extrapolated: bool
    extrapolation_reasons: list[str]


def first_crossing(retention: np.ndarray, months: np.ndarray, threshold: float) -> np.ndarray:
    """First time retention <= threshold (linear interpolation between grid points); inf if never."""
    below = retention <= threshold
    any_below = below.any(axis=1)
    idx = below.argmax(axis=1)
    out = np.full(retention.shape[0], np.inf)
    rows = np.where(any_below)[0]
    for r in rows:
        i = idx[r]
        if i == 0:
            out[r] = months[0]
        else:
            r0, r1 = retention[r, i - 1], retention[r, i]
            frac = (r0 - threshold) / (r0 - r1) if r0 != r1 else 0.0
            out[r] = months[i - 1] + frac * (months[i] - months[i - 1])
    return out


def simulate_scenario(s: Scenario, models: Models | None = None, draws: Draws | None = None,
                      n_draws: int = 2000, seed: int = 0) -> ScenarioSim:
    models = models or load_models()
    draws = draws or make_draws(n_draws, models, seed)
    c = translate(s)
    months = np.arange(0, s.horizon_years * 12 + 1, dtype=float)
    t_days = months * DAYS_PER_MONTH
    efc = c.efc_per_day.value * s.operating_days_per_year * t_days / 365.25
    sim = simulate_loss(t_days, efc, c.effective_temp_c.value, c.mean_soc_pct.value, c.c_rate_eff.value, models, draws)
    pen = s.pack_penalty_min + (s.pack_penalty_max - s.pack_penalty_min) * draws.u_pen
    loss = np.clip(sim["total"] * (1.0 + pen)[:, None], 0.0, 1.0)
    ret = 1.0 - loss
    cross = first_crossing(ret, months, s.threshold)
    reasons = extrapolation_reasons(float(efc.max()), c.effective_temp_c.value, c.mean_soc_pct.value, c.c_rate_eff.value, models)
    return ScenarioSim(s, c, months, ret, sim["calendar"], sim["cycle"], pen, cross, sim["extrapolated"], reasons)


class ReplacementResult(BaseModel):
    months_p10: Labelled | None
    months_p50: Labelled | None
    months_p90: Labelled | None
    probability_by_month: Labelled
    probability_within_horizon: Labelled
    calendar_share_of_loss: Labelled
    retention_p10: Labelled
    retention_p50: Labelled
    retention_p90: Labelled
    months: list[float]
    threshold: Labelled
    extrapolated: bool
    extrapolation_reasons: list[str]
    warnings: list[str]
    mode: str = "prior"


def _pct(cross: np.ndarray, q: float, horizon: float):
    v = np.percentile(cross, q)
    return None if not np.isfinite(v) or v > horizon else float(v)


def replacement_window(s: Scenario, n_draws: int = 2000, seed: int = 0, models: Models | None = None,
                       draws: Draws | None = None) -> ReplacementResult:
    sim = simulate_scenario(s, models, draws, n_draws, seed)
    horizon = float(sim.months[-1])
    cross = sim.cross_months
    prob = np.array([(cross <= m).mean() for m in sim.months])
    hit = np.isfinite(cross)
    cal_share = 0.0
    if hit.any():
        idxs = np.minimum(np.searchsorted(sim.months, cross[hit], side="left"), len(sim.months) - 1)
        rows = np.where(hit)[0]
        c, y = sim.cal_loss[rows, idxs], sim.cyc_loss[rows, idxs]
        cal_share = float(np.mean(c / np.maximum(c + y, 1e-12)))
    ret = np.percentile(sim.retention, [10, 50, 90], axis=0)
    ev = "derived"
    warns = list(sim.conditions.warnings)
    if sim.extrapolated:
        warns.append("Inputs are outside the range of the training data (see extrapolation_reasons): bands were widened by an assumed factor.")
    cmin = (models or load_models()).cyc.valid_c_rate[0]
    if sim.conditions.c_rate_eff.value < cmin:
        warns.append(f"Direction of likely bias: the cycling data are high-rate ({cmin:.1f}+ C) and the model has no C-rate effect, "
                     f"so cycling loss for this {sim.conditions.c_rate_eff.value:.2f} C bus is probably OVERSTATED and replacement timing too early.")
    if not hit.any():
        warns.append(f"Retention does not reach the threshold within {s.horizon_years} years in any simulated draw.")
    elif hit.mean() < 0.9:
        warns.append(f"Only {hit.mean() * 100:.0f}% of draws reach the threshold within {s.horizon_years} years; upper percentiles are beyond the horizon.")
    mk = lambda q: (None if (v := _pct(cross, q, horizon)) is None else L(v, "months", ev))
    return ReplacementResult(
        months_p10=mk(10), months_p50=mk(50), months_p90=mk(90),
        probability_by_month=L(prob.tolist(), "probability", ev, "P(replacement threshold reached by month m)"),
        probability_within_horizon=L(float(hit.mean()), "probability", ev),
        calendar_share_of_loss=L(cal_share, "fraction", ev, "share of capacity loss from calendar ageing at crossing (rest is cycling)"),
        retention_p10=L(ret[0].tolist(), "fraction", ev), retention_p50=L(ret[1].tolist(), "fraction", ev),
        retention_p90=L(ret[2].tolist(), "fraction", ev), months=sim.months.tolist(),
        threshold=L(s.threshold, "fraction", "assumption", "replace when retention falls to this"),
        extrapolated=sim.extrapolated, extrapolation_reasons=sim.extrapolation_reasons, warnings=warns)
