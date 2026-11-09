import { GROUP_TITLE, type Note, type NoteGroup } from '../lib/notes'

const ORDER: NoteGroup[] = ['attention', 'range', 'info']
const LEAD: Record<NoteGroup, string> = {
  attention: 'These change what you should do.',
  range: 'The models were tested on conditions that differ from this bus, so treat the result as qualitative.',
  info: 'Assumptions and limits behind the numbers.',
}

/** All the "by the way" messages for the current result in one quiet list, so nothing has to float over the 3D scene. */
export function NotesList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="note">Nothing to flag for this scenario. Every number is still a model estimate, not validated on buses.</p>
  return (
    <div className="notes">
      {ORDER.map((g) => {
        const items = notes.filter((n) => n.group === g)
        if (items.length === 0) return null
        return (
          <section key={g} className={`ngrp ${g}`} aria-labelledby={`ng-${g}`}>
            <h3 id={`ng-${g}`}><i aria-hidden="true" />{GROUP_TITLE[g]}</h3>
            <p className="note">{LEAD[g]}</p>
            <ul>{items.map((n) => <li key={n.text}>{n.bus && <b>Bus {n.bus}</b>}{n.text}</li>)}</ul>
          </section>
        )
      })}
    </div>
  )
}
