import type { ReactNode } from 'react'

/** One icon family: 20px grid, 1.75 stroke, round caps. Drawn here so no icon library is needed. */
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const IconGoals = () => <Svg><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3.2" /></Svg>
export const IconDetails = () => <Svg><path d="M4 16V9M10 16V4M16 16v-5" /></Svg>
export const IconView = () => <Svg><path d="M10 2.5 17 6.2v7.6L10 17.5 3 13.8V6.2z" /><path d="M3 6.2 10 10l7-3.8M10 10v7.5" /></Svg>
export const IconSliders = () => <Svg><path d="M3 6h8M15 6h2M3 14h2M9 14h8" /><circle cx="13" cy="6" r="2" /><circle cx="7" cy="14" r="2" /></Svg>
export const IconClose = () => <Svg><path d="M5 5l10 10M15 5 5 15" /></Svg>
export const IconNotes = () => <Svg><path d="M4 4h12v9H9l-3.5 3v-3H4z" /><path d="M7.5 7.5h5M7.5 10h3" /></Svg>
export const IconAlert = () => <Svg><path d="M10 3 18 16.5H2z" /><path d="M10 8.5v3.6M10 14.2v.1" /></Svg>
/** A and B are lettered discs so the two buses are named the same way everywhere. */
export const BusLetter = ({ l }: { l: 'A' | 'B' }) => <span className="bl" aria-hidden="true">{l}</span>
