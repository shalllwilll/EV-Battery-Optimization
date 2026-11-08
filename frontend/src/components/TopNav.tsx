import { useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useThumb } from '../lib/useThumb'

export const ROUTES = [
  { to: '/', label: 'Overview' }, { to: '/health', label: 'Health' }, { to: '/replacement', label: 'Replacement' },
  { to: '/range', label: 'Range' }, { to: '/cost', label: 'Cost' }, { to: '/optimise', label: 'Optimise' }, { to: '/evidence', label: 'Evidence' },
]

export function TopNav() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const box = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)
  const search = window.location.search

  const thumb = useThumb(box, 'a.active', loc.pathname)

  return (
    <header className="nav" role="banner">
      <NavLink to={`/${search}`} className="brand" aria-label="Pack Horizon home">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="10" fill="#18181B" stroke="#3F3F46" /><path d="M19 6L9 19h7l-2 9 11-14h-7z" fill="#FACC15" /></svg>
        <span>Pack Horizon</span>
      </NavLink>
      <nav className="links" ref={box} aria-label="Sections">
        <span className="thumb" style={thumb} aria-hidden="true" />
        {ROUTES.map((r) => <NavLink key={r.to} to={`${r.to}${search}`} end={r.to === '/'} className={() => (loc.pathname === r.to ? 'active' : '')}>{r.label}</NavLink>)}
      </nav>
      <div className="umenu">
        <button className="avatar" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{(user ?? '?').slice(0, 1).toUpperCase()}</button>
        {menu && (
          <div className="pop" role="menu">
            <b>{user}</b><small>Demo account</small>
            <button className="btn sm" style={{ marginTop: 12, width: '100%' }} onClick={logout}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  )
}
