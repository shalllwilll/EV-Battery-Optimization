import { healthCss } from '../lib/colors'

export function Legend({ linePct }: { linePct: number }) {
  const lo = linePct - 25, span = 100 - lo
  const stops = Array.from({ length: 11 }, (_, i) => `${healthCss(100 - (span * i) / 10, linePct)} ${i * 10}%`).join(',')
  return (
    <div className="vlegend glass" role="img" aria-label={`Colour scale: yellow at 100 percent health, orange at the ${linePct} percent replacement line, red at ${lo} percent`}>
      <span>100%</span><i style={{ background: `linear-gradient(90deg,${stops})` }}><u style={{ left: `${((100 - linePct) / span) * 100}%` }} /></i><span>{lo}%</span>
      <em>White tick = replacement line ({linePct}%)</em>
    </div>
  )
}
