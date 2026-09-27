import type { Box } from '../systems/collision'
import type { Vec2 } from '../lib/math2'
import { mulberry32 } from '../lib/rng'

export type BuildingStyle = 'house' | 'shop' | 'apartment'
export type Side = 'N' | 'S' | 'E' | 'W'

export interface Building {
  box: Box
  floors: number
  style: BuildingStyle
  door: Side
}

export interface Airport {
  area: Box
  gate: Vec2
  runway: Box
  tower: Box
  plane: { x: number; z: number; angle: number; length: number }
  boardZone: { x: number; z: number; r: number }
  fences: Box[]
}

export interface City {
  bounds: Box
  streets: Box[]
  buildings: Building[]
  parks: Box[]
  props: Box[]
  route: Vec2[]
  start: Vec2
  airport: Airport
}

export const CITY_SEED = 20260927
export const STREET_WIDTH = 12
export const STREET_SPACING = 44
export const CITY_HALF_WIDTH = 126
export const CITY_DEPTH = 410
export const V_STREETS: readonly number[] = [-88, -44, 0, 44, 88]
export const H_STREETS: readonly number[] = [-44, -88, -132, -176, -220, -264, -308]

const HALF_STREET = STREET_WIDTH / 2
const SIDEWALK = 2
const LOT_GAP = 2
const PARK_COUNT = 5
const CAR_COUNT = 18
const CAR_LATERAL = 4.6
const CAR_HALF_LEN = 2.2
const CAR_HALF_WIDTH = 1
const CAR_CLEAR_OF_CROSSING = 12
const CAR_CLEAR_OF_START = 20
const FENCE_HALF = 0.25
const GATE_HALF = 6

const AIRPORT_AREA: Box = { x: 0, z: -362, hw: 60, hd: 44 }
const GATE: Vec2 = { x: 0, z: AIRPORT_AREA.z + AIRPORT_AREA.hd }

const ROUTE: Vec2[] = [
  { x: 88, z: -12 },
  { x: 88, z: -88 },
  { x: 44, z: -88 },
  { x: 44, z: -176 },
  { x: -88, z: -176 },
  { x: -88, z: -264 },
  { x: 0, z: -264 },
  GATE,
]

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

interface Lot extends Rect {
  edges: Side[]
}

function rectToBox(r: Rect): Box {
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, hw: (r.maxX - r.minX) / 2, hd: (r.maxZ - r.minZ) / 2 }
}

function styleForRow(row: number): BuildingStyle {
  if (row <= 1) return 'house'
  if (row <= 3) return 'shop'
  return 'apartment'
}

function blockRect(col: number, row: number): Rect {
  return {
    minX: col === 0 ? -CITY_HALF_WIDTH : V_STREETS[col - 1] + HALF_STREET,
    maxX: col === V_STREETS.length ? CITY_HALF_WIDTH : V_STREETS[col] - HALF_STREET,
    minZ: H_STREETS[row] + HALF_STREET,
    maxZ: row === 0 ? 0 : H_STREETS[row - 1] - HALF_STREET,
  }
}

function streetSides(col: number, row: number): Side[] {
  const sides: Side[] = ['N']
  if (row > 0) sides.push('S')
  if (col > 0) sides.push('W')
  if (col < V_STREETS.length) sides.push('E')
  return sides
}

function splitX(r: Lot, at: number): [Lot, Lot] {
  const mid = r.minX + (r.maxX - r.minX) * at
  return [
    { ...r, maxX: mid - LOT_GAP / 2, edges: r.edges.filter((e) => e !== 'E') },
    { ...r, minX: mid + LOT_GAP / 2, edges: r.edges.filter((e) => e !== 'W') },
  ]
}

function splitZ(r: Lot, at: number): [Lot, Lot] {
  const mid = r.minZ + (r.maxZ - r.minZ) * at
  return [
    { ...r, maxZ: mid - LOT_GAP / 2, edges: r.edges.filter((e) => e !== 'S') },
    { ...r, minZ: mid + LOT_GAP / 2, edges: r.edges.filter((e) => e !== 'N') },
  ]
}

function split(r: Lot, rng: () => number): [Lot, Lot] {
  const at = 0.4 + rng() * 0.2
  return rng() < 0.5 ? splitX(r, at) : splitZ(r, at)
}

function lotsFor(interior: Rect, count: number, rng: () => number): Lot[] {
  const whole: Lot = { ...interior, edges: ['N', 'S', 'E', 'W'] }
  if (count <= 1) return [whole]
  const [a, b] = split(whole, rng)
  if (count === 2) return [a, b]
  if (count === 3) return [...split(a, rng), b]
  return [...split(a, rng), ...split(b, rng)]
}

function lotCount(style: BuildingStyle, rng: () => number): number {
  if (style === 'house') return 2 + Math.floor(rng() * 3)
  if (style === 'shop') return 1 + Math.floor(rng() * 4)
  return 1 + Math.floor(rng() * 2)
}

function floorsFor(style: BuildingStyle, rng: () => number): number {
  if (style === 'house') return 1
  if (style === 'shop') return 1 + Math.floor(rng() * 2)
  return 3 + Math.floor(rng() * 3)
}

const MARGIN: Record<BuildingStyle, number> = { house: 2, shop: 1, apartment: 0.5 }

