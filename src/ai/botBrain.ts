import type { Box } from '../systems/collision'
import { castShot, type Hittable } from '../systems/combat'
import { angleOf, normalize } from '../lib/math2'
import { CITY } from '../level/city'
import { pointAtDistance, routeProgress } from '../level/route'
import {
  BOT_ADVANCE_SPEED,
  BOT_AIM_ERROR,
  BOT_AIRPORT_SWITCH,
  BOT_DOWNED_SEEK_RANGE,
  BOT_ENGAGE_RANGE,
  BOT_HOLD_RANGE,
  BOT_LANES,
  BOT_LANE_LOOKAHEAD,
  BOT_SPEED,
  REVIVE_HP,
  REVIVE_RANGE,
  REVIVE_TIME,
} from '../entities/Bot'

export interface BotSelf {
  x: number
  z: number
  slot: number
}

export interface Teammate {
  x: number
  z: number
  alive: boolean
  hp: number
  reviveProgress: number
}

export interface BotDecision {
  moveX: number
  moveZ: number
  speed: number
  target: Hittable | null
  aimAngle: number | null
}

function nearestDowned<T extends Teammate>(self: BotSelf, teammates: readonly T[]): T | null {
  let best: T | null = null
  let bestDist = BOT_DOWNED_SEEK_RANGE
  for (const t of teammates) {
    if (t.alive) continue
    const d = Math.hypot(t.x - self.x, t.z - self.z)
    if (d <= bestDist) {
      best = t
      bestDist = d
    }
  }
  return best
}

function nearestAliveDist<T extends Hittable>(self: BotSelf, zombies: readonly T[]): number {
  let best = Infinity
  for (const z of zombies) {
    if (!z.alive) continue
    const d = Math.hypot(z.x - self.x, z.z - self.z)
    if (d < best) best = d
  }
  return best
}

function pickTarget<T extends Hittable>(
  ox: number,
  oz: number,
  zombies: readonly T[],
  walls: readonly Box[],
  rng: () => number,
): { target: T; aimAngle: number } | null {
  const inRange = zombies.filter((z) => z.alive && Math.hypot(z.x - ox, z.z - oz) <= BOT_ENGAGE_RANGE)
  inRange.sort((a, b) => Math.hypot(a.x - ox, a.z - oz) - Math.hypot(b.x - ox, b.z - oz))
  for (const z of inRange) {
    const dir = normalize(z.x - ox, z.z - oz)
    const cast = castShot(ox, oz, dir.x, dir.z, BOT_ENGAGE_RANGE, [z], walls)
    if (cast.target === z) {
      const angle = angleOf(z.x - ox, z.z - oz)
      return { target: z, aimAngle: angle + (rng() * 2 - 1) * BOT_AIM_ERROR }
    }
  }
  return null
}

function inAirport(x: number, z: number): boolean {
  const a = CITY.airport.area
  return Math.abs(x - a.x) <= a.hw && Math.abs(z - a.z) <= a.hd
}

function routeGoal(self: BotSelf): { x: number; z: number } | null {
  const own = routeProgress(CITY.route, self.x, self.z)
  if (inAirport(self.x, self.z) || own.total - own.distance <= BOT_AIRPORT_SWITCH) {
    const board = CITY.airport.boardZone
    return Math.hypot(self.x - board.x, self.z - board.z) <= board.r - 1 ? null : board
  }
  const ahead = pointAtDistance(CITY.route, own.distance + BOT_LANE_LOOKAHEAD)
  const lane = BOT_LANES[self.slot] ?? 0
  return { x: ahead.point.x - ahead.dir.z * lane, z: ahead.point.z + ahead.dir.x * lane }
}

export function decideBot<T extends Hittable, M extends Teammate>(
  self: BotSelf,
  teammates: readonly M[],
  zombies: readonly T[],
  walls: readonly Box[],
  rng: () => number,
): BotDecision {
  let moveX = 0
  let moveZ = 0
  let speed = 0

  const downed = nearestDowned(self, teammates)
  if (downed) {
    const dist = Math.hypot(downed.x - self.x, downed.z - self.z)
    if (dist > REVIVE_RANGE) {
      const n = normalize(downed.x - self.x, downed.z - self.z)
      moveX = n.x
      moveZ = n.z
      speed = BOT_SPEED
    }
  } else if (nearestAliveDist(self, zombies) > BOT_HOLD_RANGE) {
    const goal = routeGoal(self)
    if (goal) {
      const n = normalize(goal.x - self.x, goal.z - self.z)
      moveX = n.x
      moveZ = n.z
      speed = BOT_ADVANCE_SPEED
    }
  }

  const picked = pickTarget(self.x, self.z, zombies, walls, rng)
  return {
    moveX,
    moveZ,
    speed,
    target: picked?.target ?? null,
    aimAngle: picked?.aimAngle ?? null,
  }
}

export function updateRevive<T extends Teammate>(teammates: readonly T[], dt: number): void {
  for (const t of teammates) {
    if (t.alive) continue
    const helped = teammates.some(
      (o) => o !== t && o.alive && Math.hypot(o.x - t.x, o.z - t.z) <= REVIVE_RANGE,
    )
    if (!helped) {
      t.reviveProgress = 0
      continue
    }
    t.reviveProgress += dt
    if (t.reviveProgress >= REVIVE_TIME) {
      t.alive = true
      t.hp = REVIVE_HP
      t.reviveProgress = 0
    }
  }
}
