import { Async } from '../components/Async'
import { EvidenceBadge } from '../components/EvidenceBadge'
import { Page } from '../components/Workspace'
import { fmt, inr, num } from '../lib/format'
import { useCurrent } from '../state/useCurrent'

const NAMES: Record<string, [string, string]> = {
  'replacement threshold': ['Replacement line', 'moved ±0.05'], 'battery price per kWh': ['Battery price', 'moved ±20 %'], 'km per day': ['Distance per day', 'moved ±20 %'],
}

export default function Cost() {
  const { q, scenario } = useCurrent()
  return (
    <Page title="Battery cost per kilometre" intro="The pack price divided by the kilometres driven until it reaches the replacement line. No interest, inflation or resale value.">
      <Async q={q} h={300}>{(p) => {
        const c = p.cost, med = num(c.cost_per_km_p50), tor = c.tornado, mx = Math.max(...tor.map((t) => num(t.swing) ?? 0), 0.0001)
        return (
          <div className="bento">
            <div className="card c5">
              <div className="hd"><div><h3>Cost per km</h3><div className="sub">Median, at ₹{scenario.battery_cost_per_kwh_inr?.toLocaleString('en-IN') ?? '–'} per kWh (your input)</div></div><EvidenceBadge level="derived" /></div>
              {med == null ? <p className="note">Enter a battery price in the scenario panel to see cost per km.</p> : <>
                <div className="kpi"><span style={{ color: 'var(--volt)' }}>₹</span>{fmt(med, 1)}<small>/ km</small></div>
                <div className="row mt"><span>Likely range</span><b>{inr(num(c.cost_per_km_p10))} to {inr(num(c.cost_per_km_p90))}</b></div>
                <div className="row"><span>Pack price</span><b>₹{fmt((num(c.battery_cost) ?? 0) / 100000, 1)} lakh</b></div>
                <div className="row"><span>Kilometres until replacement</span><b>{fmt((num(c.lifetime_km_p50) ?? 0) / 1000)} thousand</b></div>
              </>}
              {c.warnings.map((w) => <p className="note" key={w}>{w}</p>)}
            </div>
            <div className="card c7">
              <h3>What moves it most</h3><div className="sub">Swing in median ₹/km when one input changes</div>
              {tor.length === 0 ? <p className="note">The sensitivity chart appears once a battery price is entered.</p> :
                <div className="torn">{tor.map((t) => { const n = NAMES[t.input] ?? [t.input, ''], sw = num(t.swing) ?? 0
                  return <div className="r" key={t.input}><div><span>{n[0]} <span className="tag">{n[1]}</span></span><b>±₹{fmt(sw, 1)}</b></div><div className="bar" role="img" aria-label={`${n[0]} swing ₹${fmt(sw, 1)} per km`}><i style={{ width: `${(sw / mx) * 100}%` }} /></div></div> })}</div>}
            </div>
          </div>
        )
      }}</Async>
    </Page>
  )
}
