import { useEvidence } from '../api/hooks'
import { Async } from '../components/Async'
import { Page } from '../components/Workspace'
import { fmt } from '../lib/format'

const NAME: Record<string, string> = { hust: 'HUST cycling', stanford_calendar: 'Stanford storage', naumann_calendar: 'Naumann storage', weather: 'NASA POWER weather', evbattery: 'EVBattery field data' }
const TAG = ['Scope', 'Bias', 'Assumption', 'Not modelled', 'Assumption', 'Bias', 'Assumption', 'Policy']

export default function Evidence() {
  const q = useEvidence()
  return (
    <Page wide title="What this rests on" intro="Public laboratory data only. Every bus-level number is an assumption or derived from one. These figures come from the project's own validation runs.">
      <Async q={q} h={420}>{(e) => {
        const m = e.metrics, naive = m.early_life.candidates.find((c) => c.model === 'mean only')?.mape, win = m.early_life.candidates.find((c) => c.model === m.early_life.winner)?.mape
        const cl = Object.values(m.calendar_validation.cross_lab).map((v) => v.mae_within_train_horizon * 100)
        const nodes = [
          { t: 'Cell ageing', s: 'Fitted on laboratory cells', n: `${fmt(win, 1)}%`, d: `cycle-life error vs ${fmt(naive, 1)}% for guessing`, f: `storage error ${fmt(Math.min(...cl), 1)} to ${fmt(Math.max(...cl), 1)} points, cross-lab`, h: true },
          { t: 'Bus translation', s: 'Scenario into cell conditions', n: '0', d: 'buses measured', f: 'labelled assumptions · real weather' },
          { t: 'Decisions', s: 'Replacement, range, cost', n: `${fmt(m.uncertainty.cycle.coverage_point_weighted * 100, 1)}%`, d: 'of cases inside the 80 % band', f: `cycling · storage ${fmt(m.uncertainty.calendar.coverage_point_weighted * 100, 1)}%` },
        ]
        return (
          <div className="bento">
            <div className="card c12"><h3>Model pipeline</h3><div className="sub">Model version {e.model_version} · prior mode</div>
              <div className="bento" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>{nodes.map((n, i) => (
                <div key={n.t} className="card" style={{ background: 'var(--bg)', borderColor: n.h ? 'var(--volt)' : undefined }}>
                  <div className="lbl">Step {i + 1}</div><h3>{n.t}</h3><div className="sub" style={{ marginBottom: 10 }}>{n.s}</div>
                  <div className="kpi" style={{ fontSize: 46, color: 'var(--volt)' }}>{n.n}</div><div style={{ marginTop: 6 }}>{n.d}</div><div className="note">{n.f}</div>
                </div>))}</div>
            </div>
            <div className="card c12"><h3>Datasets</h3><div className="sub">Real, free, public. Nothing synthetic is used to train or tune any model.</div>
              <div className="bento" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))' }}>{e.datasets.map((d) => (
                <div key={d.id} className="card" style={{ background: 'var(--bg)' }}>
                  <h3 style={{ fontSize: 16 }}>{NAME[d.id] ?? d.id}</h3><div className="sub" style={{ marginBottom: 8 }}>{d.used_for.split(' (')[0]}</div>
                  <span className={`tag ${d.id === 'evbattery' ? 'assumption' : 'lab'}`}>{d.id === 'evbattery' ? 'real data · not LFP' : 'real data · LFP'}</span>
                  <div className="row mt"><span>Licence</span><b>{d.licence}</b></div><p className="note">{d.limitations}</p>
                  <a className="note" href={d.source_url} target="_blank" rel="noreferrer noopener">Source ↗</a>
                </div>))}</div>
            </div>
            <div className="card c6"><h3>How accurate is it?</h3><div className="sub">Measured by the project on held-out data. Not comparable to published numbers.</div>
              <div className="row"><span>Cycle life, typical error</span><b>{fmt(win, 1)}% (guessing: {fmt(naive, 1)}%)</b></div>
              <div className="row"><span>Cycling measurements inside the 80 % band</span><b>{fmt(m.uncertainty.cycle.coverage_point_weighted * 100, 1)}%</b></div>
              <div className="row"><span>Cycling cells, average share inside the band</span><b>{fmt(m.uncertainty.cycle.coverage_cell_mean * 100, 1)}%</b></div>
              <div className="row"><span>Storage points inside the 80 % band</span><b>{fmt(m.uncertainty.calendar.coverage_point_weighted * 100, 1)}%</b></div>
              <div className="row"><span>Storage, cross-lab error</span><b>{fmt(Math.min(...cl), 1)} to {fmt(Math.max(...cl), 1)} points</b></div>
              <div className="row"><span>Field-data demo (capacity from mileage)</span><b>{fmt(m.evbattery_capacity.mileage_only.mape, 2)}% error</b></div>
              <p className="note">{m.evbattery_capacity.caveat}</p></div>
            <div className="card c6"><h3>Where the data stops</h3><div className="sub">Training coverage. Outside this, bands are widened ×{e.uncertainty.extrapolation_widening}.</div>
              <div className="row"><span>Cycling temperature</span><b>{e.training_coverage.cycling_temperature_c.join(' to ')} °C</b></div>
              <div className="row"><span>Cycling charge rate</span><b>{e.training_coverage.cycling_c_rate.map((x) => x.toFixed(1)).join(' to ')} C</b></div>
              <div className="row"><span>Cycling length</span><b>up to {e.training_coverage.cycling_efc_max.toLocaleString('en-IN')} cycles</b></div>
              <p className="note">A bus charging at about 0.2 C is far below the 1.8 to 2.8 C used in the lab, so every bus result is flagged.</p></div>
            <div className="card c12"><h3>What vendor data would change</h3>
              <div className="sub">A method demonstration on public field data, not a result for LFP buses. Prior mode, which you are using, needs none of this.</div>
              {(() => {
                const cd = m.calibration_demo, rs = cd.with_snippet_features.results, r0 = rs[0], r5 = rs.find((r) => r.n_labels === 5), top = Math.max(...rs.map((r) => Math.max(r.prior_mape, r.no_pooling_mape)))
                return (
                  <div className="cal">
                    <table className="tbl">
                      <thead><tr><th>Labelled records from the vehicle</th><th>Capacity error</th><th>Plain average</th><th>Shrunk toward prior</th></tr></thead>
                      <tbody>{rs.map((r) => (
                        <tr key={r.n_labels}><td>{r.n_labels === 0 ? 'None (prior only)' : r.n_labels}</td>
                          <td><span className="bar"><i style={{ width: `${(r.partial_pooling_mape / top) * 100}%` }} /></span><b>{fmt(r.partial_pooling_mape, 2)}%</b></td>
                          <td>{r.n_labels === 0 ? '–' : `${fmt(r.no_pooling_mape, 2)}%`}</td><td>{r.n_labels === 0 ? '–' : `${fmt(r.partial_pooling_mape, 2)}%`}</td></tr>))}
                      </tbody>
                    </table>
                    {r5 && <p>With only 5 labelled records for a vehicle the model has never seen, the typical capacity error fell from {fmt(r0.prior_mape, 2)}% to {fmt(r5.partial_pooling_mape, 2)}%, and it was no worse in {fmt(r5.vehicles_not_worse_pct)}% of vehicles. Shrinking the correction toward the prior changes little on average ({fmt(r5.partial_pooling_mape, 2)}% against {fmt(r5.no_pooling_mape, 2)}%). Its job is to stop a few noisy records from over-correcting.</p>}
                    <p className="note">{cd.with_snippet_features.vehicles_evaluated} vehicles evaluated. {cd.split}. {cd.evaluation}. {cd.caveat}</p>
                  </div>
                )
              })()}
            </div>
            <div className="card c12"><h3>Known limits</h3><div className="sub">Read before quoting any number</div>
              <div className="bento" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>{e.limitations.map((t, i) => (
                <div key={t} className="card" style={{ background: 'var(--bg)' }}><div className="lbl">{String(i + 1).padStart(2, '0')} · {e.limitations.length === TAG.length ? TAG[i] : 'Limit'}</div><p style={{ margin: 0 }}>{t}</p></div>))}</div>
            </div>
          </div>
        )
      }}</Async>
    </Page>
  )
}
