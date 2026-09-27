export interface ScreenPoint {
  x: number
  y: number
}

export function headingUp(dx: number, dz: number, yaw: number): ScreenPoint {
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  return { x: -c * dx + s * dz, y: -(s * dx + c * dz) }
}

export function headingUpRotation(yaw: number): number {
  return yaw + Math.PI
}

export function headingAngle(dx: number, dz: number, yaw: number): number {
  const p = headingUp(dx, dz, yaw)
  return Math.atan2(p.x, -p.y)
}

export function northUpHeading(yaw: number): number {
  return Math.atan2(Math.sin(yaw), -Math.cos(yaw))
}

export function clampToRadius(p: ScreenPoint, r: number): { point: ScreenPoint; clamped: boolean } {
  const d = Math.hypot(p.x, p.y)
  if (d <= r) return { point: p, clamped: false }
  return { point: { x: (p.x / d) * r, y: (p.y / d) * r }, clamped: true }
}

export interface MapFrame {
  minX: number
  minZ: number
  width: number
  depth: number
}

export function fitScale(frame: MapFrame, w: number, h: number): number {
  return Math.min(w / frame.width, h / frame.depth)
}
