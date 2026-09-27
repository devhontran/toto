import type { Box } from '../systems/collision'
import { castShot, type Hittable } from '../systems/combat'
import { angleOf, normalize } from '../lib/math2'
import {
  BOT_AIM_ERROR,
  BOT_DOWNED_SEEK_RANGE,
  BOT_ENGAGE_RANGE,
  BOT_FOLLOW_STOP,
  BOT_SLOTS,
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
  target: Hittable | null
  aimAngle: number | null
}

function goalFor(
  self: BotSelf,
  playerX: number,
  playerZ: number,
  teammates: readonly Teammate[],
): { x: number; z: number; stop: number } {
  let nearest: Teammate | null = null
  let bestDist = BOT_DOWNED_SEEK_RANGE
  for (const t of teammates) {
    if (t.alive) continue
    const d = Math.hypot(t.x - self.x, t.z - self.z)
    if (d <= bestDist) {
      nearest = t
      bestDist = d
    }
  }
  if (nearest) return { x: nearest.x, z: nearest.z, stop: REVIVE_RANGE }
  const slot = BOT_SLOTS[self.slot]
  return { x: playerX + slot.x, z: playerZ + slot.z, stop: BOT_FOLLOW_STOP }
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
  playerX: number,
  playerZ: number,
  teammates: readonly M[],
  zombies: readonly T[],
  walls: readonly Box[],
  rng: () => number,
): BotDecision {
  const goal = goalFor(self, playerX, playerZ, teammates)
  const dist = Math.hypot(goal.x - self.x, goal.z - self.z)
  let moveX = 0
  let moveZ = 0
  if (dist > goal.stop) {
    const n = normalize(goal.x - self.x, goal.z - self.z)
    moveX = n.x
    moveZ = n.z
  }
  const picked = pickTarget(self.x, self.z, zombies, walls, rng)
  return {
    moveX,
    moveZ,
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
