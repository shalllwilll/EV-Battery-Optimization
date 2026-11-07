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
