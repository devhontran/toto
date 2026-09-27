import * as THREE from 'three'
import type { Airport } from '../level/city'
import type { Box } from '../systems/collision'
import { flatSurface, type FlatRect, type VoxelBatcher } from './voxel'

const APRON_Y = 0.03
const RUNWAY_Y = 0.04
const RUNWAY_COLOR = 0x2c2c31
const APRON_COLOR = 0xb4b4b4
const FENCE_HEIGHT = 3
const FENCE_POST_EVERY = 8
const DASH_LEN = 4
const DASH_EVERY = 9
const EDGE_LIGHT_EVERY = 6
const EDGE_LIGHT_COLOR = 0xfff0b0
const THRESHOLD_BARS = 8
const THRESHOLD_LEN = 5
const RING_COLOR = 0x5dff8a
const RING_WIDTH = 0.7
const TOWER_SHAFT = 20
const TOWER_CAB = 3
const BEACON_COLOR = 0xff3b30
const GATE_POST = 5
export const DOOR_Z = 7
export const DOOR_SILL = 2.5

function fence(v: VoxelBatcher, f: Box): void {
  const alongX = f.hw >= f.hd
  const len = Math.round((alongX ? f.hw : f.hd) * 2)
  const start = alongX ? f.x - f.hw : f.z - f.hd
  for (let i = 0; i < len; i++) {
    const a = start + i + 0.5
    for (let y = 0; y < FENCE_HEIGHT; y++) {
      if (alongX) v.addAt('ironBars', a, y + 0.5, f.z, {})
      else v.addAt('ironBars', f.x, y + 0.5, a, { y: Math.PI / 2 })
    }
  }
  for (let i = 0; i <= len; i += FENCE_POST_EVERY) {
    const a = start + Math.min(i, len)
    const x = alongX ? a : f.x
    const z = alongX ? f.z : a
    v.addAt('iron', x, (FENCE_HEIGHT + 0.2) / 2, z, {}, { sx: 0.35, sy: FENCE_HEIGHT + 0.2, sz: 0.35 })
  }
}

function gatePosts(v: VoxelBatcher, a: Airport): void {
  const south = a.fences.filter((f) => Math.abs(f.z - a.gate.z) < 1 && f.hw > f.hd)
  for (const f of south) {
    const x = Math.abs(f.x + f.hw - a.gate.x) < Math.abs(f.x - f.hw - a.gate.x) ? f.x + f.hw : f.x - f.hw
    for (let y = 0; y < GATE_POST; y++) v.addAt('stoneBricks', x, y + 0.5, a.gate.z)
    v.addAt('glow', x, GATE_POST + 0.35, a.gate.z, {}, { sx: 0.7, sy: 0.7, sz: 0.7 })
  }
}

function runwayMarks(v: VoxelBatcher, r: Box): void {
  const y = 0.5 + RUNWAY_Y
  const x0 = r.x - r.hw
  const x1 = r.x + r.hw
  for (let x = x0 + THRESHOLD_LEN + 4; x < x1 - THRESHOLD_LEN - 4; x += DASH_EVERY)
    v.addAt('marking', x + DASH_LEN / 2, y, r.z, {}, { sx: DASH_LEN, sz: 0.5 })
  for (let i = 0; i < THRESHOLD_BARS; i++) {
    const z = r.z - r.hd + 1.5 + (i * (r.hd * 2 - 3)) / (THRESHOLD_BARS - 1)
    for (const x of [x0 + 1 + THRESHOLD_LEN / 2, x1 - 1 - THRESHOLD_LEN / 2])
      v.addAt('marking', x, y, z, {}, { sx: THRESHOLD_LEN, sz: 0.8 })
  }
  for (let x = x0; x <= x1; x += EDGE_LIGHT_EVERY) {
    for (const z of [r.z - r.hd - 0.4, r.z + r.hd + 0.4])
      v.addAt('glow', x, 0.2, z, {}, { sx: 0.35, sy: 0.35, sz: 0.35, color: EDGE_LIGHT_COLOR })
  }
}

