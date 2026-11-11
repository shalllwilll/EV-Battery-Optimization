import { useMemo, useState } from 'react'
import { AddBuses, type Method } from '../components/fleet/AddBuses'
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
import { download } from '../lib/download'
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
        {!intake && (!fleet || adding) && (
          <div className="card c12">
            <h2>{fleet ? 'Add buses' : 'Start your fleet'}</h2>
            <div className="sub">{fleet ? 'Pick a way in. You will see what changes before anything is added.' : 'Every way in ends at the same preview. Nothing is stored until you confirm it, and the last change can be undone.'}</div>
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
