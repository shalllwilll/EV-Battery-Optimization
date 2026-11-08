import { useState } from 'react'
import { useHealth } from '../api/hooks'
import { useCurrent } from '../state/useCurrent'
import { ZONE_LABELS } from '../lib/scenario'

/** Always visible: the two honesty chips, service status, the scenario in one line, and the outside-lab-data warning when it applies. */
export function StatusBar() {
  const h = useHealth()
  const { scenario, q } = useCurrent()
  const [open, setOpen] = useState(false)
  const ex = q.data?.replacement.extrapolated ? q.data.replacement.extrapolation_reasons : null
  return (
    <div className="status" aria-label="Model status">
      <span className="chip"><i />Prior mode · no vendor data</span>
      <span className="chip w"><i />Not yet validated on buses</span>
      {ex && <span style={{ position: 'relative' }}>
        <button className="chip w" aria-expanded={open} onClick={() => setOpen((o) => !o)}><i />Outside lab data ▾</button>
        {open && <div className="pop" style={{ top: 'calc(100% + 8px)', left: 0, width: 360 }} role="dialog">
          <b style={{ fontFamily: 'var(--head)' }}>This scenario is outside the laboratory data</b>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>{ex.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="note">The likely range is widened by an assumed factor. The cycling tests were fast, so a slow-charging bus is probably treated as too harsh and replacement shown too early.</p>
        </div>}
      </span>}
      {h.isError ? <button className="chip bad" onClick={() => h.refetch()} title="Click to retry"><i />Service unreachable · retry</button>
        : h.data ? <span className="chip" title={`model ${h.data.model_version}`}><i />Service online</span> : <span className="chip pulse"><i />Connecting…</span>}
      <span className="grow" />
      <span className="sum"><b>{scenario.archetype === '12m' ? '12 m' : '9 m'}</b> · {ZONE_LABELS[scenario.zone]} · <b>{scenario.km_per_day}</b> km/day · <b>{scenario.soc_max_pct}%</b> cap</span>
    </div>
  )
}
