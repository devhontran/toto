import { describe, it, expect } from 'vitest'
import { WEAPONS, WeaponState, pelletAngles } from './weapons'

describe('WeaponState', () => {
  it('fires, consumes a round and respects fire rate', () => {
    const w = new WeaponState(WEAPONS.pistol)
    expect(w.tryFire()).toBe(true)
    expect(w.mag).toBe(11)
    expect(w.tryFire()).toBe(false)
    w.update(0.25)
    expect(w.tryFire()).toBe(true)
  })

  it('auto-reloads an empty pistol from infinite reserve', () => {
    const w = new WeaponState(WEAPONS.pistol)
    w.mag = 0
    expect(w.tryFire()).toBe(false)
    expect(w.reloading).toBe(true)
    w.update(1.5)
    expect(w.reloading).toBe(false)
    expect(w.mag).toBe(12)
  })

  it('reloads a rifle from limited reserve', () => {
    const w = new WeaponState(WEAPONS.rifle, 10)
    w.mag = 0
    expect(w.startReload()).toBe(true)
    w.update(1.5)
    expect(w.mag).toBe(10)
    expect(w.reserve).toBe(0)
  })

  it('does not reload a full magazine', () => {
    expect(new WeaponState(WEAPONS.pistol).startReload()).toBe(false)
  })

  it('cannot fire while reloading', () => {
    const w = new WeaponState(WEAPONS.pistol)
    w.mag = 5
    w.startReload()
    expect(w.tryFire()).toBe(false)
  })

  it('handles an empty magazine with zero reserve without getting stuck', () => {
    const w = new WeaponState(WEAPONS.rifle, 0)
    w.mag = 0
    expect(w.tryFire()).toBe(false)
    expect(w.reloading).toBe(false)
    expect(w.startReload()).toBe(false)
    w.update(5)
    expect(w.mag).toBe(0)
    expect(w.reserve).toBe(0)
  })

  it('empties an unlimited-reserve rifle mag and reloads it back to full', () => {
    const w = new WeaponState(WEAPONS.rifle, Infinity)
    w.mag = 0
    expect(w.tryFire()).toBe(false)
    expect(w.reloading).toBe(true)
    w.update(1.5)
    expect(w.reloading).toBe(false)
    expect(w.mag).toBe(30)
    expect(Number.isFinite(w.mag)).toBe(true)
    expect(w.reserve).toBe(Infinity)
  })

  it('cancelReload stops a reload in progress', () => {
    const w = new WeaponState(WEAPONS.pistol)
    w.mag = 3
    w.startReload()
    w.cancelReload()
    expect(w.reloading).toBe(false)
    w.update(2)
    expect(w.mag).toBe(3)
  })
})

describe('pelletAngles', () => {
  it('returns one centered angle for the pistol with a neutral rng', () => {
    expect(pelletAngles(WEAPONS.pistol, () => 0.5)).toEqual([0])
  })

  it('spreads six shotgun pellets across the cone', () => {
    const a = pelletAngles(WEAPONS.shotgun, () => 0.5)
    expect(a).toHaveLength(6)
    expect(a[0]).toBeCloseTo(-WEAPONS.shotgun.spread)
    expect(a[5]).toBeCloseTo(WEAPONS.shotgun.spread)
  })
})
