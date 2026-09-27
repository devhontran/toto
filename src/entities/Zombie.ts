export type ZombieKind = 'walker' | 'runner'
export type ZombieState = 'wander' | 'chase'

export interface Zombie {
  id: number
  kind: ZombieKind
  x: number
  z: number
  r: number
  angle: number
  hp: number
  alive: boolean
  speed: number
  state: ZombieState
  attackCooldown: number
  wanderAngle: number
  wanderTimer: number
  hasAlert: boolean
  alertX: number
  alertZ: number
  deadTime: number
}

export const ZOMBIE_RADIUS = 0.4
export const ZOMBIE_SIGHT = 12
export const ZOMBIE_HEARING = 25
export const ZOMBIE_WANDER_FACTOR = 0.3
export const ZOMBIE_ATTACK = { damage: 10, cooldown: 1, range: 1 }
export const ZOMBIE_STATS: Record<ZombieKind, { hp: number; speed: number }> = {
  walker: { hp: 60, speed: 2 },
  runner: { hp: 30, speed: 5 },
}

export function createZombie(id: number, kind: ZombieKind, x: number, z: number): Zombie {
  const s = ZOMBIE_STATS[kind]
  return {
    id,
    kind,
    x,
    z,
    r: ZOMBIE_RADIUS,
    angle: 0,
    hp: s.hp,
    alive: true,
    speed: s.speed,
    state: 'wander',
    attackCooldown: 0,
    wanderAngle: 0,
    wanderTimer: 0,
    hasAlert: false,
    alertX: 0,
    alertZ: 0,
    deadTime: 0,
  }
}
