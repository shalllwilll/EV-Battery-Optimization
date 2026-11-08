import type { CSSProperties } from 'react'
import type { PackId } from './bus'
import { CAMS, CAM_ORDER, LAYER_LABELS, type ViewApi, type ViewState } from './viewState'

const PACKS: { id: PackId; label: string }[] = [{ id: 'roof', label: 'Roof' }, { id: 'under', label: 'Underfloor' }, { id: 'rear', label: 'Rear' }]
const fill = (v: number) => ({ '--p': `${v * 100}%` }) as CSSProperties

export function ViewToolbar({ view, api, compare }: { view: ViewState; api: ViewApi; compare?: boolean }) {
  return (
    <div className="vbar" role="toolbar" aria-label="3D view controls">
      <div className="vgroup" role="group" aria-label="Camera">
        {CAM_ORDER.filter((c) => compare || c !== 'cmp').map((c, i) => (
          <button key={c} className="vbtn" aria-pressed={view.cam === c} onClick={() => api.setCam(c)} title={`${CAMS[c].label} (${i + 1})`}>{CAMS[c].label}</button>
        ))}
      </div>
      <div className="vgroup" role="group" aria-label="Layers">
        {LAYER_LABELS.map((l) => (
          <button key={l.key} className="vbtn" aria-pressed={view.layers[l.key]} onClick={() => api.toggle(l.key)} title={`${l.label} (${l.hotkey})`}>{l.label}</button>
        ))}
      </div>
      <div className="vgroup" role="group" aria-label="Select a battery pack">
        {PACKS.map((p) => (
          <button key={p.id} className="vbtn" aria-pressed={view.selected === p.id} onClick={() => api.select(view.selected === p.id ? null : p.id)} title={`${p.label} pack details`}>{p.label}</button>
        ))}
      </div>
      <div className="vsliders">
      <label className="vslide">Pull apart
        <input className="rng" style={fill(view.explode)} type="range" min={0} max={1} step={0.01} value={view.explode} onChange={(e) => api.setExplode(+e.target.value)} aria-valuetext={`${Math.round(view.explode * 100)} percent`} />
      </label>
      <label className="vslide">Body see-through
        <input className="rng" style={fill(1 - view.shell)} type="range" min={0} max={1} step={0.01} value={1 - view.shell} onChange={(e) => api.setShell(1 - +e.target.value)} aria-valuetext={`${Math.round((1 - view.shell) * 100)} percent`} />
      </label>
      </div>
    </div>
  )
}
