import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import type { PresetResult } from '../api/types'
import { useCompare, usePredict, useRecommend } from '../api/hooks'
import { Async, Skeleton } from '../components/Async'
import { BusBControls } from '../components/BusBControls'
import { EvidenceBadge } from '../components/EvidenceBadge'
import { HealthChart } from '../components/charts/HealthChart'
import { WithTable } from '../components/DataTable'
import { PresetCards } from '../components/PresetCards'
import { YearScrubber } from '../components/YearScrubber'
import { Page } from '../components/Workspace'
import { applyOverrides, diffLevers, hasChanges, lifeChange, newWarnings, sameLevers, signed, stageFor, type LeverKey, type Overrides } from '../lib/busB'
import { atYear, fmt, inr, num } from '../lib/format'
import { curves, repYears, xMaxFor } from '../lib/results'
import { validateScenario } from '../lib/scenario'
import { useScenario } from '../state/ScenarioContext'
import { useYear } from '../state/YearContext'
import type { BusSpec } from '../three/BusStage'
import { useViewState } from '../three/viewState'

const BusViewer = lazy(() => import('../three/BusViewer').then((m) => ({ default: m.BusViewer })))
const Z = 3.1

function Delta({ label, a, b, delta, sub, good }: { label: string; a: string; b: string; delta: string; sub: string; good: 'up' | 'down' | 'none' }) {
  return (
    <div className="kcard"><small>{label}</small>
      <div className="kv">{b}</div>
      <div className={`ks dl ${good}`}>{delta}</div>
      <div className="ks">Bus A: {a}. {sub}</div>
    </div>
  )
}

