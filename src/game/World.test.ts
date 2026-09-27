import { describe, it, expect } from 'vitest'
import { World, CORPSE_LIFE, type FrameInput } from './World'
import { BOT_SLOTS, REVIVE_HP } from '../entities/Bot'

const DT = 1 / 60

function input(over: Partial<FrameInput> = {}): FrameInput {
  return { moveX: 0, moveZ: 0, aimX: 0, aimZ: -100, fire: false, reload: false, switchTo: null, ...over }
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

describe('World', () => {
  it('moves the player forward with W', () => {
    const w = quiet()
    run(w, 1, input({ moveZ: -1 }))
    expect(w.player.z).toBeCloseTo(-10, 1)
  })

  it('stops the player at a house wall', () => {
    const w = quiet()
    w.player.x = 0
    w.player.z = -40
    run(w, 3, input({ moveX: -1 }))
    expect(w.player.x).toBeCloseTo(-7.6, 2)
  })

  it('kills a zombie in front with pistol fire and counts the kill', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', 0, -15)
    run(w, 1, input({ fire: true }))
    expect(z.alive).toBe(false)
    expect(w.kills).toBe(1)
  })

  it('stops shots at house walls', () => {
    const w = quiet()
    w.player.x = 0
    w.player.z = -40
    const z = w.spawnZombie('walker', -19.5, -40)
    w.step(DT, input({ fire: true, aimX: -30, aimZ: -40 }))
    expect(z.hp).toBe(60)
    expect(w.tracers[0].x1).toBeCloseTo(-8, 1)
  })

  it('takes zombie hits and loses at 0 hp', () => {
    const w = quiet()
    w.spawnZombie('walker', 0, -5.9)
    w.step(DT, input())
    expect(w.player.hp).toBe(90)
    run(w, 10.5, input())
    expect(w.player.hp).toBe(0)
    expect(w.status).toBe('lost')
  })

  it('wins on reaching the exit zone', () => {
    const w = quiet()
    w.player.z = -288
    w.step(DT, input())
    expect(w.status).toBe('won')
  })

  it('alerts zombies beyond sight with gunfire', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', 0, -28)
    w.step(DT, input({ fire: true, aimX: 100, aimZ: -5 }))
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
    const z = w.spawnZombie('walker', 5, -20)
    z.alive = false
    z.hp = 0
    run(w, CORPSE_LIFE + 0.1, input())
    expect(w.zombies).toHaveLength(0)
  })

  it('despawns zombies left far behind', () => {
    const w = quiet()
    w.spawnZombie('walker', 0, 36)
    w.step(DT, input())
    expect(w.zombies).toHaveLength(0)
  })

  it('switches weapons when owned', () => {
    const w = quiet(true)
    w.step(DT, input({ switchTo: 1 }))
    expect(w.player.weapon.def.id).toBe('shotgun')
  })

  it('freezes after the game ends', () => {
    const w = quiet()
    w.status = 'lost'
    w.step(DT, input({ moveZ: -1 }))
    expect(w.player.z).toBe(-5)
  })
})

describe('World bots', () => {
  it('a bot follows to its formation slot', () => {
    const w = withBots()
    w.player.z = -30
    run(w, 6, input())
    const slot = BOT_SLOTS[0]
    const bot = w.bots[0]
    const dist = Math.hypot(bot.x - (w.player.x + slot.x), bot.z - (w.player.z + slot.z))
    expect(dist).toBeLessThanOrEqual(1 + 1e-6)
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
    const x0 = w.player.x
    const z0 = w.player.z
    run(w, 1, input({ moveZ: -1, fire: true }))
    expect(w.player.x).toBe(x0)
    expect(w.player.z).toBe(z0)
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
    w.player.x = bot.x
    w.player.z = bot.z

    run(w, 1, input())
    expect(bot.reviveProgress).toBeCloseTo(1, 1)

    w.player.x = bot.x + 10
    w.step(DT, input())
    expect(bot.reviveProgress).toBe(0)
    expect(bot.alive).toBe(false)

    w.player.x = bot.x
    w.player.z = bot.z
    run(w, 3.1, input())
    expect(bot.alive).toBe(true)
    expect(bot.hp).toBe(REVIVE_HP)
  })
})
