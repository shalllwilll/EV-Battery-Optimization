import { useState } from 'react'
import type { Crosscheck, CrosscheckCheck, EvidenceResponse, LossSplit } from '../api/types'
import { fmt } from '../lib/format'
import { CrosscheckChart } from './charts/CrosscheckChart'
import { WithTable } from './DataTable'

const pct = (v: number, d = 0) => `${fmt(v * 100, d)}%`
const span = (xs: number[], d = 0) => { const lo = Math.min(...xs), hi = Math.max(...xs); return fmt(lo * 100, d) === fmt(hi * 100, d) ? pct(lo, d) : `${fmt(lo * 100, d)}–${fmt(hi * 100, d)}%` }
const times = (xs: number[]) => { const lo = Math.min(...xs), hi = Math.max(...xs); return fmt(lo, 1) === fmt(hi, 1) ? `${fmt(lo, 1)}×` : `${fmt(lo, 1)}–${fmt(hi, 1)}×` }

/** The one measure per check row that the table shows, in the order the rows are listed. */
function rows(checks: CrosscheckCheck[]) {
  const out: { label: string; measure: string; o: number; a: number; b: number }[] = []
  for (const c of checks) {
    const keys = c.kind === 'storage' ? [['loss_5y', 'after 5 years']] : [['loss_1000efc', 'after 1,000 cycles'], ['loss_3000efc', 'after 3,000 cycles']]
    for (const [k, m] of keys) out.push({ label: c.label, measure: m, o: c.ours[k], a: c.blast_250ah[k], b: c.blast_sony_3ah[k] })
  }
  return out
}

function Split({ name, s }: { name: string; s: LossSplit['10y'] }) {
  const tot = s.calendar_loss + s.cycle_loss
  return (
    <div className="xsplit">
      <div className="row"><span>{name}</span><b>{pct(tot)} lost</b></div>
      <div className="split" role="img" aria-label={`${name}: ${pct(s.calendar_loss)} from calendar ageing and ${pct(s.cycle_loss)} from cycling`}>
        <i style={{ width: `${Math.max(s.calendar_loss, 0) * 100}%`, background: 'var(--volt)' }} /><i style={{ width: `${Math.max(s.cycle_loss, 0) * 100}%`, background: '#8E8E98' }} />
      </div>
      <div className="legd"><span><i style={{ background: 'var(--volt)' }} />Calendar {pct(s.calendar_loss)}</span><span><i style={{ background: '#8E8E98' }} />Cycling {pct(s.cycle_loss)}</span></div>
    </div>
  )
}

