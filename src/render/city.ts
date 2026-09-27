import * as THREE from 'three'
import type { Box } from '../systems/collision'
import { CITY, CITY_HALF_WIDTH, H_STREETS, STREET_WIDTH, V_STREETS, type City } from '../level/city'
import { buildBuilding } from './buildings'
import { buildAirport } from './airport'
import { oakTree } from './town'
import { flatSurface, lcg, VoxelBatcher, type FlatRect } from './voxel'

export const CHUNK_SIZE = 32
const GROUND_MARGIN = 80
const HALF_STREET = STREET_WIDTH / 2
const SIDEWALK = 2
const CURB = 0.15
const ROAD_Y = 0.02
const LAMP_SPACING = 20
const LAMP_INSET = 0.5
const LAMP_POSTS = 4
const LAMP_CLEAR = HALF_STREET + SIDEWALK + 2
const CROSSWALK_LEN = 3
const CROSSWALK_GAP = 0.5
const DASH_LEN = 2
const DASH_EVERY = 6
const DASH_CLEAR = HALF_STREET + CROSSWALK_GAP + CROSSWALK_LEN + 1
const PAVEMENT_COLOR = 0xc9c9c9
const DASH_COLOR = 0xe9dfa8
const CAR_COLORS = [0xb23a2e, 0x2d5aa0, 0xe0e0e0, 0x3a3a3a, 0x2f7a46, 0xd9a82b, 0x8a8f96, 0x6b3f8a]
const CAR_TIRE = 0x1e1e1e
const POND_PARKS = 2
const TREE_AREA = 90
const TREE_SPACING = 6
const FLOWER_AREA = 14
const FLOWERS = ['poppy', 'dandelion'] as const
const BUILDING_SEED = 9000

export interface CityView {
  root: THREE.Group
  chunks: THREE.Object3D[]
  textures: VoxelBatcher['textures']
}

function streetEnd(x: number, city: City): number {
  const v = city.streets.find((s) => s.hd > s.hw && s.x === x)
  return v ? v.z - v.hd : 0
}

function blockRects(): FlatRect[] {
  const xs = [-CITY_HALF_WIDTH, ...V_STREETS.flatMap((x) => [x - HALF_STREET, x + HALF_STREET]), CITY_HALF_WIDTH]
  const zs = [0, ...H_STREETS.flatMap((z) => [z + HALF_STREET, z - HALF_STREET])]
  const out: FlatRect[] = []
  for (let i = 0; i + 1 < xs.length; i += 2) {
    for (let j = 0; j + 1 < zs.length; j += 2) {
      const minX = xs[i]
      const maxX = xs[i + 1]
      const maxZ = zs[j]
      const minZ = zs[j + 1]
      out.push({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hw: (maxX - minX) / 2, hd: (maxZ - minZ) / 2 })
    }
  }
  return out
}

function sidewalkRing(b: FlatRect): FlatRect[] {
  const s = SIDEWALK / 2
  return [
    { x: b.x, z: b.z - b.hd + s, hw: b.hw, hd: s },
    { x: b.x, z: b.z + b.hd - s, hw: b.hw, hd: s },
    { x: b.x - b.hw + s, z: b.z, hw: s, hd: b.hd - SIDEWALK },
    { x: b.x + b.hw - s, z: b.z, hw: s, hd: b.hd - SIDEWALK },
  ]
}

function crosswalk(v: VoxelBatcher, cx: number, cz: number, alongZ: boolean): void {
  for (let k = -2; k <= 2; k++) {
    const off = k * 2
    v.addAt('marking', alongZ ? cx + off : cx, 0.5 + ROAD_Y, alongZ ? cz : cz + off, {}, {
      sx: alongZ ? 1 : CROSSWALK_LEN,
      sz: alongZ ? CROSSWALK_LEN : 1,
    })
  }
}

function lamp(v: VoxelBatcher, x: number, z: number): void {
  for (let y = 0; y < LAMP_POSTS; y++) v.addAt('fence', x, y + 0.5, z)
  v.addAt('glow', x, LAMP_POSTS + 0.3, z, {}, { sx: 0.6, sy: 0.6, sz: 0.6 })
}

function nearAny(p: number, list: readonly number[], clear: number): boolean {
  return list.some((c) => Math.abs(c - p) < clear)
}

