import { Player, PLAYER_SPEED } from '../entities/Player'
import { Bot, BOT_COOLDOWN, BOT_LANES } from '../entities/Bot'
import { createZombie, ZOMBIE_ATTACK, type Zombie, type ZombieKind } from '../entities/Zombie'
import { hearNoise, updateZombie } from '../ai/zombieBrain'
import { decideBot, updateRevive } from '../ai/botBrain'
import { resolveCircleBox, resolveCircleCircle, type Box } from '../systems/collision'
import { applyDamage, castShot } from '../systems/combat'
import { pelletAngles, WEAPONS, WeaponState, type WeaponDef } from '../systems/weapons'
import { SpatialGrid } from '../systems/spatialGrid'
import { Spawner } from '../systems/spawner'
import { boundaryWalls, EXIT_ZONE, HOUSES, PLAYER_START } from '../level/map'
import { angleOf, normalize } from '../lib/math2'

export interface FrameInput {
  moveX: number
  moveZ: number
  aimX: number
  aimZ: number
  fire: boolean
  reload: boolean
  switchTo: number | null
}

export type GameStatus = 'playing' | 'won' | 'lost'

export interface Tracer {
  x0: number
  z0: number
  x1: number
  z1: number
  life: number
}

export interface WorldOptions {
  rng?: () => number
  spawning?: boolean
  allWeapons?: boolean
  bots?: boolean
}

export const TRACER_LIFE = 0.1
export const CORPSE_LIFE = 3
export const DESPAWN_BEHIND = 40
const MUZZLE_OFFSET = 0.6
const PLAYER_CROWD_SHARE = 0.1

export class World {
  readonly player = new Player()
  readonly bots: Bot[]
  readonly zombies: Zombie[] = []
  readonly walls: Box[] = [...HOUSES, ...boundaryWalls()]
  readonly tracers: Tracer[] = []
  status: GameStatus = 'playing'
  kills = 0
  time = 0

  private readonly rng: () => number
  private readonly spawning: boolean
  private readonly grid = new SpatialGrid<Zombie>(4)
  private readonly spawner = new Spawner()
  private readonly near: Zombie[] = []
  private readonly teammates: (Player | Bot)[]
  private nextId = 1

  constructor(opts: WorldOptions = {}) {
    this.rng = opts.rng ?? Math.random
    this.spawning = opts.spawning ?? true
    this.player.x = PLAYER_START.x
    this.player.z = PLAYER_START.z
    this.bots = (opts.bots ?? true)
      ? BOT_LANES.map((laneX, i) => {
          const bot = new Bot(i)
          bot.x = laneX
          bot.z = this.player.z
          return bot
        })
      : []
    this.teammates = [this.player, ...this.bots]
    if (opts.allWeapons) {
      this.player.weapons.push(new WeaponState(WEAPONS.shotgun, 24))
    }
  }

  spawnZombie(kind: ZombieKind, x: number, z: number): Zombie {
    const zombie = createZombie(this.nextId++, kind, x, z)
    this.zombies.push(zombie)
    return zombie
  }

  get aliveZombies(): number {
    let n = 0
    for (const z of this.zombies) if (z.alive) n++
    return n
  }

  step(dt: number, input: FrameInput): void {
    if (this.status !== 'playing') return
    this.time += dt
    this.updatePlayer(dt, input)
    this.updateZombies(dt)
    this.updateBots(dt)
    updateRevive(this.teammates, dt)
    this.updateTracers(dt)
    if (this.spawning) {
      this.spawner.update(dt, this.player.z, this.aliveZombies, this.walls, this.rng, (k, x, z) =>
        this.spawnZombie(k, x, z),
      )
    }
    this.updateStatus()
  }

  private updatePlayer(dt: number, input: FrameInput): void {
    const p = this.player
    if (!p.alive) return
    if (input.switchTo !== null) p.switchTo(input.switchTo)
    if (input.reload) p.weapon.startReload()
    const m = normalize(input.moveX, input.moveZ)
    p.x += m.x * PLAYER_SPEED * dt
    p.z += m.z * PLAYER_SPEED * dt
    for (const w of this.walls) resolveCircleBox(p, w)
    const ax = input.aimX - p.x
    const az = input.aimZ - p.z
    if (ax * ax + az * az > 1e-4) p.angle = angleOf(ax, az)
    p.weapon.update(dt)
    if (input.fire && p.weapon.tryFire()) this.fire()
  }

