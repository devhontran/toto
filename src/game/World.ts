import { Player, PLAYER_SPEED } from '../entities/Player'
import { Bot, BOT_COOLDOWN, BOT_ENGAGE_RANGE, BOT_LANES } from '../entities/Bot'
import { createZombie, ZOMBIE_RADIUS, type Zombie, type ZombieKind } from '../entities/Zombie'
import { hearNoise, updateZombie } from '../ai/zombieBrain'
import { decideBot, updateRevive } from '../ai/botBrain'
import { resolveCircleBox, resolveCircleCircle, type Box } from '../systems/collision'
import { applyDamage, castShot } from '../systems/combat'
import { pelletAngles, WEAPONS, WeaponState, type WeaponDef } from '../systems/weapons'
import { SpatialGrid } from '../systems/spatialGrid'
import { WallGrid } from '../systems/wallGrid'
import { Spawner } from '../systems/spawner'
import { BOARD_ZONE, PLAYER_START, WALLS } from '../level/map'
import { CITY } from '../level/city'
import { pointAtDistance, routeProgress, type RouteProgress } from '../level/route'
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

export type GameStatus = 'playing' | 'boarding' | 'escaping' | 'won' | 'lost'

export type Objective = 'reach-airport' | 'kill-boss' | 'board' | 'escape'

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
const BOSS_CROWD_SHARE = 0.1
export const BOSS_TRIGGER = 60
export const BOARDING_TIMEOUT = 8
export const ESCAPE_DURATION = 8
const BOT_START_BEHIND = 2
const WALL_PAD = 0.5

export class World {
  readonly player = new Player()
  readonly bots: Bot[]
  readonly zombies: Zombie[] = []
  readonly walls: readonly Box[] = WALLS
  readonly tracers: Tracer[] = []
  status: GameStatus = 'playing'
  progress: RouteProgress
  boardingTime = 0
  escapeTime = 0
  escaped = 0
  boss: Zombie | null = null
  bossSpawned = false
  kills = 0
  time = 0

  private readonly rng: () => number
  private readonly spawning: boolean
  private readonly grid = new SpatialGrid<Zombie>(4)
  private readonly wallGrid = new WallGrid(WALLS, 16)
  private readonly nearWalls: Box[] = []
  private readonly spawner = new Spawner()
  private readonly near: Zombie[] = []
  private readonly teammates: (Player | Bot)[]
  private nextId = 1

