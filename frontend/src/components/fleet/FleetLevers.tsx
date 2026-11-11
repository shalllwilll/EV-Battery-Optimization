import { useId, useMemo } from 'react'
import { useLeverSweep } from '../../api/hooks'
import type { Scenario } from '../../api/types'
import { dayOf, leverFleetValue, rankFleetLevers, type FleetLeverRow } from '../../lib/fleet/forecast'
import type { Fleet } from '../../lib/fleet/types'
import { leverSteps } from '../../lib/levers'
import { rupees } from '../../lib/money'
import { WithTable } from '../DataTable'
import { EvidenceBadge } from '../EvidenceBadge'

const CLASSES = 5
const ROWS = 8
const NAME: Record<string, string> = { soc_max_pct: 'Charge cap', charge_start_hour: 'Start time', heat_rise_c: 'Pack heating' }
const sign = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`

/** What to do first, in fleet rupees: each operating lever moved one step for each of the largest duty classes, ranked by what it is worth to the whole class
 *  (the per-bus saving times the buses in it), not by months. Only the largest few classes are measured, each lever alone, so rows do not add up. */
export function FleetLevers({ fleet, ready }: { fleet: Fleet; ready: boolean }) {
  const id = useId()
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const b of fleet.buses) m.set(b.classId, (m.get(b.classId) ?? 0) + 1); return m }, [fleet])
  const top = useMemo(() => fleet.classes.filter((c) => (counts.get(c.id) ?? 0) > 0).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, CLASSES), [fleet, counts])
  const bases = useLeverSweep(top.map((c) => c.scenario), ready)
  const baseData = bases.map((q) => (q.data && !q.isPlaceholderData ? q.data : undefined))
  const basesDone = baseData.length > 0 && baseData.every((b) => b !== undefined)
  const plan = top.flatMap((c, i) => { const b = baseData[i]; return b ? leverSteps(c.scenario, dayOf(c.scenario, b)).map((step) => ({ c, i, step })) : [] })
  const alts = useLeverSweep(plan.map((p) => ({ ...p.c.scenario, [p.step.key]: p.step.value }) as Scenario), ready && basesDone)
  const rows: FleetLeverRow[] = plan.map((p, k) => {
    const base = baseData[p.i], alt = alts[k]?.data && !alts[k].isPlaceholderData ? alts[k].data : undefined
    const v = base ? leverFleetValue(base, alt, counts.get(p.c.id) ?? 0) : { perBus: null, fleet: null, months: null }
    return { classId: p.c.id, className: p.c.name, buses: counts.get(p.c.id) ?? 0, text: p.step.text, months: v.months, perBus: v.perBus, fleet: v.fleet, lever: NAME[p.step.key] ?? p.step.key, needsCooling: p.step.confirm }
  })
  const ranked = rankFleetLevers(rows)
  const measured = ranked.length, expected = plan.length
  const covered = top.reduce((s, c) => s + (counts.get(c.id) ?? 0), 0)
  const shown = ranked.slice(0, ROWS)
  const noPrice = basesDone && rows.length > 0 && measured === 0 && alts.every((q) => q.isSuccess)
  if (!top.length) return null
  return (
    <section className="card c6" aria-labelledby={`${id}-h`} aria-busy={!basesDone || measured < expected}>
      <div className="hd"><div><h2 id={`${id}-h`}>What to do first, in rupees</h2><div className="sub">One change at a time, for the {top.length === 1 ? 'duty class' : `${top.length} largest duty classes`}, worth to the whole class.</div></div><EvidenceBadge level="derived" /></div>
      {!ready || !basesDone ? <p className="tnote" role="status">{ready ? `Measuring ${bases.filter((q) => q.data && !q.isPlaceholderData).length} of ${top.length} duty classes…` : 'Waiting for the fleet figures…'}</p>
        : measured < expected ? <p className="tnote" role="status">{measured} of {expected} changes measured…</p> : null}
      {noPrice && <p className="tnote">These classes have no battery price, so a change cannot be put in rupees.</p>}
      {shown.length > 0 && (
        <WithTable
          chart={
            <ol className="mny">
              {shown.map((r) => (
                <li key={`${r.classId}-${r.lever}`}>
                  <span className="mn-l">{r.text}{r.needsCooling && <em className="tag" style={{ alignSelf: 'flex-start', margin: '3px 0', fontStyle: 'normal' }}>needs your cooling system</em>}<small>{r.className} · {r.buses} {r.buses === 1 ? 'bus' : 'buses'}</small></span>
                  <span className="mn-n"><b>{(r.fleet as number) >= 0 ? 'about ' : 'costs about '}{rupees(Math.abs(r.fleet as number))} a year</b><small>{r.months != null ? `${sign(r.months)} months of life per bus` : ''}</small></span>
                </li>
              ))}
            </ol>
          }
          head={['Duty class', 'Buses', 'Change', 'Months gained per bus (median)', 'Rupees a year per bus', 'Rupees a year for the class']}
          rows={ranked.map((r) => [r.className, r.buses, r.text, r.months == null ? '–' : sign(r.months), r.perBus == null ? '–' : rupees(r.perBus), rupees(r.fleet as number)])} />
      )}
      <p className="note">The {top.length === 1 ? 'class' : `${top.length} largest classes`} cover {covered} of {fleet.buses.length.toLocaleString('en-IN')} buses; the rest are not measured. Each row is that class’s own bus with one change, against today. Pack price spread over its life: undiscounted, first pack only, and rows of the same class do not add up. Not yet validated on buses.</p>
    </section>
  )
}