  private fireRay(ox: number, oz: number, angle: number, def: WeaponDef): void {
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    const hit = castShot(ox, oz, dx, dz, def.range, this.zombies, this.walls)
    this.tracers.push({ x0: ox, z0: oz, x1: ox + dx * hit.dist, z1: oz + dz * hit.dist, life: TRACER_LIFE })
    if (hit.target) {
      hit.target.x += dx * def.knockback
      hit.target.z += dz * def.knockback
      if (applyDamage(hit.target, def.damage)) this.kills++
    }
  }

  private fire(): void {
    const p = this.player
    const def = p.weapon.def
    const ox = p.x + Math.sin(p.angle) * MUZZLE_OFFSET
    const oz = p.z + Math.cos(p.angle) * MUZZLE_OFFSET
    for (const offset of pelletAngles(def, this.rng)) this.fireRay(ox, oz, p.angle + offset, def)
    for (const z of this.zombies) hearNoise(z, p.x, p.z)
  }

  private updateBots(dt: number): void {
    for (const b of this.bots) {
      b.weapon.update(dt)
      if (!b.alive) continue
      const decision = decideBot(
        { x: b.x, z: b.z, slot: b.slot },
        this.teammates,
        this.zombies,
        this.walls,
        this.rng,
      )
      b.x += decision.moveX * decision.speed * dt
      b.z += decision.moveZ * decision.speed * dt
      for (const w of this.walls) resolveCircleBox(b, w)
      if (decision.target && decision.aimAngle !== null) {
        b.angle = angleOf(decision.target.x - b.x, decision.target.z - b.z)
        if (b.weapon.tryFire()) {
          b.weapon.cooldown = BOT_COOLDOWN
          const ox = b.x + Math.sin(decision.aimAngle) * MUZZLE_OFFSET
          const oz = b.z + Math.cos(decision.aimAngle) * MUZZLE_OFFSET
          this.fireRay(ox, oz, decision.aimAngle, b.weapon.def)
          for (const z of this.zombies) hearNoise(z, b.x, b.z)
        }
      } else if (decision.moveX !== 0 || decision.moveZ !== 0) {
        b.angle = angleOf(decision.moveX, decision.moveZ)
      }
    }
    for (let i = 0; i < this.bots.length; i++) {
      if (!this.bots[i].alive) continue
      for (let j = i + 1; j < this.bots.length; j++) {
        if (this.bots[j].alive) resolveCircleCircle(this.bots[i], this.bots[j])
      }
      if (this.player.alive) resolveCircleCircle(this.player, this.bots[i], 0.5)
    }
  }

  private updateZombies(dt: number): void {
    const p = this.player
    this.grid.clear()
    for (const z of this.zombies) if (z.alive) this.grid.insert(z)

    for (const z of this.zombies) {
      if (!z.alive) {
        z.deadTime += dt
        continue
      }
      const struck = updateZombie(z, this.teammates, dt, this.rng)
      if (struck) applyDamage(struck, ZOMBIE_ATTACK.damage)
      this.grid.query(z.x, z.z, z.r * 2, this.near)
      for (const o of this.near) if (o.id > z.id) resolveCircleCircle(z, o)
      for (const t of this.teammates) if (t.alive) resolveCircleCircle(t, z, PLAYER_CROWD_SHARE)
      for (const w of this.walls) resolveCircleBox(z, w)
    }
    for (const w of this.walls) resolveCircleBox(p, w)
    for (const b of this.bots) {
      if (!b.alive) continue
      for (const w of this.walls) resolveCircleBox(b, w)
    }

    let keep = 0
    for (const z of this.zombies) {
      const expired = z.alive ? z.z - p.z > DESPAWN_BEHIND : z.deadTime > CORPSE_LIFE
      if (!expired) this.zombies[keep++] = z
    }
    this.zombies.length = keep
  }

  private updateTracers(dt: number): void {
    let keep = 0
    for (const t of this.tracers) {
      t.life -= dt
      if (t.life > 0) this.tracers[keep++] = t
    }
    this.tracers.length = keep
  }

  private updateStatus(): void {
    const p = this.player
    if (!p.alive && this.bots.every((b) => !b.alive)) this.status = 'lost'
    else if (Math.hypot(p.x - EXIT_ZONE.x, p.z - EXIT_ZONE.z) <= EXIT_ZONE.r) this.status = 'won'
  }
}