  constructor(opts: WorldOptions = {}) {
    this.rng = opts.rng ?? Math.random
    this.spawning = opts.spawning ?? true
    this.player.x = PLAYER_START.x
    this.player.z = PLAYER_START.z
    const { dir } = pointAtDistance(CITY.route, 0)
    this.bots = (opts.bots ?? true)
      ? BOT_LANES.map((lane, i) => {
          const bot = new Bot(i)
          bot.x = PLAYER_START.x - dir.x * BOT_START_BEHIND - dir.z * lane
          bot.z = PLAYER_START.z - dir.z * BOT_START_BEHIND + dir.x * lane
          return bot
        })
      : []
    this.progress = routeProgress(CITY.route, this.player.x, this.player.z)
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

  get objective(): Objective {
    if (this.status === 'escaping' || this.status === 'won') return 'escape'
    if (!this.bossSpawned) return 'reach-airport'
    if (this.boss && this.boss.alive) return 'kill-boss'
    return 'board'
  }

  step(dt: number, input: FrameInput): void {
    if (this.status === 'escaping') {
      this.escapeTime += dt
      if (this.escapeTime >= ESCAPE_DURATION) this.status = 'won'
      return
    }
    if (this.status !== 'playing' && this.status !== 'boarding') return
    this.time += dt
    this.updatePlayer(dt, input)
    this.progress = routeProgress(CITY.route, this.player.x, this.player.z)
    this.updateBoss()
    this.updateZombies(dt)
    this.updateBots(dt)
    updateRevive(this.teammates, dt)
    this.updateTracers(dt)
    if (this.spawning) {
      this.spawner.update(
        dt,
        this.progress.distance,
        this.aliveZombies,
        this.wallGrid,
        this.rng,
        (k, x, z) => this.spawnZombie(k, x, z),
        this.bossSpawned,
      )
    }
    this.updateStatus(dt)
  }

  private collideWalls(c: { x: number; z: number; r: number }): void {
    for (const w of this.wallGrid.query(c.x, c.z, c.r + WALL_PAD, this.nearWalls)) resolveCircleBox(c, w)
  }

  private updatePlayer(dt: number, input: FrameInput): void {
    const p = this.player
    if (!p.alive) return
    if (input.switchTo !== null) p.switchTo(input.switchTo)
    if (input.reload) p.weapon.startReload()
    const m = normalize(input.moveX, input.moveZ)
    p.x += m.x * PLAYER_SPEED * dt
    p.z += m.z * PLAYER_SPEED * dt
    this.collideWalls(p)
    const ax = input.aimX - p.x
    const az = input.aimZ - p.z
    if (ax * ax + az * az > 1e-4) p.angle = angleOf(ax, az)
    p.weapon.update(dt)
    if (input.fire && p.weapon.tryFire()) this.fire()
  }

  private fireRay(ox: number, oz: number, angle: number, def: WeaponDef): void {
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    const walls = this.wallGrid.querySegment(ox, oz, ox + dx * def.range, oz + dz * def.range, WALL_PAD, this.nearWalls)
    const hit = castShot(ox, oz, dx, dz, def.range, this.zombies, walls)
    this.tracers.push({ x0: ox, z0: oz, x1: ox + dx * hit.dist, z1: oz + dz * hit.dist, life: TRACER_LIFE })
    if (hit.target) {
      const t = hit.target
      t.x += dx * def.knockback * t.knockback
      t.z += dz * def.knockback * t.knockback
      if (applyDamage(t, def.damage * t.damageTaken)) this.kills++
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
        this.wallGrid.query(b.x, b.z, BOT_ENGAGE_RANGE + WALL_PAD, this.nearWalls),
        this.rng,
      )
      b.x += decision.moveX * decision.speed * dt
      b.z += decision.moveZ * decision.speed * dt
      this.collideWalls(b)
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
      if (struck) applyDamage(struck, z.attack.damage)
      const boss = z.kind === 'boss'
      this.grid.query(z.x, z.z, boss ? z.r + ZOMBIE_RADIUS : z.r * 2, this.near)
      for (const o of this.near) {
        if (boss) {
          if (o !== z) resolveCircleCircle(z, o, BOSS_CROWD_SHARE)
        } else if (o.id > z.id && o.kind !== 'boss') resolveCircleCircle(z, o)
      }
      const share = boss ? 1 - BOSS_CROWD_SHARE : PLAYER_CROWD_SHARE
      for (const t of this.teammates) if (t.alive) resolveCircleCircle(t, z, share)
      this.collideWalls(z)
    }
    this.collideWalls(p)
    for (const b of this.bots) if (b.alive) this.collideWalls(b)

    const behind = this.progress.distance - DESPAWN_BEHIND
    let keep = 0
    for (const z of this.zombies) {
      const expired =
        z.kind !== 'boss' &&
        (z.alive ? behind > 0 && routeProgress(CITY.route, z.x, z.z).distance < behind : z.deadTime > CORPSE_LIFE)
      if (!expired) this.zombies[keep++] = z
    }
    this.zombies.length = keep
  }

  private updateBoss(): void {
    if (!this.bossSpawned && this.progress.total - this.progress.distance <= BOSS_TRIGGER) {
      this.bossSpawned = true
      const runway = CITY.airport.runway
      this.boss = this.spawnZombie('boss', runway.x, runway.z)
    }
    const b = this.boss
    if (!b || !b.alive) return
    let best = Infinity
    for (const t of this.teammates) {
      if (!t.alive) continue
      const d = Math.hypot(t.x - b.x, t.z - b.z)
      if (d < best) {
        best = d
        b.hasAlert = true
        b.alertX = t.x
        b.alertZ = t.z
      }
    }
  }

  private updateTracers(dt: number): void {
    let keep = 0
    for (const t of this.tracers) {
      t.life -= dt
      if (t.life > 0) this.tracers[keep++] = t
    }
    this.tracers.length = keep
  }

  private inBoardZone(t: { x: number; z: number }): boolean {
    return Math.hypot(t.x - BOARD_ZONE.x, t.z - BOARD_ZONE.z) <= BOARD_ZONE.r
  }

  private updateStatus(dt: number): void {
    const p = this.player
    if (!p.alive && this.bots.every((b) => !b.alive)) {
      this.status = 'lost'
      return
    }
    if (this.status === 'playing') {
      if (this.bossSpawned && !(this.boss && this.boss.alive) && p.alive && this.inBoardZone(p)) {
        this.status = 'boarding'
        this.boardingTime = 0
      }
      return
    }
    this.boardingTime += dt
    const aboard = this.bots.filter((b) => b.alive && this.inBoardZone(b)).length
    const ready = aboard === this.bots.filter((b) => b.alive).length
    if (p.alive && (ready || this.boardingTime >= BOARDING_TIMEOUT)) {
      this.status = 'escaping'
      this.escapeTime = 0
      this.escaped = 1 + aboard
    }
  }
}
