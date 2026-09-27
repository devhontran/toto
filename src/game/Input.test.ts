import { describe, it, expect } from 'vitest'
import { InputState } from './Input'

describe('InputState', () => {
  it('maps WASD to move axes (W = toward -Z)', () => {
    const s = new InputState()
    s.handleKey('KeyW', true)
    s.handleKey('KeyD', true)
    expect(s.moveZ).toBe(-1)
    expect(s.moveX).toBe(1)
  })

  it('cancels opposite keys', () => {
    const s = new InputState()
    s.handleKey('KeyA', true)
    s.handleKey('KeyD', true)
    expect(s.moveX).toBe(0)
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
    expect(f.moveZ).toBe(0)
    expect(f.fire).toBe(false)
  })

  it('passes the aim point through', () => {
    const f = new InputState().consume(3, -7)
    expect(f.aimX).toBe(3)
    expect(f.aimZ).toBe(-7)
  })
})
