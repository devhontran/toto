import * as THREE from 'three'
import { AnimatedRig, type RigTemplate } from './rig'

const SPEED_SHARPNESS = 12
const IDLE_BELOW = 0.2
const RUN_FROM = 4
const HAND_BONE = 'PalmR'

export const HUMAN_CLIPS = {
  idle: 'HumanArmature|Man_Idle',
  walk: 'HumanArmature|Man_Walk',
  run: 'HumanArmature|Man_Run',
  death: 'HumanArmature|Man_Death',
} as const

export const ZOMBIE_CLIPS = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack: 'Punch',
  death: 'Death',
} as const

class Motion {
  speed = 0
  private lastX = 0
  private lastZ = 0
  private seen = false

  track(x: number, z: number, dt: number): number {
    if (!this.seen || dt <= 0) {
      this.seen = true
      this.lastX = x
      this.lastZ = z
      return this.speed
    }
    const inst = Math.hypot(x - this.lastX, z - this.lastZ) / dt
    this.lastX = x
    this.lastZ = z
    this.speed += (inst - this.speed) * Math.min(1, dt * SPEED_SHARPNESS)
    return this.speed
  }

  reset(): void {
    this.seen = false
    this.speed = 0
  }
}

export interface HumanState {
  x: number
  z: number
  angle: number
  alive: boolean
}

export class HumanView {
  readonly rig: AnimatedRig
  private readonly hand: THREE.Object3D
  private readonly guns = new Map<string, THREE.Object3D>()
  private readonly motion = new Motion()
  private readonly tmp = new THREE.Vector3()
  private wasAlive = true

  constructor(template: RigTemplate, guns: Record<string, THREE.Object3D>) {
    this.rig = new AnimatedRig(template)
    this.hand = this.rig.bone(HAND_BONE)
    for (const [id, g] of Object.entries(guns)) {
      g.visible = false
      this.rig.root.add(g)
      this.guns.set(id, g)
    }
    this.rig.snap(HUMAN_CLIPS.idle)
  }

  reset(): void {
    this.motion.reset()
    this.wasAlive = true
    this.rig.snap(HUMAN_CLIPS.idle)
  }

  sync(s: HumanState, gunId: string, dt: number): void {
    const root = this.rig.root
    root.visible = true
    root.position.set(s.x, 0, s.z)
    root.rotation.y = s.angle
    const speed = this.motion.track(s.x, s.z, dt)
    if (!s.alive) {
      if (this.wasAlive) this.rig.play(HUMAN_CLIPS.death, true)
    } else if (!this.wasAlive) {
      this.rig.play(HUMAN_CLIPS.idle, true)
    } else {
      this.rig.play(speed < IDLE_BELOW ? HUMAN_CLIPS.idle : speed < RUN_FROM ? HUMAN_CLIPS.walk : HUMAN_CLIPS.run)
    }
    this.wasAlive = s.alive
    this.rig.update(dt)
    for (const [id, gun] of this.guns) gun.visible = s.alive && id === gunId
    const g = this.guns.get(gunId)
    if (!g || !s.alive) return
    this.hand.getWorldPosition(this.tmp)
    root.worldToLocal(this.tmp)
    g.position.copy(this.tmp)
  }
}

export interface ZombieRender {
  x: number
  z: number
  angle: number
  alive: boolean
  kind: string
  attacking: boolean
}

export class ZombieView {
  readonly rig: AnimatedRig
  private wasAlive = true
  private attacking = false

  constructor(template: RigTemplate) {
    this.rig = new AnimatedRig(template)
  }

  spawn(kind: string): void {
    this.wasAlive = true
    this.attacking = false
    this.rig.root.scale.setScalar(kind === 'runner' ? 0.9 : 1)
    this.rig.snap(kind === 'runner' ? ZOMBIE_CLIPS.run : ZOMBIE_CLIPS.walk)
  }

  sync(s: ZombieRender): void {
    const root = this.rig.root
    root.position.set(s.x, 0, s.z)
    root.rotation.y = s.angle
    if (!s.alive) {
      if (this.wasAlive) this.rig.play(ZOMBIE_CLIPS.death, true)
    } else if (s.attacking) {
      if (!this.attacking) this.rig.play(ZOMBIE_CLIPS.attack, true)
    } else {
      this.rig.play(s.kind === 'runner' ? ZOMBIE_CLIPS.run : ZOMBIE_CLIPS.walk)
    }
    this.wasAlive = s.alive
    this.attacking = s.alive && s.attacking
  }
}