export function CrosscheckCard({ x, cov }: { x: Crosscheck; cov: EvidenceResponse['training_coverage'] }) {
  const [id, setId] = useState(x.scenarios.find((s) => s.id === '12m_hot_dry')?.id ?? x.scenarios[0].id)
  const s = x.scenarios.find((v) => v.id === id) ?? x.scenarios[0]
  const i10 = x.scenarios[0].years.indexOf(10)
  const all10 = (k: 'ours_cell_p50' | 'blast' | 'blast_alt') => x.scenarios.map((v) => v[k][i10])
  const checks = rows(x.single_condition_checks)
  const stor = checks.filter((r) => r.measure === 'after 5 years'), c3 = checks.filter((r) => r.measure === 'after 3,000 cycles'), c1 = checks.filter((r) => r.measure === 'after 1,000 cycles')
  const heat = x.summary.levers.find((l) => l.id.endsWith('hotpack'))
  const lastYear = x.horizon_years

  return (
    <div className="card c12 xcheck">
      <h2>Cross-check against NREL BLAST-Lite</h2>
      <div className="sub">The same bus duty and climate run through our model and through two independent public LFP models. A consistency check between lab-data models, not a validation on buses.</div>

      <div className="xverdict">
        <b>Our model is the most pessimistic of the three in {x.summary.ours_is_lower_in_all_scenarios ? 'every' : 'most'} scenario tested.</b>{' '}
        After 10 years our cell model keeps {span(all10('ours_cell_p50'))} of its capacity; BLAST-Lite's two LFP models keep {span([...all10('blast'), ...all10('blast_alt')])}.
        The two BLAST-Lite models sit much closer to each other than either does to ours, so treat our replacement timing as a likely <em>early</em> estimate until the cycling term is reworked.
      </div>

      <div className="xpick">
        <label htmlFor="xc-scn">Scenario</label>
        <select id="xc-scn" className="sel" value={id} onChange={(e) => setId(e.target.value)}>
          {x.scenarios.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div className="lg" aria-hidden="true">
        <span><i style={{ background: '#FACC15' }} />Ours, median (band: likely range)</span>
        <span><i style={{ background: '#fff' }} />BLAST-Lite 250 Ah prismatic</span>
        <span><i style={{ background: '#B4B4BC' }} />BLAST-Lite 3 Ah cylindrical</span>
      </div>
      <WithTable chart={<CrosscheckChart s={s} horizon={lastYear} threshold={x.threshold} />}
        head={['Year', 'Ours (median)', 'BLAST-Lite 250 Ah', 'BLAST-Lite 3 Ah']}
        rows={s.years.map((y, i) => [y, fmt(s.ours_cell_p50[i] * 100), fmt(s.blast[i] * 100), fmt(s.blast_alt[i] * 100)])} />
      <p className="note">Capacity kept, cell level. Ours is shown without the pack penalty so it is comparable to a cell model; the shaded band is our own parameter uncertainty (likely range). BLAST-Lite falls inside that band in {pct(x.summary.blast_inside_our_band_share)} of the years checked, which means the band does not cover the chance that the model structure itself is off.</p>

      <h3 className="xh">Where the loss comes from after 10 years</h3>
      <div className="sub">{s.label}</div>
      <div className="xsplits">
        <Split name="Ours (cell)" s={s.loss_split.ours['10y']} />
        <Split name="BLAST-Lite 250 Ah" s={s.loss_split.blast_250ah['10y']} />
        <Split name="BLAST-Lite 3 Ah" s={s.loss_split.blast_sony_3ah['10y']} />
      </div>

      <h3 className="xh">Same condition, no bus translation</h3>
      <div className="sub">Capacity lost at a fixed temperature, so any gap is in the models themselves, not in how a bus is turned into cell conditions.</div>
      <div className="scrollx"><table className="tbl xtbl">
        <thead><tr><th scope="col">Condition</th><th scope="col">Measure</th><th scope="col">Ours</th><th scope="col">BLAST-Lite 250 Ah</th><th scope="col">BLAST-Lite 3 Ah</th></tr></thead>
        <tbody>{checks.map((r) => (
          <tr key={r.label + r.measure}><td>{r.label}</td><td>{r.measure}</td><td><b>{pct(r.o, 1)}</b></td><td>{pct(r.a, 1)}</td><td>{pct(r.b, 1)}</td></tr>))}</tbody>
      </table></div>

      <h3 className="xh">What this says</h3>
      <ul className="xlist">
        <li><b>Calendar ageing is in the same range.</b> Storage loss after 5 years is {times(stor.map((r) => r.o / r.b))} the 3 Ah model and {times(stor.map((r) => r.o / r.a))} the 250 Ah model, and those two differ from each other by {times(stor.map((r) => r.b / r.a))}.</li>
        <li><b>Cycling is where we part ways.</b> After 1,000 cycles we are close ({span(c1.map((r) => r.o))} against {span([...c1.map((r) => r.a), ...c1.map((r) => r.b)])}). After 3,000 cycles ours is {span(c3.map((r) => r.o))} against {span([...c3.map((r) => r.a), ...c3.map((r) => r.b)])}, because our fitted cycling curve bends sharply upward and BLAST-Lite's does not.</li>
        <li><b>It matches limits already listed.</b> Our cycling data run at {cov.cycling_c_rate.map((v) => v.toFixed(1)).join(' to ')} C and up to {cov.cycling_efc_max.toLocaleString('en-IN')} cycles with no C-rate effect, while this bus runs at about {fmt(s.c_rate_eff, 2)} C and reaches {Math.round(s.efc_per_year.ours * lastYear).toLocaleString('en-IN')} cycles in {lastYear} years. The cross-check supports those warnings and shows their size.</li>
        {heat && <li><b>Heat matters far more to us.</b> A pack running 8 °C hotter costs {fmt(Math.abs(heat.ours_cell_change_pts_at_10y))} points at 10 years in our model and {fmt(Math.min(Math.abs(heat.blast_sony_change_pts_at_10y), Math.abs(heat.blast_250ah_change_pts_at_10y)))}–{fmt(Math.max(Math.abs(heat.blast_sony_change_pts_at_10y), Math.abs(heat.blast_250ah_change_pts_at_10y)))} in BLAST-Lite. All three agree on the direction of that and of the charge-cap effect, not on the size.</li>}
      </ul>

      <p className="note">BLAST-Lite {x.blast_lite.version} (Python {x.blast_lite.python}), generated {x.generated}, run offline from <code>scripts/crosscheck_blast.py</code>. {x.caveats.join(' ')} <a href={x.blast_lite.source_url} target="_blank" rel="noreferrer noopener">BLAST-Lite ↗</a></p>
    </div>
  )
}
