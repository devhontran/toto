import type { Box } from '../systems/collision'
import { CITY } from './city'

export const MAP_HALF_WIDTH = CITY.bounds.hw
export const MAP_LENGTH = CITY.bounds.hd * 2
export const PLAYER_START = CITY.start
export const BOARD_ZONE = CITY.airport.boardZone
export const EXIT_ZONE = BOARD_ZONE
export const HOUSE_HEIGHT = 4

export const HOUSES: Box[] = CITY.buildings.map((b) => b.box)

export function boundaryWalls(): Box[] {
  const t = 1
  const b = CITY.bounds
  return [
    { x: b.x - b.hw - t, z: b.z, hw: t, hd: b.hd + 2 },
    { x: b.x + b.hw + t, z: b.z, hw: t, hd: b.hd + 2 },
    { x: b.x, z: b.z + b.hd + t, hw: b.hw + 2, hd: t },
    { x: b.x, z: b.z - b.hd - t, hw: b.hw + 2, hd: t },
  ]
}

export const WALLS: readonly Box[] = [
  ...HOUSES,
  ...CITY.props,
  CITY.airport.tower,
  ...CITY.airport.fences,
  ...boundaryWalls(),
]
