# E-Bus Battery Lifecycle Intelligence Tool

College course project (non-commercial). Forecasts battery health and replacement timing for Indian city e-bus fleets (LFP packs), designed like a B2B decision tool.

**Status:** under construction. See `docs/software-design-document.md` for the design and `docs/development-playbook.md` for the build plan.

## Honesty rules
- Real, free public data only; no synthetic training data.
- Works standalone ("Prior mode") from public lab data plus clearly labelled assumptions.
- Every output is marked "not yet validated on buses".
- Vendor data may only calibrate, never be required.

## Data
Datasets are not included in this repository (size and licences). See `data/README.md` for sources and how to fetch them.

## Docs
- `docs/phase0-report.md` - what the public data can and cannot support
- `docs/software-design-document.md` - architecture and models
- `docs/development-playbook.md` - milestone-by-milestone build and test plan

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

**Demo login** (one account, no sign-up): username `demo`, password `PackHorizon-2026`. Change `EV_DEMO_PASSWORD` and `EV_AUTH_SECRET` before showing this to anyone outside the course.

## Frontend (Phases 5 and 6)

React 18 + TypeScript + Vite. The 3D bus is drawn in code with react-three-fiber (no model files, so no licences and no loading).

```bash
scripts/dev_backend.sh                         # API on :8000 (PORT=8010 scripts/dev_backend.sh if 8000 is taken)
cd frontend && npm install
npm run dev                                    # http://localhost:5173, /api is proxied to the backend (EV_API_PORT=8010 to match)
npm run lint && npm run typecheck && npm test -- --run && npm run build
npm run gen:api                                # regenerate API types and form limits after docs/openapi.json changes
```

Pages: **Overview** (3D bus with battery packs coloured by projected health, year scrubber), **Health**, **Replacement**, **Range**, **Cost**, **Optimise** (two buses in 3D; Bus B is Bus A with changes you choose, plus goal presets from `/recommend`), **Evidence**.
The scenario panel on the left is shared by every page. Bus A can be typed in or imported from a CSV (`frontend/public/samples/sample-fleet-duty-ILLUSTRATIVE.csv` is a made-up example for trying the import; it is not real fleet data and is never used for training).
Keyboard shortcuts in the 3D view: 1-5 camera, S body, C wheels, P packs, L labels, D length, E pull apart, F charging flow, X scan, I isolate, Esc clear.
The 3D view needs WebGL; without it a plain card is shown and every number is still available in the cards and tables.
