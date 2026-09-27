export type WeaponId = 'pistol' | 'shotgun' | 'rifle'

export interface WeaponDef {
  id: WeaponId
  name: string
  damage: number
  pellets: number
  spread: number
  fireRate: number
  magSize: number
  reloadTime: number
  range: number
  infiniteReserve: boolean
  knockback: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'Súng lục',
    damage: 25,
    pellets: 1,
    spread: 0.03,
    fireRate: 4,
    magSize: 12,
    reloadTime: 1.5,
    range: 20,
    infiniteReserve: true,
    knockback: 0.3,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 15,
    pellets: 6,
    spread: (15 * Math.PI) / 180,
    fireRate: 1,
    magSize: 6,
    reloadTime: 1.5,
    range: 20,
    infiniteReserve: false,
    knockback: 1.5,
  },
  rifle: {
    id: 'rifle',
    name: 'Súng trường',
    damage: 20,
    pellets: 1,
    spread: 0.04,
    fireRate: 10,
    magSize: 30,
    reloadTime: 1.5,
    range: 20,
    infiniteReserve: false,
    knockback: 0.2,
  },
}

export class WeaponState {
  readonly def: WeaponDef
  mag: number
  reserve: number
  cooldown = 0
  reloadLeft = 0

  constructor(def: WeaponDef, reserve = 0) {
    this.def = def
    this.mag = def.magSize
    this.reserve = reserve
  }

  get reloading(): boolean {
    return this.reloadLeft > 0
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0
        this.finishReload()
      }
    }
  }

  private finishReload(): void {
    const need = this.def.magSize - this.mag
    const take = this.def.infiniteReserve ? need : Math.min(need, this.reserve)
    this.mag += take
    if (!this.def.infiniteReserve) this.reserve -= take
  }

  startReload(): boolean {
    if (this.reloading || this.mag === this.def.magSize) return false
    if (!this.def.infiniteReserve && this.reserve === 0) return false
    this.reloadLeft = this.def.reloadTime
    return true
  }

  cancelReload(): void {
    this.reloadLeft = 0
  }

  tryFire(): boolean {
    if (this.reloading || this.cooldown > 0) return false
    if (this.mag === 0) {
      this.startReload()
      return false
    }
    this.mag--
    this.cooldown = 1 / this.def.fireRate
    return true
  }
}

export function pelletAngles(def: WeaponDef, rng: () => number): number[] {
  if (def.pellets === 1) return [(rng() * 2 - 1) * def.spread]
  const out: number[] = []
  for (let i = 0; i < def.pellets; i++) {
    const base = -def.spread + (2 * def.spread * i) / (def.pellets - 1)
    out.push(base + (rng() * 2 - 1) * def.spread * 0.1)
  }
  return out
}
