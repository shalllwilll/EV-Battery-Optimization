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

Endpoints under `/api/v1`: `GET /health`, `GET /presets`, `GET /zones`, `GET /evidence`, `POST /predict`, `POST /compare`.
Every number in a prediction carries `{value, unit, evidence_level, validated_on_buses: false}`; responses state `mode: "prior"`.
Settings (all optional): `EV_ALLOWED_ORIGINS`, `EV_MAX_BODY_BYTES`, `EV_ARTIFACT_DIR` (see `.env.example`).