function streetDetails(v: VoxelBatcher, city: City): void {
  const southEdge = 0
  const lampOff = HALF_STREET + LAMP_INSET
  for (const x of V_STREETS) {
    const end = streetEnd(x, city)
    for (const z of H_STREETS) {
      if (z + HALF_STREET + CROSSWALK_GAP + CROSSWALK_LEN <= southEdge)
        crosswalk(v, x, z + HALF_STREET + CROSSWALK_GAP + CROSSWALK_LEN / 2, true)
      if (z - HALF_STREET - CROSSWALK_GAP - CROSSWALK_LEN >= end)
        crosswalk(v, x, z - HALF_STREET - CROSSWALK_GAP - CROSSWALK_LEN / 2, true)
      crosswalk(v, x + HALF_STREET + CROSSWALK_GAP + CROSSWALK_LEN / 2, z, false)
      crosswalk(v, x - HALF_STREET - CROSSWALK_GAP - CROSSWALK_LEN / 2, z, false)
    }
    for (let z = southEdge - DASH_EVERY / 2; z > end + DASH_LEN; z -= DASH_EVERY) {
      if (nearAny(z, H_STREETS, DASH_CLEAR)) continue
      v.addAt('marking', x, 0.5 + ROAD_Y, z, {}, { sx: 0.3, sz: DASH_LEN, color: DASH_COLOR })
    }
    const lampEnd = Math.max(end, H_STREETS[H_STREETS.length - 1])
    for (let z = southEdge - LAMP_SPACING / 2; z > lampEnd; z -= LAMP_SPACING) {
      if (nearAny(z, H_STREETS, LAMP_CLEAR)) continue
      lamp(v, x - lampOff, z)
      lamp(v, x + lampOff, z)
    }
  }
  for (const z of H_STREETS) {
    for (let x = -CITY_HALF_WIDTH + DASH_EVERY / 2; x < CITY_HALF_WIDTH - DASH_LEN; x += DASH_EVERY) {
      if (nearAny(x, V_STREETS, DASH_CLEAR)) continue
      v.addAt('marking', x, 0.5 + ROAD_Y, z, {}, { sx: DASH_LEN, sz: 0.3, color: DASH_COLOR })
    }
    for (let x = -CITY_HALF_WIDTH + LAMP_SPACING / 2; x < CITY_HALF_WIDTH; x += LAMP_SPACING) {
      if (nearAny(x, V_STREETS, LAMP_CLEAR)) continue
      lamp(v, x, z + lampOff)
      if (z !== H_STREETS[H_STREETS.length - 1]) lamp(v, x, z - lampOff)
    }
  }
}

function pond(v: VoxelBatcher, p: Box, rng: () => number): { x: number; z: number; rx: number; rz: number } {
  const rx = Math.max(3, Math.floor(p.hw * (0.3 + rng() * 0.15)))
  const rz = Math.max(3, Math.floor(p.hd * (0.3 + rng() * 0.15)))
  const cx = Math.round(p.x)
  const cz = Math.round(p.z)
  for (let dx = -rx - 1; dx <= rx; dx++) {
    for (let dz = -rz - 1; dz <= rz; dz++) {
      const e = ((dx + 0.5) / rx) ** 2 + ((dz + 0.5) / rz) ** 2
      if (e <= 1) v.addBlock('water', cx + dx, 0, cz + dz)
      else if (e <= 1.45) v.addBlock('path', cx + dx, 0, cz + dz)
    }
  }
  return { x: cx, z: cz, rx: rx + 2, rz: rz + 2 }
}

