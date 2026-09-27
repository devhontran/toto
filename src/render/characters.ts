import { BlockyCharacter, STRIDE, ZOMBIE_LOOKS, type BlockyFrame, type Look } from './blocky'

const BOSS_SCALE = 3
const BOSS_STRIDE = 2.4
const BOSS_SWING = 1.4
const ZOMBIE_CULL_Y = 0.9
const ZOMBIE_CULL_RADIUS = 1.5

export interface HumanState {
  x: number
  z: number
  angle: number
  alive: boolean
  hp: number
  weapon: { cooldown: number }
}

export class HumanView {
  readonly body: BlockyCharacter
  private lastCooldown = 0
  private lastGun = ''

  constructor(look: Look) {
    this.body = new BlockyCharacter(look, false)
  }

  reset(): void {
    this.body.reset()
    this.lastCooldown = 0
  }

  sync(s: HumanState, gunId: string, dt: number): void {
    const cd = s.weapon.cooldown
    const fired = s.alive && gunId === this.lastGun && cd > this.lastCooldown + 1e-6
    this.lastCooldown = cd
    this.lastGun = gunId
    this.body.holdGun(gunId)
    this.body.root.visible = true
    this.body.update(dt, { x: s.x, z: s.z, angle: s.angle, alive: s.alive, hp: s.hp, fired, attack: -1 }, true)
  }
}

export class ZombieView {
  readonly body = new BlockyCharacter(ZOMBIE_LOOKS.walker, true)
  readonly frame: BlockyFrame = { x: 0, z: 0, angle: 0, alive: true, hp: 0, fired: false, attack: -1 }
  cullY = ZOMBIE_CULL_Y
  cullRadius = ZOMBIE_CULL_RADIUS

  spawn(kind: string): void {
    const runner = kind === 'runner'
    const boss = kind === 'boss'
    const scale = boss ? BOSS_SCALE : runner ? 0.9 : 1
    this.body.setLook(boss ? ZOMBIE_LOOKS.boss : runner ? ZOMBIE_LOOKS.runner : ZOMBIE_LOOKS.walker)
    this.body.root.scale.setScalar(scale)
    this.body.stride = boss ? STRIDE * BOSS_STRIDE : STRIDE
    this.body.swing = boss ? BOSS_SWING : 1
    this.body.heavy = boss
    this.cullY = ZOMBIE_CULL_Y * scale
    this.cullRadius = ZOMBIE_CULL_RADIUS * scale
    this.body.reset()
  }

  sync(dt: number, animate: boolean): void {
    this.body.update(dt, this.frame, animate)
  }
}
