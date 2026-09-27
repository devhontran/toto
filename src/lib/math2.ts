export interface Vec2 {
  x: number
  z: number
}

export function normalize(x: number, z: number): Vec2 {
  const l = Math.hypot(x, z)
  return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 }
}

export function dirFromAngle(a: number): Vec2 {
  return { x: Math.sin(a), z: Math.cos(a) }
}

export function angleOf(x: number, z: number): number {
  return Math.atan2(x, z)
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
