import { useState } from 'react'
import { Async } from '../components/Async'
import { EvidenceBadge } from '../components/EvidenceBadge'
import { Insight } from '../components/Insight'
import { WhatIfBar } from '../components/WhatIfBar'
import { PriceCurve } from '../components/charts/PriceCurve'
import { Page } from '../components/Workspace'
import type { Scenario } from '../api/types'
import { fmt, inr, num } from '../lib/format'
import { breakEvenPrice, packCostPerYear, perThousand, scaleCost } from '../lib/costcalc'
import { costInsight } from '../lib/insights'
import type { WKey } from '../lib/whatif'
import { useScenario } from '../state/ScenarioContext'
import { useCurrent } from '../state/useCurrent'
import { useWhatIf } from '../state/WhatIfContext'

const NAMES: Record<string, [string, string]> = {
  'replacement threshold': ['Replacement line', 'moved ±0.05'], 'battery price per kWh': ['Battery price', 'moved ±20 %'], 'km per day': ['Distance per day', 'moved ±20 %'],
}
/** How each of the model's three tornado inputs maps to a scenario field and to the two values it tested (low = lowered). */
const LEVER: Record<string, (s: Scenario) => { key: WKey; low: number; high: number } | null> = {
  'battery price per kWh': (s) => (s.battery_cost_per_kwh_inr == null ? null : { key: 'battery_cost_per_kwh_inr', low: s.battery_cost_per_kwh_inr * 0.8, high: s.battery_cost_per_kwh_inr * 1.2 }),
  'replacement threshold': (s) => ({ key: 'threshold', low: Math.max(s.threshold - 0.05, 0.51), high: Math.min(s.threshold + 0.05, 0.94) }),
  'km per day': (s) => ({ key: 'km_per_day', low: s.km_per_day * 0.8, high: s.km_per_day * 1.2 }),
}
const DEFAULT_PRICE = 12000

