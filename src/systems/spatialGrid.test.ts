import { describe, it, expect } from 'vitest'
import { SpatialGrid } from './spatialGrid'

type P = { x: number; z: number; id: number }

describe('SpatialGrid', () => {
  it('returns only items within radius, across cells and negative coords', () => {
    const g = new SpatialGrid<P>(4)
    const items: P[] = [
      { x: 0, z: 0, id: 1 },
      { x: 2.5, z: 0, id: 2 },
      { x: -3.9, z: -0.5, id: 3 },
      { x: 10, z: 10, id: 4 },
      { x: 0, z: -20, id: 5 },
    ]
    items.forEach((i) => g.insert(i))
    const out = g.query(0, 0, 4, [])
    expect(out.map((i) => i.id).sort()).toEqual([1, 2, 3])
  })

  it('clears the output array before filling', () => {
    const g = new SpatialGrid<P>(4)
    g.insert({ x: 0, z: 0, id: 1 })
    const out: P[] = [{ x: 99, z: 99, id: 99 }]
    g.query(0, 0, 1, out)
    expect(out.map((i) => i.id)).toEqual([1])
  })

  it('is empty after clear', () => {
    const g = new SpatialGrid<P>(4)
    g.insert({ x: 0, z: 0, id: 1 })
    g.clear()
    expect(g.query(0, 0, 10, [])).toEqual([])
  })
})
