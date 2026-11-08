import { Async } from '../components/Async'
import { EvidenceBadge } from '../components/EvidenceBadge'
import { HealthChart } from '../components/charts/HealthChart'
import { WithTable } from '../components/DataTable'
import { Page } from '../components/Workspace'
import { fmt, num } from '../lib/format'
import { curves, repYears, xMaxFor } from '../lib/results'
import { useCurrent } from '../state/useCurrent'
import { useState } from 'react'

export default function Health() {
  const { q, scenario } = useCurrent()
  const [band, setBand] = useState(true), [thr, setThr] = useState(true)
  return (
    <Page title="How much capacity is left" intro="The line is the median of 2,000 simulated packs. The shaded band holds 8 in 10 of them. Hover to read a year, click to pick it.">
      <Async q={q} h={420}>{(p) => {
        const c = curves(p.replacement), xMax = xMaxFor(p), r = repYears(p.replacement)
        const cal = num(p.driver_split.calendar_share) ?? 0
        return (
          <div className="bento">
            <div className="card c8">
              <div className="hd"><div><h2>Health over time</h2><div className="sub">Median and likely range · {scenario.soc_max_pct}% charge cap</div></div><EvidenceBadge level="derived" /></div>
              <div className="lg">
                <button aria-pressed={band} onClick={() => setBand(!band)}><i style={{ background: 'rgba(250,204,21,.45)' }} />Likely range</button>
                <button aria-pressed={thr} onClick={() => setThr(!thr)}><i style={{ background: '#fff' }} />Replacement line</button>
              </div>
              <WithTable chart={<HealthChart {...c} thresholdPct={scenario.threshold * 100} medianYear={r[1]} xMax={xMax} showBand={band} showThreshold={thr} />}
                head={['Year', 'Likely low %', 'Median %', 'Likely high %']}
                rows={Array.from({ length: Math.round(xMax * 2) + 1 }, (_, i) => { const m = i * 6; return [m / 12, fmt(c.p10[m]), fmt(c.p50[m]), fmt(c.p90[m])] })} />
            </div>
            <div className="card c4">
              <div className="hd"><h2>What wears it out</h2><EvidenceBadge level="derived" /></div>
              <div className="sub">Share of the loss when the pack reaches the line</div>
              <div className="kpi">{fmt(cal * 100)}<small>% waiting</small></div>
              <div className="split"><i style={{ width: `${cal * 100}%`, background: 'var(--volt)' }} /><i style={{ width: `${(1 - cal) * 100}%`, background: '#52525B' }} /></div>
              <div className="legd"><span><i style={{ background: 'var(--volt)' }} />Calendar ageing</span><span><i style={{ background: '#52525B' }} />Cycling <b style={{ color: '#fff' }}>{fmt((1 - cal) * 100)} %</b></span></div>
              <div className="mt3">
                <div><small>Cycles a year</small><b>{fmt(num(p.conditions.efc_per_year), 0)}</b></div>
                <div><small>Cell temp</small><b>{fmt(num(p.conditions.effective_temp_c), 0)}<span> °C</span></b></div>
                <div><small>Charge level</small><b>{fmt(num(p.conditions.calendar_equivalent_soc_pct), 0)}<span> %</span></b></div>
              </div>
              <p className="note">Charge level is the stress-equivalent level the model uses for ageing, worked out from the charging window. It is an assumption, not a measurement.</p>
            </div>
            <div className="card c12">
              <h2>What the model wants you to know</h2><div className="sub">Warnings returned with this result</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--t2)' }}>{p.warnings.map((w) => <li key={w} style={{ margin: '6px 0' }}>{w}</li>)}</ul>
            </div>
          </div>
        )
      }}</Async>
    </Page>
  )
}