export default function Cost() {
  const { q, scenario } = useCurrent()
  const { setField } = useScenario()
  const { set, changed, busB, predB } = useWhatIf()
  const [target, setTarget] = useState<number | null>(null)
  return (
    <Page title="Battery cost per kilometre" intro="The pack price divided by the kilometres driven until it reaches the replacement line. No interest, inflation or resale value.">
      <Async q={q} h={300}>{(p) => {
        const c = p.cost, med = num(c.cost_per_km_p50), tor = c.tornado
        const basePrice = p.scenario.battery_cost_per_kwh_inr ?? null
        const price = scenario.battery_cost_per_kwh_inr ?? null
        const band = med != null && basePrice != null ? { p10: num(c.cost_per_km_p10) ?? med, p50: med, p90: num(c.cost_per_km_p90) ?? med } : null
        const now = band && basePrice != null && price != null ? scaleCost(band, price, basePrice) : null
        const be = now && price != null && target != null ? breakEvenPrice(price, now.p50, target) : null
        const top = tor[0] ? (NAMES[tor[0].input]?.[0] ?? tor[0].input).toLowerCase() : null
        const life = num(p.replacement.months_p50)
        const pack = num(c.battery_cost), lifeKm = num(c.lifetime_km_p50)
        const mx = Math.max(...tor.flatMap((t) => [num(t.low_case) ?? 0, num(t.high_case) ?? 0]), 0.0001), mn = Math.min(...tor.flatMap((t) => [num(t.low_case) ?? mx, num(t.high_case) ?? mx]), mx)
        const pos = (v: number) => `${((v - mn) / (mx - mn || 1)) * 100}%`
        return (
          <>
            {now && price != null && <Insight insight={costInsight({ perThousand: perThousand(price, now.p50), topInput: top, breakEven: be, target })} />}
            <section className="hero" aria-labelledby="cl-h">
              <div className="hh">
                <div><h2 id="cl-h">Cost against battery price</h2><div className="sub">Drag the dot, or use the slider, to set the price for the whole app</div></div>
                <EvidenceBadge level="derived" />
              </div>
              {!band || price == null ? (
                <div><p className="note">Enter a battery price to see cost per km.</p><button className="btn sm primary" onClick={() => setField('battery_cost_per_kwh_inr', DEFAULT_PRICE)}>Use ₹12,000 per kWh</button></div>
              ) : (
                <>
                  <div className="hero-row">
                    <div><div className="big"><span style={{ color: 'var(--volt)' }}>₹</span>{fmt(now!.p50, 2)}<small>/ km</small></div><div className="sub">median at ₹{Math.round(price).toLocaleString('en-IN')} per kWh · {inr(now!.p10, 2)} to {inr(now!.p90, 2)}</div></div>
                    <label className="tgt">Target cost per km
                      <input type="number" inputMode="decimal" min={0} step={0.1} placeholder={fmt(now!.p50 * 0.8, 1)} value={target ?? ''} onChange={(e) => setTarget(e.target.value === '' ? null : +e.target.value)} />
                      <small>{be != null ? `needs ₹${Math.round(be).toLocaleString('en-IN')} per kWh or less` : 'Type a goal to find the price that reaches it'}</small>
                    </label>
                  </div>
                  <PriceCurve band={band} basePrice={basePrice!} price={price} onPrice={(v) => setField('battery_cost_per_kwh_inr', v)} lo={Math.min(4000, Math.round(price * 0.8))} hi={Math.max(24000, Math.round(price * 1.2))} target={target} breakEven={be}
                    ghost={changed && predB.data && num(predB.data.cost.cost_per_km_p50) != null ? { price: busB.battery_cost_per_kwh_inr ?? price, p50: num(predB.data.cost.cost_per_km_p50)! } : null} />
                  <p className="note">The curve is exact: each run's cost is pack price ÷ kilometres driven, so every percentile scales with price. Life is held at the model's result for your other inputs. Not yet validated on buses.</p>
                </>
              )}
            </section>
            <WhatIfBar base={p} keys={['battery_cost_per_kwh_inr', 'threshold', 'km_per_day', 'soc_max_pct']}
              result={(alt) => { const a = num(alt.cost.cost_per_km_p50); return med != null && a != null ? <>Cost per km <strong>{inr(a, 2)}</strong> (was {inr(med, 2)})</> : null }} />
            <div className="bento">
              <div className="card c5">
                <div className="hd"><div><h2>Cost per km</h2><div className="sub">Median, at ₹{scenario.battery_cost_per_kwh_inr?.toLocaleString('en-IN') ?? '–'} per kWh (your input)</div></div><EvidenceBadge level="derived" /></div>
                {med == null ? <p className="note">Enter a battery price in the scenario panel to see cost per km.</p> : <>
                  <div className="kpi"><span style={{ color: 'var(--volt)' }}>₹</span>{fmt(now?.p50 ?? med, 1)}<small>/ km</small></div>
                  <div className="row mt"><span>Range</span><b>{inr(now?.p10 ?? num(c.cost_per_km_p10))} to {inr(now?.p90 ?? num(c.cost_per_km_p90))}</b></div>
                  <div className="row"><span>Pack price</span><b>₹{fmt(((price != null && basePrice != null ? (pack ?? 0) * (price / basePrice) : pack) ?? 0) / 100000, 1)} lakh</b></div>
                  <div className="row"><span>Kilometres until replacement</span><b>{fmt((lifeKm ?? 0) / 1000)} thousand</b></div>
                  {pack != null && <div className="row"><span>Pack cost per year of life</span><b>{(() => { const y = packCostPerYear(pack, life); return y == null ? '–' : `₹${fmt(y / 100000, 1)} lakh` })()}</b></div>}
                </>}
                {c.warnings.map((w) => <p className="note" key={w}>{w}</p>)}
              </div>
              <div className="card c7">
                <h2>What moves it most</h2><div className="sub">Median ₹ per km when one input is moved by the amount shown. The marker is today's cost.</div>
                {tor.length === 0 ? <p className="note">The sensitivity chart appears once a battery price is entered.</p> :
                  <div className="tor2">{tor.map((t) => {
                    const n = NAMES[t.input] ?? [t.input, ''], lo = num(t.low_case) ?? 0, hi = num(t.high_case) ?? 0, base = num(t.base) ?? med ?? 0
                    const lv = LEVER[t.input]?.(scenario), cheaperLow = lo <= hi
                    const cheap = Math.min(lo, hi), dear = Math.max(lo, hi)
                    return (
                      <div className="r" key={t.input}>
                        <div className="rh"><span>{n[0]} <span className="tag">{n[1]}</span></span><b>{inr(cheap, 2)} to {inr(dear, 2)}</b></div>
                        <div className="track" role="img" aria-label={`${n[0]}: cost per km from ₹${cheap.toFixed(2)} to ₹${dear.toFixed(2)}, today ₹${base.toFixed(2)}`}><i className="span" style={{ left: pos(cheap), width: `calc(${pos(dear)} - ${pos(cheap)})` }} /><i className="base" style={{ left: pos(base) }} /></div>
                        {lv && <div className="acts"><button className="btn sm" onClick={() => set(lv.key, cheaperLow ? lv.low : lv.high)}>Try the cheaper case</button></div>}
                      </div>
                    )
                  })}</div>}
              </div>
            </div>
          </>
        )
      }}</Async>
    </Page>
  )
}
