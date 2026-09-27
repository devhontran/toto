import { describe, it, expect } from 'vitest'
import { World, CORPSE_LIFE, type FrameInput } from './World'

const DT = 1 / 60

function input(over: Partial<FrameInput> = {}): FrameInput {
  return { moveX: 0, moveZ: 0, aimX: 0, aimZ: -100, fire: false, reload: false, switchTo: null, ...over }
}

function run(world: World, seconds: number, inp: FrameInput) {
  const n = Math.round(seconds / DT)
  for (let i = 0; i < n; i++) world.step(DT, inp)
}

function quiet(allWeapons = false) {
  return new World({ rng: () => 0.5, spawning: false, allWeapons })
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
