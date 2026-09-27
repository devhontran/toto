import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOT_COLORS } from '../entities/Bot'

export const PX = 1.8 / 32

const HALF_PI = Math.PI / 2
const TILE = 8
const TILES = 5
const FACE_TILES = [1, 1, 2, 4, 0, 3]
const FALL_TIME = 0.35
const FLASH_TIME = 0.12
const RECOIL_TIME = 0.06
const RECOIL_BACK = 0.05
const RECOIL_KICK = 0.15
export const STRIDE = 1.6
const WALK_SWING = (30 * Math.PI) / 180
const RUN_SWING = (55 * Math.PI) / 180
const WALK_SPEED = 2
const RUN_SPEED = 5
const IDLE_BELOW = 0.3
const MOVE_RAMP = 0.6
const SPEED_SHARPNESS = 12
const ATTACK_SWING = 1.2
const ZOMBIE_ARM_SWAY = 0.08
const AIM_YAW_R = 0.12
const AIM_YAW_L = -0.55
const AIM_PITCH_L = -HALF_PI + 0.08
const FLASH_COLOR = '#ff3030'
const FLASH_EMISSIVE = '#5a0a0a'
const GUN_SCALE = 1.5
const SLAM_TIME = 0.9
const SLAM_RAISE = 0.45
const SLAM_HIT = 0.65
const SLAM_TOP = Math.PI * 0.95
const SLAM_LOW = 0.2
const SLAM_LEAN = 0.3
const HEAVY_ROLL = 0.06

export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
  shoes: string
  eyes: string
  eyeWhite: string
  nose: string
  mouth: string
  bareArms: boolean
  face: readonly string[]
  glow?: string
  armor?: string
  crown?: string
}

const HUMAN_FACE = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'SSSSSSSS', 'SWESSEWS', 'SSSNNSSS', 'SSMMMMSS', 'SSSSSSSS']
const ZOMBIE_FACE = ['HHHHHHHH', 'HSHHSSHH', 'SSSSSSSS', 'SSSSSSSS', 'SEESSEES', 'SSSNNSSS', 'SSMMMMSS', 'SSSSSSSS']
const BOSS_FACE = ['HHHHHHHH', 'HSHHSSHH', 'SSSSSSSS', 'SHHSSHHS', 'SEESSEES', 'SSSNNSSS', 'SMMMMMMS', 'SMSMMSMS']
const SIDE = ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHS', 'HHSSSSSS', 'HSSSSSSS', 'SSSSSSSS', 'SSSSSSSS', 'SSSSSSSS']
const TOP = Array<string>(8).fill('HHHHHHHH')
const BACK = ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'SSSSSSSS', 'SSSSSSSS']
const BOTTOM = Array<string>(8).fill('SSSSSSSS')

function human(shirt: string, pants: string, hair: string, skin: string, eyes: string): Look {
  return {
    skin,
    hair,
    shirt,
    pants,
    shoes: '#3a3a40',
    eyes,
    eyeWhite: '#ffffff',
    nose: '#00000022',
    mouth: '#6b3a2a',
    bareArms: false,
    face: HUMAN_FACE,
  }
}

function zombie(skin: string, hair: string): Look {
  return {
    skin,
    hair,
    shirt: '#2fa3a3',
    pants: '#45418f',
    shoes: '#45418f',
    eyes: '#101010',
    eyeWhite: '#101010',
    nose: '#00000033',
    mouth: '#1e3312',
    bareArms: true,
    face: ZOMBIE_FACE,
  }
}

export const PLAYER_LOOK = human('#3aa6c9', '#3b3f9e', '#4a2f1c', '#c89f7a', '#4a5fc1')
export const BOT_LOOKS: readonly Look[] = [
  human(BOT_COLORS[0], '#4a4436', '#1c1a18', '#e0b894', '#3a2a1c'),
  human(BOT_COLORS[1], '#2d2d38', '#d9b35b', '#8d5a3b', '#2a1c12'),
  human(BOT_COLORS[2], '#3a2e24', '#9a3b1e', '#d7a882', '#2f7a3a'),
]
export const ZOMBIE_LOOKS = {
  walker: zombie('#5b8f3a', '#3e6b27'),
  runner: zombie('#7fb85a', '#55893a'),
  boss: {
    ...zombie('#3f6b2a', '#2b4a1c'),
    shirt: '#5b2a86',
    pants: '#2e2a5e',
    shoes: '#2e2a5e',
    eyes: '#ff2a1a',
    eyeWhite: '#ff2a1a',
    mouth: '#1a0f0a',
    face: BOSS_FACE,
    glow: '#ff2a1a',
    armor: '#8e949c',
    crown: '#d9a92a',
  } satisfies Look,
} as const

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z)
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

function pxBox(w: number, h: number, d: number, x: number, y: number, z: number, color: string): THREE.BufferGeometry {
  return box(w * PX, h * PX, d * PX, x * PX, y * PX, z * PX, color)
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  if (!g) throw new Error('merge failed')
  return g
}

function headGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(8 * PX, 8 * PX, 8 * PX).translate(0, 4 * PX, 0)
  const uv = g.attributes.uv
  for (let face = 0; face < 6; face++) {
    const tile = FACE_TILES[face]
    for (let v = face * 4; v < face * 4 + 4; v++) {
      uv.setX(v, (tile + 0.001 + uv.getX(v) * 0.998) / TILES)
    }
  }
  return g
}

function pixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function glowTexture(look: Look, glow: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE * TILES
  canvas.height = TILE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = glow
  look.face.forEach((row, y) => {
    for (let x = 0; x < TILE; x++) if (row[x] === 'E' || row[x] === 'W') ctx.fillRect(x, y, 1, 1)
  })
  return pixelTexture(canvas)
}

function headTexture(look: Look): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE * TILES
  canvas.height = TILE
  const ctx = canvas.getContext('2d')!
  const key: Record<string, string> = {
    H: look.hair,
    S: look.skin,
    W: look.eyeWhite,
    E: look.eyes,
    N: look.nose,
    M: look.mouth,
  }
  const paint = (tile: number, rows: readonly string[]): void => {
    rows.forEach((row, y) => {
      for (let x = 0; x < TILE; x++) {
        const ch = row[x]
        if (ch === 'N') {
          ctx.fillStyle = look.skin
          ctx.fillRect(tile * TILE + x, y, 1, 1)
        }
        ctx.fillStyle = key[ch]
        ctx.fillRect(tile * TILE + x, y, 1, 1)
      }
    })
  }
  paint(0, look.face)
  paint(1, SIDE)
  paint(2, TOP)
  paint(3, BACK)
  paint(4, BOTTOM)
  return pixelTexture(canvas)
}

interface Parts {
  head: THREE.Material
  torso: THREE.BufferGeometry
  arm: THREE.BufferGeometry
  leg: THREE.BufferGeometry
  crown: THREE.BufferGeometry | null
}

const partsCache = new WeakMap<Look, Parts>()
const bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true })
const flashMaterial = new THREE.MeshLambertMaterial({ color: FLASH_COLOR, emissive: FLASH_EMISSIVE })
let sharedHead: THREE.BufferGeometry | null = null
const noGeometry = new THREE.BufferGeometry()

function torsoGeometry(look: Look): THREE.BufferGeometry {
  const shirt = pxBox(8, 12, 4, 0, 18, 0, look.shirt)
  if (!look.armor) return shirt
  const plate = new THREE.Color(look.armor).multiplyScalar(0.7).getStyle()
  return merge([
    shirt,
    pxBox(3, 2, 0.4, -1.5, 13, 2.1, look.skin),
    pxBox(2, 3, 0.4, 2.5, 14.5, 2.1, look.skin),
    pxBox(1, 1, 0.4, -3, 15.5, 2.1, look.skin),
    pxBox(2, 1, 0.4, 1, 12.5, -2.1, look.skin),
    pxBox(8.8, 6, 4.8, 0, 21, 0, look.armor),
    pxBox(9, 1, 5, 0, 17.8, 0, plate),
    pxBox(2, 2, 0.4, 0, 21, 2.5, plate),
  ])
}

function armGeometry(look: Look): THREE.BufferGeometry {
  if (!look.bareArms) return merge([pxBox(4, 4, 4, 0, 0, 0, look.shirt), pxBox(4, 8, 4, 0, -6, 0, look.skin)])
  const arm = pxBox(4, 12, 4, 0, -4, 0, look.skin)
  if (!look.armor) return arm
  return merge([arm, pxBox(5, 3, 5, 0, 0.5, 0, look.armor), pxBox(4.4, 1, 4.4, 0, -6, 0, look.shirt)])
}

function crownGeometry(color: string): THREE.BufferGeometry {
  const parts = [pxBox(8.6, 1.5, 8.6, 0, 8.75, 0, color)]
  for (const x of [-3.5, 0, 3.5]) {
    parts.push(pxBox(1.5, 2, 1.5, x, 10.5, 3.55, color), pxBox(1.5, 2, 1.5, x, 10.5, -3.55, color))
  }
  parts.push(pxBox(1.5, 2, 1.5, 3.55, 10.5, 0, color), pxBox(1.5, 2, 1.5, -3.55, 10.5, 0, color))
  return merge(parts)
}

function partsFor(look: Look): Parts {
  let p = partsCache.get(look)
  if (p) return p
  const leg =
    look.shoes === look.pants
      ? pxBox(4, 12, 4, 0, -6, 0, look.pants)
      : merge([pxBox(4, 10, 4, 0, -5, 0, look.pants), pxBox(4, 2, 4, 0, -11, 0, look.shoes)])
  p = {
    head: look.glow
      ? new THREE.MeshLambertMaterial({ map: headTexture(look), emissiveMap: glowTexture(look, look.glow), emissive: '#ffffff' })
      : new THREE.MeshLambertMaterial({ map: headTexture(look) }),
    torso: torsoGeometry(look),
    arm: armGeometry(look),
    leg,
    crown: look.crown ? crownGeometry(look.crown) : null,
  }
  partsCache.set(look, p)
  return p
}

const gunCache = new Map<string, THREE.BufferGeometry>()

function gunGeometry(id: string): THREE.BufferGeometry {
  let g = gunCache.get(id)
  if (g) return g
  const metal = '#34373d'
  const dark = '#1d1e22'
  const wood = '#6b4a2c'
  if (id === 'pistol') {
    g = merge([
      box(0.05, 0.06, 0.2, 0, 0.03, 0.06, metal),
      box(0.045, 0.1, 0.05, 0, -0.04, -0.01, dark),
      box(0.02, 0.02, 0.03, 0, 0.03, 0.17, dark),
    ])
  } else if (id === 'shotgun') {
    g = merge([
      box(0.07, 0.08, 0.36, 0, 0.03, 0.12, metal),
      box(0.05, 0.05, 0.3, 0, 0.04, 0.45, dark),
      box(0.07, 0.05, 0.16, 0, -0.02, 0.36, wood),
      box(0.06, 0.1, 0.2, 0, -0.01, -0.14, wood),
    ])
  } else {
    g = merge([
      box(0.07, 0.09, 0.5, 0, 0.03, 0.16, metal),
      box(0.035, 0.035, 0.22, 0, 0.045, 0.52, dark),
      box(0.05, 0.14, 0.07, 0, -0.08, 0.2, dark),
      box(0.05, 0.1, 0.05, 0, -0.05, 0, dark),
      box(0.06, 0.1, 0.2, 0, 0.0, -0.18, dark),
      box(0.03, 0.03, 0.08, 0, 0.09, 0.12, dark),
    ])
  }
  gunCache.set(id, g)
  return g
}

export interface BlockyFrame {
  x: number
  z: number
  angle: number
  alive: boolean
  hp: number
  fired: boolean
  attack: number
}

function slamPose(t: number): { arm: number; lean: number } {
  if (t < SLAM_RAISE) {
    const k = t / SLAM_RAISE
    const e = k * (2 - k)
    return { arm: -HALF_PI - (SLAM_TOP - HALF_PI) * e, lean: -SLAM_LEAN * 0.5 * e }
  }
  if (t < SLAM_HIT) {
    const k = (t - SLAM_RAISE) / (SLAM_HIT - SLAM_RAISE)
    const e = k * k
    return { arm: -SLAM_TOP + (SLAM_TOP - SLAM_LOW) * e, lean: -SLAM_LEAN * 0.5 + SLAM_LEAN * 1.5 * e }
  }
  const k = (t - SLAM_HIT) / (1 - SLAM_HIT)
  const e = k * k * (3 - 2 * k)
  return { arm: -SLAM_LOW - (HALF_PI - SLAM_LOW) * e, lean: SLAM_LEAN * (1 - e) }
}

