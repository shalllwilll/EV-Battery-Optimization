import { useId, useMemo, useState } from 'react'
import { moneyBy } from '../../lib/fleet/forecast'
import { groupRows, type GroupBy, type Row } from '../../lib/fleet/segments'
import type { FleetForecast } from '../../lib/fleet/types'
import { rupees } from '../../lib/money'
import { EvidenceBadge } from '../EvidenceBadge'

const BYS: { v: GroupBy; label: string }[] = [{ v: 'depot', label: 'Depot' }, { v: 'route', label: 'Route' }, { v: 'class', label: 'Duty class' }, { v: 'type', label: 'Bus type' }]
const TOP = 8

/** Where the battery money goes: depots, routes or duty classes ranked by what their packs cost per year of life, with the cost per km beside it. It is a cost, not a margin:
 *  the tool does not know what the contract pays per km, so it cannot say which depot or route loses money. */
export function MoneyBlock({ rows, forecast, stale }: { rows: Row[]; forecast: FleetForecast; stale: boolean }) {
  const id = useId()
  const [by, setBy] = useState<GroupBy>('depot')
  const [all, setAll] = useState(false)
  const list = useMemo(() => moneyBy(rows, groupRows(rows, by, forecast.as_of).groups, forecast), [rows, by, forecast])
  const shown = all ? list : list.slice(0, TOP)
  const top = Math.max(1, ...list.map((r) => r.perYear ?? 0))
  const known = list.some((r) => r.perYear != null)
  return (
    <section className="card c6" aria-labelledby={`${id}-h`} aria-busy={stale}>
      <div className="hd"><div><h2 id={`${id}-h`}>Where the battery money goes</h2><div className="sub">Pack price spread over its life, per year.</div></div><EvidenceBadge level="derived" /></div>
      <div className="lsel"><label htmlFor={`${id}-by`}>Rank by</label><select id={`${id}-by`} className="sel" value={by} onChange={(e) => { setBy(e.target.value as GroupBy); setAll(false) }}>{BYS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}</select></div>
      {!known ? <p className="tnote">No class has a battery price and a measurable life yet, so there is nothing to rank.</p> : (
        <ol className="mny">
          {shown.map((r) => (
            <li key={r.key}>
              <span className="mn-l">{r.label}<small>{r.buses} {r.buses === 1 ? 'bus' : 'buses'}</small></span>
              <span className="mn-b" aria-hidden="true"><i style={{ width: `${((r.perYear ?? 0) / top) * 100}%` }} /></span>
              <span className="mn-n"><b>{r.perYear == null ? '–' : `${rupees(r.perYear)} a year`}</b>{r.perKm != null && <small>₹{r.perKm.toFixed(2)} per km</small>}</span>
            </li>
          ))}
        </ol>
      )}
      {list.length > TOP && <div style={{ marginTop: 10 }}><button className="btn sm" aria-expanded={all} onClick={() => setAll((a) => !a)}>{all ? `Show the top ${TOP}` : `Show all ${list.length}`}</button></div>}
      <p className="note">A cost, not a margin: the tool does not know what your contract pays per km, so it cannot say which depot or route loses money. Each bus carries its duty class’s figure (a mean of medians, undiscounted, first pack only), and the ranking follows how the buses are grouped. Not yet validated on buses.</p>
    </section>
  )
}
