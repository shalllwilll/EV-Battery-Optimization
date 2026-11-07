# Phase checkpoints

Records of each phase's completion checkpoint (the tables in `docs/development-playbook.md` stay as blank templates).
Only Phase 4 is recorded here so far; earlier phases are identifiable by their `cp-*` git tags.

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
