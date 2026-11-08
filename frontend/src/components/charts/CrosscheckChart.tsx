import type { CrosscheckScenario } from '../../api/types'
import { band, G, Grid, path, X, XAxis, type Box } from './geometry'

const H = { w: 700, h: 300 }
const LO = 0, HI = 100

/** Yearly series (index = year, fraction) to a monthly percent series so the shared path helpers can draw it. */
const monthly = (yearly: number[], horizon: number) =>
  Array.from({ length: horizon * 12 + 1 }, (_, m) => {
    const f = Math.min(m / 12, yearly.length - 1), i = Math.min(yearly.length - 2, Math.floor(f))
    return (yearly[i] + (yearly[i + 1] - yearly[i]) * (f - i)) * 100
  })

export function CrosscheckChart({ s, horizon, threshold }: { s: CrosscheckScenario; horizon: number; threshold: number }) {
  const b: Box = { ...H, xMax: horizon }
  const p10 = monthly(s.ours_p10, horizon), p50 = monthly(s.ours_cell_p50, horizon), p90 = monthly(s.ours_p90, horizon)
  const bl = monthly(s.blast, horizon), sony = monthly(s.blast_alt, horizon)
  const ty = G.T + ((H.h - G.T - G.B) * (HI - threshold * 100)) / (HI - LO)
  return (
    <svg className="ch" viewBox={`0 0 ${H.w} ${H.h}`} role="img"
      aria-label={`Capacity kept over ${horizon} years for ${s.label}: our model against the two BLAST-Lite LFP models. The table view lists the numbers.`}>
      <Grid b={b} ticks={[20, 40, 60, 80, 100]} lo={LO} hi={HI} fmt={(t) => `${t}%`} />
      <XAxis b={b} />
      <line x1={G.L} x2={H.w - G.R} y1={ty} y2={ty} stroke="#fff" strokeOpacity=".55" strokeDasharray="6 5" />
      <text x={G.L + 8} y={ty + 18} style={{ fill: '#fff' }}>Replace at {Math.round(threshold * 100)}%</text>
      <path d={band(b, p90, p10, LO, HI)} fill="rgba(250,204,21,.14)" />
      <path d={path(b, p50, LO, HI)} fill="none" stroke="#FACC15" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path(b, bl, LO, HI)} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path(b, sony, LO, HI)} fill="none" stroke="#B4B4BC" strokeWidth="2.4" strokeDasharray="7 5" strokeLinecap="round" />
      <line x1={X(b, 10)} x2={X(b, 10)} y1={G.T} y2={H.h - G.B} stroke="#fff" strokeOpacity=".18" strokeDasharray="2 4" />
    </svg>
  )
}
