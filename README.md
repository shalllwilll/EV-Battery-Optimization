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
