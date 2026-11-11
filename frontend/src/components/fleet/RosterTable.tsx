import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { editBuses, type BusPatch } from '../../lib/fleet/roster'
import { UNASSIGNED, type Bus, type Fleet } from '../../lib/fleet/types'
import { useScenario } from '../../state/ScenarioContext'
import { useFleet } from '../../state/FleetContext'
import { toast } from '../Toast'

const PAGE = 100
const monthLabel = (m?: string) => m ?? ''

/** A value that edits where it sits. Enter or leaving the cell saves, Escape cancels; an invalid value shows its reason and stays open. */
function EditCell({ value, label, placeholder, onCommit }: { value: string; label: string; placeholder?: string; onCommit: (v: string) => string | null }) {
  const [on, setOn] = useState(false)
  const [text, setText] = useState(value)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (on) ref.current?.select() }, [on])
  const done = () => {
    if (text.trim() === value.trim()) { setOn(false); setErr(null); return }
    const e = onCommit(text)
    if (e) setErr(e); else { setOn(false); setErr(null) }
  }
  if (!on) return <button className="cell-b" aria-label={`${label}: ${value || 'not set'}. Edit`} onClick={() => { setText(value); setOn(true) }}>{value || <span className="dim">{placeholder ?? '—'}</span>}</button>
  return (
    <span className="cell-e">
      <input ref={ref} value={text} aria-label={label} aria-invalid={err != null} onChange={(e) => setText(e.target.value)} onBlur={done}
        onKeyDown={(e) => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { setOn(false); setErr(null) } }} />
      {err && <span className="err" role="alert">{err}</span>}
    </span>
  )
}

const flagsOf = (b: Bus, dutySource: string | undefined) => {
  const t: string[] = []
  if (!b.inServiceMonth) t.push('age unknown')
  if (dutySource === 'assumed') t.push('duty assumed')
  if (dutySource === 'inherited') t.push('duty from route')
  if (b.depot === UNASSIGNED) t.push('no depot')
  if (b.route === UNASSIGNED) t.push('no route')
  return t
}

