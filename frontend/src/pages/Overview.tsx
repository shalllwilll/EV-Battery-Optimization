import { lazy, useState } from 'react'
import { ErrorState, Skeleton } from '../components/Async'
import { Dock, DockButton, Drawer, DOCK_PX, Immersive, StatStrip, useWide } from '../components/Overlay'
import { BusLetter, IconView } from '../components/Icons'
import { ScenarioPanel } from '../components/ScenarioPanel'
import { StatusBar } from '../components/StatusBar'
import { YearScrubber } from '../components/YearScrubber'
import { arr, atYear, fmt, inr, num } from '../lib/format'
import { curves, repYears, xMaxFor } from '../lib/results'
import { useScenario } from '../state/ScenarioContext'
import { useCurrent } from '../state/useCurrent'
import { useYear } from '../state/YearContext'
import type { BusSpec } from '../three/BusStage'
import { Legend } from '../three/Legend'
import { PackInspector } from '../three/PackInspector'
import { ViewPanel } from '../three/ViewPanel'
import { useViewState } from '../three/viewState'

const BusViewer = lazy(() => import('../three/BusViewer').then((m) => ({ default: m.BusViewer })))
type Panel = 'bus' | 'view' | null
const WIDTH: Record<Exclude<Panel, null>, number> = { bus: 340, view: 300 }

export default function Overview() {
  const { q, scenario } = useCurrent()
  const { valid, errors } = useScenario()
  const { year } = useYear()
  const [view, api] = useViewState('iso')
  const wide = useWide()
  const [panel, setPanel] = useState<Panel>(null)
  const shown: Panel = valid ? panel : 'bus'
  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p))
  const lengthM = scenario.archetype === '9m' ? 9 : 12
  const inset = wide && shown ? DOCK_PX + WIDTH[shown] : 0
  const p = valid ? q.data : undefined

  let stats: Parameters<typeof StatStrip>[0]['stats'] = []
  let buses: BusSpec[] = []
  let c: ReturnType<typeof curves> | null = null
  let xMax = 8, y = 0, r: ReturnType<typeof repYears> = [null, null, null]
  const line = scenario.threshold * 100
  if (p) {
    c = curves(p.replacement); xMax = xMaxFor(p); r = repYears(p.replacement); y = Math.min(year, xMax)
    const at = (a: number[]) => atYear(a, y)
    const nw = num(p.range.new_pack_range_km) ?? 0, med = num(p.cost.cost_per_km_p50)
    buses = [{ key: 'a', label: 'Your bus', healthPct: at(c.p50), offsetZ: 0 }]
    stats = [
      { label: `Health at year ${y.toFixed(1)}`, value: fmt(at(c.p50), 1), unit: '%', sub: `Likely ${fmt(at(c.p10), 0)}% to ${fmt(at(c.p90), 0)}%` },
      { label: 'Replace around', value: r[1] == null ? '–' : fmt(r[1], 1), unit: 'years', sub: r[0] == null ? 'Beyond the forecast' : `Earliest ${fmt(r[0], 1)}${r[2] == null ? '' : `, latest ${fmt(r[2], 1)}`}` },
      { label: 'Range on a full charge', value: fmt(nw * atYear(arr(p.replacement.retention_p50), y)), unit: 'km', sub: `${fmt(nw)} km when new` },
      { label: 'Battery cost per km', value: med == null ? '–' : inr(med), unit: med == null ? undefined : '/ km', sub: med == null ? 'Enter a battery price' : 'Median, your price input' },
    ]
  }
  const healthNow = c ? atYear(c.p50, y) : 0
  const rows = c ? [{ label: 'Health', p10: atYear(c.p10, y), p50: healthNow, p90: atYear(c.p90, y) }] : []

  const stage = valid && p
    ? <BusViewer buses={buses} lengthM={lengthM} linePct={line} view={view} api={api} insetLeft={inset}
        ariaLabel={`3D ${lengthM} metre electric bus with battery packs coloured by projected health, ${fmt(healthNow, 0)} percent at year ${y.toFixed(1)}`} />
    : <div className="skel full" aria-busy="true" aria-label="Loading…" />

  return (
    <Immersive stage={stage}>
      <div className="imm-top">
        <div className="imm-tl">
          <StatusBar compact />
          <Dock>
            <DockButton label="Bus A" active={shown === 'bus'} onClick={() => toggle('bus')}><BusLetter l="A" /></DockButton>
            <DockButton label="View" active={shown === 'view'} onClick={() => toggle('view')}><IconView /></DockButton>
          </Dock>
        </div>
        <div className="imm-tr">
          {p && <StatStrip stats={stats} />}
          <PackInspector selected={view.selected} rows={rows} year={y} isolate={view.isolate} onIsolate={api.toggleIsolate} onClose={() => api.select(null)} />
        </div>
      </div>

      <Drawer open={shown === 'bus'} title="Bus A · your scenario" width={WIDTH.bus} onClose={() => setPanel(null)}>
        {!valid && <p className="note" role="alert">Fix {Object.keys(errors).length} input{Object.keys(errors).length > 1 ? 's' : ''} to run the model: {Object.keys(errors).join(', ')}.</p>}
        <ScenarioPanel drawer />
      </Drawer>
      <Drawer open={shown === 'view'} title="View" width={WIDTH.view} onClose={() => setPanel(null)}>
        <ViewPanel view={view} api={api} />
      </Drawer>

      {valid && !p && q.error != null && <div className="imm-center"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>}
      {valid && !p && q.error == null && <div className="imm-center" aria-hidden="true"><Skeleton h={60} /></div>}

      {p && c && (
        <div className="imm-bottom">
          {!view.selected && <p className="imm-hint">Click a battery pack for its health · drag to turn · scroll to zoom</p>}
          <div className="imm-row">
            <YearScrubber p10={c.p10} p50={c.p50} p90={c.p90} thresholdPct={line} xMax={xMax} win={[r[0], r[2]]} />
            <Legend linePct={line} />
          </div>
        </div>
      )}
    </Immersive>
  )
}
