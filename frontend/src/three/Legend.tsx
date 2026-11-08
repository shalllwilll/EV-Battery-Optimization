import { DIFF_SCALE, diffCss, healthCss } from '../lib/colors'

export function Legend({ linePct, bare }: { linePct: number; bare?: boolean }) {
  const lo = linePct - 25, span = 100 - lo
  const stops = Array.from({ length: 11 }, (_, i) => `${healthCss(100 - (span * i) / 10, linePct)} ${i * 10}%`).join(',')
  return (
    <div className={`vlegend${bare ? ' bare' : ' glass'}`} role="img" aria-label={`Colour scale: yellow at 100 percent health, orange at the ${linePct} percent replacement line, red at ${lo} percent`}>
      <span>100%</span><i style={{ background: `linear-gradient(90deg,${stops})` }}><u style={{ left: `${((100 - linePct) / span) * 100}%` }} /></i><span>{lo}%</span>
      <em>White tick = replacement line ({linePct}%)</em>
    </div>
  )
}

export type CompareMode = 'health' | 'diff'

/** Legend for the comparison page: a switch between the two colourings, and the scale for whichever is on. */
export function CompareLegend({ mode, onMode, linePct, idle }: { mode: CompareMode; onMode: (m: CompareMode) => void; linePct: number; idle?: boolean }) {
  const stops = [-DIFF_SCALE, -DIFF_SCALE / 2, 0, DIFF_SCALE / 2, DIFF_SCALE].map((d, i) => `${diffCss(d)} ${i * 25}%`).join(',')
  return (
    <div className="cmpleg glass">
      <div className="cmpmode" role="group" aria-label="What the colours show">
        <button aria-pressed={mode === 'health'} onClick={() => onMode('health')}>Health</button>
        <button aria-pressed={mode === 'diff'} onClick={() => onMode('diff')}>Difference</button>
      </div>
      {mode === 'health'
        ? <Legend linePct={linePct} bare />
        : (
          <div className="dleg" role="img" aria-label={`Colour scale: red when Bus B is ${DIFF_SCALE} or more percentage points less healthy than Bus A, grey when the same, yellow when ${DIFF_SCALE} or more points healthier`}>
            <span>−{DIFF_SCALE} pts</span><i style={{ background: `linear-gradient(90deg,${stops})` }} /><span>+{DIFF_SCALE} pts</span>
            <em>{idle ? 'Change Bus B to see where it differs.' : 'Bus B health minus Bus A, at this year. Bus A is grey.'}</em>
          </div>
        )}
    </div>
  )
}
