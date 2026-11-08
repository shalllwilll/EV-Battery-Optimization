import { lazy, Suspense } from 'react'
import { Async, Skeleton } from '../components/Async'
import { YearScrubber } from '../components/YearScrubber'
import { Page } from '../components/Workspace'
import { arr, atYear, fmt, inr, num } from '../lib/format'
import { curves, repYears, xMaxFor } from '../lib/results'
import { useCurrent } from '../state/useCurrent'
import { useYear } from '../state/YearContext'
import { useViewState } from '../three/viewState'
import type { BusSpec } from '../three/BusStage'

const BusViewer = lazy(() => import('../three/BusViewer').then((m) => ({ default: m.BusViewer })))

export default function Overview() {
  const { q, scenario } = useCurrent()
  const { year } = useYear()
  const [view, api] = useViewState('iso')
  const lengthM = scenario.archetype === '9m' ? 9 : 12
  return (
    <Page title="Your bus, year by year" intro="Move the year to watch the battery packs change colour as the model projects their health. Yellow is healthy, orange is the replacement line, red is past it.">
      <Async q={q} h={640}>{(p) => {
        const c = curves(p.replacement), xMax = xMaxFor(p), r = repYears(p.replacement), y = Math.min(year, xMax)
        const at = (a: number[]) => atYear(a, y)
        const buses: BusSpec[] = [{ key: 'a', label: 'Your bus', healthPct: at(c.p50), offsetZ: 0 }]
        const nw = num(p.range.new_pack_range_km) ?? 0, med = num(p.cost.cost_per_km_p50)
        const line = scenario.threshold * 100
        return (
          <>
            <div className="kstrip">
              <div className="kcard"><small>Health at year {y.toFixed(1)}</small><div className="kv">{fmt(at(c.p50), 1)}<span>%</span></div><div className="ks">Likely {fmt(at(c.p10), 1)}% to {fmt(at(c.p90), 1)}%</div></div>
              <div className="kcard"><small>Replace around</small><div className="kv">{r[1] == null ? '–' : fmt(r[1], 1)}<span>years</span></div><div className="ks">{r[0] == null ? 'Beyond the forecast' : `Earliest ${fmt(r[0], 1)}${r[2] == null ? '' : `, latest ${fmt(r[2], 1)}`} years`}</div></div>
              <div className="kcard"><small>Range on a full charge</small><div className="kv">{fmt(nw * atYear(arr(p.replacement.retention_p50), y))}<span>km</span></div><div className="ks">{fmt(nw)} km when new</div></div>
              <div className="kcard"><small>Battery cost per km</small><div className="kv">{med == null ? '–' : inr(med)}<span>/ km</span></div><div className="ks">{med == null ? 'Enter a battery price' : 'Median, your price input'}</div></div>
            </div>
            <div className="card c12" style={{ padding: 16 }}>
              <Suspense fallback={<Skeleton h={600} />}>
                <BusViewer buses={buses} lengthM={lengthM} linePct={line} view={view} api={api} year={y} height={560}
                  rows={[{ label: 'Health', p10: at(c.p10), p50: at(c.p50), p90: at(c.p90) }]}
                  ariaLabel={`3D ${lengthM} metre electric bus with battery packs coloured by projected health, ${fmt(at(c.p50), 0)} percent at year ${y.toFixed(1)}`} />
              </Suspense>
            </div>
            <div style={{ marginTop: 16 }}>
              <YearScrubber p10={c.p10} p50={c.p50} p90={c.p90} thresholdPct={line} xMax={xMax} win={[r[0], r[2]]} />
            </div>
          </>
        )
      }}</Async>
    </Page>
  )
}
