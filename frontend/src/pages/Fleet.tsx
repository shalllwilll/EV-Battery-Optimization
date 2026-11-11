import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddBuses, sampleIntake, type Method } from '../components/fleet/AddBuses'
import { FleetGate } from '../components/fleet/FleetGate'
import { BudgetBlock } from '../components/fleet/BudgetBlock'
import { FleetLevers } from '../components/fleet/FleetLevers'
import { MoneyBlock } from '../components/fleet/MoneyBlock'
import { RosterTable } from '../components/fleet/RosterTable'
import { TimelineBlock } from '../components/fleet/TimelineBlock'
import { useFleetBlocks } from '../components/fleet/useFleetBlocks'
import { useReadContext } from '../components/fleet/useReadContext'
import { toast } from '../components/Toast'
import { Page } from '../components/Workspace'
import { postFile } from '../api/client'
import { download } from '../lib/download'
import { budgetCsv, forecastCsv } from '../lib/fleet/exports'
import { toFleetRequest } from '../lib/fleet/io'
import type { Intake } from '../lib/fleet/intake'
import { serializeFleet } from '../lib/fleet/io'
import { rosterCsv } from '../lib/fleet/roster'
import { buildRows } from '../lib/fleet/segments'
import { useFleet } from '../state/FleetContext'

