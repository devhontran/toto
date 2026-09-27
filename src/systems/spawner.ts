import { overlapsCircleBox, type Box } from './collision'
import type { WallGrid } from './wallGrid'
import { ZOMBIE_RADIUS, type ZombieKind } from '../entities/Zombie'
import { CITY } from '../level/city'
import { pointAtDistance, routeLength } from '../level/route'
import { clamp, type Vec2 } from '../lib/math2'

export const SPAWN_INTERVAL = 0.5
export const SPAWN_AHEAD_MIN = 45
export const SPAWN_AHEAD_RANGE = 25
export const SPAWN_LATERAL = 5
export const SIDE_STREET_CHANCE = 0.3
export const SIDE_STREET_REACH = 30
export const SIDE_STREET_MIN = 12
export const SIDE_STREET_RANGE = 13
const SPAWN_ATTEMPTS = 3
const ROUTE_TOTAL = routeLength(CITY.route)

export function maxAlive(progress: number): number {
  return Math.round(20 + 80 * progress)
}

export function runnerChance(progress: number): number {
  return 0.1 + 0.5 * progress
}

function inBox(x: number, z: number, b: Box): boolean {
  return Math.abs(x - b.x) <= b.hw && Math.abs(z - b.z) <= b.hd
}

function sideStreetPoint(p: Vec2, dir: Vec2, rng: () => number): Vec2 | null {
  const alongX = Math.abs(dir.x) > Math.abs(dir.z)
  let best: Box | null = null
  let bestGap = SIDE_STREET_REACH
  for (const s of CITY.streets) {
    const crossesX = s.hw > s.hd
    if (crossesX === alongX) continue
    const gap = alongX ? Math.abs(s.x - p.x) : Math.abs(s.z - p.z)
    if (gap <= bestGap) {
      best = s
      bestGap = gap
    }
  }
  if (!best) return null
  const off = (rng() < 0.5 ? -1 : 1) * (SIDE_STREET_MIN + rng() * SIDE_STREET_RANGE)
  const lateral = (rng() * 2 - 1) * SPAWN_LATERAL * 0.8
  const q = alongX ? { x: best.x + lateral, z: p.z + off } : { x: p.x + off, z: best.z + lateral }
  return inBox(q.x, q.z, best) ? q : null
}

export class Spawner {
  private timer = 0
  private readonly near: Box[] = []

  update(
    dt: number,
    distance: number,
    alive: number,
    walls: WallGrid,
    rng: () => number,
    spawn: (kind: ZombieKind, x: number, z: number) => void,
    airportClosed = false,
  ): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = SPAWN_INTERVAL
    const progress = clamp(distance / ROUTE_TOTAL, 0, 1)
    if (alive >= maxAlive(progress)) return
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
      const side = rng() < SIDE_STREET_CHANCE
      const ahead = pointAtDistance(CITY.route, distance + SPAWN_AHEAD_MIN + rng() * SPAWN_AHEAD_RANGE)
      let spot: Vec2 | null
      if (side) spot = sideStreetPoint(ahead.point, ahead.dir, rng)
      else {
        const lateral = (rng() * 2 - 1) * SPAWN_LATERAL
        spot = { x: ahead.point.x - ahead.dir.z * lateral, z: ahead.point.z + ahead.dir.x * lateral }
      }
      if (!spot) continue
      const probe = { x: spot.x, z: spot.z, r: ZOMBIE_RADIUS }
      if (airportClosed && overlapsCircleBox(probe, CITY.airport.area)) continue
      if (walls.query(spot.x, spot.z, ZOMBIE_RADIUS, this.near).some((w) => overlapsCircleBox(probe, w))) continue
      spawn(rng() < runnerChance(progress) ? 'runner' : 'walker', spot.x, spot.z)
      return
    }
  }
}
