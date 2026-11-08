import type { ReactNode } from 'react'
import { ScenarioPanel } from './ScenarioPanel'
import { StatusBar } from './StatusBar'
import { useScenario } from '../state/ScenarioContext'
import { ErrorState } from './Async'

export function Page({ kicker, title, intro, children, wide }: { kicker: string; title: string; intro: string; children: ReactNode; wide?: boolean }) {
  const { valid, errors } = useScenario()
  return (
    <div className="page">
      <StatusBar />
      <div className={`work${wide ? ' wide' : ''}`}>
        {!wide && <ScenarioPanel />}
        <main className="main" id="main">
          <div className="pagehead"><div className="kick">{kicker}</div><h1>{title}</h1><p>{intro}</p></div>
          {valid ? children : <ErrorState error={new Error(`Fix ${Object.keys(errors).length} scenario input${Object.keys(errors).length > 1 ? 's' : ''} to run the model: ${Object.keys(errors).join(', ')}.`)} />}
          <div className="foot"><span>Prior mode · public laboratory data · not yet validated on buses</span></div>
        </main>
      </div>
    </div>
  )
}
