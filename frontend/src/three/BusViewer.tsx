import { Suspense, useRef, useState } from 'react'
import BusStage, { StageBoundary, type BusSpec } from './BusStage'
import { PackInspector, type InspectRow } from './PackInspector'
import { ViewToolbar } from './ViewToolbar'
import { hasWebGL } from './webgl'
import { useViewShortcuts, type ViewApi, type ViewState } from './viewState'
import type { PackId } from './bus'
import { healthCss } from '../lib/colors'

type Props = { buses: BusSpec[]; lengthM: 12 | 9; linePct: number; view: ViewState; api: ViewApi; rows: InspectRow[]; year: number; compare?: boolean; height?: number; ariaLabel: string }

function Fallback({ buses }: { buses: BusSpec[] }) {
  return (
    <div className="v-fallback" role="status">
      <b>3D view is not available here</b>
      <p>Your browser could not start WebGL, so the bus drawing is switched off. Every number on this page is still shown in the cards and tables.</p>
      {buses.map((b) => <div className="row" key={b.key}><span>{b.label}</span><b>{b.healthPct.toFixed(1)}% health</b></div>)}
    </div>
  )
}

function Legend({ linePct }: { linePct: number }) {
  const lo = linePct - 25, span = 100 - lo
  const stops = Array.from({ length: 11 }, (_, i) => `${healthCss(100 - (span * i) / 10, linePct)} ${i * 10}%`).join(',')
  return (
    <div className="vlegend glass" role="img" aria-label={`Colour scale: yellow at 100 percent health, orange at the ${linePct} percent replacement line, red at ${lo} percent`}>
      <span>100%</span><i style={{ background: `linear-gradient(90deg,${stops})` }}><u style={{ left: `${((100 - linePct) / span) * 100}%` }} /></i><span>{lo}%</span>
      <em>White tick = replacement line ({linePct}%)</em>
    </div>
  )
}

export function BusViewer({ buses, lengthM, linePct, view, api, rows, year, compare, height = 560, ariaLabel }: Props) {
  const [hovered, setHovered] = useState<PackId | null>(null)
  const explode = useRef(view.explode)
  explode.current = view.explode
  useViewShortcuts(api, () => explode.current)
  const ok = hasWebGL()
  return (
    <div className="viewer">
      <ViewToolbar view={view} api={api} compare={compare} />
      <div className="vstage" style={{ height }}>
        {ok ? (
          <StageBoundary fallback={<Fallback buses={buses} />}>
            <Suspense fallback={<div className="skel" style={{ height }} aria-busy="true" aria-label="Loading 3D view" />}>
              <BusStage buses={buses} lengthM={lengthM} linePct={linePct} view={view} hovered={hovered} onHover={setHovered} onSelect={api.select} ariaLabel={ariaLabel} />
            </Suspense>
          </StageBoundary>
        ) : <Fallback buses={buses} />}
        <PackInspector selected={view.selected} rows={rows} year={year} isolate={view.isolate} onIsolate={api.toggleIsolate} onClose={() => api.select(null)} />
        <Legend linePct={linePct} />
        <div className="vhint" aria-hidden="true">Keys: 1–5 camera · S body · P packs · E pull apart · F flow · X scan · I isolate · Esc clear</div>
      </div>
    </div>
  )
}
