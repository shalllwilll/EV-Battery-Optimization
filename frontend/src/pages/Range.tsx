import { Async } from '../components/Async'
import { EvidenceBadge } from '../components/EvidenceBadge'
import { SeasonChart } from '../components/charts/SeasonChart'
import { WithTable } from '../components/DataTable'
import { Page } from '../components/Workspace'
import { useZones } from '../api/hooks'
import { arr, atYear, fmt, num } from '../lib/format'
import { ZONE_LABELS } from '../lib/scenario'
import { useCurrent } from '../state/useCurrent'
import { useYear } from '../state/YearContext'

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length

export default function Range() {
  const { q, scenario } = useCurrent()
  const { year } = useYear()
  const zones = useZones()
  const z = zones.data?.zones.find((x) => x.id === scenario.zone)
  return (
    <Page title="Season, climate and range" intro="Real air temperatures for the chosen zone. The model gives one range for every month, because no public data links cold or heat to LFP bus range.">
      <div className="bento">
        <div className="card c7">
          <div className="hd"><div><h3>Air temperature by month</h3><div className="sub">{ZONE_LABELS[scenario.zone]} · {z ? `${z.elevation_m} m · NASA POWER ${zones.data?.period.slice(0, 4)}–${zones.data?.period.slice(9, 13)}` : 'loading…'} · bar = monthly mean, line = average day and night</div></div><span className="tag lab">real weather</span></div>
          {z ? <WithTable chart={<SeasonChart months={z.monthly} />} head={['Month', 'Mean °C', 'Day °C', 'Night °C']} rows={z.monthly.map((m) => [m.month, m.tmean_c.toFixed(1), m.tmax_mean_c.toFixed(1), m.tmin_mean_c.toFixed(1)])} />
            : <div className="skel" style={{ height: 260 }} />}
        </div>
        <div className="card c5">
          <Async q={q} h={260}>{(p) => {
            const ret = arr(p.replacement.retention_p50), now = atYear(ret, year), nw = num(p.range.new_pack_range_km) ?? 0
            return (<>
              <div className="hd"><h3>Range on a full charge</h3><EvidenceBadge level="derived" /></div>
              <div className="sub">Median pack at year {year.toFixed(1)}</div>
              <div className="kpi">{fmt(nw * now)}<small>km</small></div>
              <div className="bar mt"><i style={{ width: `${now * 100}%` }} /></div>
              <div className="legd" style={{ marginTop: 8 }}><span>0</span><span>{fmt(nw)} km new</span></div>
              <table className="tbl mt"><thead><tr><th>Pack age</th><th>Median km</th><th>Cautious km</th></tr></thead><tbody>
                {p.range.ages_years.map((a) => <tr key={a}><td>{a} years</td><td>{fmt(mean(arr(p.range.range_km_p50[String(a)])))}</td><td>{fmt(mean(arr(p.range.range_km_p10[String(a)])))}</td></tr>)}
              </tbody></table>
              <p className="note">Usable energy × health ÷ energy use. Air conditioning and seasonal consumption are not modelled, so every month shows the same range.</p>
              {p.range.warnings.map((w) => <p className="note" key={w}>{w}</p>)}
            </>)
          }}</Async>
        </div>
      </div>
    </Page>
  )
}
