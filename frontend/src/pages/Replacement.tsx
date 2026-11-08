import { Async } from '../components/Async'
import { EvidenceBadge } from '../components/EvidenceBadge'
import { ProbChart } from '../components/charts/ProbChart'
import { WithTable } from '../components/DataTable'
import { Page } from '../components/Workspace'
import { atYear, fmt, num } from '../lib/format'
import { probSeries, repYears, xMaxFor, NO_DATE } from '../lib/results'
import { useCurrent } from '../state/useCurrent'
import { useYear } from '../state/YearContext'

const yrs = (v: number | null) => (v == null ? <span style={{ fontSize: 14 }}>{NO_DATE}</span> : <>{v.toFixed(1)}<span> yrs</span></>)

export default function Replacement() {
  const { q, scenario } = useCurrent()
  const { year } = useYear()
  return (
    <Page title="When to plan the swap" intro="Every simulated pack crosses the replacement line at a different time. Plan around a window, never a single date.">
      <Async q={q} h={420}>{(p) => {
        const r = p.replacement, y = repYears(r), prob = probSeries(r), xMax = xMaxFor(p)
        const within = num(r.probability_within_horizon) ?? 0
        return (
          <div className="bento">
            <div className="card c7">
              <div className="hd"><div><h3>Chance the pack has reached the line</h3><div className="sub">Cumulative share of simulated packs · line at {Math.round(scenario.threshold * 100)}% health</div></div><EvidenceBadge level="derived" /></div>
              <WithTable chart={<ProbChart prob={prob} repYears={y} xMax={xMax} />} head={['Year', 'Share reached %']} rows={Array.from({ length: Math.round(xMax * 2) + 1 }, (_, i) => [i / 2, fmt(prob[i * 6])])} />
            </div>
            <div className="card c5">
              <div className="hd"><h3>Planning dates</h3><EvidenceBadge level="derived" /></div>
              <div className="sub">Years in service until the line</div>
              <div className="mt3" style={{ marginTop: 0 }}>
                <div><small>Early (p10)</small><b>{yrs(y[0])}</b></div>
                <div><small>Median (p50)</small><b style={{ color: 'var(--volt)' }}>{yrs(y[1])}</b></div>
                <div><small>Late (p90)</small><b>{yrs(y[2])}</b></div>
              </div>
              <div className="row mt"><span>Reached within {scenario.horizon_years} years</span><b>{fmt(within * 100)} % of packs</b></div>
              <div className="row"><span>Replaced by year {year.toFixed(1)}</span><b>{fmt(atYear(prob, year))} %</b></div>
              <p className="note">Window = where 10 % to 90 % of simulated packs have reached the line. Choose the percentile that matches how much risk of early failure you can accept. Click the chart to move the marker.</p>
              {r.warnings.map((w) => <p className="note" key={w}>{w}</p>)}
            </div>
          </div>
        )
      }}</Async>
    </Page>
  )
}
