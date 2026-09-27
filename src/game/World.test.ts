import { describe, it, expect } from 'vitest'
import { World, CORPSE_LIFE, BOSS_TRIGGER, BOARDING_TIMEOUT, ESCAPE_DURATION, type FrameInput } from './World'
import { BOSS_DAMAGE_TAKEN } from '../entities/Zombie'
import { BOT_LANES, REVIVE_HP } from '../entities/Bot'
import { BOARD_ZONE, PLAYER_START, WALLS } from '../level/map'
import { CITY, V_STREETS } from '../level/city'
import { pointAtDistance, routeLength, routeProgress } from '../level/route'
import { overlapsCircleBox } from '../systems/collision'

const DT = 1 / 60
const S = PLAYER_START
const TOTAL = routeLength(CITY.route)

function input(over: Partial<FrameInput> = {}): FrameInput {
  return { moveX: 0, moveZ: 0, aimX: S.x, aimZ: S.z - 100, fire: false, reload: false, switchTo: null, ...over }
}

function run(world: World, seconds: number, inp: FrameInput) {
  const n = Math.round(seconds / DT)
  for (let i = 0; i < n; i++) world.step(DT, inp)
}

function quiet(allWeapons = false) {
  return new World({ rng: () => 0.5, spawning: false, allWeapons, bots: false })
}

function withBots() {
  return new World({ rng: () => 0.5, spawning: false })
}

function place(t: { x: number; z: number }, p: { x: number; z: number }) {
  t.x = p.x
  t.z = p.z
}

function streetSideBuilding() {
  for (const b of CITY.buildings) {
    const east = b.box.x + b.box.hw
    const street = V_STREETS.find((v) => v - 6 - east >= 1.9 && v - 6 - east <= 4.1)
    if (street === undefined) continue
    const spot = { x: street, z: b.box.z, r: 2 }
    if (WALLS.some((w) => overlapsCircleBox(spot, w))) continue
    return { east, spot }
  }
  throw new Error('no street-side building')
}

describe('World', () => {
  it('starts on the route start facing up the first street', () => {
    const w = quiet()
    expect(w.player.x).toBe(S.x)
    expect(w.player.z).toBe(S.z)
    expect(w.progress.distance).toBe(0)
    expect(w.progress.total).toBeCloseTo(TOTAL)
    expect(w.objective).toBe('reach-airport')
  })

  it('moves the player forward with W and tracks route progress', () => {
    const w = quiet()
    run(w, 1, input({ moveZ: -1 }))
    expect(w.player.z).toBeCloseTo(S.z - 5, 1)
    expect(w.progress.distance).toBeCloseTo(5, 1)
  })

  it('stops the player at a building wall found through the wall grid', () => {
    const w = quiet()
    const { east, spot } = streetSideBuilding()
    place(w.player, spot)
    run(w, 5, input({ moveX: -1 }))
    expect(w.player.x).toBeCloseTo(east + w.player.r, 2)
  })

  it('stops the player at the city boundary', () => {
    const w = quiet()
    run(w, 5, input({ moveZ: 1 }))
    expect(w.player.z).toBeCloseTo(-w.player.r, 2)
  })

  it('kills a zombie in front with the starting rifle and counts the kill', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', S.x, S.z - 10)
    run(w, 1, input({ fire: true }))
    expect(z.alive).toBe(false)
    expect(w.kills).toBe(1)
  })

  it('stops shots at a nearby building wall', () => {
    const w = quiet()
    const { east, spot } = streetSideBuilding()
    place(w.player, spot)
    const z = w.spawnZombie('walker', east - 1, spot.z)
    w.step(DT, input({ fire: true, aimX: spot.x - 30, aimZ: spot.z }))
    expect(z.hp).toBe(60)
    expect(w.tracers[0].x1).toBeCloseTo(east, 1)
  })

  it('takes zombie hits and loses at 0 hp', () => {
    const w = quiet()
    w.spawnZombie('walker', S.x, S.z - 0.9)
    w.step(DT, input())
    expect(w.player.hp).toBe(90)
    run(w, 10.5, input())
    expect(w.player.hp).toBe(0)
    expect(w.status).toBe('lost')
  })

  it('alerts zombies beyond sight with gunfire', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', S.x, S.z - 23)
    w.step(DT, input({ fire: true, aimX: S.x + 100, aimZ: S.z }))
    expect(z.hasAlert).toBe(true)
    expect(z.state).toBe('chase')
  })

  it('keeps its facing when the aim point sits on the player', () => {
    const w = quiet()
    w.step(DT, input({ aimX: w.player.x, aimZ: w.player.z }))
    expect(w.player.angle).toBe(Math.PI)
  })

  it('removes corpses after CORPSE_LIFE', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', S.x + 2, S.z - 20)
    z.alive = false
    z.hp = 0
    run(w, CORPSE_LIFE + 0.1, input())
    expect(w.zombies).toHaveLength(0)
  })

  it('despawns zombies left far behind along the route, keeping ones ahead around a corner', () => {
    const w = quiet()
    place(w.player, pointAtDistance(CITY.route, 100).point)
    const behind = w.spawnZombie('walker', S.x, S.z - 5)
    const ahead = w.spawnZombie('walker', CITY.route[3].x, CITY.route[3].z)
    w.step(DT, input())
    expect(w.zombies).not.toContain(behind)
    expect(w.zombies).toContain(ahead)
  })

  it('starts with a rifle and can switch to the backup pistol', () => {
    const w = quiet()
    expect(w.player.weapon.def.id).toBe('rifle')
    w.step(DT, input({ switchTo: 1 }))
    expect(w.player.weapon.def.id).toBe('pistol')
  })

  it('switches to the debug shotgun when owned', () => {
    const w = quiet(true)
    w.step(DT, input({ switchTo: 2 }))
    expect(w.player.weapon.def.id).toBe('shotgun')
  })

  it('freezes after the game ends', () => {
    const w = quiet()
    w.status = 'lost'
    w.step(DT, input({ moveZ: -1 }))
    expect(w.player.z).toBe(S.z)
  })
})

