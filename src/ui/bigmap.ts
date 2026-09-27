import type { World } from '../game/World'
import { CITY } from '../level/city'
import { CITY_FRAME, MAP_COLORS, drawArrow, drawBoss, drawCity, drawPlaneIcon, drawTeam, traceRouteAhead } from './cityMap'
import { fitScale, northUpHeading } from './mapMath'

const PAD = 48

export class BigMap {
  readonly root: HTMLDivElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private layer: HTMLCanvasElement | null = null
  private key = ''

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'bigmap'
    this.root.hidden = true
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
    const title = document.createElement('div')
    title.className = 'bigmap__title'
    title.textContent = 'BẢN ĐỒ · thả M để đóng'
    this.root.append(this.canvas, title)
    parent.appendChild(this.root)
  }

  private layout(): { dpr: number; scale: number; ox: number; oy: number } {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    const scale = fitScale(CITY_FRAME, w - PAD * 2, h - PAD * 2)
    const ox = (w - CITY_FRAME.width * scale) / 2
    const oy = (h - CITY_FRAME.depth * scale) / 2
    const key = `${w}x${h}@${dpr}`
    if (key !== this.key || !this.layer) {
      this.key = key
      this.canvas.width = Math.round(w * dpr)
      this.canvas.height = Math.round(h * dpr)
      this.canvas.style.width = `${w}px`
      this.canvas.style.height = `${h}px`
      const layer = document.createElement('canvas')
      layer.width = Math.ceil(CITY_FRAME.width * scale * dpr)
      layer.height = Math.ceil(CITY_FRAME.depth * scale * dpr)
      drawCity(layer.getContext('2d')!, CITY_FRAME, scale * dpr)
      this.layer = layer
    }
    return { dpr, scale, ox, oy }
  }

  update(world: World, yaw: number, show: boolean): void {
    this.root.hidden = !show
    if (!show) return
    const { dpr, scale, ox, oy } = this.layout()
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(this.layer!, ox, oy, CITY_FRAME.width * scale, CITY_FRAME.depth * scale)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgb(255 255 255 / 0.6)'
    ctx.strokeRect(ox, oy, CITY_FRAME.width * scale, CITY_FRAME.depth * scale)

    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(scale, scale)
    ctx.translate(-CITY_FRAME.minX, -CITY_FRAME.minZ)
    const px = 1 / scale
    ctx.beginPath()
    CITY.route.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.z) : ctx.lineTo(pt.x, pt.z)))
    ctx.setLineDash([6 * px, 5 * px])
    ctx.lineWidth = 3 * px
    ctx.strokeStyle = MAP_COLORS.routeDone
    ctx.stroke()
    traceRouteAhead(ctx, world, 0, 0)
    ctx.strokeStyle = MAP_COLORS.route
    ctx.stroke()
    ctx.setLineDash([])
    drawBoss(ctx, world, 0, 0, 7 * px, 2 * px)
    drawTeam(ctx, world, 0, 0, 5 * px, 2 * px)
    ctx.restore()

    const toScreen = (x: number, z: number) => ({
      x: ox + (x - CITY_FRAME.minX) * scale,
      y: oy + (z - CITY_FRAME.minZ) * scale,
    })
    const a = CITY.airport
    const plane = toScreen(a.plane.x, a.plane.z)
    drawPlaneIcon(ctx, plane.x, plane.y, Math.PI - a.plane.angle, 14)
    const label = toScreen(a.area.x, a.area.z - a.area.hd)
    ctx.font = '700 16px ui-monospace, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgb(0 0 0 / 0.85)'
    ctx.strokeText('SÂN BAY', label.x, label.y - 6)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('SÂN BAY', label.x, label.y - 6)

    const p = world.player
    const me = toScreen(p.x, p.z)
    drawArrow(ctx, me.x, me.y, northUpHeading(yaw), 10)
  }

  dispose(): void {
    this.root.remove()
  }
}
