import { useEffect, useRef, useState } from 'react'
import { useYear } from '../state/YearContext'

type Props = { p10: number[]; p50: number[]; p90: number[]; thresholdPct: number; xMax: number; win?: [number | null, number | null] }
const W = 800, H = 50
const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches

export function YearScrubber({ p10, p50, p90, thresholdPct, xMax, win }: Props) {
  const { year, setYear } = useYear()
  const [playing, setPlaying] = useState(false)
  const yr = useRef(year)
  yr.current = year
  useEffect(() => {
    if (!playing) return
    let raf = 0, last = performance.now()
    const tick = (t: number) => { const n = yr.current + ((t - last) / 1000) * (xMax / 8); last = t; setYear(n > xMax ? 0 : n); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, xMax, setYear])
  const x = (y: number) => (W * y) / xMax, v = (a: number) => 4 + (H - 8) * (100 - Math.max(a, 30)) / 70
  const n = Math.min(p50.length, Math.round(xMax * 12) + 1)
  const line = (a: number[]) => a.slice(0, n).map((e, i) => `${i ? 'L' : 'M'}${x(i / 12).toFixed(1)} ${v(e).toFixed(1)}`).join('')
  const rv = (a: number[]) => { let s = ''; for (let i = n - 1; i >= 0; i--) s += `L${x(i / 12).toFixed(1)} ${v(a[i]).toFixed(1)}`; return s }
  const ticks: number[] = []
  for (let t = 0; t <= xMax; t += xMax > 10 ? 3 : 2) ticks.push(t)
  return (
    <div className="tl glass">
      <span className="yrl">Year <b>{year.toFixed(1)}</b></span>
      <button className="play" aria-label={playing ? 'Pause' : 'Play through the years'} aria-pressed={playing} onClick={() => { if (reduced() && !playing) { setYear(Math.min(xMax, year + 1)); return } setPlaying((p) => !p) }}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d={playing ? 'M3 2h3.4v12H3zM9.6 2H13v12H9.6z' : 'M4 2v12l10-6z'} fill="#09090B" /></svg>
      </button>
      <div className="trk">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {win?.[0] != null && <rect x={x(win[0])} width={Math.max(0, x(Math.min(win[1] ?? xMax, xMax)) - x(win[0]))} height={H} fill="rgba(255,255,255,.06)" />}
          <line x1="0" x2={W} y1={v(thresholdPct)} y2={v(thresholdPct)} stroke="rgba(255,255,255,.3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={line(p90) + rv(p10) + 'Z'} fill="rgba(250,204,21,.2)" />
          <path d={line(p50)} fill="none" stroke="#FACC15" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <line x1={x(year)} x2={x(year)} y1="0" y2={H} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <input type="range" min={0} max={xMax} step={0.05} value={Math.min(year, xMax)} aria-label="Years in service" aria-valuetext={`${year.toFixed(1)} years`} onChange={(e) => { setPlaying(false); setYear(+e.target.value) }} />
      </div>
      <div className="axis" style={{ gridColumn: 2 }}>{ticks.map((t) => <span key={t}>{t === 0 ? 'New' : t}</span>)}<span>years</span></div>
    </div>
  )
}
