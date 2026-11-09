/** Cost-per-km helpers. In the engine each run's cost is pack price / km driven until the replacement line, so for a fixed battery life every
 *  percentile of cost scales exactly with the price per kWh (locked by tests/test_cost_scaling.py). Nothing else scales this way: threshold and
 *  km per day change the life, so they always need a fresh /predict. */
export type CostBand = { p10: number; p50: number; p90: number }

export const scaleCost = (c: CostBand, price: number, basePrice: number): CostBand => {
  const k = basePrice > 0 ? price / basePrice : 1
  return { p10: c.p10 * k, p50: c.p50 * k, p90: c.p90 * k }
}

/** Price per kWh at which the median cost per km hits `target`. */
export const breakEvenPrice = (basePrice: number, baseP50: number, target: number): number | null =>
  baseP50 > 0 && target > 0 ? (basePrice * target) / baseP50 : null

export function priceCurve(c: CostBand, basePrice: number, lo: number, hi: number, n = 24) {
  return Array.from({ length: n + 1 }, (_, i) => { const price = lo + ((hi - lo) * i) / n; return { price, ...scaleCost(c, price, basePrice) } })
}

/** Cost per km moved by each extra Rs 1,000 per kWh. */
export const perThousand = (basePrice: number, baseP50: number) => (basePrice > 0 ? (baseP50 / basePrice) * 1000 : 0)

/** Pack cost spread over its life, per year. */
export const packCostPerYear = (packCostInr: number, lifeMonths: number | null) => (lifeMonths == null || lifeMonths <= 0 ? null : packCostInr / (lifeMonths / 12))
