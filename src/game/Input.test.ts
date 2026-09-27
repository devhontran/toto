import { describe, it, expect } from 'vitest'
import { InputState, PITCH_MAX, PITCH_MIN, relativeMove } from './Input'

describe('InputState', () => {
  it('maps WASD to move axes at the start yaw (W = toward -Z, D = +X)', () => {
    const s = new InputState()
    s.handleKey('KeyW', true)
    s.handleKey('KeyD', true)
    const f = s.consume(0, 0)
    expect(f.moveZ).toBeCloseTo(-1)
    expect(f.moveX).toBeCloseTo(1)
  })

  it('look turns right on positive dx and clamps pitch', () => {
    const s = new InputState()
    const yaw = s.yaw
    s.look(100, 0)
    expect(s.yaw).toBeLessThan(yaw)
    s.look(0, -10000)
    expect(s.pitch).toBe(PITCH_MAX)
    s.look(0, 10000)
    expect(s.pitch).toBe(PITCH_MIN)
  })

  it('cancels opposite keys', () => {
    const s = new InputState()
    s.handleKey('KeyA', true)
    s.handleKey('KeyD', true)
    expect(s.strafe).toBe(0)
  })

  it('queues reload and weapon switch once per press', () => {
    const s = new InputState()
    s.handleKey('KeyR', true)
    s.handleKey('Digit2', true)
    const first = s.consume(0, 0)
    expect(first.reload).toBe(true)
    expect(first.switchTo).toBe(1)
    const second = s.consume(0, 0)
    expect(second.reload).toBe(false)
    expect(second.switchTo).toBeNull()
  })

  it('reset clears held keys and fire so nothing sticks after focus loss', () => {
    const s = new InputState()
    s.handleKey('KeyW', true)
    s.fireHeld = true
    s.reset()
    const f = s.consume(0, 0)
    expect(f.moveZ).toBeCloseTo(0)
    expect(f.fire).toBe(false)
  })

  it('passes the aim point through', () => {
    const f = new InputState().consume(3, -7)
    expect(f.aimX).toBe(3)
    expect(f.aimZ).toBe(-7)
  })
})

describe('relativeMove', () => {
  it('W at yaw π moves toward -Z', () => {
    const m = relativeMove(Math.PI, 0, 1)
    expect(m.x).toBeCloseTo(0)
    expect(m.z).toBeCloseTo(-1)
  })

  it('D at yaw π strafes to screen-right (+X, Three.js right of a -Z view)', () => {
    const m = relativeMove(Math.PI, 1, 0)
    expect(m.x).toBeCloseTo(1)
    expect(m.z).toBeCloseTo(0)
  })

  it('A at yaw π strafes to screen-left (-X)', () => {
    const m = relativeMove(Math.PI, -1, 0)
    expect(m.x).toBeCloseTo(-1)
  })

  it('W at yaw 0 moves toward +Z and D strafes to -X', () => {
    expect(relativeMove(0, 0, 1).z).toBeCloseTo(1)
    expect(relativeMove(0, 1, 0).x).toBeCloseTo(-1)
  })

  it('W at yaw π/2 moves toward +X and D strafes toward +Z', () => {
    const w = relativeMove(Math.PI / 2, 0, 1)
    expect(w.x).toBeCloseTo(1)
    expect(w.z).toBeCloseTo(0)
    const d = relativeMove(Math.PI / 2, 1, 0)
    expect(d.x).toBeCloseTo(0)
    expect(d.z).toBeCloseTo(1)
  })

  it('S moves opposite to W', () => {
    const m = relativeMove(Math.PI, 0, -1)
    expect(m.z).toBeCloseTo(1)
  })
})
