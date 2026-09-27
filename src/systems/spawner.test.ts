import { describe, it, expect } from 'vitest'
import { Spawner, maxAlive } from './spawner'
import { WallGrid } from './wallGrid'
import { overlapsCircleBox } from './collision'
import { WALLS } from '../level/map'
import { CITY } from '../level/city'
import { routeLength } from '../level/route'
import { mulberry32 } from '../lib/rng'
import type { ZombieKind } from '../entities/Zombie'

const grid = new WallGrid(WALLS)
const total = routeLength(CITY.route)
const start = CITY.start

function seq(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

function collect() {
  const out: { kind: ZombieKind; x: number; z: number }[] = []
  return { out, spawn: (kind: ZombieKind, x: number, z: number) => out.push({ kind, x, z }) }
}

function onStreet(x: number, z: number): boolean {
  return CITY.streets.some((s) => Math.abs(x - s.x) <= s.hw && Math.abs(z - s.z) <= s.hd)
}

describe('Spawner', () => {
  it('spawns a walker 45-70m ahead along the route on its centerline', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, 0, 0, grid, () => 0.5, spawn)
    expect(out).toEqual([{ kind: 'walker', x: start.x, z: start.z - 57.5 }])
  })

  it('offsets spawns laterally within 5m of the centerline', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, 0, 0, grid, seq(0.5, 0.5, 1, 0.5), spawn)
    expect(out[0].x).toBeCloseTo(start.x + 5)
    expect(out[0].z).toBeCloseTo(start.z - 57.5)
  })

  it('waits SPAWN_INTERVAL between spawns', () => {
    const { out, spawn } = collect()
    const s = new Spawner()
    s.update(0.1, 0, 0, grid, () => 0.5, spawn)
    s.update(0.1, 0, 1, grid, () => 0.5, spawn)
    expect(out).toHaveLength(1)
    s.update(0.5, 0, 1, grid, () => 0.5, spawn)
    expect(out).toHaveLength(2)
  })

  it('stops at the alive cap for current progress', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, 0, maxAlive(0), grid, () => 0.5, spawn)
    expect(out).toHaveLength(0)
  })

  it('retries when the chosen spot is inside a wall', () => {
    const { out, spawn } = collect()
    const blocked = new WallGrid([{ x: start.x, z: start.z - 57.5, hw: 1, hd: 1 }])
    new Spawner().update(0.016, 0, 0, blocked, seq(0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5), spawn)
    expect(out).toHaveLength(1)
    expect(out[0].x).toBeCloseTo(start.x + 5)
  })

  it('sends ~30% of spawns down a nearby side street', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, 0, 0, grid, seq(0.1, 0.5, 0.9, 0.5, 0.5, 0.5), spawn)
    expect(out).toHaveLength(1)
    const z = out[0]
    expect(onStreet(z.x, z.z)).toBe(true)
    expect(Math.abs(z.x - start.x)).toBeGreaterThanOrEqual(12)
  })

  it('favours runners near the end and clamps to the airport gate', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, total - 20, 0, grid, () => 0.5, spawn)
    expect(out[0]).toEqual({ kind: 'runner', x: CITY.airport.gate.x, z: CITY.airport.gate.z })
  })

  it('never spawns in a wall and always on a street or at the gate', () => {
    const rng = mulberry32(3)
    const { out, spawn } = collect()
    for (let d = 0; d <= total; d += 5) for (let k = 0; k < 4; k++) new Spawner().update(0.016, d, 0, grid, rng, spawn)
    expect(out.length).toBeGreaterThan(300)
    const gate = CITY.airport.gate
    for (const z of out) {
      expect(WALLS.some((w) => overlapsCircleBox({ x: z.x, z: z.z, r: 0.4 }, w))).toBe(false)
      expect(onStreet(z.x, z.z) || Math.abs(z.z - gate.z) < 1e-9).toBe(true)
    }
  })

  it('keeps out of the airport once it is closed, falling back to side streets', () => {
    const rng = mulberry32(5)
    const { out, spawn } = collect()
    for (let k = 0; k < 200; k++) new Spawner().update(0.016, total - 30, 0, grid, rng, spawn, true)
    expect(out.length).toBeGreaterThan(20)
    for (const z of out) expect(overlapsCircleBox({ x: z.x, z: z.z, r: 0.4 }, CITY.airport.area)).toBe(false)
  })
})
