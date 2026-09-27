import type { Box } from '../systems/collision'
import { castShot, type Hittable } from '../systems/combat'
import { angleOf, clamp, normalize } from '../lib/math2'
import { EXIT_ZONE } from '../level/map'
import {
  BOT_ADVANCE_SPEED,
  BOT_AIM_ERROR,
  BOT_DOWNED_SEEK_RANGE,
  BOT_ENGAGE_RANGE,
  BOT_HOLD_RANGE,
  BOT_LANES,
  BOT_LANE_LOOKAHEAD,
  BOT_EXIT_CONVERGE,
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
  } else {
    const atExit = Math.hypot(self.x - EXIT_ZONE.x, self.z - EXIT_ZONE.z) <= EXIT_ZONE.r - 1
    const nearestZombie = nearestAliveDist(self, zombies)
    if (!atExit && nearestZombie > BOT_HOLD_RANGE) {
      const converge = clamp((EXIT_ZONE.z + BOT_EXIT_CONVERGE - self.z) / BOT_EXIT_CONVERGE, 0, 1)
      const lane = BOT_LANES[self.slot] + (EXIT_ZONE.x - BOT_LANES[self.slot]) * converge
      const n = normalize(lane - self.x, -BOT_LANE_LOOKAHEAD)
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
