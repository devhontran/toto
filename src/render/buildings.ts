import * as THREE from 'three'
import type { Building, Side } from '../level/city'
import { buildHouse, FLOOR_HEIGHT, type Facing } from './town'
import { lcg, type BlockType, type Extra, type VoxelBatcher } from './voxel'

const FACING: Record<Side, Facing> = { N: '-z', S: '+z', E: '+x', W: '-x' }
const OUT: Record<Side, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }
const HOUSE_PATH = 2
const DOOR_WIDTH = 2

const AWNING_COLORS = [0xc0392b, 0x2e8b57, 0x2f5fb3, 0xe07b24, 0xd4b12a, 0x7d3c98, 0x1f9aa0]
const SIGN_COLORS = [0x2c3e50, 0x8e2b20, 0x1d4f2e, 0x3b2a5a, 0xf0e6c8]
const CONCRETE_WALLS = [0xf1f1ee, 0xe6e2da, 0xd9dde0, 0xefe6d2]
const TRIM_COLORS = [0x8f959a, 0x6f767c, 0xb9b3a8]

interface Material {
  type: BlockType
  color?: number
}

interface Cell {
  side: Side
  t: number
  len: number
  corner: boolean
}

function pickOf<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

function tint(m: Material): Extra {
  return m.color === undefined ? {} : { color: m.color }
}

function frameFor(b: Building): { frame: THREE.Matrix4; nx: number; nz: number } {
  const w = b.box.hw * 2
  const d = b.box.hd * 2
  const nx = Math.max(2, Math.round(w))
  const nz = Math.max(2, Math.round(d))
  const frame = new THREE.Matrix4()
    .makeTranslation(b.box.x - b.box.hw, 0, b.box.z - b.box.hd)
    .multiply(new THREE.Matrix4().makeScale(w / nx, 1, d / nz))
  return { frame, nx, nz }
}

function cellOf(x: number, z: number, nx: number, nz: number): Cell | null {
  const sides: Side[] = []
  if (z === 0) sides.push('N')
  if (z === nz - 1) sides.push('S')
  if (x === 0) sides.push('W')
  if (x === nx - 1) sides.push('E')
  if (sides.length === 0) return null
  const side = sides[0]
  const alongX = side === 'N' || side === 'S'
  return { side, t: alongX ? x : z, len: alongX ? nx : nz, corner: sides.length > 1 }
}

function paneRot(side: Side): { y: number } {
  return { y: side === 'E' || side === 'W' ? Math.PI / 2 : 0 }
}

function doorSpan(len: number): [number, number] {
  const a = Math.floor(len / 2) - 1
  return [a, a + DOOR_WIDTH - 1]
}

function frontCell(side: Side, t: number, nx: number, nz: number, out = 0): { x: number; z: number } {
  const [ox, oz] = OUT[side]
  if (side === 'N' || side === 'S') return { x: t, z: (side === 'N' ? 0 : nz - 1) + oz * out }
  return { x: (side === 'W' ? 0 : nx - 1) + ox * out, z: t }
}

function flatRoof(v: VoxelBatcher, nx: number, nz: number, y: number, roof: Material, rng: () => number, vents: number): void {
  for (let x = 0; x < nx; x++) {
    for (let z = 0; z < nz; z++) {
      v.addBlock(roof.type, x, y, z, {}, tint(roof))
      if (cellOf(x, z, nx, nz)) v.addBlock('stoneSlab', x, y + 1, z)
    }
  }
  for (let i = 0; i < vents; i++) {
    const x = 2 + Math.floor(rng() * Math.max(1, nx - 5))
    const z = 2 + Math.floor(rng() * Math.max(1, nz - 5))
    v.addBlock('iron', x, y + 1, z)
    if (rng() < 0.5) v.addBlock('iron', x + 1, y + 1, z)
    v.addBlock('stoneSlab', x, y + 2, z)
  }
}

