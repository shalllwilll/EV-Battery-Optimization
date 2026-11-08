# Pack Horizon: E-Bus Battery Lifecycle Tool

College course project (non-commercial). Forecasts battery health and replacement timing for Indian city e-buses (12 m and 9 m, LFP packs, overnight depot charging), designed like a B2B decision tool. No client, city or operator is named.

![Overview: a 12 m bus with battery packs coloured by projected health](docs/figures/overview.jpg)

| | |
|---|---|
| ![Optimise: Bus A beside Bus B with changes applied](docs/figures/optimise.jpg) | ![Evidence: what vendor data would change](docs/figures/evidence-calibration.jpg) |

Screenshots are from the running app (Prior mode). Every number in them is a model output labelled "not yet validated on buses".

## Honesty rules
- Real, free public data only; no synthetic training data.
- Works standalone ("Prior mode") from public lab data plus clearly labelled assumptions.
- Every output is marked "not yet validated on buses".
- Vendor data may only calibrate, never be required. A working calibration method is demonstrated on public field data (Evidence page, `docs/calibration-interface.md`) but is deliberately not wired into the app.
- BMS-reported state of health is never treated as ground truth.

## Quick start
Needs Python 3.12 or newer and Node 20 or newer. The small trained model files are in the repository, so nothing has to be downloaded or trained to run the app.

```bash
git clone https://github.com/shalllwilll/EV-Battery-Optimization.git
cd EV-Battery-Optimization
scripts/setup_env.sh            # creates .venv and installs the Python dependencies
scripts/run_all.sh              # builds the frontend on first run, then serves app and API on http://localhost:8000
```

Sign in with the demo account (username `demo`, password `PackHorizon-2026`). `PORT=8010 scripts/run_all.sh` changes the port, `REBUILD=1` forces a frontend rebuild. The app runs fully offline and needs no data folder.

Optional: `scripts/fetch_data.sh` downloads the public datasets (see `data/README.md`, several GB) and `scripts/build_data.sh` plus `scripts/train_all.sh` rebuild every model file from them (`docs/reproducibility.md`).

## Tests
```bash
.venv/bin/python -m pytest -q                                                  # backend and engine
(cd frontend && npm test -- --run && npm run lint && npm run typecheck && npm run build)
```
Tests that need the downloaded datasets are skipped when `data/` is missing.

## Limits
Read these before quoting any number from the app. The full list is in `docs/model-card.md` and on the Evidence page.
- **No public data comes from LFP buses.** Everything labelled "bus" is a stated assumption: duty cycle, pack heating, pack-to-pack variation (an assumed 0 to 8 % extra loss) and the effect of temperature on range.
- **The cycling model probably over-states fade for buses.** The only cycling data (HUST, 77 cells) were run at about 2 C; a depot-charged bus works at about 0.2 C. The fitted model could not identify a charge-rate effect, so every result carries a warning.
- **Cycle-life error is about 12.7 %** (against 17.7 % for guessing the average) on held-out cells, so the app shows ranges, never a single date. The 80 % bands contain 72.5 % of cycling measurements and 79.6 % of storage measurements; some cells and conditions are missed entirely.
- **No public data cover cycling above 35 °C or idle time,** which matter for Indian summers. Outside the training range the bands are widened by an assumed factor of 1.5.
- **The calibration demonstration uses NMC-like cells, not LFP,** and compares against capacity labels the dataset authors derived, not measured values.
- **A demo, not a service.** One shared login, no database, no uptime or accuracy promise.

## Docs
- `docs/software-design-document.md` design and decisions (with deviations marked), `docs/model-card.md` models and their measured errors
- `docs/phase0-report.md` what the public data can and cannot support, `docs/data-attribution.md` credits and licences
- `docs/calibration-interface.md`, `docs/accessibility.md`, `docs/security-review.md`, `docs/performance.md`, `docs/reproducibility.md`
- `docs/phase-checkpoints.md` and `CHANGELOG.md` what changed at each checkpoint, `docs/development-playbook.md` the build plan

## Licence and authorship
No licence has been granted: the code is visible here but all rights are reserved by the author. The datasets keep their own licences (`docs/data-attribution.md`). All commits are by the repository owner.

## Backend API (Phase 4)

```bash
scripts/dev_backend.sh          # http://localhost:8000, interactive docs at /docs
scripts/smoke_api.sh            # starts a throwaway server and checks every endpoint
.venv/bin/python scripts/export_openapi.py   # regenerate docs/openapi.json after any API change
```

Endpoints under `/api/v1`: `GET /health` and `POST /auth/login` (public); `GET /auth/me`, `GET /presets`, `GET /zones`, `GET /evidence`, `POST /predict`, `POST /compare` and `POST /recommend` (sign-in required).
`/recommend` searches charge cap and charging start time (plus cooling and energy use as a separate "needs confirmation" step) for five goals, and keeps every suggestion inside the route-plus-20 %-reserve rule.
Every number in a prediction carries `{value, unit, evidence_level, validated_on_buses: false}`; responses state `mode: "prior"`.
Settings (all optional): `EV_ALLOWED_ORIGINS`, `EV_MAX_BODY_BYTES`, `EV_ARTIFACT_DIR`, and the demo-login settings `EV_AUTH_REQUIRED`, `EV_DEMO_USER`, `EV_DEMO_PASSWORD`, `EV_AUTH_SECRET`, `EV_TOKEN_TTL_S` (see `.env.example`).

**Demo login** (one account, no sign-up): username `demo`, password `PackHorizon-2026`. Change `EV_DEMO_PASSWORD` before showing a hosted copy to anyone outside the course. Without `EV_AUTH_SECRET` the server signs tokens with a random per-process key, so sign-ins end when it restarts. See `docs/security-review.md`.

## Frontend (Phases 5 and 6)

React 18 + TypeScript + Vite. The 3D bus is drawn in code with react-three-fiber (no model files, so no licences and no loading).

```bash
scripts/dev_backend.sh                         # API on :8000 (PORT=8010 scripts/dev_backend.sh if 8000 is taken)
cd frontend && npm install
npm run dev                                    # http://localhost:5173, /api is proxied to the backend (EV_API_PORT=8010 to match)
npm run lint && npm run typecheck && npm test -- --run && npm run build
npm run gen:api                                # regenerate API types and form limits after docs/openapi.json changes
```

Pages: **Overview** (full-screen 3D bus with battery packs coloured by projected health; year scrubber; scenario and view settings open from a side dock), **Health**, **Replacement**, **Range**, **Cost**, **Optimise** (full-screen two-bus 3D; Bus B is Bus A with changes you choose, plus goal presets from `/recommend`, all in drawers), **Evidence**.
The scenario panel on the left is shared by every page. Bus A can be typed in or imported from a CSV (`frontend/public/samples/sample-fleet-duty-ILLUSTRATIVE.csv` is a made-up example for trying the import; it is not real fleet data and is never used for training).
Keyboard shortcuts in the 3D view: 1-5 camera, S body, C wheels, P packs, L labels, D length, E pull apart, F charging flow, X scan, I isolate, Esc clear.
The 3D view needs WebGL; without it a plain card is shown and every number is still available in the cards and tables.
