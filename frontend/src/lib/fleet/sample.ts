import type { ArchetypePreset } from '../../api/types'
import { DEFAULT_PRICE } from '../scenario'
import { classify } from './classes'
import type { DraftBus, Fleet } from './types'

/** Small seeded generator, so the sample fleet is the same every time for the same date. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

/** Five duty classes over three depots. Each route's buses share one duty, as route sheets do. All numbers are the bus-type presets with a few
 *  of the duty inputs moved, and in-service months are drawn for the demonstration. It is not a real fleet and says so everywhere it appears. */
const ROUTES = [
  { depot: 'Depot A', route: 'Route 1', type: '12m', n: 16, km: 0, start: 0 },
  { depot: 'Depot A', route: 'Route 2', type: '12m', n: 14, km: 40, start: 1 },
  { depot: 'Depot B', route: 'Route 3', type: '9m', n: 12, km: 0, start: 0 },
  { depot: 'Depot B', route: 'Route 4', type: '12m', n: 10, km: -40, start: 2 },
  { depot: 'Depot C', route: 'Route 5', type: '9m', n: 8, km: 25, start: -1 },
] as const

export function sampleFleet(presets: Pick<ArchetypePreset, 'id' | 'scenario'>[], now: Date = new Date()): Fleet {
  const rand = rng(2026)
  const nowIdx = now.getFullYear() * 12 + now.getMonth()
  const drafts: DraftBus[] = []
  let n = 100
  for (const r of ROUTES) {
    const base = presets.find((p) => p.id === r.type)?.scenario ?? presets[0].scenario
    const start = (((base.charge_start_hour + r.start) % 24) + 24) % 24
    const scenario = { ...base, battery_cost_per_kwh_inr: DEFAULT_PRICE, km_per_day: Math.max(60, base.km_per_day + r.km), charge_start_hour: start }
    for (let i = 0; i < r.n; i++) {
      const idx = nowIdx - Math.floor(6 + rand() * 102)          // in service 6 to 107 months ago: deliberately wide, so the grouping has something to show (the oldest the forecast can take is 9 years)
      drafts.push({ id: `B-${n++}`, depot: r.depot, route: r.route, inServiceMonth: ym(Math.floor(idx / 12), (idx % 12) + 1), scenario })
    }
  }
  const c = classify(drafts, 'sample')
  return { id: 'sample', name: 'Sample fleet: synthetic, for demonstration', kind: 'sample', classes: c.classes, buses: c.buses, createdAt: now.toISOString() }
}
