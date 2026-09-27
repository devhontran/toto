import { describe, it, expect } from 'vitest'
import { decideBot, updateRevive } from './botBrain'
import { BOT_LANES, REVIVE_HP } from '../entities/Bot'
import { CITY } from '../level/city'
import { pointAtDistance, routeLength } from '../level/route'

const rng = () => 0.5
const S = CITY.start
const BOARD = CITY.airport.boardZone
const total = routeLength(CITY.route)

function zombie(x: number, z: number, alive = true) {
  return { x, z, r: 0.4, hp: 60, alive }
}

function mate(x: number, z: number, alive = true) {
  return { x, z, alive, hp: 100, reviveProgress: 0 }
}

describe('decideBot', () => {
  it('advances up the first street (toward -Z) when no zombies are near', () => {
    const decision = decideBot({ x: S.x, z: S.z, slot: 1 }, [mate(S.x, S.z)], [], [], rng)
    expect(decision.moveZ).toBeLessThan(0)
    expect(decision.speed).toBe(3.5)
  })

  it('steers toward its lateral lane off the route centerline', () => {
    const left = decideBot({ x: S.x, z: S.z, slot: 0 }, [mate(S.x, S.z)], [], [], rng)
    const right = decideBot({ x: S.x, z: S.z, slot: 2 }, [mate(S.x, S.z)], [], [], rng)
    expect(BOT_LANES).toEqual([-3, 0, 3])
    expect(left.moveX).toBeLessThan(0)
    expect(right.moveX).toBeGreaterThan(0)
  })

  it('turns with the route at a corner', () => {
    const corner = CITY.route[1]
    const decision = decideBot({ x: corner.x, z: corner.z, slot: 1 }, [], [], [], rng)
    const next = pointAtDistance(CITY.route, routeLength(CITY.route.slice(0, 2)) + 1).dir
    expect(decision.moveX * next.x + decision.moveZ * next.z).toBeGreaterThan(0.99)
  })

  it('stops advancing when a zombie is within 10m', () => {
    const decision = decideBot({ x: S.x, z: S.z, slot: 1 }, [mate(S.x, S.z)], [zombie(S.x, S.z - 5)], [], rng)
    expect(decision.moveX).toBe(0)
    expect(decision.moveZ).toBe(0)
    expect(decision.speed).toBe(0)
  })

  it('keeps advancing and still shoots a zombie between 10m and the 15m engage range', () => {
    const decision = decideBot({ x: S.x, z: S.z, slot: 1 }, [mate(S.x, S.z)], [zombie(S.x, S.z - 12)], [], rng)
    expect(decision.moveZ).toBeLessThan(0)
    expect(decision.target).not.toBeNull()
  })

  it('ignores a zombie beyond the 15m engage range', () => {
    const decision = decideBot({ x: 0, z: 0, slot: 1 }, [mate(0, 0)], [zombie(0, -16)], [], rng)
    expect(decision.target).toBeNull()
  })

  it('picks the nearest zombie in engage range with a clear line, skipping one behind a wall', () => {
    const wall = { x: 1.5, z: -3, hw: 1, hd: 1 }
    const blocked = zombie(3, -6)
    const visible = zombie(-5, -5)
    const decision = decideBot({ x: 0, z: 0, slot: 1 }, [mate(0, 0)], [blocked, visible], [wall], rng)
    expect(decision.target).toBe(visible)
  })

  it('heads from the airport gate to the board zone', () => {
    const gate = CITY.airport.gate
    const decision = decideBot({ x: gate.x, z: gate.z, slot: 1 }, [], [], [], rng)
    const to = { x: BOARD.x - gate.x, z: BOARD.z - gate.z }
    const len = Math.hypot(to.x, to.z)
    expect(decision.moveX).toBeCloseTo(to.x / len, 5)
    expect(decision.moveZ).toBeCloseTo(to.z / len, 5)
    expect(decision.speed).toBe(3.5)
  })

  it('switches to the board zone just before the gate', () => {
    const near = pointAtDistance(CITY.route, total - 1).point
    const decision = decideBot({ x: near.x, z: near.z, slot: 1 }, [], [], [], rng)
    expect(decision.moveX).toBeLessThan(0)
  })

  it('holds inside the board zone', () => {
    const decision = decideBot({ x: BOARD.x + 1, z: BOARD.z, slot: 1 }, [mate(0, 0)], [], [], rng)
    expect(decision.moveX).toBe(0)
    expect(decision.moveZ).toBe(0)
    expect(decision.speed).toBe(0)
  })

  it('prioritizes reviving a downed teammate within 20m over advancing', () => {
    const downed = mate(S.x + 5, S.z, false)
    const decision = decideBot({ x: S.x, z: S.z, slot: 1 }, [downed], [], [], rng)
    expect(decision.moveX).toBeCloseTo(1, 5)
    expect(decision.moveZ).toBeCloseTo(0, 5)
  })

  it('ignores a downed teammate beyond the 20m seek range and resumes advancing', () => {
    const downed = mate(S.x - 100, S.z, false)
    const decision = decideBot({ x: S.x, z: S.z, slot: 1 }, [downed, mate(S.x, S.z)], [], [], rng)
    expect(decision.moveZ).toBeLessThan(0)
  })
})

describe('updateRevive', () => {
  it('revives a downed teammate after 3s of continuous nearby help', () => {
    const downed = mate(0, 0, false)
    const helper = mate(1, 0, true)
    const team = [downed, helper]
    updateRevive(team, 1)
    updateRevive(team, 1)
    expect(downed.alive).toBe(false)
    updateRevive(team, 1)
    expect(downed.alive).toBe(true)
    expect(downed.hp).toBe(REVIVE_HP)
  })

  it('resets progress when the helper leaves range', () => {
    const downed = mate(0, 0, false)
    const helper = mate(1, 0, true)
    const team = [downed, helper]
    updateRevive(team, 2)
    expect(downed.reviveProgress).toBeGreaterThan(0)
    helper.x = 10
    updateRevive(team, 1)
    expect(downed.reviveProgress).toBe(0)
    expect(downed.alive).toBe(false)
  })
})
