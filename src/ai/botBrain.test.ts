import { describe, it, expect } from 'vitest'
import { decideBot, updateRevive } from './botBrain'
import { BOT_SLOTS, REVIVE_HP } from '../entities/Bot'

const rng = () => 0.5

function zombie(x: number, z: number, alive = true) {
  return { x, z, r: 0.4, hp: 60, alive }
}

function mate(x: number, z: number, alive = true) {
  return { x, z, alive, hp: 100, reviveProgress: 0 }
}

describe('decideBot', () => {
  it('moves toward its formation slot when farther than 1m away', () => {
    const slot = BOT_SLOTS[0]
    const targetX = slot.x
    const targetZ = -30 + slot.z
    const dist = Math.hypot(targetX, targetZ)
    const decision = decideBot({ x: 0, z: 0, slot: 0 }, 0, -30, [mate(0, -30)], [], [], rng)
    expect(decision.moveX).toBeCloseTo(targetX / dist, 5)
    expect(decision.moveZ).toBeCloseTo(targetZ / dist, 5)
  })

  it('stops once within 1m of its slot', () => {
    const slot = BOT_SLOTS[0]
    const decision = decideBot({ x: slot.x, z: slot.z, slot: 0 }, 0, 0, [mate(0, 0)], [], [], rng)
    expect(decision.moveX).toBe(0)
    expect(decision.moveZ).toBe(0)
  })

  it('picks the nearest zombie in engage range with a clear line, skipping one behind a wall', () => {
    const wall = { x: 1.5, z: -3, hw: 1, hd: 1 }
    const blocked = zombie(3, -6)
    const visible = zombie(-5, -5)
    const decision = decideBot(
      { x: 0, z: 0, slot: 0 },
      0,
      0,
      [mate(0, 0)],
      [blocked, visible],
      [wall],
      rng,
    )
    expect(decision.target).toBe(visible)
  })

  it('ignores a zombie beyond the 15m engage range', () => {
    const decision = decideBot({ x: 0, z: 0, slot: 0 }, 0, 0, [mate(0, 0)], [zombie(0, -16)], [], rng)
    expect(decision.target).toBeNull()
  })

  it('prioritizes reviving a downed teammate within 20m over its slot', () => {
    const downed = mate(5, 0, false)
    const decision = decideBot({ x: 0, z: 0, slot: 0 }, 0, -30, [downed], [], [], rng)
    expect(decision.moveX).toBeCloseTo(1, 5)
    expect(decision.moveZ).toBeCloseTo(0, 5)
  })

  it('ignores a downed teammate beyond the 20m seek range', () => {
    const slot = BOT_SLOTS[0]
    const downed = mate(100, 0, false)
    const decision = decideBot({ x: slot.x, z: slot.z, slot: 0 }, 0, 0, [downed, mate(0, 0)], [], [], rng)
    expect(decision.moveX).toBe(0)
    expect(decision.moveZ).toBe(0)
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
