import { describe, it, expect } from 'vitest'
import { FixedStep } from './fixedStep'

describe('FixedStep', () => {
  it('runs whole steps for the elapsed time', () => {
    const f = new FixedStep(1 / 60, 0.25)
    expect(f.advance(1 / 30, () => {})).toBe(2)
  })

  it('carries the remainder to the next frame', () => {
    const f = new FixedStep(1 / 60, 0.25)
    expect(f.advance(0.01, () => {})).toBe(0)
    expect(f.advance(0.01, () => {})).toBe(1)
  })

  it('caps a long hitch at maxFrame worth of steps', () => {
    const f = new FixedStep(1 / 60, 0.25)
    const n = f.advance(5, () => {})
    expect(n).toBeGreaterThanOrEqual(14)
    expect(n).toBeLessThanOrEqual(15)
  })

  it('ignores negative frame time', () => {
    expect(new FixedStep(1 / 60, 0.25).advance(-1, () => {})).toBe(0)
  })

  it('passes the fixed step to the callback', () => {
    const seen: number[] = []
    new FixedStep(0.5, 1).advance(1, (dt) => seen.push(dt))
    expect(seen).toEqual([0.5, 0.5])
  })
})
