import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom lacks these browser APIs; the app only needs them to exist.
class RO { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver   // plain assignment: tests call vi.unstubAllGlobals()
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
}
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })
