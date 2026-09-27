import type { Vec2 } from '../lib/math2'

export interface RouteProgress {
  distance: number
  total: number
  segment: number
  next: Vec2
  point: Vec2
}

export function routeLength(route: readonly Vec2[]): number {
  let total = 0
  for (let i = 1; i < route.length; i++) total += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z)
  return total
}

export function routeProgress(route: readonly Vec2[], x: number, z: number): RouteProgress {
  let bestD2 = Infinity
  let distance = 0
  let segment = 0
  let point: Vec2 = { x: route[0].x, z: route[0].z }
  let walked = 0
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]
    const sx = b.x - a.x
    const sz = b.z - a.z
    const len2 = sx * sx + sz * sz
    const len = Math.sqrt(len2)
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * sx + (z - a.z) * sz) / len2)) : 0
    const px = a.x + sx * t
    const pz = a.z + sz * t
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz)
    if (d2 < bestD2) {
      bestD2 = d2
      distance = walked + len * t
      segment = i
      point = { x: px, z: pz }
    }
    walked += len
  }
  const n = route[Math.min(segment + 1, route.length - 1)]
  return { distance, total: walked, segment, next: { x: n.x, z: n.z }, point }
}

export function pointAtDistance(route: readonly Vec2[], d: number): { point: Vec2; dir: Vec2 } {
  let left = Math.max(0, d)
  let dir: Vec2 = { x: 0, z: 0 }
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len <= 0) continue
    dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
    if (left <= len) return { point: { x: a.x + dir.x * left, z: a.z + dir.z * left }, dir }
    left -= len
  }
  const end = route[route.length - 1]
  return { point: { x: end.x, z: end.z }, dir }
}