export default function Optimise() {
  const { scenario, valid } = useScenario()
  const { year } = useYear()
  const [over, setOver] = useState<Overrides>({})
  const [confirm, setConfirm] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [view, api] = useViewState('cmp')
  const viewerRef = useRef<HTMLDivElement>(null)

  // Bus B = Bus A plus the levers that really differ
  const eff = useMemo(() => diffLevers(scenario, applyOverrides(scenario, over)), [scenario, over])
  const changed = hasChanges(eff)
  const busB = useMemo(() => applyOverrides(scenario, eff), [scenario, eff])
  const bOk = valid && Object.keys(validateScenario(busB)).length === 0
  const run = changed && bOk

  const predA = usePredict(valid ? scenario : null)
  const predB = usePredict(run ? busB : null)
  const cmp = useCompare(run ? scenario : null, run ? busB : null)
  const rec = useRecommend(valid ? scenario : null)

  const setLever = useCallback((k: LeverKey, v: number) => setOver((o) => ({ ...o, [k]: v })), [])
  const reset = useCallback(() => setOver({}), [])
  // the goal the user chose stays highlighted for as long as Bus B still matches it (several goals can give identical advice)
  const appliedId = useMemo(() => {
    const p = rec.data?.presets.find((x) => x.id === pickedId)
    return p && hasChanges(eff) && sameLevers(eff, diffLevers(scenario, stageFor(p, confirm).scenario)) ? p.id : null
  }, [rec.data, pickedId, eff, scenario, confirm])
  const pick = useCallback((p: PresetResult) => {
    setPickedId(p.id)
    setOver(diffLevers(scenario, stageFor(p, confirm).scenario))
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches
    viewerRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [scenario, confirm])

  // Allowing cooling and energy-use changes while a goal is on Bus B re-applies that goal with the matching stage, so Bus B never silently lags the toggle.
  const toggleConfirm = useCallback((on: boolean) => {
    setConfirm(on)
    const p = rec.data?.presets.find((x) => x.id === appliedId)
    if (p) setOver(diffLevers(scenario, stageFor(p, on).scenario))
  }, [rec.data, appliedId, scenario])

  const lengthM = scenario.archetype === '9m' ? 9 : 12
  return (
    <Page title="Compare two buses" intro="Bus A is your bus as it runs today. Bus B is the same bus with changes you choose. Both run through the same model on the same simulated packs, so the gap you see is the effect of your changes, not noise.">
      <Async q={predA} h={500}>{(pa) => {
        const usingB = run && !!cmp.data && !!predB.data
        const waiting = run && !usingB
        const rA = usingB ? cmp.data!.replacements[0] : pa.replacement, rB = usingB ? cmp.data!.replacements[1] : pa.replacement
        const pb = usingB ? predB.data! : pa
        const cA = curves(rA), cB = curves(rB), xMax = xMaxFor(pa), y = Math.min(year, xMax)
        const hA = atYear(cA.p50, y), hB = atYear(cB.p50, y), line = scenario.threshold * 100
        const mA = num(rA.months_p50), mB = num(rB.months_p50), d = usingB ? cmp.data!.deltas[0] : null
        const costA = num(pa.cost.cost_per_km_p50), costB = num(pb.cost.cost_per_km_p50)
        const rngA = (num(pa.range.new_pack_range_km) ?? 0) * scenario.threshold, rngB = (num(pb.range.new_pack_range_km) ?? 0) * scenario.threshold
        const f = rec.data?.feasibility
        const need = f ? (f.base_passes ? num(f.required_range_km) : num(f.base_range_at_replacement_km)) : null
        const tight = usingB && need != null && rngB < need - 0.5
        const life = d ? lifeChange(num(d.months_p50) ?? 0, num(d.months_p10) ?? 0, num(d.months_p90) ?? 0) : null
        const buses: BusSpec[] = [{ key: 'a', label: 'Bus A', healthPct: hA, offsetZ: -Z }, { key: 'b', label: 'Bus B', healthPct: hB, offsetZ: Z, packLabels: false }]
        const r = repYears(rA)
        const heads = usingB ? newWarnings(pa.conditions.warnings, pb.conditions.warnings) : []
        const dPts = hB - hA
        return (
          <div className="stack">
            {f && (
              <div className={`card feas${f.base_passes ? '' : ' warn'}`} role="note">
                <div className="hd"><h3>{f.base_passes ? 'Your route check' : 'Your route is already tight on range'}</h3><EvidenceBadge level="derived" /></div>
                <p className="plainbig">{f.plain}</p>
                <div className="note">{f.rule_applied}</div>
              </div>
            )}

            <div className="cmpgrid" ref={viewerRef}>
              {rec.data
                ? <BusBControls a={scenario} over={eff} setLever={setLever} reset={reset} presets={rec.data.presets} appliedId={appliedId} onPick={pick} includeConfirm={confirm} setIncludeConfirm={toggleConfirm} />
                : <div className="card bctl"><h3>Bus B settings</h3>{rec.error ? <p className="note">The goal presets could not be loaded. You can still use the sliders after they load, or try again.</p> : <Skeleton h={300} />}</div>}
              <div className="cmpmain">
                <div className="kstrip" aria-busy={waiting} data-waiting={waiting}>
                  <Delta label={`Health at year ${y.toFixed(1)}`} b={`${fmt(hB, 1)}%`} a={`${fmt(hA, 1)}%`} delta={changed ? `${signed(dPts, 1)} points` : 'No changes yet'} sub="Median pack." good={dPts > 0.05 ? 'up' : dPts < -0.05 ? 'down' : 'none'} />
                  <Delta label="Replace around" b={mB == null ? 'beyond forecast' : `${fmt(mB / 12, 1)} years`} a={mA == null ? 'beyond forecast' : `${fmt(mA / 12, 1)} years`} delta={life ? life.headline : 'No changes yet'} sub={d ? `${life!.range}. Bus B lasts longer in ${fmt((num(d.prob_variant_later) ?? 0) * 100)}% of simulated packs.` : 'Move a slider or pick a goal.'} good={d ? ((num(d.months_p50) ?? 0) > 0.05 ? 'up' : (num(d.months_p50) ?? 0) < -0.05 ? 'down' : 'none') : 'none'} />
                  <Delta label="Battery cost per km" b={inr(costB, 2)} a={inr(costA, 2)} delta={costA == null || costB == null || !changed ? (costA == null ? 'Enter a battery price' : 'No changes yet') : (Math.abs(costB - costA) < 0.005 ? 'No change' : `${costB < costA ? '−' : '+'}₹${Math.abs(costB - costA).toFixed(2)} per km`)} sub="Median." good={costA != null && costB != null ? (costB < costA - 0.005 ? 'up' : costB > costA + 0.005 ? 'down' : 'none') : 'none'} />
                  <Delta label="Range when replaced" b={`${fmt(rngB)} km`} a={`${fmt(rngA)} km`} delta={changed ? (Math.abs(rngB - rngA) < 0.5 ? 'Same' : signed(rngB - rngA, 0, ' km')) : 'No changes yet'} sub={tight ? (f?.base_passes ? 'Below your route plus 20 % reserve.' : 'Less than Bus A has.') : 'On a full charge.'} good={tight ? 'down' : rngB > rngA + 0.5 ? 'up' : rngB < rngA - 0.5 ? 'down' : 'none'} />
                </div>
                {heads.length > 0 && <div className="errbox" role="alert"><b>Heads-up for Bus B</b>{heads.map((h) => <p key={h}>{h}</p>)}</div>}
                {tight && <div className="errbox" role="alert"><b>Bus B gives up too much range</b><p>{f?.base_passes ? `When the pack is due for replacement Bus B could drive about ${fmt(rngB)} km on a charge, but your route needs ${fmt(need)} km (route plus a 20 % reserve). Raise the charge cap or shorten the route before using this setting.` : `Bus A is already below the reserve on this route, so presets are held to Bus A's own range (${fmt(need)} km). Bus B drops below that, at about ${fmt(rngB)} km.`}</p></div>}
                <div className="card" style={{ padding: 16 }}>
                  <Suspense fallback={<Skeleton h={520} />}>
                    <BusViewer buses={buses} lengthM={lengthM} linePct={line} view={view} api={api} year={y} height={520} compare
                      rows={[{ label: 'Bus A', p10: atYear(cA.p10, y), p50: hA, p90: atYear(cA.p90, y) }, { label: 'Bus B', p10: atYear(cB.p10, y), p50: hB, p90: atYear(cB.p90, y) }]}
                      ariaLabel={`3D comparison of two ${lengthM} metre electric buses. Bus A battery health ${fmt(hA, 0)} percent, Bus B ${fmt(hB, 0)} percent at year ${y.toFixed(1)}`} />
                  </Suspense>
                </div>
                <div style={{ marginTop: 16 }}><YearScrubber p10={cA.p10} p50={cA.p50} p90={cA.p90} thresholdPct={line} xMax={xMax} win={[r[0], r[2]]} /></div>
              </div>
            </div>

            <div className="bento">
              <div className="card c7">
                <div className="hd"><div><h3>Health over time, Bus A and Bus B</h3><div className="sub">Yellow line and band: Bus A. White dashed line: Bus B.</div></div><EvidenceBadge level="derived" /></div>
                <WithTable chart={<HealthChart {...cA} thresholdPct={line} medianYear={r[1]} xMax={xMax} other={changed ? cB.p50 : undefined} label="Battery health of Bus A with its likely range, and the median health of Bus B" />}
                  head={['Year', 'Bus A median %', 'Bus B median %']}
                  rows={Array.from({ length: Math.round(xMax) + 1 }, (_, i) => [i, fmt(cA.p50[i * 12]), fmt(cB.p50[i * 12])])} />
              </div>
              <div className="card c5">
                <h3>What we did not change, and why</h3>
                <div className="sub">Levers the search left alone</div>
                {rec.data ? <ul className="notused">{rec.data.not_used.map((n) => <li key={n.lever}><b>{n.lever}</b><span>{n.reason}</span></li>)}</ul> : <Skeleton h={160} />}
              </div>
            </div>

            <section aria-labelledby="pre-h">
              <div className="sechd"><h2 id="pre-h">Suggested ways to run Bus A</h2><p>Each goal is a search over charge cap and charging start time (and, if you allow it, cooling and energy use) that keeps the route possible. They are options to test. The model cannot know whether they will be followed.</p></div>
              <Async q={rec} h={320}>{(rr) => <>
                <PresetCards rec={rr} includeConfirm={confirm} appliedId={appliedId} onTry={pick} />
                <div className="card" style={{ marginTop: 16 }}>
                  {rr.notes.map((n) => <p className="note" key={n}>{n}</p>)}
                  {rr.warnings.map((w) => <p className="note" key={w}>{w}</p>)}
                </div>
              </>}</Async>
            </section>
          </div>
        )
      }}</Async>
    </Page>
  )
}
