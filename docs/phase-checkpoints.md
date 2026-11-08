# Phase checkpoints

Records of each phase's completion checkpoint (the tables in `docs/development-playbook.md` stay as blank templates).
Phases 4 to 6 are recorded here so far; earlier phases are identifiable by their `cp-*` git tags.

## Phase 4: Backend API (complete)

| Item | Record |
|---|---|
| Completed milestones | 4.1 skeleton (`cp-4.1` = 3d61e30), 4.2 `/predict` (`cp-4.2` = bc8aab1), 4.3 compare/presets/zones/evidence (`cp-4.3` = ca6ddc7) |
| Tests passed | 181 / 181 in the whole repository (65 of them are API tests: 17 skeleton, 32 predict, 16 reference) |
| Overall verification | `scripts/smoke_api.sh` passes against a live server; `uvicorn` starts in about 0.5 s; `/docs` loads; chunked and Content-Length oversized bodies give 413 on a live server |
| Go/No-Go | **GO**: `docs/openapi.json` is generated from the app and a test fails if it drifts; the label-coverage test passes for both archetypes in all four zones |

### Deviations from the playbook (all intentional)
- Routes live in one file `backend/app/routes.py` (not a `routes/` package) and API tests are in `tests/test_api_*.py` (not `backend/tests/`), to keep one pytest root.
- The playbook says 413 for oversized bodies; the limit is a streaming ASGI middleware so it also covers chunked uploads, which a Content-Length check alone misses.
- Added an optional `mode` request field so an unsupported mode returns 400 (SDD section 6.2); only `"prior"` exists in v1.
- T4.3-3 needed the EVBattery capacity error in `metrics.json`; added `engine/train/fit_evb_baseline.py` (run by `scripts/train_all.sh`) which stores it. It reproduces Phase 0 (2.50 % mileage only, 2.30 % with snippet features; the Phase 0 report quotes 2.29 % from truncation).
- `/evidence`, `/presets` and `/zones` read their files on every request, so a changed `metrics.json` shows up without a restart (T4.3-8). `model_version` and `/health` hashes are taken at startup.

### Known issues carried into the frontend phases
- No authentication (by design); the prediction cache is in memory and per process.
- Unhandled-exception 500 responses come from Starlette's outermost handler, which sits outside CORS: a browser may show them as a CORS error instead of the JSON message. The frontend error UI should treat a failed fetch with no response as "server error".
- Requests with a horizon shorter than the time to threshold produce percentile warnings from numpy (harmless; the API returns `null` for percentiles beyond the horizon).
- Port 8765 was occupied by an unrelated local Python process during testing; `smoke_api.sh` now picks a free port.


## Phase 4.4: `/recommend` and demo login (complete, `cp-4.4`)

| Item | Record |
|---|---|
| What was added | `POST /recommend` (goal presets from a search over charge cap and charging start time, with a separate "needs confirmation" step for cooling and energy use); bearer-token demo login (`/auth/login`, `/auth/me`) with a login rate limit |
| Tests passed | 200 / 200 in the whole repository |
| Go/No-Go | **GO** |

### Findings that shaped the design
- **Levers were chosen from measured effect, not guessed.** Charge cap and charging start time move battery life in the model; charger power moves it by at most 0.2 months (the cycling data show no charge-speed effect); minimum charge has no depth-of-discharge effect in the training cells, so it would look free and is never suggested; daily distance is a service level. The last three are listed in the response as `not_used`, with reasons.
- **The default 12 m bus (200 km a day, 350 kWh) fails the 20 % reserve rule on its own**: about 210 km of range at replacement against 240 km needed. When Bus A already fails, suggestions are held to Bus A's own range and the UI says so in plain words.
- **Several goals can land on identical advice** on a range-tight route. The API returns `same_as` and the UI shows a short pointer instead of repeated cards.

## Phase 5 and 6: Frontend (complete for the build; visual polish is a separate pass)

| Item | Record |
|---|---|
| Completed milestones | 5.1-5.3 scaffold, login, floating glass nav, scenario panel with CSV import, Health / Replacement / Range / Cost / Evidence (`cp-5.3`); 6.x 3D Overview and Optimise compare (`cp-6.2`) |
| Tests passed | 82 frontend tests (colour ramp, Bus B overrides and preset helpers on the real `/recommend` result, wording helpers, page tests including the Optimise flow and the no-WebGL fallback) |
| Checks | `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build` all clean; checked live against the backend in the browser pane at desktop width and 390 px |

### Deviations from the SDD and playbook (all intentional)
- **Plain CSS with design tokens instead of Tailwind.** The visual design is a small set of hand-tuned tokens and a custom glass navigation bar; a utility framework added more than it saved.
- **Charts are custom SVG, not Recharts or visx** (this closes the open item in SDD section 13). The charts need a shared year crosshair, tweening between scenarios and a table alternative for every chart, which was simpler to build directly than to bend a library to.
- **No zustand.** React context for scenario, year and sign-in, plus react-query for every API call, was enough.
- **The 3D chunk is large (about 240 kB gzipped)** because of three.js. It is loaded only on Overview and Optimise; the rest of the app is under 100 kB gzipped. `chunkSizeWarningLimit` is raised for that one chunk.

### Honest limits of the 3D view
- The model predicts one health figure for the whole pack, so every module shows the same colour. The inspector says this. Module layout and the cell grid are a schematic, not a real design.
- The roof air-conditioning unit is drawn for context only; the model has no air-conditioning data.
- On the Optimise page, Bus B's slider changes are checked against the engine's own warnings (for example "charging not finished before departure") and against the route rule, and both are shown in plain words.

### Known issues carried into the next phases
- Visual polish is still to do (the user asked for a separate pass once the build is complete).
- Accessibility audit, `npm audit` and packaging (Phase 8) are not done yet.
- The calibration demo on the Evidence page is deferred (Phase 7).
- Docker is not installed on the development machine, so optional container packaging is untested.
