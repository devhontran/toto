import { WEAPONS, WeaponState } from '../systems/weapons'

export const PLAYER_SPEED = 5
export const PLAYER_RADIUS = 0.4
export const PLAYER_MAX_HP = 100

export class Player {
  x = 0
  z = 0
  r = PLAYER_RADIUS
  angle = Math.PI
  hp = PLAYER_MAX_HP
  alive = true
  weapons: WeaponState[] = [new WeaponState(WEAPONS.pistol)]
  current = 0

  get weapon(): WeaponState {
    return this.weapons[this.current]
  }

  switchTo(i: number): void {
    if (i === this.current || i < 0 || i >= this.weapons.length) return
    this.weapon.cancelReload()
    this.current = i
  }
}
