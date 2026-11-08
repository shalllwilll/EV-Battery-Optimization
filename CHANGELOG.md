# Changelog

Each entry is a git tag (`git show cp-x.y`). Numbers quoted here are the ones in `engine/artifacts/metrics.json` and `docs/model-card.md`.

## Interface redesign (after v1.0.0)
- Removed the status chips ("Prior mode", "Not yet validated on buses", "Outside lab data", "Service online") and the "assumption" tags on scenario inputs. The not-validated statement stays in the page footer, on the Evidence page, in hover text and in every API number.
- The scenario inputs on Health, Replacement, Range and Cost are a slide-out drawer opened from a "Scenario" button; they open by themselves when an input is invalid.
- Larger key-number panels, set lower under the navigation bar. On Optimise, "Change Bus B to compare" appears once.
- Optimise comparison: Health / Difference colouring (Bus A grey, Bus B red to yellow by health difference), delta badges on Bus B, a "Bus B changes" bar, a two-curve timeline with replacement markers, and a one-off pulse when a new result arrives.
- Label colour is the brand yellow. The README screenshots show the earlier layout.

## BLAST-Lite cross-check (after v1.0.0)
- New Evidence card: our cell model against two public LFP models from NREL's BLAST-Lite on identical bus duty cycles (10 scenarios), a loss split into calendar and cycling, and same-condition storage and cycling runs. Generated offline by `scripts/crosscheck_blast.py` into `engine/artifacts/crosscheck_blast.json`; `/evidence` serves it as `crosscheck` (null if the file is absent). BLAST-Lite is not an app dependency.
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