function buildPark(v: VoxelBatcher, p: Box, index: number): void {
  const rng = lcg(7000 + index)
  const hole = index < POND_PARKS ? pond(v, p, rng) : null
  const inHole = (x: number, z: number, pad: number) =>
    hole !== null && ((x - hole.x) / (hole.rx + pad)) ** 2 + ((z - hole.z) / (hole.rz + pad)) ** 2 <= 1
  const x0 = Math.ceil(p.x - p.hw) + 2
  const x1 = Math.floor(p.x + p.hw) - 3
  const z0 = Math.ceil(p.z - p.hd) + 2
  const z1 = Math.floor(p.z + p.hd) - 3
  const area = (x1 - x0) * (z1 - z0)
  const midX = Math.round(p.x)
  const trunks: { x: number; z: number }[] = []
  for (let guard = 0; trunks.length < area / TREE_AREA && guard < 400; guard++) {
    const x = x0 + Math.floor(rng() * (x1 - x0))
    const z = z0 + Math.floor(rng() * (z1 - z0))
    if (inHole(x, z, 2.5) || Math.abs(x - midX + 0.5) < 3.5) continue
    if (trunks.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.z - z)) < TREE_SPACING)) continue
    trunks.push({ x, z })
    oakTree(v, x, z, 4 + Math.floor(rng() * 3), rng)
  }
  const used = new Set(trunks.map((t) => `${t.x},${t.z}`))
  for (let i = 0; i < area / FLOWER_AREA; i++) {
    const x = x0 + Math.floor(rng() * (x1 - x0))
    const z = z0 + Math.floor(rng() * (z1 - z0))
    const key = `${x},${z}`
    if (used.has(key) || inHole(x, z, 0)) continue
    used.add(key)
    v.addBlock(FLOWERS[Math.floor(rng() * FLOWERS.length)], x, 0, z)
  }
  for (let z = Math.ceil(p.z - p.hd); z < Math.floor(p.z + p.hd); z++) {
    if (inHole(midX, z, 0) || inHole(midX + 1, z, 0)) continue
    v.addBlock('path', midX - 1, 0, z)
    v.addBlock('path', midX, 0, z)
  }
}

function buildCar(v: VoxelBatcher, box: Box, index: number): void {
  const rng = lcg(5000 + index)
  const body = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]
  const alongZ = box.hd >= box.hw
  const len = (alongZ ? box.hd : box.hw) * 2
  const wid = (alongZ ? box.hw : box.hd) * 2
  const frame = new THREE.Matrix4()
    .makeTranslation(box.x, 0, box.z)
    .multiply(new THREE.Matrix4().makeRotationY(alongZ ? (rng() < 0.5 ? 0 : Math.PI) : rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2))
  v.setFrame(frame)
  v.addAt('concrete', 0, 0.75, 0, {}, { sx: wid, sy: 0.7, sz: len, color: body })
  v.addAt('concrete', 0, 1.45, -0.2, {}, { sx: wid - 0.2, sy: 0.7, sz: len * 0.5, color: body })
  v.addAt('window', 0, 1.42, -0.2 + len * 0.25 + 0.06, { x: -0.25 }, { sx: wid - 0.3, sy: 0.55 })
  v.addAt('window', 0, 1.42, -0.2 - len * 0.25 - 0.06, {}, { sx: wid - 0.3, sy: 0.55 })
  for (const s of [-1, 1]) {
    v.addAt('window', s * (wid / 2 - 0.05), 1.45, -0.2, { y: Math.PI / 2 }, { sx: len * 0.45, sy: 0.5 })
    v.addAt('concrete', s * (wid / 2 - 0.3), 0.8, len / 2 + 0.02, {}, { sx: 0.4, sy: 0.2, sz: 0.05, color: 0xf4efc8 })
    v.addAt('concrete', s * (wid / 2 - 0.3), 0.85, -len / 2 - 0.02, {}, { sx: 0.4, sy: 0.2, sz: 0.05, color: 0xa81c1c })
    for (const f of [-1, 1]) v.addAt('concrete', s * (wid / 2 - 0.2), 0.35, f * len * 0.3, {}, { sx: 0.5, sy: 0.7, sz: 0.7, color: CAR_TIRE })
  }
  v.setFrame(null)
}

export function buildCity(city: City = CITY): CityView {
  const v = new VoxelBatcher({ chunk: CHUNK_SIZE })
  const tex = v.textures
  streetDetails(v, city)
  city.buildings.forEach((b, i) => buildBuilding(v, b, BUILDING_SEED + i))
  city.parks.forEach((p, i) => buildPark(v, p, i))
  city.props.forEach((c, i) => buildCar(v, c, i))
  const airportFlats = buildAirport(v, city.airport)
  const root = v.build()
  const chunks = [...root.children]
  const b = city.bounds
  root.add(
    flatSurface([{ x: b.x, z: b.z, hw: b.hw + GROUND_MARGIN, hd: b.hd + GROUND_MARGIN }], tex.grassTop, 0),
    flatSurface(city.streets, tex.gravel, ROAD_Y, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    flatSurface(blockRects().flatMap(sidewalkRing), tex.smoothStone, CURB, { color: PAVEMENT_COLOR }, CURB),
    ...airportFlats,
  )
  return { root, chunks, textures: tex }
}