export default function FleetPage() {
  const { fleet, setFleet, undo, canUndo, saveStatus } = useFleet()
  const ctx = useReadContext()
  const blocks = useFleetBlocks(fleet)
  const rows = useMemo(() => (fleet ? buildRows(fleet, blocks.forecast) : []), [fleet, blocks.forecast])
  const [method, setMethod] = useState<Method | null>(null)
  const [adding, setAdding] = useState(false)
  const [intake, setIntake] = useState<Intake | null>(null)
  const close = () => { setIntake(null); setMethod(null); setAdding(false) }
  const [pdfBusy, setPdfBusy] = useState(false)
  const fleetPdf = async () => {
    if (!fleet || pdfBusy) return
    setPdfBusy(true)
    try {
      const { blob, filename } = await postFile('/report/fleet-pdf', { ...toFleetRequest(fleet, blocks.asOf), name: fleet.name })
      const url = URL.createObjectURL(blob), a = document.createElement('a')
      a.href = url; a.download = filename === 'pack-horizon-comparison.pdf' ? 'pack-horizon-fleet-forecast.pdf' : filename
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { toast(e instanceof Error ? e.message : 'The fleet report could not be made.') } finally { setPdfBusy(false) }
  }
  const slug = (fleet?.name ?? 'fleet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fleet'

  return (
    <Page wide title="Fleet" intro="Your buses in one place. Add them any way you like; you see a preview of what will change, and nothing is added until you confirm it.">
      <div className="bento">
        {canUndo && (
          <div className="c12 undo" role="status">
            <span>{fleet ? 'Your fleet was changed.' : 'The fleet was removed.'}</span>
            <button className="btn sm" onClick={() => { undo(); toast('Undone') }}>Undo</button>
          </div>
        )}
        {fleet && (
          <div className="c12 fleet-head">
            <div className="fh-l">
              <h2>{fleet.name}</h2>
              {fleet.kind === 'sample' && <span className="tag assumption">Synthetic, for demonstration</span>}
              <span className="chip"><i />{fleet.buses.length.toLocaleString('en-IN')} {fleet.buses.length === 1 ? 'bus' : 'buses'}</span>
              <span className="chip"><i />{fleet.classes.length} duty {fleet.classes.length === 1 ? 'class' : 'classes'}</span>
            </div>
            <div className="fh-r">
              <button className="btn sm primary" aria-expanded={adding} onClick={() => { setAdding((a) => !a); setMethod(null) }}>Add buses</button>
              <button className="btn sm" onClick={() => download(`${slug}.json`, serializeFleet(fleet), 'application/json')}>Save fleet file</button>
              <button className="btn sm" onClick={() => download(`${slug}-roster.csv`, rosterCsv(fleet))}>Roster CSV</button>
              <button className="btn sm" disabled={pdfBusy || !blocks.series} onClick={fleetPdf}>{pdfBusy ? 'Making the report…' : 'Fleet report (PDF)'}</button>
              <button className="btn sm" disabled={!blocks.series} onClick={() => download(`${slug}-forecast.csv`, forecastCsv(rows, blocks.series, blocks.asOf))}>Forecast CSV</button>
              <button className="btn sm" disabled={!blocks.series} onClick={() => blocks.series && download(`${slug}-budget.csv`, budgetCsv(blocks.series))}>Budget CSV</button>
              <button className="btn sm" onClick={() => { setFleet(null); close(); toast('Fleet removed') }}>Remove fleet</button>
            </div>
          </div>
        )}
        {fleet && saveStatus !== 'saved' && (
          <div className="c12 errbox" role="alert">
            <b>{saveStatus === 'too_big' ? 'This fleet is too large to keep in the browser.' : 'This browser is not letting the page save.'}</b>
            <p>It still works for now, but it will be gone when you leave the page. Save the fleet file to keep it.</p>
          </div>
        )}
        {intake && <div className="c12"><FleetGate intake={intake} onClose={close} /></div>}
        {!intake && !fleet && (
          <section className="card c12 first" aria-labelledby="first-h">
            <h2 id="first-h">Where do you want to start?</h2>
            <div className="sub">Plan battery replacements for a whole fleet, or look at one bus. Nothing is stored until you confirm it.</div>
            <div className="meth doors">
              <button className="meth-b" disabled={!ctx} onClick={() => ctx && setIntake(sampleIntake(ctx))}><b>Load the sample fleet</b><span>60 synthetic buses across 3 depots, to see every block working. Labelled as synthetic everywhere.</span></button>
              <button className="meth-b" aria-pressed={method === 'upload'} onClick={() => setMethod(method === 'upload' ? null : 'upload')}><b>Import a CSV</b><span>A roster with one row per bus, or a duty log. Read in this browser, never uploaded.</span></button>
              <Link className="meth-b" to={`/health${window.location.search}`}><b>Just one bus</b><span>Skip the fleet and look at a single bus: its health, range and cost.</span></Link>
            </div>
          </section>
        )}
        {!intake && (!fleet || adding) && (
          <div className="card c12">
            <h2>{fleet ? 'Add buses' : 'Other ways in'}</h2>
            <div className="sub">{fleet ? 'Pick a way in. You will see what changes before anything is added.' : 'Every way in ends at the same preview, and the last change can be undone.'}</div>
            <AddBuses ctx={ctx} fleet={fleet} method={method} onMethod={setMethod} onIntake={setIntake} />
          </div>
        )}
        {fleet && blocks.failed && !blocks.forecast && (
          <div className="c12 errbox" role="alert"><b>The forecast could not be worked out.</b><p>The roster still works. Check that the server is running, then change or re-add a bus to try again.</p></div>
        )}
        {fleet && blocks.series && (
          <>
            <BudgetBlock series={blocks.series} depots={blocks.depots} unknown={blocks.unknown} moreDepots={blocks.moreDepots} stale={blocks.stale} />
            <TimelineBlock classes={blocks.classes} labels={blocks.series.labels} done={blocks.classesDone} total={blocks.classes.length} stale={blocks.stale} />
            {blocks.forecast && <MoneyBlock rows={rows} forecast={blocks.forecast} stale={blocks.stale} />}
            <FleetLevers fleet={fleet} ready={!blocks.stale && blocks.classesDone === blocks.classes.length} />
          </>
        )}
        {fleet && blocks.main.isPending && !blocks.series && <div className="c12 card" role="status" aria-busy="true"><div className="skel" style={{ height: 120 }} /><p className="note">Working out the forecast…</p></div>}
        {fleet && <div className="c12"><RosterTable fleet={fleet} rows={rows} forecast={blocks.forecast} series={blocks.series} stale={blocks.stale} loading={blocks.main.isPending || blocks.stale} /></div>}
      </div>
    </Page>
  )
}