describe('World bots', () => {
  it('start beside the player across the first street', () => {
    const w = withBots()
    expect(w.bots.map((b) => b.x)).toEqual(BOT_LANES.map((l) => S.x + l))
    for (const b of w.bots) expect(b.z).toBeGreaterThan(S.z)
  })

  it('a bot advances along the route and around the first corner', () => {
    const w = withBots()
    const bot = w.bots[0]
    run(w, 30, input())
    const p = routeProgress(CITY.route, bot.x, bot.z)
    expect(p.distance).toBeGreaterThan(90)
    expect(p.segment).toBeGreaterThanOrEqual(1)
    expect(Math.hypot(bot.x - p.point.x, bot.z - p.point.z)).toBeLessThan(3.5)
  })

  it('a bot stops advancing when a zombie is within 10m', () => {
    const w = withBots()
    const bot = w.bots[0]
    w.spawnZombie('walker', bot.x, bot.z - 5)
    const z0 = bot.z
    w.step(DT, input())
    expect(bot.z).toBe(z0)
  })

  it('a bot walks from the gate into the board zone and holds there', () => {
    const w = withBots()
    const bot = w.bots[2]
    place(bot, CITY.airport.gate)
    run(w, 25, input())
    const d = Math.hypot(bot.x - BOARD_ZONE.x, bot.z - BOARD_ZONE.z)
    expect(d).toBeLessThanOrEqual(BOARD_ZONE.r - 1 + 0.1)
    const held = { x: bot.x, z: bot.z }
    run(w, 1, input())
    expect(bot.x).toBeCloseTo(held.x, 5)
    expect(bot.z).toBeCloseTo(held.z, 5)
  })

  it('a bot kills a zombie in range and increments world.kills', () => {
    const w = withBots()
    const bot = w.bots[0]
    const z = w.spawnZombie('walker', bot.x, bot.z - 5)
    run(w, 1, input())
    expect(z.alive).toBe(false)
    expect(w.kills).toBe(1)
  })

  it('a zombie attacks a nearby bot', () => {
    const w = withBots()
    const bot = w.bots[0]
    w.spawnZombie('walker', bot.x, bot.z - 0.9)
    w.step(DT, input())
    expect(bot.hp).toBe(90)
  })

  it('a downed player cannot move or fire', () => {
    const w = quiet()
    w.player.alive = false
    w.player.hp = 0
    run(w, 1, input({ moveZ: -1, fire: true }))
    expect(w.player.x).toBe(S.x)
    expect(w.player.z).toBe(S.z)
    expect(w.tracers).toHaveLength(0)
  })

  it('the team only loses once the player and all bots are downed', () => {
    const w = withBots()
    w.player.alive = false
    w.bots[0].alive = false
    w.bots[1].alive = false
    w.step(DT, input())
    expect(w.status).toBe('playing')
    w.bots[2].alive = false
    w.step(DT, input())
    expect(w.status).toBe('lost')
  })

  it('revives a downed bot after 3s nearby, and resets progress if the reviver walks away', () => {
    const w = withBots()
    const bot = w.bots[0]
    bot.alive = false
    bot.hp = 0
    w.bots[1].alive = false
    w.bots[2].alive = false
    place(w.player, bot)

    run(w, 1, input())
    expect(bot.reviveProgress).toBeCloseTo(1, 1)

    w.player.z = bot.z - 10
    w.step(DT, input())
    expect(bot.reviveProgress).toBe(0)
    expect(bot.alive).toBe(false)

    place(w.player, bot)
    run(w, 3.1, input())
    expect(bot.alive).toBe(true)
    expect(bot.hp).toBe(REVIVE_HP)
  })
})

