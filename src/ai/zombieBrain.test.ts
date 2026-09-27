import { describe, it, expect } from 'vitest'
import { createZombie, ZOMBIE_ATTACK } from '../entities/Zombie'
import { hearNoise, updateZombie } from './zombieBrain'

const rng = () => 0.5
const target = (x: number, z: number) => ({ x, z, r: 0.4, alive: true })

describe('updateZombie', () => {
  it('chases a target within sight', () => {
    const z = createZombie(1, 'walker', 0, -10)
    updateZombie(z, [target(0, 0)], 0.1, rng)
    expect(z.state).toBe('chase')
    expect(z.z).toBeCloseTo(-9.8)
    expect(z.x).toBeCloseTo(0)
  })

  it('wanders slowly when the target is out of sight', () => {
    const z = createZombie(1, 'walker', 0, -20)
    updateZombie(z, [target(0, 0)], 0.1, rng)
    expect(z.state).toBe('wander')
    expect(Math.hypot(z.x, z.z + 20)).toBeLessThanOrEqual(2 * 0.3 * 0.1 + 1e-9)
  })

  it('ignores dead targets', () => {
    const z = createZombie(1, 'walker', 0, -5)
    updateZombie(z, [{ ...target(0, 0), alive: false }], 0.1, rng)
    expect(z.state).toBe('wander')
  })

  it('strikes a target in reach, then waits for cooldown', () => {
    const z = createZombie(1, 'walker', 0, -1.2)
    const t = target(0, 0)
    expect(updateZombie(z, [t], 0.016, rng)).toBe(t)
    expect(z.attackCooldown).toBe(ZOMBIE_ATTACK.cooldown)
    expect(updateZombie(z, [t], 0.016, rng)).toBeNull()
    expect(updateZombie(z, [t], 1, rng)).toBe(t)
  })

  it('does nothing when dead', () => {
    const z = createZombie(1, 'walker', 0, -1.2)
    z.alive = false
    expect(updateZombie(z, [target(0, 0)], 0.1, rng)).toBeNull()
    expect(z.z).toBe(-1.2)
  })
})

describe('hearNoise', () => {
  it('alerts a zombie within hearing range and it heads to the noise', () => {
    const z = createZombie(1, 'walker', 0, -20)
    hearNoise(z, 0, 0)
    expect(z.hasAlert).toBe(true)
    updateZombie(z, [], 0.1, rng)
    expect(z.state).toBe('chase')
    expect(z.z).toBeCloseTo(-19.8)
  })

  it('ignores noise beyond hearing range', () => {
    const z = createZombie(1, 'walker', 0, -30)
    hearNoise(z, 0, 0)
    expect(z.hasAlert).toBe(false)
  })

  it('ignores noise when dead', () => {
    const z = createZombie(1, 'walker', 0, -5)
    z.alive = false
    hearNoise(z, 0, 0)
    expect(z.hasAlert).toBe(false)
  })

  it('clears the alert on arrival', () => {
    const z = createZombie(1, 'walker', 0, -0.5)
    hearNoise(z, 0, 0)
    updateZombie(z, [], 0.1, rng)
    expect(z.hasAlert).toBe(false)
  })
})

describe('boss', () => {
  it('has boss stats', () => {
    const z = createZombie(1, 'boss', 0, 0)
    expect(z.hp).toBe(1500)
    expect(z.speed).toBe(2.2)
    expect(z.r).toBe(1)
    expect(z.sight).toBe(30)
    expect(z.knockback).toBe(0.1)
    expect(z.attack).toEqual({ damage: 30, cooldown: 1.5, range: 1.5 })
  })

  it('sees a target at 25m and strikes from 1.5m with a 1.5s cooldown', () => {
    const far = createZombie(1, 'boss', 0, -25)
    updateZombie(far, [target(0, 0)], 0.1, rng)
    expect(far.state).toBe('chase')
    const z = createZombie(2, 'boss', 0, -2.8)
    const t = target(0, 0)
    expect(updateZombie(z, [t], 0.016, rng)).toBe(t)
    expect(z.attackCooldown).toBe(1.5)
    expect(updateZombie(z, [t], 1, rng)).toBeNull()
    expect(updateZombie(z, [t], 0.6, rng)).toBe(t)
  })
})
