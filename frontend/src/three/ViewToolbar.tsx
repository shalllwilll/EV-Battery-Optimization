import { CAMS, CAM_ORDER, LAYER_LABELS, type ViewApi, type ViewState } from './viewState'

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
      <label className="vslide">Pull apart
        <input type="range" min={0} max={1} step={0.01} value={view.explode} onChange={(e) => api.setExplode(+e.target.value)} aria-valuetext={`${Math.round(view.explode * 100)} percent`} />
      </label>
      <label className="vslide">Body see-through
        <input type="range" min={0} max={1} step={0.01} value={1 - view.shell} onChange={(e) => api.setShell(1 - +e.target.value)} aria-valuetext={`${Math.round((1 - view.shell) * 100)} percent`} />
      </label>
    </div>
  )
}
