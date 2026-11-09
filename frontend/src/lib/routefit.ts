import { atYear, crossingYear } from './format'

/** The recommender's reserve rule: a route must still fit with 20 % to spare. */
export const RESERVE = 0.2
export const routeNeedKm = (kmPerDay: number, reserve = RESERVE) => kmPerDay * (1 + reserve)

/** Range (km) of a full charge at `year`, from new-pack range and a retention curve in percent (one value per month). */
export const rangeAt = (newKm: number, retentionPct: number[], year: number) => (newKm * atYear(retentionPct, year)) / 100

export type Coverage = { kind: 'never' | 'until' | 'beyond'; year: number | null }
/** How long a retention curve keeps range at or above the route need. 'never' = short already when new; 'beyond' = still covers at the end of the forecast. */
export function coverage(newKm: number, retentionPct: number[], needKm: number): Coverage {
  if (newKm < needKm) return { kind: 'never', year: 0 }
  const series = retentionPct.map((r) => (newKm * r) / 100)
  const y = crossingYear(series, needKm)
  return y == null ? { kind: 'beyond', year: null } : { kind: 'until', year: y }
}