function buildShop(v: VoxelBatcher, b: Building, nx: number, nz: number, rng: () => number): void {
  const wall: Material = rng() < 0.5 ? { type: 'bricks' } : { type: 'stoneBricks' }
  const trim: Material = wall.type === 'bricks' ? { type: 'stoneBricks' } : { type: 'smoothStone' }
  const floor: Material = rng() < 0.5 ? { type: 'planks' } : { type: 'smoothStone' }
  const awning = pickOf(rng, AWNING_COLORS)
  const stripe = rng() < 0.6 ? 0xf4f4f4 : pickOf(rng, AWNING_COLORS)
  const top = b.floors * FLOOR_HEIGHT
  for (let x = 0; x < nx; x++) {
    for (let z = 0; z < nz; z++) {
      const cell = cellOf(x, z, nx, nz)
      if (!cell) {
        v.addBlock(floor.type, x, 0, z)
        continue
      }
      v.addBlock(trim.type, x, 0, z)
      const front = cell.side === b.door && !cell.corner
      const [d0, d1] = doorSpan(cell.len)
      for (let y = 1; y < top; y++) {
        const level = (y - 1) % FLOOR_HEIGHT
        const ground = y < FLOOR_HEIGHT
        if (cell.corner || level === FLOOR_HEIGHT - 1) v.addBlock(trim.type, x, y, z, {}, tint(trim))
        else if (front && ground && cell.t >= d0 && cell.t <= d1 && y <= 2) continue
        else if (front && ground) v.addBlock('glass', x, y, z, paneRot(cell.side))
        else if (!ground && (level === 1 || level === 2) && cell.t % 3 !== 0 && cell.t < cell.len - 1)
          v.addBlock('window', x, y, z, paneRot(cell.side))
        else v.addBlock(wall.type, x, y, z, {}, tint(wall))
      }
    }
  }
  flatRoof(v, nx, nz, top, { type: 'smoothStone' }, rng, rng() < 0.5 ? 1 : 0)
  const len = b.door === 'N' || b.door === 'S' ? nx : nz
  for (let t = 1; t < len - 1; t++) {
    const color = t % 2 === 0 ? awning : stripe
    const near = frontCell(b.door, t, nx, nz, 1)
    const far = frontCell(b.door, t, nx, nz, 2)
    v.addBlock('woolSlab', near.x, 3, near.z, {}, { color })
    v.addAt('woolSlab', far.x + 0.5, 3, far.z + 0.5, {}, { color })
  }
  const signLen = Math.min(len - 4, 6)
  if (signLen >= 2) {
    const mid = frontCell(b.door, len / 2, nx, nz, 0)
    const [ox, oz] = OUT[b.door]
    const alongX = b.door === 'N' || b.door === 'S'
    const cx = alongX ? mid.x : mid.x + 0.5 + ox * 0.6
    const cz = alongX ? mid.z + 0.5 + oz * 0.6 : mid.z
    const sign = pickOf(rng, SIGN_COLORS)
    v.addAt('concrete', cx, 4.5, cz, {}, { sx: alongX ? signLen : 0.2, sy: 0.8, sz: alongX ? 0.2 : signLen, color: sign })
    const lit = rng() < 0.5 ? 0xfff2c0 : pickOf(rng, AWNING_COLORS)
    for (let i = 0; i < signLen - 1; i++) {
      const off = i - (signLen - 2) / 2
      v.addAt('glow', cx + (alongX ? off : ox * 0.12), 4.5, cz + (alongX ? oz * 0.12 : off), {}, {
        sx: alongX ? 0.5 : 0.05,
        sy: 0.4,
        sz: alongX ? 0.05 : 0.5,
        color: lit,
      })
    }
  }
}

function buildApartment(v: VoxelBatcher, b: Building, nx: number, nz: number, rng: () => number): void {
  const roll = rng()
  const wall: Material =
    roll < 0.4
      ? { type: 'concrete', color: pickOf(rng, CONCRETE_WALLS) }
      : roll < 0.65
        ? { type: 'quartz' }
        : roll < 0.85
          ? { type: 'stoneBricks' }
          : { type: 'bricks' }
  const trim: Material =
    wall.type === 'concrete' || wall.type === 'quartz'
      ? rng() < 0.5
        ? { type: 'smoothStone' }
        : { type: 'concrete', color: pickOf(rng, TRIM_COLORS) }
      : { type: 'smoothStone' }
  const spacing = rng() < 0.5 ? 3 : 4
  const top = b.floors * FLOOR_HEIGHT
  for (let x = 0; x < nx; x++) {
    for (let z = 0; z < nz; z++) {
      const cell = cellOf(x, z, nx, nz)
      if (!cell) continue
      v.addBlock(trim.type, x, 0, z, {}, tint(trim))
      const front = cell.side === b.door && !cell.corner
      const [d0, d1] = doorSpan(cell.len)
      const inDoor = front && cell.t >= d0 && cell.t <= d1
      for (let y = 1; y < top; y++) {
        const level = (y - 1) % FLOOR_HEIGHT
        if (cell.corner || level === FLOOR_HEIGHT - 1) v.addBlock(trim.type, x, y, z, {}, tint(trim))
        else if (inDoor && y <= 2) v.addBlock('window', x, y, z, paneRot(cell.side))
        else if (inDoor && y === 3) v.addBlock(trim.type, x, y, z, {}, tint(trim))
        else if ((level === 1 || level === 2) && cell.t % spacing !== 0 && cell.t < cell.len - 1)
          v.addBlock('window', x, y, z, paneRot(cell.side))
        else v.addBlock(wall.type, x, y, z, {}, tint(wall))
      }
    }
  }
  flatRoof(v, nx, nz, top, { type: 'smoothStone' }, rng, 2 + Math.floor(rng() * 3))
  const len = b.door === 'N' || b.door === 'S' ? nx : nz
  const [d0, d1] = doorSpan(len)
  for (let t = d0 - 1; t <= d1 + 1; t++) {
    const c = frontCell(b.door, t, nx, nz, 1)
    v.addBlock('stoneSlab', c.x, 3, c.z)
  }
  for (const t of [d0 - 1, d1 + 1]) {
    const c = frontCell(b.door, t, nx, nz, 1)
    v.addAt('glow', c.x + 0.5, 2.6, c.z + 0.5, {}, { sx: 0.35, sy: 0.35, sz: 0.35 })
  }
}

export function buildBuilding(v: VoxelBatcher, b: Building, seed: number): void {
  const { frame, nx, nz } = frameFor(b)
  const rng = lcg(seed)
  v.setFrame(frame)
  if (b.style === 'house')
    buildHouse(v, { box: { x: nx / 2, z: nz / 2, hw: nx / 2, hd: nz / 2 }, facing: FACING[b.door], floors: b.floors, path: HOUSE_PATH, seed })
  else if (b.style === 'shop') buildShop(v, b, nx, nz, rng)
  else buildApartment(v, b, nx, nz, rng)
  v.setFrame(null)
}
