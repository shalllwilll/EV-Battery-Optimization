import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { IconClose } from './Icons'

/** True while the media query matches. Used to pick the desktop (side drawers) or phone (bottom sheets) layout. */
export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [q])
  return m
}
export const WIDE_QUERY = '(min-width:1180px)'
export const useWide = () => useMedia(WIDE_QUERY)
export const DOCK_PX = 112   // left edge of a drawer: 16px margin + 84px dock + 12px gap

/** Mount on open, unmount after the exit transition, so panels fade in and out without staying in the tab order. */
function useMounted(open: boolean, ms = 260) {
  const [mounted, setMounted] = useState(open), [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open, ms])
  return { mounted, shown }
}

/** Full-viewport page: the 3D scene fills the screen and everything else floats on top of it. */
export function Immersive({ stage, children }: { stage: ReactNode; children: ReactNode }) {
  return (
    <main className="imm" id="main">
      <div className="imm-stage">{stage}</div>
      <div className="imm-ui">{children}</div>
    </main>
  )
}

export function Drawer({ open, title, onClose, width = 340, children }: { open: boolean; title: string; onClose: () => void; width?: number; children: ReactNode }) {
  const { mounted, shown } = useMounted(open)
  const ref = useRef<HTMLElement>(null)
  // Focus moves into the panel when it opens and returns to whatever opened it when it closes.
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => { const o = opener.current; if (o && o.isConnected) o.focus({ preventScroll: true }) }
  }, [open])
  useEffect(() => { if (open && mounted) ref.current?.focus({ preventScroll: true }) }, [open, mounted])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!mounted) return null
  return (
    <aside ref={ref} tabIndex={-1} className={`drawer${shown && open ? ' in' : ''}`} style={{ '--w': `${width}px` } as CSSProperties} aria-label={title}>
      <header className="dh"><h2>{title}</h2><button className="x" onClick={onClose} aria-label={`Close ${title}`}><IconClose /></button></header>
      <div className="db">{children}</div>
    </aside>
  )
}

export const Dock = ({ children }: { children: ReactNode }) => <nav className="dock glass" aria-label="Panels">{children}</nav>
export function DockButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className="dk" aria-pressed={active} onClick={onClick}><span className="ic">{children}</span><span>{label}</span></button>
}

export type Stat = { label: string; value: ReactNode; unit?: string; sub?: string; tone?: 'up' | 'down' | 'none' }
export function StatStrip({ stats, busy, title }: { stats: Stat[]; busy?: boolean; title?: string }) {
  return (
    <div className="stats glass" role="group" aria-label="Key numbers" aria-busy={busy} data-busy={busy ? 'true' : 'false'}>
      {title && <div className="st ttl"><span>{title}</span></div>}
      {stats.map((s) => (
        <div className="st" key={s.label}>
          <small>{s.label}</small>
          <b>{s.value}{s.unit && <span>{s.unit}</span>}</b>
          {s.sub && <em className={s.tone ?? 'none'}>{s.sub}</em>}
        </div>
      ))}
    </div>
  )
}