export function RosterTable({ fleet }: { fleet: Fleet }) {
  const { setFleet } = useFleet()
  const { scenario } = useScenario()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState({ depot: '', route: '', month: '', duty: 'keep' })
  const [err, setErr] = useState<string | null>(null)
  const now = () => Date.now()
  const cls = useMemo(() => new Map(fleet.classes.map((c) => [c.id, c])), [fleet])
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? fleet.buses.filter((b) => `${b.id} ${b.depot} ${b.route}`.toLowerCase().includes(t)) : fleet.buses
  }, [fleet, q])
  const shown = rows.slice(0, limit)
  const allOn = rows.length > 0 && rows.every((b) => sel.has(b.id))
  const sid = useId()
  // a bus that is no longer in the fleet cannot stay selected
  useEffect(() => { setSel((s) => { const ids = new Set(fleet.buses.map((b) => b.id)); const n = new Set([...s].filter((x) => ids.has(x))); return n.size === s.size ? s : n }) }, [fleet])

  const apply = (ids: string[], patch: BusPatch): string | null => {
    const r = editBuses(fleet, ids, patch, now())
    if (!r.ok) return r.message ?? 'That change could not be made.'
    setFleet(r.fleet)
    return null
  }
  const applyBulk = () => {
    const patch: BusPatch = {}
    if (bulk.depot.trim()) patch.depot = bulk.depot
    if (bulk.route.trim()) patch.route = bulk.route
    if (bulk.month.trim()) patch.inServiceMonth = bulk.month
    if (bulk.duty === 'screen') patch.duty = { scenario, source: 'entered' }
    else if (bulk.duty.startsWith('class:')) { const c = cls.get(bulk.duty.slice(6)); if (c) patch.duty = { scenario: c.scenario, source: 'entered' } }
    if (!Object.keys(patch).length) { setErr('Choose something to change first.'); return }
    const e = apply([...sel], patch)
    if (e) { setErr(e); return }
    toast(`Updated ${sel.size} ${sel.size === 1 ? 'bus' : 'buses'}`)
    setErr(null); setSel(new Set()); setBulk({ depot: '', route: '', month: '', duty: 'keep' })
  }

  return (
    <section className="card" aria-labelledby={`${sid}-h`}>
      <div className="hd roster-hd">
        <div><h2 id={`${sid}-h`}>Your buses</h2><div className="sub" style={{ marginBottom: 0 }}>Click a depot, route or month to change it. Select rows to change several at once.</div></div>
        <div className="inp roster-q"><input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} placeholder="Find a bus, depot or route" aria-label="Find a bus, depot or route" /></div>
      </div>

      {sel.size > 0 && (
        <div className="bulk" role="group" aria-label={`Change ${sel.size} selected buses`}>
          <b>{sel.size} selected</b>
          <label>Depot<input value={bulk.depot} onChange={(e) => setBulk({ ...bulk, depot: e.target.value })} /></label>
          <label>Route<input value={bulk.route} onChange={(e) => setBulk({ ...bulk, route: e.target.value })} /></label>
          <label>In service<input value={bulk.month} placeholder="YYYY-MM" onChange={(e) => setBulk({ ...bulk, month: e.target.value })} /></label>
          <label>Duty
            <select className="sel" value={bulk.duty} onChange={(e) => setBulk({ ...bulk, duty: e.target.value })}>
              <option value="keep">Keep as is</option>
              <option value="screen">The bus on screen</option>
              {fleet.classes.map((c) => <option key={c.id} value={`class:${c.id}`}>Same as {c.name}</option>)}
            </select>
          </label>
          <span className="bulk-act"><button className="btn sm primary" onClick={applyBulk}>Apply to {sel.size}</button><button className="btn sm" onClick={() => { setSel(new Set()); setErr(null) }}>Clear selection</button></span>
          {err && <span className="err" role="alert">{err}</span>}
        </div>
      )}

      <div className="scrollx">
        <table className="tbl roster">
          <thead><tr>
            <th scope="col" className="ck"><input type="checkbox" aria-label={`Select all ${rows.length} matching buses`} checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((b) => b.id)))} /></th>
            <th scope="col">Bus</th><th scope="col">Depot</th><th scope="col">Route</th><th scope="col">Type</th><th scope="col">In service</th><th scope="col">Duty class</th><th scope="col">Worth knowing</th>
          </tr></thead>
          <tbody>
            {shown.map((b) => {
              const c = cls.get(b.classId)
              return (
                <tr key={b.id} aria-selected={sel.has(b.id)} className={sel.has(b.id) ? 'on' : undefined}>
                  <td className="ck"><input type="checkbox" aria-label={`Select ${b.id}`} checked={sel.has(b.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })} /></td>
                  <th scope="row">{b.id}</th>
                  <td><EditCell label={`Depot of ${b.id}`} value={b.depot === UNASSIGNED ? '' : b.depot} placeholder="Unassigned" onCommit={(v) => (v.trim() ? apply([b.id], { depot: v }) : 'Enter a name.')} /></td>
                  <td><EditCell label={`Route of ${b.id}`} value={b.route === UNASSIGNED ? '' : b.route} placeholder="Unassigned" onCommit={(v) => (v.trim() ? apply([b.id], { route: v }) : 'Enter a name.')} /></td>
                  <td>{c ? (c.scenario.archetype === '12m' ? '12 m' : '9 m') : ''}</td>
                  <td><EditCell label={`In-service month of ${b.id}`} value={monthLabel(b.inServiceMonth)} placeholder="Unknown" onCommit={(v) => (v.trim() ? apply([b.id], { inServiceMonth: v }) : 'Enter a month like 2023-07.')} /></td>
                  <td className="cls" title={c ? `Up to about ${c.spreadMonths.toFixed(1)} months apart in battery life within this class` : undefined}>{c?.name ?? ''}</td>
                  <td>{flagsOf(b, b.sources.duty).map((t) => <span key={t} className="tag assumption">{t}</span>)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="dim">No bus matches “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && <div style={{ marginTop: 12 }}><button className="btn sm" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, rows.length - shown.length)} more ({shown.length} of {rows.length.toLocaleString('en-IN')} shown)</button></div>}
    </section>
  )
}
