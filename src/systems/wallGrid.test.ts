import { describe, it, expect } from 'vitest'
import { WallGrid } from './wallGrid'
import type { Box } from './collision'

const long: Box = { x: 0, z: -200, hw: 1, hd: 200 }
const small: Box = { x: 30, z: -30, hw: 2, hd: 2 }
const far: Box = { x: 200, z: -300, hw: 3, hd: 3 }

describe('WallGrid', () => {
  const grid = new WallGrid([long, small, far], 16)

  it('finds a long box from any cell it spans, once', () => {
    const out: Box[] = []
    expect(grid.query(2, -350, 3, out)).toEqual([long])
    expect(grid.query(2, -10, 40, out)).toEqual([long, small])
  })

  it('skips boxes outside the query rect', () => {
    const out: Box[] = []
    expect(grid.query(100, -100, 5, out)).toEqual([])
    expect(grid.query(26, -30, 1.5, out)).toEqual([])
    expect(grid.query(26, -30, 2.5, out)).toEqual([small])
  })

  it('queries the rect around a segment', () => {
    const out: Box[] = []
    expect(grid.querySegment(10, -30, 30, -30, 1, out)).toEqual([small])
    expect(grid.querySegment(10, -30, -10, -30, 1, out)).toEqual([long])
  })
})
