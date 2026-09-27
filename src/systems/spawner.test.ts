import { describe, it, expect } from 'vitest'
import { Spawner, maxAlive } from './spawner'
import { HOUSES } from '../level/map'
import type { ZombieKind } from '../entities/Zombie'

function seq(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

function collect() {
  const out: { kind: ZombieKind; x: number; z: number }[] = []
  return { out, spawn: (kind: ZombieKind, x: number, z: number) => out.push({ kind, x, z }) }
}

describe('Spawner', () => {
  it('spawns a walker 45-70m ahead of the player', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -5, 0, HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ kind: 'walker', x: 0, z: -62.5 })
  })

  it('waits SPAWN_INTERVAL between spawns', () => {
    const { out, spawn } = collect()
    const s = new Spawner()
    s.update(0.1, -5, 0, HOUSES, () => 0.5, spawn)
    s.update(0.1, -5, 1, HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(1)
    s.update(0.5, -5, 1, HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(2)
  })

  it('stops at the alive cap for current progress', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -5, maxAlive(5 / 300), HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(0)
  })

  it('retries when the chosen spot is inside a house', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -25, 0, HOUSES, seq(0.8, 0.5, 0.5, 0.5, 0.9), spawn)
    expect(out).toHaveLength(1)
    expect(out[0].x).toBe(0)
  })

  it('favours runners near the end and clamps inside the map', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -280, 0, HOUSES, () => 0.5, spawn)
    expect(out[0].kind).toBe('runner')
    expect(out[0].z).toBe(-299)
  })
})
