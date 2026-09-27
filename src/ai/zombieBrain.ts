import {
  ZOMBIE_ATTACK,
  ZOMBIE_HEARING,
  ZOMBIE_SIGHT,
  ZOMBIE_WANDER_FACTOR,
  type Zombie,
} from '../entities/Zombie'
import { angleOf, dirFromAngle, normalize } from '../lib/math2'

export interface Target {
  x: number
  z: number
  r: number
  alive: boolean
}

export function hearNoise(z: Zombie, nx: number, nz: number): void {
  if (!z.alive) return
  if (Math.hypot(nx - z.x, nz - z.z) > ZOMBIE_HEARING) return
  z.hasAlert = true
  z.alertX = nx
  z.alertZ = nz
}

function moveToward(z: Zombie, tx: number, tz: number, step: number): void {
  const n = normalize(tx - z.x, tz - z.z)
  z.x += n.x * step
  z.z += n.z * step
  z.angle = angleOf(tx - z.x, tz - z.z)
}

export function updateZombie<T extends Target>(
  z: Zombie,
  targets: readonly T[],
  dt: number,
  rng: () => number,
): T | null {
  if (!z.alive) return null
  z.attackCooldown = Math.max(0, z.attackCooldown - dt)

  let target: T | null = null
  let best = ZOMBIE_SIGHT
  for (const t of targets) {
    if (!t.alive) continue
    const d = Math.hypot(t.x - z.x, t.z - z.z)
    if (d <= best) {
      best = d
      target = t
    }
  }

  if (target) {
    z.state = 'chase'
    z.hasAlert = false
    z.angle = angleOf(target.x - z.x, target.z - z.z)
    if (best - z.r - target.r <= ZOMBIE_ATTACK.range) {
      if (z.attackCooldown === 0) {
        z.attackCooldown = ZOMBIE_ATTACK.cooldown
        return target
      }
      return null
    }
    moveToward(z, target.x, target.z, z.speed * dt)
    return null
  }

  if (z.hasAlert) {
    z.state = 'chase'
    if (Math.hypot(z.alertX - z.x, z.alertZ - z.z) < 1) z.hasAlert = false
    else moveToward(z, z.alertX, z.alertZ, z.speed * dt)
    return null
  }

  z.state = 'wander'
  z.wanderTimer -= dt
  if (z.wanderTimer <= 0) {
    z.wanderAngle = rng() * Math.PI * 2
    z.wanderTimer = 2 + rng() * 2
  }
  z.angle = z.wanderAngle
  const d = dirFromAngle(z.wanderAngle)
  z.x += d.x * z.speed * ZOMBIE_WANDER_FACTOR * dt
  z.z += d.z * z.speed * ZOMBIE_WANDER_FACTOR * dt
  return null
}
