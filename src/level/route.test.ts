import { describe, it, expect } from 'vitest'
import { pointAtDistance, routeLength, routeProgress } from './route'

const route = [
  { x: 0, z: 0 },
  { x: 0, z: -10 },
  { x: 20, z: -10 },
]

describe('routeLength', () => {
  it('sums segment lengths', () => {
    expect(routeLength(route)).toBe(30)
  })
})

describe('routeProgress', () => {
  it('projects onto the first segment', () => {
    const p = routeProgress(route, 2, -4)
    expect(p.distance).toBeCloseTo(4)
    expect(p.total).toBe(30)
    expect(p.segment).toBe(0)
    expect(p.next).toEqual({ x: 0, z: -10 })
    expect(p.point).toEqual({ x: 0, z: -4 })
  })

  it('projects onto a later segment', () => {
    const p = routeProgress(route, 7, -12)
    expect(p.distance).toBeCloseTo(17)
    expect(p.segment).toBe(1)
    expect(p.next).toEqual({ x: 20, z: -10 })
  })

  it('clamps before the start and past the end', () => {
    expect(routeProgress(route, 0, 5).distance).toBe(0)
    expect(routeProgress(route, 40, -10).distance).toBe(30)
  })
})

describe('pointAtDistance', () => {
  it('walks along segments with their direction', () => {
    expect(pointAtDistance(route, 4)).toEqual({ point: { x: 0, z: -4 }, dir: { x: 0, z: -1 } })
    expect(pointAtDistance(route, 15)).toEqual({ point: { x: 5, z: -10 }, dir: { x: 1, z: 0 } })
  })

  it('clamps to the ends', () => {
    expect(pointAtDistance(route, -5).point).toEqual({ x: 0, z: 0 })
    expect(pointAtDistance(route, 99)).toEqual({ point: { x: 20, z: -10 }, dir: { x: 1, z: 0 } })
  })

  it('round-trips with routeProgress', () => {
    const { point } = pointAtDistance(route, 22.5)
    expect(routeProgress(route, point.x, point.z).distance).toBeCloseTo(22.5)
  })
})
