import type { Labelled } from '../api/types'

const TEXT = {
  lab: 'Fitted on public laboratory data. Never checked on buses.',
  assumption: 'An assumption: no data behind it for buses.',
  derived: 'Calculated from laboratory data and assumptions. Inherits the weakest of them.',
}
const NAME = { lab: 'lab data', assumption: 'assumption', derived: 'derived' }

export function EvidenceBadge({ level, label }: { level: Labelled['evidence_level']; label?: string }) {
  return <span className={`tag ${level}`} title={`${TEXT[level]} Not yet validated on buses.`}>{label ?? NAME[level]}</span>
}
