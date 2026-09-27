import { describe, it, expect } from 'vitest'
import { objectiveInfo } from './objective'
import type { RouteProgress } from '../level/route'

const progress: RouteProgress = { distance: 100.4, total: 520.2, segment: 1, next: { x: 44, z: -88 }, point: { x: 70, z: -88 } }
const zone = { x: -30, z: -366, r: 5 }

describe('objectiveInfo', () => {
  it('reach-airport shows remaining route distance and targets the next waypoint', () => {
    const info = objectiveInfo('reach-airport', progress, { x: 70, z: -88 }, zone)
    expect(info.text).toBe('Đến sân bay · 420m')
    expect(info.target).toEqual({ x: 44, z: -88 })
  })

  it('kill-boss has no distance', () => {
    expect(objectiveInfo('kill-boss', progress, { x: 0, z: 0 }, zone).text).toBe('Hạ zombie khổng lồ!')
  })

  it('board targets the board zone and measures to its edge', () => {
    const info = objectiveInfo('board', progress, { x: -30, z: -346 }, zone)
    expect(info.text).toBe('Lên máy bay! · 15m')
    expect(info.target).toBe(zone)
    expect(objectiveInfo('board', progress, { x: -30, z: -366 }, zone).text).toBe('Lên máy bay! · 0m')
  })

  it('escape has no arrow', () => {
    const info = objectiveInfo('escape', progress, { x: 0, z: 0 }, zone)
    expect(info.text).toBe('Cất cánh!')
    expect(info.target).toBeNull()
  })
})
