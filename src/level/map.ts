import type { Box } from '../systems/collision'

export const MAP_HALF_WIDTH = 20
export const MAP_LENGTH = 300
export const PLAYER_START = { x: 0, z: -5 }
export const EXIT_ZONE = { x: 0, z: -290, r: 6 }
export const HOUSE_HEIGHT = 4

export const HOUSES: Box[] = [
  { x: -13, z: -40, hw: 5, hd: 6 },
  { x: 13, z: -85, hw: 5, hd: 6 },
  { x: -13, z: -130, hw: 5, hd: 6 },
  { x: 13, z: -175, hw: 5, hd: 6 },
  { x: -13, z: -215, hw: 5, hd: 6 },
  { x: 13, z: -250, hw: 5, hd: 6 },
]

export function boundaryWalls(): Box[] {
  const t = 1
  const half = MAP_LENGTH / 2
  return [
    { x: -MAP_HALF_WIDTH - t, z: -half, hw: t, hd: half + 2 },
    { x: MAP_HALF_WIDTH + t, z: -half, hw: t, hd: half + 2 },
    { x: 0, z: t, hw: MAP_HALF_WIDTH + 2, hd: t },
    { x: 0, z: -MAP_LENGTH - t, hw: MAP_HALF_WIDTH + 2, hd: t },
  ]
}
