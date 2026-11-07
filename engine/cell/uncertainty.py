"""Monte Carlo retention bands (p10/p50/p90) from parameter bootstrap + residual spread.

Each draw picks one bootstrap calendar parameter set and one bootstrap cycle parameter set, then adds
(a) a lognormal calendar residual (sigma_cal, from leave-one-condition-out residuals) and
(b) a cell-to-cell scale effect on the cycle term (sigma_logB, between-cell spread).
Inputs outside the training range widen both spreads (assumed factor, see uncertainty.json).
Draws can be shared between scenarios so differences are not Monte Carlo noise (paired comparison).
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np

from engine.cell.calendar import R, SOC_NODES, TREF, VALID_SOC, VALID_T
from engine.cell.cycle import CycleParams
from engine.cell.cycle import is_extrapolated as cyc_extrap

MAX_DRAWS = 5000
PCT = (10, 50, 90)


@dataclass(frozen=True)
class Models:
    cal_draws: np.ndarray       # (n, 7): logA, Ea, z, g0, g25, g75, g100
    cyc_draws: np.ndarray       # (n, 4): logB, m, k, sigma
    cyc: CycleParams
    sigma_cal: float
    widen: float


@dataclass(frozen=True)
class Draws:
    cal_idx: np.ndarray
    cyc_idx: np.ndarray
    z_cal: np.ndarray
    z_cyc: np.ndarray

    @property
    def n(self) -> int:
        return len(self.cal_idx)


def load_models(art_dir: str = "engine/artifacts") -> Models:
    cal = json.load(open(f"{art_dir}/calendar_params.json"))
    cyc = json.load(open(f"{art_dir}/cycle_params.json"))
    unc = json.load(open(f"{art_dir}/uncertainty.json"))
    return Models(np.array(cal["bootstrap_draws"]), np.array(cyc["bootstrap_draws_logB_m_k_sigma"]),
                  CycleParams.from_dict(cyc["params"]), float(unc["sigma_cal"]), float(unc["extrapolation_widening"]))


def make_draws(n: int, models: Models, seed: int = 0) -> Draws:
    if not isinstance(n, (int, np.integer)) or n < 1:
        raise ValueError("n_draws must be a positive integer")
    if n > MAX_DRAWS:
        raise ValueError(f"n_draws must be <= {MAX_DRAWS}")
    rng = np.random.default_rng(seed)
    return Draws(rng.integers(0, len(models.cal_draws), n), rng.integers(0, len(models.cyc_draws), n),
                 rng.standard_normal(n), rng.standard_normal(n))


def simulate_loss(t_days, efc, temp_c: float, soc_pct: float, c_rate: float, models: Models, draws: Draws):
    """Return dict with total/calendar/cycle loss matrices (n_draws, T), and the extrapolation flag."""
    t = np.asarray(t_days, dtype=float)
    n = np.asarray(efc, dtype=float)
    if t.shape != n.shape or t.ndim != 1:
        raise ValueError("t_days and efc must be 1-D arrays of equal length")
    if np.any(t < 0) or np.any(n < 0):
        raise ValueError("time and EFC must be >= 0")
    if c_rate <= 0:
        raise ValueError("c_rate must be > 0")
    extrap = bool(not (VALID_T[0] <= temp_c <= VALID_T[1] and VALID_SOC[0] <= soc_pct <= VALID_SOC[1])
                  or cyc_extrap(n.max() if len(n) else 0.0, temp_c, c_rate, models.cyc))
    w = models.widen if extrap else 1.0
    T = temp_c + 273.15
    d = models.cal_draws[draws.cal_idx]                       # (D, 7)
    logA, Ea, z = d[:, 0], d[:, 1], d[:, 2]
    gvals = np.stack([d[:, 3], d[:, 4], np.ones(len(d)), d[:, 5], d[:, 6]], axis=1)
    g = np.array([np.interp(soc_pct, SOC_NODES, gv) for gv in gvals])
    rate = np.exp(logA) * np.exp(-(Ea / R) * (1.0 / T - 1.0 / TREF)) * g
    eps_cal = np.exp(w * models.sigma_cal * draws.z_cal)
    cal = (rate * eps_cal)[:, None] * t[None, :] ** z[:, None]
    c = models.cyc_draws[draws.cyc_idx]                       # (D, 4)
    logB = c[:, 0] + w * c[:, 3] * draws.z_cyc
    p = models.cyc
    tfac = np.exp(-(p.Eb / R) * (1.0 / T - 1.0 / (p.T0_c + 273.15)))
    cyc = (np.exp(logB) * (c_rate / p.C0) ** c[:, 2] * tfac)[:, None] * n[None, :] ** c[:, 1][:, None]
    tot = np.clip(cal + cyc, 0.0, 1.0)
    return dict(total=tot, calendar=cal, cycle=cyc, extrapolated=extrap)


def predict_retention(t_days, efc, temp_c, soc_pct, c_rate, n_draws: int = 2000, seed: int = 0,
                      models: Models | None = None, draws: Draws | None = None) -> dict:
    models = models or load_models()
    draws = draws or make_draws(n_draws, models, seed)
    sim = simulate_loss(t_days, efc, temp_c, soc_pct, c_rate, models, draws)
    ret = 1.0 - sim["total"]
    lo, mid, hi = np.percentile(ret, list(PCT), axis=0)   # retention percentiles: p10 <= p50 <= p90
    return dict(p10=lo, p50=mid, p90=hi, extrapolated=sim["extrapolated"], n_draws=draws.n)
