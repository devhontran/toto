import { rayBox, rayCircle, type Box, type Circle } from './collision'

export interface Hittable extends Circle {
  hp: number
  alive: boolean
}

export function castShot<T extends Hittable>(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  range: number,
  targets: readonly T[],
  walls: readonly Box[],
): { target: T | null; dist: number } {
  let best = range
  for (const w of walls) {
    const t = rayBox(ox, oz, dx, dz, w)
    if (t !== null && t < best) best = t
  }
  let target: T | null = null
  for (const c of targets) {
    if (!c.alive) continue
    const t = rayCircle(ox, oz, dx, dz, c)
    if (t !== null && t < best) {
      best = t
      target = c
    }
  }
  return { target, dist: best }
}

export function applyDamage(t: { hp: number; alive: boolean }, dmg: number): boolean {
  if (!t.alive) return false
  t.hp -= dmg
  if (t.hp <= 0) {
    t.hp = 0
    t.alive = false
    return true
  }
  return false
}
