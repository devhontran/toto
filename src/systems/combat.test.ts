import { describe, it, expect } from 'vitest'
import { castShot, applyDamage } from './combat'

const mk = (x: number, z: number) => ({ x, z, r: 0.4, hp: 60, alive: true })

describe('castShot', () => {
  it('hits the nearest target in line', () => {
    const near = mk(0, -5)
    const far = mk(0, -10)
    const res = castShot(0, 0, 0, -1, 20, [far, near], [])
    expect(res.target).toBe(near)
    expect(res.dist).toBeCloseTo(4.6)
  })

  it('is blocked by a wall in front of the target', () => {
    const t = mk(0, -10)
    const res = castShot(0, 0, 0, -1, 20, [t], [{ x: 0, z: -5, hw: 2, hd: 0.5 }])
    expect(res.target).toBeNull()
    expect(res.dist).toBeCloseTo(4.5)
  })

  it('ignores dead targets', () => {
    const dead = { ...mk(0, -5), alive: false }
    const alive = mk(0, -8)
    expect(castShot(0, 0, 0, -1, 20, [dead, alive], []).target).toBe(alive)
  })

  it('misses targets beyond range', () => {
    const res = castShot(0, 0, 0, -1, 20, [mk(0, -30)], [])
    expect(res.target).toBeNull()
    expect(res.dist).toBe(20)
  })
})

describe('applyDamage', () => {
  it('reports the killing blow exactly once', () => {
    const t = mk(0, 0)
    expect(applyDamage(t, 25)).toBe(false)
    expect(t.hp).toBe(35)
    expect(applyDamage(t, 50)).toBe(true)
    expect(t.hp).toBe(0)
    expect(t.alive).toBe(false)
    expect(applyDamage(t, 50)).toBe(false)
  })
})