describe('World boss', () => {
  const bosses = (w: World) => w.zombies.filter((z) => z.kind === 'boss').length

  it('spawns the boss once at the runway center when 60m of route remain, and it chases at once', () => {
    const w = quiet()
    place(w.player, pointAtDistance(CITY.route, TOTAL - BOSS_TRIGGER - 1).point)
    w.step(DT, input())
    expect(w.bossSpawned).toBe(false)
    expect(w.boss).toBeNull()
    place(w.player, pointAtDistance(CITY.route, TOTAL - BOSS_TRIGGER + 0.5).point)
    w.step(DT, input())
    expect(w.bossSpawned).toBe(true)
    expect(w.objective).toBe('kill-boss')
    const boss = w.boss!
    expect(boss.kind).toBe('boss')
    expect(boss.state).toBe('chase')
    expect(Math.hypot(boss.x - CITY.airport.runway.x, boss.z - CITY.airport.runway.z)).toBeLessThan(0.2)
    boss.alive = false
    boss.hp = 0
    expect(w.objective).toBe('board')
    place(w.player, pointAtDistance(CITY.route, TOTAL - 100).point)
    w.step(DT, input())
    place(w.player, pointAtDistance(CITY.route, TOTAL - 20).point)
    run(w, 1, input())
    expect(bosses(w)).toBe(1)
    expect(w.boss).toBe(boss)
  })

  it('reduces knockback and damage taken by the boss', () => {
    const w = quiet()
    const boss = w.spawnZombie('boss', S.x, S.z - 15)
    w.step(DT, input({ fire: true }))
    expect(boss.hp).toBeCloseTo(1500 - 20 * BOSS_DAMAGE_TAKEN, 6)
    expect(boss.z).toBeCloseTo(S.z - 15 - 0.2 * 0.1 + 2.2 * DT, 4)
  })

  it('hits a teammate for 30', () => {
    const w = quiet()
    w.spawnZombie('boss', w.player.x, w.player.z - 2.8)
    w.step(DT, input())
    expect(w.player.hp).toBe(70)
  })

  it('keeps the boss corpse past CORPSE_LIFE and never despawns it behind', () => {
    const w = quiet()
    place(w.player, pointAtDistance(CITY.route, 150).point)
    const behind = w.spawnZombie('boss', S.x, S.z - 5)
    const dead = w.spawnZombie('boss', S.x, S.z - 60)
    dead.alive = false
    dead.hp = 0
    run(w, CORPSE_LIFE + 1, input())
    expect(w.zombies).toContain(behind)
    expect(w.zombies).toContain(dead)
  })

  it('crowd separation pushes a regular zombie off the boss', () => {
    const w = quiet()
    const walker = w.spawnZombie('walker', 0.5, -150)
    const boss = w.spawnZombie('boss', 0, -150)
    w.step(DT, input())
    expect(Math.hypot(boss.x, boss.z + 150)).toBeLessThan(0.15)
    expect(Math.hypot(walker.x - 0.5, walker.z + 150)).toBeGreaterThan(0.7)
  })
})