function limb(parent: THREE.Object3D, x: number, y: number): { pivot: THREE.Group; mesh: THREE.Mesh } {
  const pivot = new THREE.Group()
  pivot.position.set(x * PX, y * PX, 0)
  pivot.rotation.order = 'YXZ'
  const mesh = new THREE.Mesh(undefined, bodyMaterial)
  pivot.add(mesh)
  parent.add(pivot)
  return { pivot, mesh }
}

export class BlockyCharacter {
  readonly root = new THREE.Group()
  private readonly tilt = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly head: THREE.Mesh
  private readonly crown = new THREE.Mesh(noGeometry, bodyMaterial)
  private readonly torso: THREE.Mesh
  private readonly armL: THREE.Group
  private readonly armR: THREE.Group
  private readonly legL: THREE.Group
  private readonly legR: THREE.Group
  private readonly hand = new THREE.Group()
  private readonly guns = new Map<string, THREE.Mesh>()
  private readonly meshes: THREE.Mesh[] = []
  private readonly materials: THREE.Material[] = []
  private readonly undead: boolean
  private speed = 0
  private lastX = 0
  private lastZ = 0
  private seen = false
  private phase = 0
  private time = Math.random() * 10
  private fall = 0
  private flash = 0
  private recoil = 0
  private lastHp = Infinity
  private tinted = false
  private slamT = -1
  private lastAttack = -1
  stride = STRIDE
  swing = 1
  heavy = false

  constructor(look: Look, undead: boolean) {
    this.undead = undead
    this.root.add(this.tilt)
    this.tilt.position.z = -4 * PX
    this.tilt.add(this.body)
    this.body.position.z = 4 * PX
    if (!sharedHead) sharedHead = headGeometry()
    this.head = new THREE.Mesh(sharedHead, bodyMaterial)
    this.head.position.y = 24 * PX
    this.torso = new THREE.Mesh(undefined, bodyMaterial)
    this.body.add(this.head, this.torso)
    this.head.add(this.crown)
    const al = limb(this.body, 6, 22)
    const ar = limb(this.body, -6, 22)
    const ll = limb(this.body, 2, 12)
    const lr = limb(this.body, -2, 12)
    this.armL = al.pivot
    this.armR = ar.pivot
    this.legL = ll.pivot
    this.legR = lr.pivot
    this.meshes.push(this.head, this.torso, al.mesh, ar.mesh, ll.mesh, lr.mesh)
    this.hand.position.y = -9 * PX
    this.hand.rotation.x = HALF_PI
    this.armR.add(this.hand)
    this.setLook(look)
  }

  setLook(look: Look): void {
    const p = partsFor(look)
    const [head, torso, al, ar, ll, lr] = this.meshes
    head.material = p.head
    torso.geometry = p.torso
    al.geometry = p.arm
    ar.geometry = p.arm
    ll.geometry = p.leg
    lr.geometry = p.leg
    this.crown.geometry = p.crown ?? noGeometry
    this.crown.visible = p.crown !== null
    for (let i = 0; i < this.meshes.length; i++) this.materials[i] = this.meshes[i].material as THREE.Material
    this.tinted = false
  }

  holdGun(id: string | null): void {
    if (id && !this.guns.has(id)) {
      const gun = new THREE.Mesh(gunGeometry(id), bodyMaterial)
      gun.scale.setScalar(GUN_SCALE)
      gun.position.set(0, -0.06, -0.04)
      this.hand.add(gun)
      this.guns.set(id, gun)
    }
    for (const [k, g] of this.guns) g.visible = k === id
  }

  reset(): void {
    this.seen = false
    this.speed = 0
    this.fall = 0
    this.flash = 0
    this.recoil = 0
    this.lastHp = Infinity
    this.slamT = -1
    this.lastAttack = -1
    this.body.rotation.set(0, 0, 0)
    this.setTint(false)
  }

