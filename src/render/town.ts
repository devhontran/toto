import type { Box } from '../systems/collision'
import { lcg, type BlockType, type VoxelBatcher } from './voxel'

export const FLOOR_HEIGHT = 4
const TORCH_Y = 2.6
const TORCH_OFFSET = 0.5625

export type Facing = '+x' | '-x' | '+z' | '-z'
export type HouseStyleId = 'oak'

interface HouseStyle {
  foundation: BlockType
  floor: BlockType
  wall: BlockType
  pillar: BlockType
  gable: BlockType
  roof: BlockType
  roofCap: BlockType
}

const STYLES: Record<HouseStyleId, HouseStyle> = {
  oak: {
    foundation: 'cobble',
    floor: 'planks',
    wall: 'planks',
    pillar: 'log',
    gable: 'planks',
    roof: 'stairs',
    roofCap: 'darkPlanks',
  },
}

export interface HouseSpec {
  box: Box
  facing: Facing
  floors?: number
  style?: HouseStyleId
  path?: number
  seed?: number
}

function windowAt(t: number, len: number): boolean {
  if (len >= 12) return t === 2 || t === 3 || t === len - 4 || t === len - 3
  if (len >= 6) return t === len / 2 - 1 || t === len / 2
  return false
}

function gableRoof(v: VoxelBatcher, style: HouseStyle, h: Box, base: number): void {
  const alongZ = h.hd >= h.hw
  const a0 = alongZ ? h.x - h.hw : h.z - h.hd
  const a1 = alongZ ? h.x + h.hw : h.z + h.hd
  const b0 = alongZ ? h.z - h.hd : h.x - h.hw
  const b1 = alongZ ? h.z + h.hd : h.x + h.hw
  const put = (type: BlockType, a: number, y: number, b: number, ry = 0) =>
    alongZ ? v.addBlock(type, a, y, b, { y: ry }) : v.addBlock(type, b, y, a, { y: ry })
  const upA = alongZ ? -Math.PI / 2 : Math.PI
  const downA = alongZ ? Math.PI / 2 : 0
  const levels = Math.ceil((a1 - a0 + 2) / 2)
  for (let k = 0; k < levels; k++) {
    const y = base + k
    const left = a0 - 1 + k
    const right = a1 - k
    for (let b = b0 - 1; b <= b1; b++) {
      if (left === right) {
        put(style.roofCap, left, y, b)
        continue
      }
      put(style.roof, left, y, b, upA)
      put(style.roof, right, y, b, downA)
    }
    for (let a = left + 1; a < right; a++) {
      put(style.gable, a, y, b0)
      put(style.gable, a, y, b1 - 1)
    }
  }
}

export function buildHouse(v: VoxelBatcher, spec: HouseSpec): void {
  const h = spec.box
  const style = STYLES[spec.style ?? 'oak']
  const top = (spec.floors ?? 1) * FLOOR_HEIGHT
  const rng = lcg(spec.seed ?? 1)
  const x0 = h.x - h.hw
  const x1 = h.x + h.hw
  const z0 = h.z - h.hd
  const z1 = h.z + h.hd
  const frontRunsX = spec.facing === '+z' || spec.facing === '-z'
  const ox = spec.facing === '+x' ? 1 : spec.facing === '-x' ? -1 : 0
  const oz = spec.facing === '+z' ? 1 : spec.facing === '-z' ? -1 : 0
  const frontLine = ox > 0 ? x1 - 1 : ox < 0 ? x0 : oz > 0 ? z1 - 1 : z0
  const frontLen = frontRunsX ? x1 - x0 : z1 - z0
  const doorA = Math.floor(frontLen / 2) - 1
  const frontCell = (t: number) => (frontRunsX ? { x: x0 + t, z: frontLine } : { x: frontLine, z: z0 + t })

  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const edgeX = x === x0 || x === x1 - 1
      const edgeZ = z === z0 || z === z1 - 1
      if (!edgeX && !edgeZ) {
        v.addBlock(style.floor, x, 0, z)
        continue
      }
      v.addBlock(style.foundation, x, 0, z)
      const corner = edgeX && edgeZ
      const runsZ = edgeX && !edgeZ
      const t = runsZ ? z - z0 : x - x0
      const len = runsZ ? z1 - z0 : x1 - x0
      const isFront = !corner && (frontRunsX ? z === frontLine : x === frontLine)
      for (let y = 1; y <= top; y++) {
        const level = (y - 1) % FLOOR_HEIGHT
        if (corner) v.addBlock(style.pillar, x, y, z)
        else if (level === FLOOR_HEIGHT - 1) v.addBlock(style.pillar, x, y, z, runsZ ? { x: Math.PI / 2 } : { z: Math.PI / 2 })
        else if (isFront && y <= 2 && (t === doorA || t === doorA + 1)) continue
        else if (windowAt(t, len) && (level === 1 || level === 2)) v.addBlock('glass', x, y, z, { y: runsZ ? Math.PI / 2 : 0 })
        else v.addBlock(style.wall, x, y, z)
      }
    }
  }

  gableRoof(v, style, h, top + 1)

  for (const t of [doorA - 1, doorA + 2]) {
    const c = frontCell(t)
    v.addAt('torch', c.x + 0.5 + ox * TORCH_OFFSET, TORCH_Y, c.z + 0.5 + oz * TORCH_OFFSET)
  }
  for (let step = 1; step <= (spec.path ?? 0); step++) {
    for (const t of [doorA, doorA + 1]) {
      const c = frontCell(t)
      v.addBlock('path', c.x + ox * step, 0, c.z + oz * step)
    }
  }
  for (let t = 0; t < frontLen; t++) {
    if (!windowAt(t, frontLen)) continue
    const c = frontCell(t)
    v.addBlock('grass', c.x + ox, 0, c.z + oz)
    v.addBlock(rng() < 0.5 ? 'poppy' : 'dandelion', c.x + ox, 1, c.z + oz)
  }
}

export function oakTree(v: VoxelBatcher, x: number, z: number, height: number, rng: () => number): void {
  for (let y = 0; y < height; y++) v.addBlock('log', x, y, z)
  for (let y = height - 3; y <= height; y++) {
    const r = y < height - 1 ? 2 : 1
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (y < height && dx === 0 && dz === 0) continue
        const corner = Math.abs(dx) === r && Math.abs(dz) === r
        if (y === height && dx !== 0 && dz !== 0) continue
        if (corner && rng() < 0.5) continue
        v.addBlock('leaves', x + dx, y, z + dz)
      }
    }
  }
}