describe('World boarding and escape', () => {
  function bossDown(w: World) {
    place(w.player, pointAtDistance(CITY.route, TOTAL - 10).point)
    w.step(DT, input())
    w.boss!.alive = false
    w.boss!.hp = 0
  }

  function inZone(t: { x: number; z: number }) {
    return Math.hypot(t.x - BOARD_ZONE.x, t.z - BOARD_ZONE.z) <= BOARD_ZONE.r
  }

  it('does not board while the boss is alive', () => {
    const w = quiet()
    place(w.player, pointAtDistance(CITY.route, TOTAL - 10).point)
    w.step(DT, input())
    place(w.player, BOARD_ZONE)
    w.step(DT, input())
    expect(w.status).toBe('playing')
  })

  it('boards, waits for every alive bot, escapes for ESCAPE_DURATION, then wins', () => {
    const w = withBots()
    bossDown(w)
    place(w.player, BOARD_ZONE)
    w.step(DT, input())
    expect(w.status).toBe('boarding')
    expect(w.objective).toBe('board')
    run(w, 0.5, input({ moveX: 1 }))
    expect(w.status).toBe('boarding')
    expect(w.player.x).toBeGreaterThan(BOARD_ZONE.x + 2)
    place(w.player, BOARD_ZONE)
    w.bots[0].x = BOARD_ZONE.x - 2
    w.bots[0].z = BOARD_ZONE.z
    w.bots[1].x = BOARD_ZONE.x + 2
    w.bots[1].z = BOARD_ZONE.z
    w.bots[2].x = BOARD_ZONE.x
    w.bots[2].z = BOARD_ZONE.z + 2
    w.step(DT, input())
    expect(w.status).toBe('escaping')
    expect(w.objective).toBe('escape')
    expect(w.escaped).toBe(4)
    const frozen = { x: w.player.x, z: w.player.z, time: w.time }
    run(w, ESCAPE_DURATION - 0.1, input({ moveZ: 1 }))
    expect(w.status).toBe('escaping')
    expect(w.player.x).toBe(frozen.x)
    expect(w.player.z).toBe(frozen.z)
    expect(w.time).toBe(frozen.time)
    run(w, 0.2, input())
    expect(w.status).toBe('won')
    expect(w.escapeTime).toBeGreaterThanOrEqual(ESCAPE_DURATION)
  })

  it('leaves a downed bot and a straggler behind after the boarding timeout', () => {
    const w = withBots()
    bossDown(w)
    const downed = w.bots[0]
    downed.alive = false
    downed.hp = 0
    place(downed, S)
    place(w.bots[1], { x: S.x, z: S.z - 60 })
    place(w.bots[2], { x: BOARD_ZONE.x, z: BOARD_ZONE.z })
    place(w.player, { x: BOARD_ZONE.x + 2, z: BOARD_ZONE.z })
    w.step(DT, input())
    expect(w.status).toBe('boarding')
    run(w, BOARDING_TIMEOUT - 0.5, input())
    expect(w.status).toBe('boarding')
    run(w, 1, input())
    expect(w.status).toBe('escaping')
    expect(inZone(w.bots[1])).toBe(false)
    expect(w.escaped).toBe(2)
  })

  it('escapes at once when the only other survivors are downed', () => {
    const w = withBots()
    bossDown(w)
    for (const b of w.bots) {
      b.alive = false
      b.hp = 0
      place(b, S)
    }
    place(w.player, BOARD_ZONE)
    w.step(DT, input())
    expect(w.status).toBe('boarding')
    w.step(DT, input())
    expect(w.status).toBe('escaping')
    expect(w.escaped).toBe(1)
  })

  it('can still lose while boarding', () => {
    const w = withBots()
    bossDown(w)
    place(w.player, BOARD_ZONE)
    w.step(DT, input())
    expect(w.status).toBe('boarding')
    w.player.alive = false
    for (const b of w.bots) b.alive = false
    w.step(DT, input())
    expect(w.status).toBe('lost')
  })
})
