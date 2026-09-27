import { describe, it, expect } from 'vitest'
import {
  resolveCircleCircle,
  resolveCircleBox,
  overlapsCircleBox,
  rayCircle,
  rayBox,
} from './collision'

describe('resolveCircleCircle', () => {
  it('separates overlapping circles evenly', () => {
    const a = { x: 0, z: 0, r: 0.5 }
    const b = { x: 0.6, z: 0, r: 0.5 }
    expect(resolveCircleCircle(a, b)).toBe(true)
    expect(b.x - a.x).toBeCloseTo(1)
    expect(a.x).toBeCloseTo(-0.2)
  })

  it('leaves separated circles alone', () => {
    const a = { x: 0, z: 0, r: 0.5 }
    const b = { x: 2, z: 0, r: 0.5 }
    expect(resolveCircleCircle(a, b)).toBe(false)
    expect(a.x).toBe(0)
    expect(b.x).toBe(2)
  })

  it('moves only b when aShare is 0', () => {
    const a = { x: 0, z: 0, r: 0.5 }
    const b = { x: 0.6, z: 0, r: 0.5 }
    resolveCircleCircle(a, b, 0)
    expect(a.x).toBe(0)
    expect(b.x).toBeCloseTo(1)
  })

  it('separates coincident circles without NaN', () => {
    const a = { x: 1, z: 1, r: 0.5 }
    const b = { x: 1, z: 1, r: 0.5 }
    resolveCircleCircle(a, b)
    for (const v of [a.x, a.z, b.x, b.z]) expect(Number.isFinite(v)).toBe(true)
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1)
  })
})

describe('resolveCircleBox', () => {
  const box = { x: 0, z: 0, hw: 1, hd: 1 }

  it('pushes a circle out through the nearest edge', () => {
    const c = { x: 1.2, z: 0, r: 0.5 }
    expect(resolveCircleBox(c, box)).toBe(true)
    expect(c.x).toBeCloseTo(1.5)
    expect(c.z).toBeCloseTo(0)
  })

  it('pushes out a circle whose center is inside the box', () => {
    const c = { x: 0.8, z: 0, r: 0.5 }
    expect(resolveCircleBox(c, box)).toBe(true)
    expect(c.x).toBeCloseTo(1.5)
  })

  it('pushes a circle off a corner to exactly its radius', () => {
    const c = { x: 1.3, z: 1.3, r: 0.5 }
    resolveCircleBox(c, box)
    expect(Math.hypot(c.x - 1, c.z - 1)).toBeCloseTo(0.5)
  })

  it('leaves an outside circle alone', () => {
    const c = { x: 3, z: 0, r: 0.5 }
    expect(resolveCircleBox(c, box)).toBe(false)
    expect(c.x).toBe(3)
  })
})

describe('overlapsCircleBox', () => {
  const box = { x: 0, z: 0, hw: 1, hd: 1 }
  it('detects overlap without mutating', () => {
    const c = { x: 1.2, z: 0, r: 0.5 }
    expect(overlapsCircleBox(c, box)).toBe(true)
    expect(c.x).toBe(1.2)
  })
  it('reports no overlap when apart', () => {
    expect(overlapsCircleBox({ x: 3, z: 0, r: 0.5 }, box)).toBe(false)
  })
})

describe('rayCircle', () => {
  it('returns distance to the near surface', () => {
    expect(rayCircle(0, 0, 0, -1, { x: 0, z: -5, r: 0.5 })).toBeCloseTo(4.5)
  })
  it('misses a circle off to the side', () => {
    expect(rayCircle(0, 0, 0, -1, { x: 3, z: -5, r: 0.5 })).toBeNull()
  })
  it('ignores a circle behind the origin', () => {
    expect(rayCircle(0, 0, 0, -1, { x: 0, z: 5, r: 0.5 })).toBeNull()
  })
  it('returns 0 when the origin is inside', () => {
    expect(rayCircle(0, 0, 1, 0, { x: 0.1, z: 0, r: 0.5 })).toBe(0)
  })
})

describe('rayBox', () => {
  const box = { x: 5, z: 0, hw: 1, hd: 1 }
  it('returns distance to the near face', () => {
    expect(rayBox(0, 0, 1, 0, box)).toBeCloseTo(4)
  })
  it('misses a box off to the side', () => {
    expect(rayBox(0, 0, 1, 0, { x: 5, z: 3, hw: 1, hd: 1 })).toBeNull()
  })
  it('misses when parallel and outside the slab', () => {
    expect(rayBox(0, 0, 0, -1, box)).toBeNull()
  })
  it('ignores a box behind the origin', () => {
    expect(rayBox(0, 0, -1, 0, box)).toBeNull()
  })
})
