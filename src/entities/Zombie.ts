export type ZombieKind = 'walker' | 'runner' | 'boss'
export type ZombieState = 'wander' | 'chase'

export interface ZombieAttack {
  damage: number
  cooldown: number
  range: number
}

export interface ZombieStats {
  hp: number
  speed: number
  r: number
  sight: number
  knockback: number
  damageTaken: number
  attack: ZombieAttack
}

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
  sight: number
  knockback: number
  damageTaken: number
  attack: ZombieAttack
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
export const ZOMBIE_ATTACK: ZombieAttack = { damage: 10, cooldown: 1, range: 1 }
export const BOSS_DAMAGE_TAKEN = 0.35

const REGULAR = { r: ZOMBIE_RADIUS, sight: ZOMBIE_SIGHT, knockback: 1, damageTaken: 1, attack: ZOMBIE_ATTACK }

export const ZOMBIE_STATS: Record<ZombieKind, ZombieStats> = {
  walker: { ...REGULAR, hp: 60, speed: 2 },
  runner: { ...REGULAR, hp: 30, speed: 5 },
  boss: {
    hp: 1500,
    speed: 2.2,
    r: 1,
    sight: 30,
    knockback: 0.1,
    damageTaken: BOSS_DAMAGE_TAKEN,
    attack: { damage: 30, cooldown: 1.5, range: 1.5 },
  },
}

export function createZombie(id: number, kind: ZombieKind, x: number, z: number): Zombie {
  const s = ZOMBIE_STATS[kind]
  return {
    id,
    kind,
    x,
    z,
    r: s.r,
    angle: 0,
    hp: s.hp,
    alive: true,
    speed: s.speed,
    sight: s.sight,
    knockback: s.knockback,
    damageTaken: s.damageTaken,
    attack: s.attack,
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
