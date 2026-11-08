# Performance (Phase 8.2)

Measured on the development laptop (Apple silicon, other applications running), in-process with no network, by `python scripts/perf_check.py`.

| Check | Result | Budget |
|---|---|---|
| `/predict`, 50 sequential calls, 2,000 simulated packs, a different scenario each time so the response cache cannot help | median 0.07 s, p95 0.08 s, max 0.08 s | p95 under 2 s |
| 20 parallel workers × 5 calls (100 requests) | all 200, zero 5xx, slowest request 1.7 s, 3.3 s wall | zero 5xx |
| Frontend first load (built) | app code 85 kB gzipped; the 3D scene (three.js, 240 kB gzipped) loads only on Overview and Optimise | no hard budget set |

Notes
- The 1.7 s slowest request under 20-way parallel load is requests queueing behind each other on one process, not a slow request; one call alone takes under 0.1 s.
- **Lighthouse was not run.** It needs a headless Chrome and a download of the tool. Bundle size and load behaviour are reported above instead. Run `npx lighthouse http://localhost:8000 --preset=desktop` against the packaged app (Phase 8.3) if a score is wanted.
- These numbers are from one machine and one run. They show the budget is met with a wide margin, not a guaranteed figure for other hardware.
