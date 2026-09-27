import type { World } from '../game/World'
import { CITY } from '../level/city'
import { CITY_FRAME, MAP_COLORS, drawArrow, drawBoss, drawCity, drawPlaneIcon, drawTeam, traceRouteAhead } from './cityMap'
import { clampToRadius, headingUp, headingUpRotation } from './mapMath'

const SIZE = 200
const VIEW_RADIUS = 80
const ZOMBIE_RANGE = 40
const ICON_INSET = 14
const PX_PER_M = SIZE / 2 / VIEW_RADIUS

export class Minimap {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private layer: HTMLCanvasElement | null = null
  private dpr = 0
  private dash = 0

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'minimap'
    this.canvas.style.width = `${SIZE}px`
    this.canvas.style.height = `${SIZE}px`
    this.ctx = this.canvas.getContext('2d')!
    parent.appendChild(this.canvas)
  }

  private ensureLayer(): number {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (dpr === this.dpr && this.layer) return dpr
    this.dpr = dpr
    this.canvas.width = SIZE * dpr
    this.canvas.height = SIZE * dpr
    const k = PX_PER_M * dpr
    const layer = document.createElement('canvas')
    layer.width = Math.ceil(CITY_FRAME.width * k)
    layer.height = Math.ceil(CITY_FRAME.depth * k)
    drawCity(layer.getContext('2d')!, CITY_FRAME, k)
    this.layer = layer
    return dpr
  }

  draw(world: World, yaw: number, dt: number): void {
    if (this.canvas.hidden) return
    const dpr = this.ensureLayer()
    const ctx = this.ctx
    const k = PX_PER_M * dpr
    const half = (SIZE / 2) * dpr
    const p = world.player
    this.dash = (this.dash + dt * 6) % 8

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = MAP_COLORS.outside
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.save()
    ctx.translate(half, half)
    ctx.rotate(headingUpRotation(yaw))
    ctx.scale(k, k)
    ctx.drawImage(this.layer!, CITY_FRAME.minX - p.x, CITY_FRAME.minZ - p.z, CITY_FRAME.width, CITY_FRAME.depth)

    const px = 1 / PX_PER_M
    traceRouteAhead(ctx, world, p.x, p.z)
    ctx.setLineDash([4 * px, 3 * px])
    ctx.lineDashOffset = -this.dash * px
    ctx.lineWidth = 2.5 * px
    ctx.strokeStyle = MAP_COLORS.route
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = MAP_COLORS.zombie
    const r2 = ZOMBIE_RANGE * ZOMBIE_RANGE
    for (const z of world.zombies) {
      if (!z.alive || z.kind === 'boss') continue
      const dx = z.x - p.x
      const dz = z.z - p.z
      if (dx * dx + dz * dz > r2) continue
      ctx.fillRect(dx - 1.5 * px, dz - 1.5 * px, 3 * px, 3 * px)
    }
    drawBoss(ctx, world, p.x, p.z, 6 * px, 1.5 * px)
    drawTeam(ctx, world, p.x, p.z, 3.5 * px, 1.5 * px)
    ctx.restore()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawArrow(ctx, SIZE / 2, SIZE / 2, 0, 8)

    const plane = CITY.airport.plane
    const s = headingUp(plane.x - p.x, plane.z - p.z, yaw)
    const { point, clamped } = clampToRadius({ x: s.x * PX_PER_M, y: s.y * PX_PER_M }, SIZE / 2 - ICON_INSET)
    if (clamped) {
      ctx.beginPath()
      ctx.arc(SIZE / 2 + point.x, SIZE / 2 + point.y, 11, 0, Math.PI * 2)
      ctx.fillStyle = 'rgb(0 0 0 / 0.55)'
      ctx.fill()
    }
    drawPlaneIcon(ctx, SIZE / 2 + point.x, SIZE / 2 + point.y, 0, 9)
  }

  dispose(): void {
    this.canvas.remove()
  }
}
