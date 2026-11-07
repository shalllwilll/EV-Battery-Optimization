"""Cost per km (Layer 4): battery replacement cost / km driven until the threshold is reached. Undiscounted."""
from __future__ import annotations

import numpy as np
from pydantic import BaseModel

from engine.bus.scenario import Scenario
from engine.cell.uncertainty import Draws, Models
from engine.decide.replacement import ScenarioSim, simulate_scenario
from engine.labels import Labelled, L


class CostResult(BaseModel):
    cost_per_km_p10: Labelled | None
    cost_per_km_p50: Labelled | None
    cost_per_km_p90: Labelled | None
    battery_cost: Labelled | None
    lifetime_km_p50: Labelled | None
    censored_fraction: Labelled | None
    tornado: list[dict]
    warnings: list[str]


def lifetime_km(sim: ScenarioSim) -> np.ndarray:
    """Km driven until threshold per draw; draws that never cross are censored at the horizon (lower bound)."""
    s = sim.scenario
    months = np.minimum(sim.cross_months, sim.months[-1])
    return months / 12.0 * s.operating_days_per_year * s.km_per_day


def _cost_p50(s: Scenario, models, draws) -> float:
    sim = simulate_scenario(s, models, draws)
    return float(np.percentile(s.pack_kwh * s.battery_cost_per_kwh_inr / lifetime_km(sim), 50))


def cost_per_km(sim: ScenarioSim, models: Models | None = None, draws: Draws | None = None) -> CostResult:
    s = sim.scenario
    if s.battery_cost_per_kwh_inr is None:
        return CostResult(cost_per_km_p10=None, cost_per_km_p50=None, cost_per_km_p90=None, battery_cost=None,
                          lifetime_km_p50=None, censored_fraction=None, tornado=[],
                          warnings=["Enter a battery price per kWh to get cost per km."])
    price = s.pack_kwh * s.battery_cost_per_kwh_inr
    km = lifetime_km(sim)
    c = price / km
    q = np.percentile(c, [10, 50, 90])
    cens = float(np.isinf(sim.cross_months).mean())
    base = float(q[1])
    tornado = []
    if models is not None and draws is not None:
        for name, lo_s, hi_s in (
            ("battery price per kWh", s.model_copy(update=dict(battery_cost_per_kwh_inr=s.battery_cost_per_kwh_inr * 0.8)),
             s.model_copy(update=dict(battery_cost_per_kwh_inr=s.battery_cost_per_kwh_inr * 1.2))),
            ("replacement threshold", s.model_copy(update=dict(threshold=max(s.threshold - 0.05, 0.51))),
             s.model_copy(update=dict(threshold=min(s.threshold + 0.05, 0.94)))),
            ("km per day", s.model_copy(update=dict(km_per_day=s.km_per_day * 0.8)),
             s.model_copy(update=dict(km_per_day=s.km_per_day * 1.2))),
        ):
            a, b = _cost_p50(lo_s, models, draws), _cost_p50(hi_s, models, draws)
            tornado.append(dict(input=name, low_case=a, high_case=b, swing=abs(b - a), base=base))
        tornado.sort(key=lambda t: -t["swing"])
    warns = ["Undiscounted: no interest, inflation or residual value. Battery price is a user assumption."]
    if cens > 0:
        warns.append(f"{cens * 100:.0f}% of draws never reach the threshold within the horizon: their life is counted only to the horizon, so cost per km is an upper bound for them.")
    mk = lambda v: L(float(v), "INR/km", "derived")
    return CostResult(cost_per_km_p10=mk(q[0]), cost_per_km_p50=mk(q[1]), cost_per_km_p90=mk(q[2]),
                      battery_cost=L(price, "INR", "assumption", "pack kWh x price per kWh, both user inputs"),
                      lifetime_km_p50=L(float(np.percentile(km, 50)), "km", "derived"),
                      censored_fraction=L(cens, "fraction", "derived"), tornado=tornado, warnings=warns)
