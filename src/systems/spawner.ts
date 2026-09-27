import { overlapsCircleBox, type Box } from './collision'
import { ZOMBIE_RADIUS, type ZombieKind } from '../entities/Zombie'
import { MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'
import { clamp } from '../lib/math2'

export const SPAWN_INTERVAL = 0.5
const SPAWN_AHEAD_MIN = 22
const SPAWN_AHEAD_RANGE = 20
const SPAWN_ATTEMPTS = 3

export function maxAlive(progress: number): number {
  return Math.round(20 + 80 * progress)
}

export function runnerChance(progress: number): number {
  return 0.1 + 0.5 * progress
}

export class Spawner {
  private timer = 0

  update(
    dt: number,
    playerZ: number,
    alive: number,
    walls: readonly Box[],
    rng: () => number,
    spawn: (kind: ZombieKind, x: number, z: number) => void,
  ): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = SPAWN_INTERVAL
    const progress = clamp(-playerZ / MAP_LENGTH, 0, 1)
    if (alive >= maxAlive(progress)) return
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
      const x = (rng() * 2 - 1) * (MAP_HALF_WIDTH - 1)
      const z = Math.max(-MAP_LENGTH + 1, playerZ - SPAWN_AHEAD_MIN - rng() * SPAWN_AHEAD_RANGE)
      const probe = { x, z, r: ZOMBIE_RADIUS }
      if (walls.some((w) => overlapsCircleBox(probe, w))) continue
      spawn(rng() < runnerChance(progress) ? 'runner' : 'walker', x, z)
      return
    }
  }
}
