import { BlockyCharacter, ZOMBIE_LOOKS, type BlockyFrame, type Look } from './blocky'

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

  spawn(kind: string): void {
    const runner = kind === 'runner'
    this.body.setLook(runner ? ZOMBIE_LOOKS.runner : ZOMBIE_LOOKS.walker)
    this.body.root.scale.setScalar(runner ? 0.9 : 1)
    this.body.reset()
  }

  sync(dt: number, animate: boolean): void {
    this.body.update(dt, this.frame, animate)
  }
}
