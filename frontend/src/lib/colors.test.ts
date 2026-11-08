import { describe, expect, it } from 'vitest'
import { healthRGB, luminance } from './colors'

describe('health colour ramp (T6.1-2)', () => {
  it('gives distinct colours at 100, 80 and 60 percent', () => {
    const c = [100, 80, 60].map((h) => healthRGB(h).join(','))
    expect(new Set(c).size).toBe(3)
  })
  it('gets steadily darker as health falls (readable in greyscale)', () => {
    let prev = Infinity
    for (let h = 100; h >= 50; h -= 2.5) { const l = luminance(healthRGB(h)); expect(l).toBeLessThanOrEqual(prev + 1e-9); prev = l }
  })
  it('hits the replacement colour exactly on the line and respects a custom line', () => {
    expect(healthRGB(80)).toEqual([249, 115, 22])
    expect(healthRGB(70, 70)).toEqual([249, 115, 22])
  })
  it('clamps outside the scale', () => { expect(healthRGB(130)).toEqual(healthRGB(100)); expect(healthRGB(0)).toEqual([239, 68, 68]) })
})
