import { describe, it, expect } from 'vitest'
import { CITY, generateCity, H_STREETS, STREET_WIDTH, V_STREETS } from './city'
import { routeLength } from './route'
import { overlapsCircleBox, type Box } from '../systems/collision'

function overlap(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.z - b.z) < a.hd + b.hd
}

function inside(a: Box, b: Box): boolean {
  return a.x - a.hw >= b.x - b.hw && a.x + a.hw <= b.x + b.hw && a.z - a.hd >= b.z - b.hd && a.z + a.hd <= b.z + b.hd
}

function segBoxDistance(ax: number, az: number, bx: number, bz: number, box: Box): number {
  let best = Infinity
  for (let i = 0; i <= 200; i++) {
    const t = i / 200
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    const dx = Math.max(Math.abs(x - box.x) - box.hw, 0)
    const dz = Math.max(Math.abs(z - box.z) - box.hd, 0)
    best = Math.min(best, Math.hypot(dx, dz))
  }
  return best
}

function onStreet(x: number, z: number): boolean {
  return CITY.streets.some((s) => Math.abs(x - s.x) <= s.hw && Math.abs(z - s.z) <= s.hd)
}

const solids = () => [...CITY.buildings.map((b) => b.box), ...CITY.props, CITY.airport.tower, ...CITY.airport.fences]

describe('CITY', () => {
  it('is deterministic for a seed and differs for another', () => {
    expect(generateCity()).toEqual(CITY)
    expect(generateCity(7).buildings).not.toEqual(CITY.buildings)
  })

  it('spans ~260 x ~420 m in the XZ plane south of z=0', () => {
    const b = CITY.bounds
    expect(b.hw * 2).toBeGreaterThanOrEqual(240)
    expect(b.hw * 2).toBeLessThanOrEqual(280)
    expect(b.hd * 2).toBeGreaterThanOrEqual(400)
    expect(b.hd * 2).toBeLessThanOrEqual(440)
    expect(b.z + b.hd).toBe(0)
  })

  it('has 12 m streets spaced 44 m apart', () => {
    for (let i = 1; i < V_STREETS.length; i++) expect(V_STREETS[i] - V_STREETS[i - 1]).toBe(44)
    for (let i = 1; i < H_STREETS.length; i++) expect(H_STREETS[i - 1] - H_STREETS[i]).toBe(44)
    for (const s of CITY.streets) expect(Math.min(s.hw, s.hd) * 2).toBe(STREET_WIDTH)
  })

  it('places many buildings, styled by zone, never on a street, the route or the airport', () => {
    expect(CITY.buildings.length).toBeGreaterThan(60)
    for (const b of CITY.buildings) {
      for (const s of CITY.streets) expect(overlap(b.box, s)).toBe(false)
      expect(overlap(b.box, CITY.airport.area)).toBe(false)
      expect(inside(b.box, CITY.bounds)).toBe(true)
      for (let i = 1; i < CITY.route.length; i++) {
        const a = CITY.route[i - 1]
        const c = CITY.route[i]
        expect(segBoxDistance(a.x, a.z, c.x, c.z, b.box)).toBeGreaterThanOrEqual(6)
      }
      if (b.style === 'house') expect(b.floors).toBe(1)
      if (b.style === 'shop') expect(b.floors).toBeGreaterThanOrEqual(1)
      if (b.style === 'shop') expect(b.floors).toBeLessThanOrEqual(2)
      if (b.style === 'apartment') expect(b.floors).toBeGreaterThanOrEqual(3)
      if (b.style === 'apartment') expect(b.floors).toBeLessThanOrEqual(5)
    }
    const southmost = CITY.buildings.filter((b) => b.box.z > -80)
    const northmost = CITY.buildings.filter((b) => b.box.z < -230)
    expect(southmost.every((b) => b.style === 'house')).toBe(true)
    expect(northmost.every((b) => b.style === 'apartment')).toBe(true)
    expect(CITY.buildings.some((b) => b.style === 'shop')).toBe(true)
  })

  it('never overlaps two buildings or a building with a park', () => {
    const boxes = CITY.buildings.map((b) => b.box)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false)
      for (const p of CITY.parks) expect(overlap(boxes[i], p)).toBe(false)
    }
    expect(CITY.parks.length).toBeGreaterThan(0)
  })

  it('opens every door onto an adjacent street', () => {
    for (const b of CITY.buildings) {
      const { x, z, hw, hd } = b.box
      const out = 5
      const probe =
        b.door === 'N' ? { x, z: z - hd - out } : b.door === 'S' ? { x, z: z + hd + out } : b.door === 'E' ? { x: x + hw + out, z } : { x: x - hw - out, z }
      expect(onStreet(probe.x, probe.z)).toBe(true)
    }
  })

  it('keeps abandoned cars on streets, off each other', () => {
    expect(CITY.props.length).toBeGreaterThanOrEqual(10)
    for (const c of CITY.props) expect(CITY.streets.some((s) => inside(c, s))).toBe(true)
    for (let i = 0; i < CITY.props.length; i++)
      for (let j = i + 1; j < CITY.props.length; j++) expect(overlap(CITY.props[i], CITY.props[j])).toBe(false)
  })
})

