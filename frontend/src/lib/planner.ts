/** Turns the model's "share of runs that have reached the replacement line by month m" (a cumulative curve, 0..1 per month) into planning views.
 *  Every view assumes a fleet spreads like the model's runs: independent buses, no second pack, no discounting. */

/** One dot per 1/n of the runs, at the month it reached the line. `null` = had not reached it by the end of the forecast. */
export function quantileDots(cdf: number[], n = 50): (number | null)[] {
  return Array.from({ length: n }, (_, i) => {
    const q = (i + 0.5) / n
    const m = cdf.findIndex((p) => p >= q - 1e-9)
    return m < 0 ? null : m
  })
}

export type YearBar = { year: number; expected: number }
/** Expected number of buses (out of `fleet`) reaching the line in each year of the forecast, plus the expected number still going after it. */
export function annualSchedule(cdf: number[], fleet: number) {
  const last = cdf.length - 1, years = Math.floor(last / 12)
  const at = (m: number) => cdf[Math.min(m, last)]
  const bars: YearBar[] = Array.from({ length: years }, (_, y) => ({ year: y + 1, expected: fleet * Math.max(0, at((y + 1) * 12) - at(y * 12)) }))
  return { bars, after: fleet * Math.max(0, 1 - at(years * 12)) }
}

/** Running total of the first-pack spend after each year (undiscounted). */
export const cumulativeSpend = (bars: YearBar[], packCostInr: number) => {
  let s = 0
  return bars.map((b) => (s += b.expected * packCostInr))
}
