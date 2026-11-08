import { useId } from 'react'
import type { PresetResult, Scenario } from '../api/types'
import { hasChanges, sliderSpecs, type LeverKey, type Overrides } from '../lib/busB'

type Props = {
  a: Scenario; over: Overrides
  setLever: (k: LeverKey, v: number) => void; reset: () => void
  presets: PresetResult[]; appliedId: string | null; onPick: (p: PresetResult) => void
  includeConfirm: boolean; setIncludeConfirm: (b: boolean) => void
}

export function BusBControls({ a, over, setLever, reset, presets, appliedId, onPick, includeConfirm, setIncludeConfirm }: Props) {
  const uid = useId()
  const specs = sliderSpecs(a)
  return (
    <div className="card bctl">
      <div className="hd"><h3>Bus B settings</h3><button className="btn sm" onClick={reset} disabled={!hasChanges(over)}>Same as Bus A</button></div>
      <div className="sub">Bus B is a copy of Bus A with only the changes you make here. Drag a slider and the model re-runs.</div>
      <div className="strip" role="group" aria-label="Start from a goal">
        <span>Start from a goal</span>
        <div>{presets.map((p) => <button key={p.id} className="vbtn" aria-pressed={appliedId === p.id} onClick={() => onPick(p)} title={p.goal}>{p.title}</button>)}</div>
      </div>
      <label className="switch"><input type="checkbox" checked={includeConfirm} onChange={(e) => setIncludeConfirm(e.target.checked)} /><span>Include changes that need your confirmation (cooling, energy use)</span></label>
      {specs.map((sp) => {
        const aVal = a[sp.key] as number, val = (over[sp.key] ?? aVal) as number, changed = over[sp.key] != null
        return (
          <div className={`bs${changed ? ' ch' : ''}`} key={sp.key}>
            <div className="bsh"><label htmlFor={`${uid}${sp.key}`}>{sp.label}</label><b>{sp.fmt(val)}</b></div>
            <input id={`${uid}${sp.key}`} type="range" min={sp.min} max={sp.max} step={sp.step} value={val} aria-valuetext={sp.fmt(val)} aria-describedby={`${uid}${sp.key}d`} onChange={(e) => setLever(sp.key, +e.target.value)} />
            <div className="bsf" id={`${uid}${sp.key}d`}><span>Bus A: {sp.fmt(aVal)}</span>{sp.confirm && <span className="tag assumption" title={sp.confirm}>needs confirmation</span>}</div>
            <div className="bsn">{sp.confirm ?? sp.help}</div>
          </div>
        )
      })}
    </div>
  )
}