describe('CITY route', () => {
  const r = CITY.route

  it('starts at the start in the south-east and ends at the airport gate in the north', () => {
    expect(r[0]).toEqual(CITY.start)
    expect(CITY.start.x).toBeGreaterThan(0)
    expect(CITY.start.z).toBeGreaterThan(-40)
    expect(r[r.length - 1]).toEqual(CITY.airport.gate)
    expect(CITY.airport.gate.z).toBe(CITY.airport.area.z + CITY.airport.area.hd)
  })

  it('is ~550 m long with at least 4 turns', () => {
    const len = routeLength(r)
    expect(len).toBeGreaterThanOrEqual(500)
    expect(len).toBeLessThanOrEqual(620)
    let turns = 0
    for (let i = 2; i < r.length; i++) {
      const a = Math.atan2(r[i - 1].x - r[i - 2].x, r[i - 1].z - r[i - 2].z)
      const b = Math.atan2(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z)
      if (Math.abs(a - b) > 1e-6) turns++
    }
    expect(turns).toBeGreaterThanOrEqual(4)
  })

  it('runs continuously along street centerlines', () => {
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1]
      const b = r[i]
      expect(a.x === b.x || a.z === b.z).toBe(true)
      if (a.x === b.x) expect(V_STREETS).toContain(a.x)
      else expect(H_STREETS).toContain(a.z)
      for (let t = 0; t <= 1; t += 0.05) expect(onStreet(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)).toBe(true)
    }
  })

  it('stays clear of every solid, as do the gate, board zone and runway center', () => {
    const walls = solids()
    for (let i = 1; i < r.length; i++) {
      for (let t = 0; t <= 1; t += 0.02) {
        const p = { x: r[i - 1].x + (r[i].x - r[i - 1].x) * t, z: r[i - 1].z + (r[i].z - r[i - 1].z) * t, r: 1 }
        expect(walls.some((w) => overlapsCircleBox(p, w))).toBe(false)
      }
    }
    const a = CITY.airport
    for (const p of [
      { ...a.gate, r: 1 },
      { ...a.boardZone },
      { x: a.runway.x, z: a.runway.z, r: 2 },
    ])
      expect(walls.some((w) => overlapsCircleBox(p, w))).toBe(false)
  })
})

describe('CITY airport', () => {
  const a = CITY.airport

  it('is ~120 x 80 m in the north with runway, tower, plane and board zone inside', () => {
    expect(a.area.hw * 2).toBe(120)
    expect(a.area.hd * 2).toBeGreaterThanOrEqual(80)
    expect(inside(a.area, CITY.bounds)).toBe(true)
    expect(inside(a.runway, a.area)).toBe(true)
    expect(inside(a.tower, a.area)).toBe(true)
    expect(a.plane.length).toBe(24)
    expect(overlapsCircleBox({ x: a.plane.x, z: a.plane.z, r: 0.1 }, a.runway)).toBe(true)
    expect(inside({ x: a.boardZone.x, z: a.boardZone.z, hw: a.boardZone.r, hd: a.boardZone.r }, a.area)).toBe(true)
  })

  it('is fenced with a gap at the gate', () => {
    const gate = { x: a.gate.x, z: a.gate.z, r: 5 }
    expect(a.fences.some((f) => overlapsCircleBox(gate, f))).toBe(false)
    expect(a.fences.some((f) => overlapsCircleBox({ x: a.gate.x + 10, z: a.gate.z, r: 0.5 }, f))).toBe(true)
    expect(a.fences.some((f) => overlapsCircleBox({ x: a.area.x - a.area.hw, z: a.area.z, r: 0.5 }, f))).toBe(true)
    expect(a.fences.some((f) => overlapsCircleBox({ x: a.area.x, z: a.area.z - a.area.hd, r: 0.5 }, f))).toBe(true)
  })
})
