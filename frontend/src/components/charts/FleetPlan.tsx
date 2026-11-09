import { useEffect, useState } from 'react'
import { WithTable } from '../DataTable'
import { annualSchedule, cumulativeSpend } from '../../lib/planner'
import { fmt } from '../../lib/format'
import { useYear } from '../../state/YearContext'
import { G, Grid, Tip, X, XAxis, Y, type Box } from './geometry'

const KEY = 'ph.fleet'
const H = { w: 700, h: 210 }
const lakh = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} crore` : `₹${(v / 1e5).toFixed(1)} lakh`)
const load = () => { try { const n = Number(localStorage.getItem(KEY)); return Number.isFinite(n) && n >= 1 ? Math.min(5000, Math.round(n)) : 50 } catch { return 50 } }

/** The same distribution applied to a fleet: how many buses reach the line each year, and what first packs would cost. */
export function FleetPlan({ cdf, packCostInr, xMax }: { cdf: number[]; packCostInr: number | null; xMax: number }) {
  const [fleet, setFleet] = useState(load)
  useEffect(() => { try { localStorage.setItem(KEY, String(fleet)) } catch { /* private window: keep going without it */ } }, [fleet])
  const { year, setYear } = useYear()
  const [hov, setHov] = useState<number | null>(null)
  const { bars, after } = annualSchedule(cdf, fleet)
  const shown = bars.filter((b) => b.year <= Math.ceil(xMax))
  const cum = packCostInr != null ? cumulativeSpend(bars, packCostInr) : null
  const top = Math.max(1, Math.ceil(Math.max(...shown.map((b) => b.expected), 0.5) * 1.15))
  const b: Box = { ...H, xMax: shown.length || 1 }
  const bw = ((H.w - G.L - G.R) / b.xMax) * 0.7
  const yi = Math.min(shown.length, Math.max(1, Math.ceil(year))) - 1
  const doneBy = shown.slice(0, yi + 1).reduce((s, x) => s + x.expected, 0)
  return (
    <>
      <div className="fleet-in">
        <label>Buses in the fleet<input type="number" min={1} max={5000} value={fleet} onChange={(e) => setFleet(Math.min(5000, Math.max(1, Math.round(+e.target.value || 1))))} /></label>
        <div className="fleet-k"><small>By year {year.toFixed(1)}</small><b>{fmt(doneBy)}<span> replaced</span></b></div>
        {cum && <div className="fleet-k"><small>First packs by then</small><b>{lakh(cum[yi] ?? 0)}</b></div>}
        <div className="fleet-k"><small>Still going after {xMax >= (cdf.length - 1) / 12 ? 'the forecast' : `year ${Math.ceil(xMax)}`}</small><b>{fmt(after)}<span> buses</span></b></div>
      </div>
      <WithTable
        chart={
          <svg className="ch" viewBox={`0 0 ${H.w} ${H.h}`} role="img" aria-label={`Expected number of the ${fleet} buses reaching the replacement line in each year. Year ${yi + 1} expects ${shown[yi]?.expected.toFixed(1) ?? 0} buses.`}>
            <Grid b={b} ticks={[0, top / 2, top].map((t) => +t.toFixed(1))} lo={0} hi={top} fmt={(t) => `${t}`} />
            <XAxis b={{ ...b, xMax: shown.length }} />
            {shown.map((s) => {
              const x = X(b, s.year - 0.5) - bw / 2, y = Y(b, s.expected, 0, top), on = s.year === yi + 1
              return (
                <g key={s.year} onPointerEnter={() => setHov(s.year)} onPointerLeave={() => setHov(null)} onClick={() => setYear(s.year)} style={{ cursor: 'pointer' }}>
                  <rect x={X(b, s.year - 1)} y={G.T} width={X(b, 1) - X(b, 0)} height={H.h - G.T - G.B} fill="transparent" />
                  <rect x={x} y={y} width={bw} height={Math.max(0, H.h - G.B - y)} rx="4" fill={on ? '#FACC15' : 'rgba(250,204,21,.45)'} />
                </g>
              )
            })}
            {hov != null && shown[hov - 1] && <Tip b={b} x={X(b, hov - 0.5)} y={Y(b, shown[hov - 1].expected, 0, top)} lines={[[`Year ${hov}`], [`${shown[hov - 1].expected.toFixed(1)} buses`, '#FACC15'], ...(cum ? [[lakh(cum[hov - 1]), '#D4D4D8'] as [string, string]] : [])]} />}
          </svg>
        }
        head={['Year', 'Expected buses', ...(cum ? ['First packs so far'] : [])]}
        rows={shown.map((s) => [s.year, s.expected.toFixed(1), ...(cum ? [lakh(cum[s.year - 1])] : [])])} />
      <p className="note">Assumes buses spread out like the model's runs, they age independently, each is replaced once, and money is not discounted. Fleet size is remembered in this browser only.</p>
    </>
  )
}
