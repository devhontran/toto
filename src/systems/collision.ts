import { clamp } from '../lib/math2'

export interface Circle {
  x: number
  z: number
  r: number
}

export interface Box {
  x: number
  z: number
  hw: number
  hd: number
}

export function resolveCircleCircle(a: Circle, b: Circle, aShare = 0.5): boolean {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const min = a.r + b.r
  const d2 = dx * dx + dz * dz
  if (d2 >= min * min) return false
  const d = Math.sqrt(d2)
  const nx = d > 1e-6 ? dx / d : 1
  const nz = d > 1e-6 ? dz / d : 0
  const overlap = min - d
  a.x -= nx * overlap * aShare
  a.z -= nz * overlap * aShare
  b.x += nx * overlap * (1 - aShare)
  b.z += nz * overlap * (1 - aShare)
  return true
}

export function resolveCircleBox(c: Circle, b: Box): boolean {
  const px = clamp(c.x, b.x - b.hw, b.x + b.hw)
  const pz = clamp(c.z, b.z - b.hd, b.z + b.hd)
  const dx = c.x - px
  const dz = c.z - pz
  const d2 = dx * dx + dz * dz
  if (d2 > 0) {
    if (d2 >= c.r * c.r) return false
    const d = Math.sqrt(d2)
    c.x = px + (dx / d) * c.r
    c.z = pz + (dz / d) * c.r
    return true
  }
  const left = c.x - (b.x - b.hw)
  const right = b.x + b.hw - c.x
  const back = c.z - (b.z - b.hd)
  const front = b.z + b.hd - c.z
  const m = Math.min(left, right, back, front)
  if (m === left) c.x = b.x - b.hw - c.r
  else if (m === right) c.x = b.x + b.hw + c.r
  else if (m === back) c.z = b.z - b.hd - c.r
  else c.z = b.z + b.hd + c.r
  return true
}

export function overlapsCircleBox(c: Circle, b: Box): boolean {
  const dx = c.x - clamp(c.x, b.x - b.hw, b.x + b.hw)
  const dz = c.z - clamp(c.z, b.z - b.hd, b.z + b.hd)
  return dx * dx + dz * dz < c.r * c.r
}

export function rayCircle(ox: number, oz: number, dx: number, dz: number, c: Circle): number | null {
  const fx = ox - c.x
  const fz = oz - c.z
  const cc = fx * fx + fz * fz - c.r * c.r
  if (cc <= 0) return 0
  const b = fx * dx + fz * dz
  const disc = b * b - cc
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  return t >= 0 ? t : null
}

export function rayBox(ox: number, oz: number, dx: number, dz: number, b: Box): number | null {
  let tmin = 0
  let tmax = Infinity
  const axes: [number, number, number, number][] = [
    [ox, dx, b.x - b.hw, b.x + b.hw],
    [oz, dz, b.z - b.hd, b.z + b.hd],
  ]
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null
      continue
    }
    const t1 = (lo - o) / d
    const t2 = (hi - o) / d
    tmin = Math.max(tmin, Math.min(t1, t2))
    tmax = Math.min(tmax, Math.max(t1, t2))
    if (tmin > tmax) return null
  }
  return tmin
}