function buildBlock(col: number, row: number, rng: () => number, out: Building[]): void {
  const block = blockRect(col, row)
  const interior = {
    minX: block.minX + SIDEWALK,
    maxX: block.maxX - SIDEWALK,
    minZ: block.minZ + SIDEWALK,
    maxZ: block.maxZ - SIDEWALK,
  }
  const style = styleForRow(row)
  const streets = streetSides(col, row)
  for (const lot of lotsFor(interior, lotCount(style, rng), rng)) {
    const doors = lot.edges.filter((e) => streets.includes(e))
    if (doors.length === 0) continue
    const m = MARGIN[style]
    out.push({
      box: rectToBox({ minX: lot.minX + m, maxX: lot.maxX - m, minZ: lot.minZ + m, maxZ: lot.maxZ - m }),
      floors: floorsFor(style, rng),
      style,
      door: doors[Math.floor(rng() * doors.length)],
    })
  }
}

function streetBoxes(): Box[] {
  const north = H_STREETS[H_STREETS.length - 1] - HALF_STREET
  const streets: Box[] = V_STREETS.map((x) => {
    const end = x === GATE.x ? GATE.z : north
    return { x, z: end / 2, hw: HALF_STREET, hd: -end / 2 }
  })
  for (const z of H_STREETS) streets.push({ x: 0, z, hw: CITY_HALF_WIDTH, hd: HALF_STREET })
  return streets
}

function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw + pad && Math.abs(a.z - b.z) < a.hd + b.hd + pad
}

function placeCars(rng: () => number, start: Vec2): Box[] {
  const cars: Box[] = []
  const north = H_STREETS[H_STREETS.length - 1] - HALF_STREET
  for (let attempt = 0; attempt < CAR_COUNT * 20 && cars.length < CAR_COUNT; attempt++) {
    const vertical = rng() < 0.5
    const side = rng() < 0.5 ? -1 : 1
    let car: Box
    let along: number
    let crossings: readonly number[]
    if (vertical) {
      const x = V_STREETS[Math.floor(rng() * V_STREETS.length)]
      along = north + CAR_HALF_LEN + rng() * (-north - 2 * CAR_HALF_LEN)
      crossings = [0, north, ...H_STREETS]
      car = { x: x + side * CAR_LATERAL, z: along, hw: CAR_HALF_WIDTH, hd: CAR_HALF_LEN }
    } else {
      const z = H_STREETS[Math.floor(rng() * H_STREETS.length)]
      along = -CITY_HALF_WIDTH + CAR_HALF_LEN + rng() * (2 * CITY_HALF_WIDTH - 2 * CAR_HALF_LEN)
      crossings = [-CITY_HALF_WIDTH, CITY_HALF_WIDTH, ...V_STREETS]
      car = { x: along, z: z + side * CAR_LATERAL, hw: CAR_HALF_LEN, hd: CAR_HALF_WIDTH }
    }
    if (crossings.some((c) => Math.abs(c - along) < CAR_CLEAR_OF_CROSSING)) continue
    if (Math.hypot(car.x - start.x, car.z - start.z) < CAR_CLEAR_OF_START) continue
    if (cars.some((c) => boxesOverlap(c, car, 1))) continue
    cars.push(car)
  }
  return cars
}

function airport(): Airport {
  const a = AIRPORT_AREA
  const south = a.z + a.hd
  const north = a.z - a.hd
  const west = a.x - a.hw
  const east = a.x + a.hw
  const sideLen = (a.hw - GATE_HALF) / 2
  return {
    area: a,
    gate: GATE,
    runway: { x: 0, z: -380, hw: 54, hd: 9 },
    tower: { x: 44, z: -336, hw: 4, hd: 4 },
    plane: { x: -34, z: -380, angle: Math.PI / 2, length: 24 },
    boardZone: { x: -30, z: -366, r: 5 },
    fences: [
      { x: west + sideLen, z: south, hw: sideLen, hd: FENCE_HALF },
      { x: east - sideLen, z: south, hw: sideLen, hd: FENCE_HALF },
      { x: a.x, z: north, hw: a.hw, hd: FENCE_HALF },
      { x: west, z: a.z, hw: FENCE_HALF, hd: a.hd },
      { x: east, z: a.z, hw: FENCE_HALF, hd: a.hd },
    ],
  }
}

export function generateCity(seed: number = CITY_SEED): City {
  const rng = mulberry32(seed)
  const start = ROUTE[0]
  const cols = V_STREETS.length + 1
  const rows = H_STREETS.length
  const parkIds = new Set<number>()
  while (parkIds.size < PARK_COUNT) parkIds.add(Math.floor(rng() * cols * rows))
  const buildings: Building[] = []
  const parks: Box[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (parkIds.has(row * cols + col)) {
        const b = blockRect(col, row)
        parks.push(rectToBox({ minX: b.minX + SIDEWALK, maxX: b.maxX - SIDEWALK, minZ: b.minZ + SIDEWALK, maxZ: b.maxZ - SIDEWALK }))
      } else buildBlock(col, row, rng, buildings)
    }
  }
  return {
    bounds: { x: 0, z: -CITY_DEPTH / 2, hw: CITY_HALF_WIDTH, hd: CITY_DEPTH / 2 },
    streets: streetBoxes(),
    buildings,
    parks,
    props: placeCars(rng, start),
    route: ROUTE.map((p) => ({ x: p.x, z: p.z })),
    start: { x: start.x, z: start.z },
    airport: airport(),
  }
}

export const CITY: City = generateCity()
