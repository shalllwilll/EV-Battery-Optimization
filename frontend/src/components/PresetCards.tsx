import type { PresetResult, RecommendResponse, Stage } from '../api/types'
import { duplicateOf, leverValue, lifeChange, signed, stageFor } from '../lib/busB'
import { num } from '../lib/format'

function Tiles({ st }: { st: Stage }) {
  const d = st.delta, life = lifeChange(num(d.months_p50) ?? 0, num(d.months_p10) ?? 0, num(d.months_p90) ?? 0, d.p90_beyond_horizon)
  const cost = num(d.cost_per_km_change), rng = num(d.range_change_km) ?? 0
  return (
    <div className="tiles">
      <div><small>Battery life</small><b>{life.headline}</b><span>{life.range}</span></div>
      <div><small>Battery cost per km</small><b>{cost == null ? '–' : cost === 0 ? 'No change' : `${cost < 0 ? '−' : '+'}₹${Math.abs(cost).toFixed(2)}`}</b><span>{cost == null ? 'enter a battery price' : 'median'}</span></div>
      <div><small>Range at replacement</small><b>{Math.abs(rng) < 0.5 ? 'Same' : signed(rng, 0, ' km')}</b><span>when the pack is due</span></div>
    </div>
  )
}

function Card({ p, stage, dup, applied, onTry }: { p: PresetResult; stage: Stage; dup: PresetResult | null; applied: boolean; onTry: () => void }) {
  return (
    <article className={`pcard${applied ? ' on' : ''}${dup ? ' dup' : ''}`}>
      <div className="hd"><div><h3>{p.title}</h3><div className="sub">{p.goal}</div></div>{applied && <span className="tag lab">Shown on Bus B</span>}</div>
      {dup ? <p className="psum">The search found the same best option as <b>{dup.title}</b>, so the advice is identical.</p> : (
        <>
          <div className="ifa">If you adopt this</div>
          <p className="psum">{stage.summary}</p>
          <Tiles st={stage} />
          {stage.changes.length > 0 && (
            <ul className="chg">{stage.changes.map((c) => (
              <li key={c.lever}>
                <span>{c.label}: <s>{leverValue(c.lever, c.from_value.value as number, c.unit)}</s> → <b>{leverValue(c.lever, c.to_value.value as number, c.unit)}</b>{c.needs_confirmation && <span className="tag assumption">needs your confirmation</span>}</span>
                <em>{c.why}</em>
              </li>))}
            </ul>
          )}
          {!stage.feasible && <p className="note">This option does not meet the route rule, so treat it with care.</p>}
        </>
      )}
      <button className="btn" onClick={onTry} aria-pressed={applied}>{applied ? 'Shown on Bus B' : 'Try on Bus B'}</button>
      {!dup && p.rejected.length > 0 && <details><summary>What the search ruled out</summary><ul>{p.rejected.map((r) => <li key={r}>{r}</li>)}</ul></details>}
    </article>
  )
}

export function PresetCards({ rec, includeConfirm, appliedId, onTry }: { rec: RecommendResponse; includeConfirm: boolean; appliedId: string | null; onTry: (p: PresetResult) => void }) {
  return (
    <div className="pstack">
      {rec.presets.map((p) => <Card key={p.id} p={p} stage={stageFor(p, includeConfirm)} dup={duplicateOf(p, rec.presets, includeConfirm)} applied={appliedId === p.id} onTry={() => onTry(p)} />)}
    </div>
  )
}