function tower(v: VoxelBatcher, t: Box): void {
  const x0 = Math.round(t.x - t.hw)
  const x1 = Math.round(t.x + t.hw)
  const z0 = Math.round(t.z - t.hd)
  const z1 = Math.round(t.z + t.hd)
  const midX = Math.floor((x0 + x1) / 2)
  const midZ = Math.floor((z0 + z1) / 2)
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const edgeX = x === x0 || x === x1 - 1
      const edgeZ = z === z0 || z === z1 - 1
      if (!edgeX && !edgeZ) continue
      const corner = edgeX && edgeZ
      const center = edgeX ? z === midZ || z === midZ - 1 : x === midX || x === midX - 1
      for (let y = 0; y < TOWER_SHAFT; y++) {
        const level = y % 4
        if (edgeZ && z === z1 - 1 && center && y < 2) v.addBlock('darkPlanks', x, y, z)
        else if (corner || level === 3 || y === 0) v.addBlock('smoothStone', x, y, z)
        else if (center && (level === 1 || level === 2)) v.addBlock('window', x, y, z, { y: edgeX ? Math.PI / 2 : 0 })
        else v.addBlock('stoneBricks', x, y, z)
      }
    }
  }
  const cab = { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1 }
  const floorY = TOWER_SHAFT
  const roofY = floorY + TOWER_CAB + 1
  for (let x = cab.x0; x < cab.x1; x++) {
    for (let z = cab.z0; z < cab.z1; z++) {
      v.addBlock('smoothStone', x, floorY, z)
      v.addBlock('smoothStone', x, roofY, z)
      const edgeX = x === cab.x0 || x === cab.x1 - 1
      const edgeZ = z === cab.z0 || z === cab.z1 - 1
      if (!edgeX && !edgeZ) continue
      v.addBlock('stoneSlab', x, roofY + 1, z)
      for (let y = floorY + 1; y < roofY; y++) {
        if (edgeX && edgeZ) v.addBlock('iron', x, y, z)
        else v.addBlock('window', x, y, z, { y: edgeX ? Math.PI / 2 : 0 })
      }
    }
  }
  for (let y = roofY + 1; y < roofY + 5; y++) v.addAt('iron', t.x, y + 0.5, t.z, {}, { sx: 0.2, sz: 0.2 })
  v.addAt('glow', t.x, roofY + 5.3, t.z, {}, { sx: 0.5, sy: 0.5, sz: 0.5, color: BEACON_COLOR })
}

function boardRing(v: VoxelBatcher, zone: Airport['boardZone']): void {
  const r = zone.r
  for (let x = Math.floor(zone.x - r - 1); x <= Math.ceil(zone.x + r); x++) {
    for (let z = Math.floor(zone.z - r - 1); z <= Math.ceil(zone.z + r); z++) {
      const d = Math.hypot(x + 0.5 - zone.x, z + 0.5 - zone.z)
      if (d > r - RING_WIDTH && d <= r) v.addAt('light', x + 0.5, 0.07, z + 0.5, {}, { sy: 0.08, color: RING_COLOR })
    }
  }
}

function boardingStairs(v: VoxelBatcher, plane: Airport['plane']): void {
  v.setFrame(new THREE.Matrix4().makeTranslation(plane.x, 0, plane.z).multiply(new THREE.Matrix4().makeRotationY(plane.angle)))
  const turn = { y: -Math.PI / 2 }
  for (const z of [DOOR_Z - 0.5, DOOR_Z + 0.5]) {
    v.addAt('ironStairs', -4.5, 0.5, z, turn)
    v.addAt('iron', -3.5, 0.5, z)
    v.addAt('ironStairs', -3.5, 1.5, z, turn)
    v.addAt('iron', -2.5, 1, z, {}, { sy: 2 })
    v.addAt('iron', -2.5, 2.25, z, {}, { sy: 0.5 })
  }
  for (const z of [DOOR_Z - 0.94, DOOR_Z + 0.94]) {
    v.addAt('ironBars', -4.5, 1.5, z)
    v.addAt('ironBars', -3.5, 2.5, z)
    v.addAt('ironBars', -2.5, 3, z)
  }
  v.setFrame(null)
}

export function buildAirport(v: VoxelBatcher, a: Airport): THREE.Mesh[] {
  a.fences.forEach((f) => fence(v, f))
  gatePosts(v, a)
  runwayMarks(v, a.runway)
  tower(v, a.tower)
  boardRing(v, a.boardZone)
  boardingStairs(v, a.plane)
  const r = a.runway
  const runwaySouth = r.z + r.hd
  const padMinX = a.plane.x - a.plane.length
  const padMaxX = a.gate.x + 6
  const padMaxZ = a.boardZone.z + a.boardZone.r + 4
  const apron: FlatRect[] = [
    { x: a.gate.x, z: (a.gate.z + runwaySouth) / 2, hw: 6, hd: (a.gate.z - runwaySouth) / 2 },
    { x: (padMinX + padMaxX) / 2, z: (padMaxZ + runwaySouth) / 2, hw: (padMaxX - padMinX) / 2, hd: (padMaxZ - runwaySouth) / 2 },
  ]
  const tex = v.textures
  return [
    flatSurface(apron, tex.smoothStone, APRON_Y, { color: APRON_COLOR, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    flatSurface([r], tex.concrete, RUNWAY_Y, { color: RUNWAY_COLOR, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  ]
}
