import { describe, it, expect } from 'vitest'
import { clampToRadius, fitScale, headingAngle, headingUp, headingUpRotation, northUpHeading } from './mapMath'
import { relativeMove, START_YAW } from '../game/Input'

describe('headingUp', () => {
  it('at the start yaw puts -Z up and +X right', () => {
    const up = headingUp(0, -10, START_YAW)
    expect(up.x).toBeCloseTo(0)
    expect(up.y).toBeCloseTo(-10)
    const right = headingUp(10, 0, START_YAW)
    expect(right.x).toBeCloseTo(10)
    expect(right.y).toBeCloseTo(0)
  })

  it('maps the walk-forward and strafe-right directions to screen up and right for any yaw', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, 2.5, -1.3]) {
      const f = relativeMove(yaw, 0, 1)
      const r = relativeMove(yaw, 1, 0)
      const fp = headingUp(f.x, f.z, yaw)
      const rp = headingUp(r.x, r.z, yaw)
      expect(fp.x).toBeCloseTo(0)
      expect(fp.y).toBeCloseTo(-1)
      expect(rp.x).toBeCloseTo(1)
      expect(rp.y).toBeCloseTo(0)
    }
  })

  it('matches a canvas rotate(headingUpRotation) of the north-up layout', () => {
    for (const yaw of [0, 1, 2, 3, -2]) {
      const t = headingUpRotation(yaw)
      const dx = 3
      const dz = -7
      const p = headingUp(dx, dz, yaw)
      expect(Math.cos(t) * dx - Math.sin(t) * dz).toBeCloseTo(p.x)
      expect(Math.sin(t) * dx + Math.cos(t) * dz).toBeCloseTo(p.y)
    }
  })
})

describe('headingAngle', () => {
  it('is 0 straight ahead, +π/2 to the right, -π/2 to the left', () => {
    expect(headingAngle(0, -5, START_YAW)).toBeCloseTo(0)
    expect(headingAngle(5, 0, START_YAW)).toBeCloseTo(Math.PI / 2)
    expect(headingAngle(-5, 0, START_YAW)).toBeCloseTo(-Math.PI / 2)
    expect(Math.abs(headingAngle(0, 5, START_YAW))).toBeCloseTo(Math.PI)
  })
})

describe('northUpHeading', () => {
  it('points up when walking toward -Z and right when walking toward +X', () => {
    expect(northUpHeading(START_YAW)).toBeCloseTo(0)
    expect(northUpHeading(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(northUpHeading(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
  })
})

describe('clampToRadius', () => {
  it('keeps points inside and pulls outside points onto the edge', () => {
    expect(clampToRadius({ x: 3, y: 4 }, 10)).toEqual({ point: { x: 3, y: 4 }, clamped: false })
    const out = clampToRadius({ x: 30, y: 40 }, 10)
    expect(out.clamped).toBe(true)
    expect(out.point.x).toBeCloseTo(6)
    expect(out.point.y).toBeCloseTo(8)
  })
})

describe('fitScale', () => {
  it('fits the limiting axis', () => {
    expect(fitScale({ minX: 0, minZ: 0, width: 200, depth: 400 }, 1000, 800)).toBe(2)
    expect(fitScale({ minX: 0, minZ: 0, width: 200, depth: 100 }, 1000, 800)).toBe(5)
  })
})
