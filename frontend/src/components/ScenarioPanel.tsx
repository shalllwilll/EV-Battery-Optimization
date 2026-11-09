import { useRef, useState } from 'react'
import { ApiClientError } from '../api/client'
import { usePredict, useZones } from '../api/hooks'
import { FIELDS, GROUPS, ZONE_LABELS, ZONE_SUB, type FieldKey } from '../lib/scenario'
import { useScenario } from '../state/ScenarioContext'
import { FieldWithBadge } from './FieldWithBadge'
import { toast } from './Toast'
import { CsvImport } from './CsvImport'
import { useThumb } from '../lib/useThumb'
import { IconLink, IconReset, IconUpload } from './Icons'

export function ScenarioPanel({ drawer }: { drawer?: boolean }) {
  const s = useScenario()
  const zones = useZones()
  const p = usePredict(s.valid ? s.scenario : null)
  const serverFields: Record<string, string> = {}
  if (p.error instanceof ApiClientError) for (const f of p.error.fields) serverFields[f.field.replace(/^scenario\./, '')] = f.message
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const segRef = useRef<HTMLDivElement>(null)
  const thumb = useThumb(segRef, '[aria-pressed=true]', s.scenario.archetype)

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link copied') } catch { toast('Copy the address bar to share this scenario') }
  }
  return (
    <>
      {!drawer && <button className="scen-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span>Scenario</span><span style={{ fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--body)' }}>{s.scenario.archetype} · {ZONE_LABELS[s.scenario.zone]} · {s.scenario.km_per_day} km</span></button>}
      <aside className={`scen${open ? ' open' : ''}${drawer ? ' in-drawer' : ''}`} aria-label="Scenario inputs">
        {!drawer && <header><h2>Scenario</h2></header>}
        <div className="scen-tools" role="toolbar" aria-label="Scenario actions">
          <button className="sbt" aria-expanded={importOpen} aria-controls="csv-panel" onClick={() => setImportOpen((o) => !o)}><IconUpload />Import CSV</button>
          <span className="sp" />
          <button className="sbt" aria-label="Reset to defaults" title="Reset every input to its default" onClick={s.reset}><IconReset />Reset</button>
          <button className="sbt" title="Copy a link that opens this scenario" onClick={copyLink}><IconLink />Copy link</button>
        </div>
        {importOpen && <CsvImport />}
        {s.notice && <div className="notice" role="status" style={{ margin: '10px 0' }}><span>{s.notice}</span><button className="btn sm" onClick={s.dismissNotice}>OK</button></div>}
        <div className="grp"><h3>Bus</h3>
          <div className="fld"><div className="l"><span id="bt">Bus type</span></div>
            <div className="seg" ref={segRef} role="group" aria-labelledby="bt"><span className="thumb" style={thumb} />
              {(['12m', '9m'] as const).map((a) => <button key={a} aria-pressed={s.scenario.archetype === a} onClick={() => s.setArchetype(a)}>{a === '12m' ? '12 m' : '9 m'}</button>)}
            </div>
            <div className="src">Changing bus type refreshes size, energy use, distance, charger and days; your other choices stay.</div>
          </div>
          {FIELDS.filter((f) => f.group === 'Bus').map((f) => <Field key={f.key} k={f.key} serverFields={serverFields} />)}
        </div>
        <div className="grp"><h3>Duty</h3>{FIELDS.filter((f) => f.group === 'Duty').map((f) => <Field key={f.key} k={f.key} serverFields={serverFields} />)}</div>
        <div className="grp"><h3>Charging</h3>{FIELDS.filter((f) => f.group === 'Charging').map((f) => <Field key={f.key} k={f.key} serverFields={serverFields} />)}</div>
        <div className="grp"><h3>Climate and heat</h3>
          <div className="fld"><div className="l"><label htmlFor="zone">Climate zone</label><span className="tag lab" title="Real NASA POWER air temperatures, 2015 to 2024">real weather</span></div>
            <select id="zone" className="sel" value={s.scenario.zone} onChange={(e) => s.setZone(e.target.value as typeof s.scenario.zone)}>
              {(zones.data?.zones.map((z) => z.id) ?? Object.keys(ZONE_LABELS)).map((z) => <option key={z} value={z}>{ZONE_LABELS[z]} · {ZONE_SUB[z]}</option>)}
            </select></div>
          {FIELDS.filter((f) => f.group === 'Climate and heat').map((f) => <Field key={f.key} k={f.key} serverFields={serverFields} />)}
        </div>
        {GROUPS.slice(4).map((g) => <div className="grp" key={g}><h3>{g}</h3>{FIELDS.filter((f) => f.group === g).map((f) => <Field key={f.key} k={f.key} serverFields={serverFields} />)}</div>)}
        <p className="note">Every input here is a labelled assumption about the bus. The model re-runs automatically when they are valid.</p>
      </aside>
    </>
  )
}

function Field({ k, serverFields }: { k: FieldKey; serverFields: Record<string, string> }) {
  const s = useScenario()
  const meta = FIELDS.find((f) => f.key === k)!
  const v = s.scenario[k] as number | null
  return <FieldWithBadge meta={meta} value={v} error={s.errors[k]} serverError={serverFields[k]} onChange={(x) => s.setField(k, x)} />
}
