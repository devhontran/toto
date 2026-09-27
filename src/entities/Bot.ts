import { WEAPONS, WeaponState } from '../systems/weapons'

export const BOT_RADIUS = 0.4
export const BOT_SPEED = 5.5
export const BOT_ADVANCE_SPEED = 3.5
export const BOT_MAX_HP = 100
export const BOT_ENGAGE_RANGE = 15
export const BOT_HOLD_RANGE = 10
export const BOT_LANE_LOOKAHEAD = 10
export const BOT_EXIT_CONVERGE = 20
export const BOT_AIM_ERROR = (5 * Math.PI) / 180
export const BOT_COOLDOWN = 1 / (10 * 0.7)
export const BOT_DOWNED_SEEK_RANGE = 20
export const REVIVE_RANGE = 1.5
export const REVIVE_TIME = 3
export const REVIVE_HP = 30

export const BOT_LANES: readonly number[] = [-6, 0, 6]

export const BOT_COLORS: readonly string[] = ['#3ddc97', '#ff9f43', '#c56cf0']

export class Bot {
  readonly slot: number
  x = 0
  z = 0
  r = BOT_RADIUS
  angle = 0
  hp = BOT_MAX_HP
  alive = true
  reviveProgress = 0
  weapon = new WeaponState(WEAPONS.rifle, Infinity)

  constructor(slot: number) {
    this.slot = slot
  }
}
