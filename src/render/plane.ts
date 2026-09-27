import * as THREE from 'three'
import type { Airport } from '../level/city'
import type { GameStatus } from '../game/World'
import { DOOR_SILL, DOOR_Z } from './airport'
import { VoxelBatcher, type Textures } from './voxel'

const BELLY = DOOR_SILL - 1
const HALF = 2
const BODY_FROM = -10
const BODY_TO = 10
const LIVERY = 0x2456a6
const DOOR_COLOR = 0xc9ced6
const DARK = 0x26282c
const TIRE = 0x1b1b1b
const ROLL_TIME = 4
const ROLL_ACCEL = 8
const CLIMB_ACCEL = 4
const CLIMB_TIME = 4
const CLIMB_HEIGHT = 60
const MAX_PITCH = 0.22
const PITCH_RAMP = 1.5

function fuselage(v: VoxelBatcher): void {
  for (let zc = BODY_FROM; zc < BODY_TO; zc++) {
    const z = zc + 0.5
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (i !== 0 && i !== 3 && j !== 0 && j !== 3) continue
        const x = i - HALF + 0.5
        const y = BELLY + j + 0.5
        const side = i === 0 || i === 3
        const door = i === 0 && (j === 1 || j === 2) && (zc === DOOR_Z - 1 || zc === DOOR_Z)
        if (door) v.addAt('concrete', x, y, z, {}, { color: DOOR_COLOR })
        else if (side && j === 1) v.addAt('concrete', x, y, z, {}, { color: LIVERY })
        else v.addAt('quartz', x, y, z)
        if (side && j === 2 && !door && zc % 2 === 0 && zc > BODY_FROM && zc < BODY_TO - 1) {
          const out = i === 0 ? -HALF - 0.07 : HALF + 0.07
          v.addAt('window', out, y, z, { y: Math.PI / 2 }, { sx: 0.6, sy: 0.6 })
        }
      }
    }
  }
}

function nose(v: VoxelBatcher): void {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) v.addAt('quartz', i - HALF + 0.5, BELLY + j + 0.5, BODY_TO + 0.5)
  for (let i = 1; i < 3; i++) for (let j = 0; j < 2; j++) v.addAt('quartz', i - HALF + 0.5, BELLY + j + 0.5, BODY_TO + 1.5)
  for (let i = 0; i < 4; i++) v.addAt('window', i - HALF + 0.5, BELLY + 2.5, BODY_TO + 1.07, {}, { sx: 0.9, sy: 0.7 })
  for (const x of [-HALF - 0.07, HALF + 0.07]) v.addAt('window', x, BELLY + 2.5, BODY_TO + 0.5, { y: Math.PI / 2 }, { sx: 0.8, sy: 0.7 })
}

function tail(v: VoxelBatcher): void {
  for (let i = 1; i < 3; i++) {
    for (let j = 1; j < 4; j++) v.addAt('quartz', i - HALF + 0.5, BELLY + j + 0.5, BODY_FROM - 0.5)
    for (let j = 2; j < 4; j++) v.addAt('quartz', i - HALF + 0.5, BELLY + j + 0.5, BODY_FROM - 1.5)
  }
  const fin = [5, 5, 4, 3, 2]
  fin.forEach((h, k) => {
    for (let r = 0; r < h; r++) v.addAt('concrete', 0, BELLY + 4.5 + r, BODY_FROM - 1.5 + k, {}, { sx: 0.5, color: LIVERY })
  })
  for (let zc = BODY_FROM - 2; zc < BODY_FROM + 1; zc++) {
    const span = zc === BODY_FROM ? 3 : 5
    for (let d = 1; d < span; d++) for (const s of [-1, 1]) v.addAt('quartz', s * (d + 0.5), BELLY + 3.3, zc + 0.5, {}, { sy: 0.4 })
  }
}

function wings(v: VoxelBatcher): void {
  for (let d = HALF; d < 12; d++) {
    const from = -3 - Math.floor((d - HALF) * 0.4)
    const to = 2 - Math.floor((d - HALF) * 0.6)
    for (let zc = from; zc < to; zc++) for (const s of [-1, 1]) v.addAt('quartz', s * (d + 0.5), BELLY + 0.25, zc + 0.5, {}, { sy: 0.5 })
  }
  for (const s of [-1, 1]) {
    v.addAt('concrete', s * 11.5, BELLY + 1, -4.5, {}, { sy: 1, sz: 1, color: LIVERY })
    const x = s * 5
    v.addAt('iron', x, BELLY - 0.8, 1.5, {}, { sx: 1.4, sy: 1.3, sz: 3 })
    v.addAt('iron', x, BELLY - 0.1, 1, {}, { sx: 0.3, sy: 0.3, sz: 1.5 })
    v.addAt('concrete', x, BELLY - 0.8, 3.02, {}, { sx: 1.1, sy: 1, sz: 0.06, color: DARK })
    v.addAt('concrete', x, BELLY - 0.8, -0.02, {}, { sx: 0.9, sy: 0.8, sz: 0.06, color: DARK })
  }
}

function gear(v: VoxelBatcher): void {
  const legs: [number, number][] = [
    [0, 8.5],
    [-1.2, -1.5],
    [1.2, -1.5],
  ]
  for (const [x, z] of legs) {
    v.addAt('iron', x, (BELLY + 0.3) / 2, z, {}, { sx: 0.25, sy: BELLY - 0.3, sz: 0.25 })
    v.addAt('concrete', x, 0.3, z, {}, { sx: 0.45, sy: 0.6, sz: 0.6, color: TIRE })
  }
}

function smooth(t: number): number {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

export class Airplane {
  readonly root = new THREE.Group()
  private readonly home: Airport['plane']
  private clock = 0

  constructor(textures: Textures, home: Airport['plane']) {
    this.home = home
    const v = new VoxelBatcher({ textures })
    fuselage(v)
    nose(v)
    tail(v)
    wings(v)
    gear(v)
    this.root.add(v.build())
    this.root.rotation.order = 'YXZ'
    this.pose(0)
  }

  update(status: GameStatus, escapeTime: number, dt: number): void {
    if (status === 'escaping') this.clock = escapeTime
    else if (status === 'won') this.clock += dt
    else this.clock = 0
    this.pose(this.clock)
  }

  private pose(t: number): void {
    const roll = Math.min(t, ROLL_TIME)
    const s = Math.max(0, t - ROLL_TIME)
    const v0 = ROLL_ACCEL * ROLL_TIME
    const d = 0.5 * ROLL_ACCEL * roll * roll + v0 * s + 0.5 * CLIMB_ACCEL * s * s
    const climbRate = (2 * CLIMB_HEIGHT) / CLIMB_TIME
    const y = s <= CLIMB_TIME ? CLIMB_HEIGHT * (s / CLIMB_TIME) ** 2 : CLIMB_HEIGHT + climbRate * (s - CLIMB_TIME)
    const a = this.home.angle
    this.root.position.set(this.home.x + Math.sin(a) * d, y, this.home.z + Math.cos(a) * d)
    this.root.rotation.set(-MAX_PITCH * smooth(s / PITCH_RAMP), a, 0)
  }
}