  private setTint(on: boolean): void {
    if (on === this.tinted) return
    this.tinted = on
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].material = on ? flashMaterial : this.materials[i]
  }

  update(dt: number, f: BlockyFrame, animate: boolean): void {
    this.root.position.set(f.x, 0, f.z)
    this.root.rotation.y = f.angle
    let dist = 0
    if (!this.seen) {
      this.seen = true
    } else if (dt > 0) {
      dist = Math.hypot(f.x - this.lastX, f.z - this.lastZ)
      this.speed += (dist / dt - this.speed) * Math.min(1, dt * SPEED_SHARPNESS)
    }
    this.lastX = f.x
    this.lastZ = f.z
    this.time += dt
    if (f.alive) this.phase += (dist * Math.PI * 2) / this.stride
    const target = f.alive ? 0 : 1
    this.fall += Math.sign(target - this.fall) * Math.min(Math.abs(target - this.fall), dt / FALL_TIME)
    if (f.hp < this.lastHp && this.lastHp !== Infinity) this.flash = FLASH_TIME
    this.lastHp = f.hp
    this.flash = Math.max(0, this.flash - dt)
    if (f.fired) this.recoil = RECOIL_TIME
    else this.recoil = Math.max(0, this.recoil - dt)
    this.setTint(this.flash > 0)
    if (this.heavy) {
      if (f.attack >= 0 && this.lastAttack < 0) this.slamT = 0
      else if (this.slamT >= 0) this.slamT += dt / SLAM_TIME
      if (this.slamT > 1 || !f.alive) this.slamT = -1
    }
    this.lastAttack = f.attack
    this.hand.visible = f.alive
    if (!animate) return

    const up = 1 - this.fall * this.fall
    const moving = Math.min(1, Math.max(0, (this.speed - IDLE_BELOW) / MOVE_RAMP)) * up
    const run = Math.min(1, Math.max(0, (this.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)))
    const amp = (WALK_SWING + (RUN_SWING - WALK_SWING) * run) * moving * this.swing
    const s = Math.sin(this.phase)
    const breathe = Math.sin(this.time * 2.2)
    this.tilt.rotation.x = -HALF_PI * this.fall * this.fall
    this.body.position.y = up * ((1 - moving) * breathe * 0.012 + moving * Math.abs(Math.cos(this.phase)) * 0.04)
    this.legL.rotation.x = s * amp
    this.legR.rotation.x = -s * amp

    if (this.heavy) {
      const sway = ZOMBIE_ARM_SWAY * (moving * s + (1 - moving) * breathe * 0.5)
      const slam = this.slamT >= 0 ? slamPose(this.slamT) : null
      const arm = slam ? slam.arm : -HALF_PI
      this.body.rotation.set((slam ? slam.lean : 0) * up, 0, s * HEAVY_ROLL * moving)
      this.armL.rotation.set((arm + (slam ? 0 : sway)) * up, 0, 0)
      this.armR.rotation.set((arm - (slam ? 0 : sway)) * up, 0, 0)
      this.armL.position.z = 0
      this.armR.position.z = 0
      return
    }

    if (this.undead) {
      let attack = 0
      if (f.attack >= 0) attack = Math.sin(Math.min(1, f.attack) * Math.PI) * ATTACK_SWING
      const sway = ZOMBIE_ARM_SWAY * (moving * s + (1 - moving) * breathe * 0.5)
      this.armL.rotation.set((-HALF_PI + sway + attack) * up, 0, 0)
      this.armR.rotation.set((-HALF_PI - sway + attack) * up, 0, 0)
      this.armL.position.z = 0
      this.armR.position.z = 0
      return
    }

    const k = this.recoil / RECOIL_TIME
    const idle = (1 - moving) * Math.sin(this.time * 1.6) * 0.03
    this.armR.rotation.set((-HALF_PI - RECOIL_KICK * k + idle) * up, AIM_YAW_R * up, 0)
    this.armL.rotation.set((AIM_PITCH_L - RECOIL_KICK * k * 0.5 + idle) * up, AIM_YAW_L * up, 0)
    this.armR.position.z = -RECOIL_BACK * k
    this.armL.position.z = -RECOIL_BACK * k * 0.6
  }
}
