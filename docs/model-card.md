# Model card (living document)

Status: Phase 2 in progress. Every number here is written from script output; see `engine/artifacts/`.

## Calendar ageing model (M2.1)

Form: `loss = exp(logA) * exp(-(Ea/R)(1/T - 1/Tref)) * g(SOC) * t_days^z`, retention = 1 - loss, Tref = 25 C, g(50 %) = 1, g piecewise linear on SOC 0/25/50/75/100 %.

Fitted on 97 storage series (80 Stanford LFP cells, 17 Naumann conditions), 6,198 observations, robust (soft-L1) least squares, each source weighted equally. Uncertainty: 500 bootstrap refits resampling series within each source.

| Parameter | Fitted | Bootstrap 5-95 % | Meaning |
|---|---|---|---|
| Ea | 33.6 kJ/mol | 32.4 to 34.8 | temperature sensitivity |
| z | 0.555 | 0.536 to 0.576 | time exponent (about square root) |
| exp(logA) | 0.00150 per day^z | 0.00126 to 0.00176 | loss rate at 25 C, 50 % SOC |
| g(0 %) | 0.32 | 0.25 to 0.35 | SOC stress relative to 50 % |
| g(25 %) | 0.59 | 0.47 to 0.64 | |
| g(75 %) | 1.00 | 1.00 to 1.04 | sits on its lower bound (see below) |
| g(100 %) | 1.15 | 1.11 to 1.21 | |

SOC stress is constrained to be non-decreasing (g0 <= g25 <= 1 <= g75 <= g100). Without the constraint the first fit put g(75 %) at 0.87, below g(50 %), because one Naumann series (40 C) shows slightly higher retention at 75 % than at 50 %. We treat that as measurement noise, so the fit now says "no extra stress from 50 to 75 %".

Fit quality: RMSE 0.021 in retention. Residuals reach about 0.07 (see `docs/figures/calendar_residuals.png`). Known weaknesses:
- The two labs disagree at 60 C: the model over-predicts Naumann loss there by up to 0.08 while fitting Stanford.
- SOC stress is shared across temperatures. At about 25 C and 100 % SOC the model predicts 0.925 retention after 885 days against 0.89 observed (Naumann), and 0.864 after 2,840 days against 0.818 observed (Stanford). The model is optimistic for ambient-temperature high-SOC storage. This matters for depot charging at 100 % and is a reason for wide bands (M3.1).
- The 75 % SOC node rests on a single lab condition.

Validity range: 0 to 85 C, 0 to 100 % SOC, storage only. Outside it the engine flags `extrapolated`. This model says nothing about cycling.

### Calendar model validation (M2.2)

Acceptance threshold fixed before running: mean absolute retention error below 0.05 inside the overlap of the two labs (24 to 60 C, SOC 50 or 100 %). No parameters were tuned to pass.

| Test | Mean abs. error (retention) | Notes |
|---|---|---|
| Fit Stanford, predict Naumann | 0.022 | 6 overlapping conditions, 204 points |
| Fit Naumann, predict Stanford | 0.034 | 6 conditions, 5,028 points; 0.021 when limited to the 885 days Naumann covers, so error grows when extrapolating in time |
| Leave one condition out, Stanford | mean 0.026, worst 0.058 | worst case: 85 C, 50 % SOC (edge of the data) |
| Leave one condition out, Naumann | mean 0.012, worst 0.041 | worst case: 60 C, 100 % SOC |

Result: threshold met (0.022 and 0.034). Reading: calendar behaviour transfers between labs to about 2 to 3 points of retention, but this is a small-scale check on 2 labs of storage tests only, and long-horizon extrapolation is worse. Numbers are in `engine/artifacts/metrics.json`.

## Cycle fade model (M2.3)

Form: `loss = exp(logB) * (C/C0)^k * exp(-(Eb/R)(1/T - 1/T0)) * EFC^m`, fitted on the 77 HUST cells (146,122 cycle observations, one temperature, 30 C). EFC is the cycle count.

