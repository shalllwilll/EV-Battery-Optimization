/** Battery health (percent) -> colour. Volt yellow when healthy, orange at the replacement line, red past it.
 *  Lightness falls steadily from healthy to worn, so the scale also reads in greyscale and for colour-blind viewers. */
export type RGB = [number, number, number]
const HEALTHY: RGB = [250, 204, 21], LINE: RGB = [249, 115, 22], WORN: RGB = [239, 68, 68]
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))

export function healthRGB(healthPct: number, linePct = 80): RGB {
  if (healthPct >= linePct) return mix(HEALTHY, LINE, clamp((100 - healthPct) / (100 - linePct)))
  return mix(LINE, WORN, clamp((linePct - healthPct) / 25))
}
export const healthCss = (h: number, line = 80) => `rgb(${healthRGB(h, line).join(',')})`
/** WCAG relative luminance, used by the tests to prove the ramp is monotone. */
export function luminance([r, g, b]: RGB): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
