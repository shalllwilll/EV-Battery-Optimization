# Changelog

Each entry is a git tag (`git show cp-x.y`). Numbers quoted here are the ones in `engine/artifacts/metrics.json` and `docs/model-card.md`.

## Analysis pages as instruments (after v1.0.0)
- Health, Replacement, Range and Cost each lead with one interactive picture and a one-line insight built from the page's own numbers, with a "Try it" button where a lever applies. Frontend only: no API changes.
- **Cost lab**: cost per km against battery price (10th to 90th percentile band), draggable price marker that sets the scenario price, a target cost per km with the break-even price, "Pack cost per year of life", and a tornado whose bars show the cheaper and dearer case with a "Try the cheaper case" button. Cost per run is pack price over km, so every percentile scales exactly with the battery price; `tests/test_cost_scaling.py` locks that. Threshold and km per day are never extrapolated: they come back from `/predict`.
- **Route fit** (Range): a road meter of range now (median and cautious) against the route plus 20 % reserve, a draggable route flag that sets km per day, and range over the years with the shortfall shaded. Range at any age is new-pack range times the health curve.
- **Replacement planner**: fifty dots, each 2 % of the model's runs, placed where that run reaches the line, with a "beyond the forecast" pile; a fleet planner (fleet size kept in this browser) turning the same spread into expected replacements per year and undiscounted first-pack spend. Assumes independent buses and one replacement each.
- **Ageing lab** (Health): 96 rings drained by the shared year with play, a one-day strip (drive, charge, rest full), a twelve-month cell temperature ring, and warnings moved into the shared Notes list. The waiting / cycling split is the share at replacement applied to the loss, not a time series.
- **Try a change** bar on each page: sliders for the levers that page cares about draw a ghost (hollow dots, dashed line, "was" values) and a life-change chip from a second `/predict`. The real scenario is never modified. "See it on the bus" links open the 3D page on the matching lens.
- Everything stays labelled not yet validated on buses.

## 3D views as instruments (after v1.0.0)
- Four lenses on both 3D pages (Ageing, Charge, Heat, Range; keys A, G, T, R), one at a time so the scene stays clear.
- Ageing: every battery cell is a ring that drains as the years pass. Lit arc = capacity left (median at that year), slate = lost to calendar ageing, umber = lost to cycling (split from the model's driver shares), white tick = replacement line, faint outer arc = the 10th to 90th percentile range. Cell-to-cell spread is illustrative scatter inside that range, not measured per cell. Cells below the replacement line glow orange (steady; a pulse there read as screen flicker).
- A depot charger beside each bus with a thin cable to the charge port; light pulses speed up with charger power. Pack thickness steps with pack energy.
- Charge lens: 24-hour day animation (drive, charge, rest) shared by both buses, a client port of the engine's day profile; rings show state of charge with ticks for the cap and minimum; a hatched bar means charging does not finish before departure.
- Heat lens: ring colour from the model's cell temperature, rising motes scaled by pack warmth. Range lens: a ground ruler of range on a full charge against the route plus 20 % reserve, with the shortfall in amber.
- Warnings moved off the bus: a Notes drawer (Needs attention, Outside the tested range, Good to know) with a count on the dock; the red overlays on Optimise are gone. An amber dot on the bus label marks items needing attention.
- Optimise: hovering a "Bus B changes" chip highlights the matching part of Bus B, a one-line insight (time resting full, battery life), and a small replacement-year bar on each bus label.
- Look: bloom and vignette (dropped automatically if the frame rate falls), soft depot floor and ground shadow, hover text on packs.
- Not yet validated on buses, like every number here. New dependencies: `@react-three/postprocessing`, `postprocessing`.

## NREL BLAST-Lite is now the engine (after v1.0.0)
- The app's capacity curves, replacement timing, range, cost and recommendations now come from a Python port of NREL's two LFP cell models (`engine/reference/`, notice in `engine/reference/NOTICE`). Our own laboratory-fitted model is kept in the code behind `EV_ENGINE=lab` and is no longer shown.
- Why: the cross-check below found our fit the most pessimistic in every scenario (4 to 5 year replacement) against NREL models and published EV-battery lifetimes of 10 to 15 years. Default 12 m hot-dry bus is now about 12 years (10th percentile about 8; 90th beyond the 15-year horizon).
- Each result is 50 runs (2 models x 5 degradation scalars x 5 pack penalties); the range is a spread of models, not a confidence interval. Pack penalty default is now 20 to 30 % (was 0 to 8 %).
- Port checked against package outputs: largest gap 0.47 points of capacity on bus scenarios, 0.005 on fixed conditions (`engine/artifacts/reference_port_check.json`).
- Evidence page rewritten around the NREL models, their tested ranges and the port check; the old cross-check card and the lab-model accuracy figures are gone. `/evidence` now returns `reference_engine` and `engine`, and no longer returns `crosscheck`.
- Replacement months at the 10th, 50th and 90th percentile come from the percentile retention curves, shared by Predict, Compare and Recommend. A percentile beyond the horizon is returned as null.
- Uncached prediction is slower (about 0.2 s against 0.07 s locally).

## Interface redesign (after v1.0.0)
- Removed the status chips ("Prior mode", "Not yet validated on buses", "Outside lab data", "Service online") and the "assumption" tags on scenario inputs. The not-validated statement stays in the page footer, on the Evidence page, in hover text and in every API number.
- The scenario inputs on Health, Replacement, Range and Cost are a slide-out drawer opened from a "Scenario" button; they open by themselves when an input is invalid.
- Larger key-number panels, set lower under the navigation bar. On Optimise, "Change Bus B to compare" appears once.
- Optimise comparison: Health / Difference colouring (Bus A grey, Bus B red to yellow by health difference), delta badges on Bus B, a "Bus B changes" bar, a two-curve timeline with replacement markers, and a one-off pulse when a new result arrives.
- Label colour is the brand yellow. The README screenshots show the earlier layout.

## BLAST-Lite cross-check (after v1.0.0)
- (Card since removed: see the entry above.) New Evidence card: our cell model against two public LFP models from NREL's BLAST-Lite on identical bus duty cycles (10 scenarios), a loss split into calendar and cycling, and same-condition storage and cycling runs. Generated offline by `scripts/crosscheck_blast.py` into `engine/artifacts/crosscheck_blast.json`; `/evidence` serves it as `crosscheck` (null if the file is absent). BLAST-Lite is not an app dependency.
- Finding: our model is the most pessimistic of the three in every scenario (12 m hot-dry, 10 years: 40 % retained against 82 to 88 %). Calendar ageing is in the same range as the two BLAST-Lite models (which differ 2 to 3× from each other); the gap is in cycling beyond about 1,000 cycles. The default replacement timing is probably early. The model itself was not changed.

## v1.0.0
First release. Prior mode only: models trained on public laboratory data, every output marked "not yet validated on buses". Adds the release documentation (README with screenshots, `docs/data-attribution.md`, this changelog) and the claims audit of the README against the stored metrics.

## Phase 8: hardening and release
- **cp-8.3, cp-8.3.1** `scripts/run_all.sh` serves the API and the built app on one port; single-page-app fallback, hashed-asset caching and path-traversal protection; works offline and without the `data/` folder. (`cp-8.3` shipped with two older tests failing because of the new catch-all route; `cp-8.3.1` fixes the tests.)
- **cp-8.2** Security headers on every response; the token key no longer has a public default; `pip-audit`, `npm audit --omit=dev` and `gitleaks` clean; `/predict` p95 0.08 s. See `docs/security-review.md`, `docs/performance.md`.
- **cp-8.1, cp-8.1.1** Accessibility: axe scans on every page (0 violations after fixes), skip link, landmarks, heading order, drawer focus handling, phone overflow, reduced motion. (`cp-8.1` shipped a stylesheet typo that broke the production build; `cp-8.1.1` fixes it.) See `docs/accessibility.md`.

## Phase 7: evidence and calibration
- **cp-7.2** Calibration method demonstration on EVBattery (`engine/calibrate/`, `docs/calibration-interface.md`): capacity error 2.19 % with no vendor labels, 1.55 % with 5, 1.41 % with 100. Shown on the Evidence page with the not-LFP caveat.

## Phase 6: 3D views
- **cp-6.5** Overview and Optimise became full-screen 3D scenes with a dock, side drawers, a key-number strip and the year scrubber floating over them.
- **cp-6.4** Removed the small label above page headings.
- **cp-6.3** Visual polish of the 3D views and the Optimise page.
- **cp-6.2** Procedural 3D bus with battery packs coloured by projected health; two-bus Optimise compare with live Bus B sliders and five goal presets from `/recommend`.

## Phase 5: frontend
- **cp-5.3** React frontend: sign-in, floating glass navigation, scenario panel with CSV import, Health, Replacement, Range, Cost and Evidence pages.

## Phase 4: API
- **cp-4.4** `/recommend` goal presets from a search over charge cap and charging start time; demo login with signed tokens; route-feasibility rule (range at replacement at least the route plus 20 %).
- **cp-4.3** Complete API: `/presets`, `/zones`, `/evidence`, `/compare`.
- **cp-4.2** `/predict` with labelled values (`value`, `unit`, `evidence_level`, `validated_on_buses: false`).
- **cp-4.1** FastAPI skeleton, uniform errors, body-size limit.

## Phase 3: decisions
- **cp-3.4** Range, cost per km and charging what-ifs on shared random draws.
- **cp-3.3** Replacement-window Monte Carlo (2,000 draws).
- **cp-3.2** Bus translation: duty cycle to cell conditions, with real weather for four climate zones.
- **cp-3.1** Uncertainty: bootstrap plus split-conformal bands (80 % band contains 72.5 % of cycling and 79.6 % of storage measurements).

## Phase 2: cell models
- **cp-2.4** Early-life cycle-life predictor: 12.7 % error against 17.7 % for guessing the average, on 77 held-out cells.
- **cp-2.3** Cycle-ageing model fitted on HUST.
- **cp-2.2** Calendar model validated across labs (fit one, predict the other).
- **cp-2.1** Calendar-ageing model fitted on Stanford and Naumann storage data.

## Phase 1: data
- **cp-1.3** EVBattery charging snippets processed for the calibration demonstration.
- **cp-1.2** NASA POWER weather for four climate zones.
- **cp-1.1** Laboratory datasets ingested with provenance.

## Phase 0: groundwork
- **cp-0.3** Phase 0 baselines reproducible. **cp-0.2** Environment and project skeleton. **cp-0.1** Repository initialised.