| Item | Value | Status |
|---|---|---|
| m (fade exponent) | 1.91 | fitted, pooled over cells; fade accelerates (outside the 0.5 to 1.5 range I guessed in the playbook, which was wrong for this data) |
| exp(logB) | 1.4e-7 per EFC^m | fitted mean of per-cell scales |
| Between-cell spread | sigma(log B) = 0.37 | fitted; about 19 % relative spread in cycle life, matches the naive 17.7 % life error from Phase 0 |
| k (C-rate exponent) | 0 | NOT claimed. A regression gave k = -0.96 (higher C, less fade), which is the wrong sign for physics: protocols differ in several ways at once, so C-rate is confounded. It is stored as a diagnostic only. |
| Eb (temperature term) | 30 kJ/mol | ASSUMED mid-range value. HUST has one temperature, so no temperature effect on cycling is measured. Everything that depends on it must be labelled an assumption. |

Fit quality: with each cell's own scale B_i, RMSE 0.010 in fade (shape fits well). Predicting a new cell from the pooled mean scale gives RMSE 0.047, because cells differ a lot. All cells end at about 74 % of first-cycle capacity (end of test criterion), so what differs between cells is the time to get there.

Consequences for the product:
- Charge-rate what-ifs have no data-backed cycle effect in v1 (the UI must say so). Temperature effects on cycling are assumptions.
- Validity: 25 to 35 C, effective C-rate 1.79 to 2.82, EFC up to 2,689. Outside this the engine flags `extrapolated`.
- Calendar and cycle loss are added (assumed; not tested because no dataset has both separated).

## Early-life cycle-life predictor (M2.4)

Task: predict a cell's cycle life from its first 100 cycles. Leave-one-cell-out on 77 HUST cells, target log(life). Selection rule fixed in advance: the simplest model within one bootstrap standard error of the best.

| Model | Mean abs. % error | SE | Within 15 % |
|---|---|---|---|
| Mean only (naive) | 17.7 | 1.5 | 48 % |
| ElasticNet, capacity features (**selected**) | 12.7 | 1.1 | 64 % |
| ElasticNet + dQ(V), all discharge steps (Phase 0 version) | 13.6 | 1.3 | 57 % |
| ElasticNet + dQ(V), protocol-consistent discharge_3 step | 12.7 | 1.2 | 65 % |
| Gradient boosting, capacity features | 13.1 | 1.3 | 64 % |

Improvement of the selected model over the naive one: 5.0 percentage points (bootstrap 95 % interval 2.6 to 7.8), so it is real but modest. The protocol-consistent voltage-curve features tie with the simple model, so the simpler one is kept; gradient boosting is not better.

Features: capacity at cycle 1, capacity change between cycle 10 and 100, fade slope over cycles 10 to 100, minimum capacity in the first 100 cycles. Only cycles up to 100 are used (tested). Coefficients (scaled features): change 10 to 100 = -0.42, slope = +0.43, minimum capacity = +0.20, first-cycle capacity = -0.04. The first two are strongly collinear and nearly cancel, so read them as "the early fade rate matters", not as separate effects.

Limits: 77 cells, one cell type and batch, own split (not comparable with published benchmarks). Refuses input with fewer than 100 cycles.

## Uncertainty bands (M3.1)

Each prediction draws 2,000 (default; maximum 5,000) Monte Carlo samples: one bootstrap calendar parameter set, one bootstrap cycle parameter set, a lognormal calendar residual (sigma = 0.196, from leave-one-condition-out residuals) and a cell-to-cell scale effect on the cycle term (sigma(log B) = 0.37). The reported band is p10 to p90 of retention (nominal 80 %). Scenarios can share the same draws, so what-if differences are not simulation noise.

Coverage of the nominal 80 % band, checked by leaving data out:

| Part | Point-weighted coverage | Per-unit mean | Worst unit |
|---|---|---|---|
| Cycle, leave one cell out (77 cells, proper refit) | 72.5 % | 72.8 % | one cell fully outside |
| Calendar, leave one condition out | 79.6 % | 73.1 % | one condition fully outside |

Target was 70 to 90 %: met, but read with care. The calendar sigma is calibrated on the same out-of-fold residuals, so its 79.6 % is close to circular. The cycle number is a genuine test. Both coverages hide that some individual cells and conditions are missed entirely, which is what a 77-cell, one-batch dataset gives.

Extrapolation: when temperature, SOC, C-rate or cycle count leave the training range, both spreads are multiplied by 1.5. This factor is an ASSUMPTION, not measured.

Not modelled: correlation between calendar and cycle uncertainty (treated as independent), batch-to-batch variation, and any bus-specific effect.
