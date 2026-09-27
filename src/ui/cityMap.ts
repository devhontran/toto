import { CITY } from '../level/city'
import type { Box } from '../systems/collision'
import type { Vec2 } from '../lib/math2'
import type { MapFrame } from './mapMath'
import type { World } from '../game/World'
import { BOT_COLORS } from '../entities/Bot'

const MARGIN = 24

export const MAP_COLORS = {
  ground: '#4d5a45',
  outside: '#20241f',
  street: '#34353a',
  building: '#c4c4bc',
  buildingEdge: '#8e8e86',
  park: '#5f9a3e',
  airport: '#6d7166',
  airportEdge: '#e8e8e0',
  runway: '#23242a',
  runwayMark: '#f2f2f2',
  tower: '#9fb4c8',
  route: '#ffd23f',
  routeDone: 'rgb(255 210 63 / 0.25)',
  player: '#ffffff',
  zombie: '#ff3b30',
  boss: '#ff1a1a',
  plane: '#ffffff',
  board: '#39ff88',
}

export const CITY_FRAME: MapFrame = {
  minX: CITY.bounds.x - CITY.bounds.hw - MARGIN,
  minZ: CITY.bounds.z - CITY.bounds.hd - MARGIN,
  width: CITY.bounds.hw * 2 + MARGIN * 2,
  depth: CITY.bounds.hd * 2 + MARGIN * 2,
}

function fillBox(ctx: CanvasRenderingContext2D, b: Box): void {
  ctx.fillRect(b.x - b.hw, b.z - b.hd, b.hw * 2, b.hd * 2)
}

export function drawCity(ctx: CanvasRenderingContext2D, frame: MapFrame, scale: number): void {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(-frame.minX, -frame.minZ)
  ctx.fillStyle = MAP_COLORS.outside
  ctx.fillRect(frame.minX, frame.minZ, frame.width, frame.depth)
  ctx.fillStyle = MAP_COLORS.ground
  fillBox(ctx, CITY.bounds)

  const a = CITY.airport
  ctx.fillStyle = MAP_COLORS.airport
  fillBox(ctx, a.area)
  ctx.fillStyle = MAP_COLORS.runway
  fillBox(ctx, a.runway)
  ctx.fillStyle = MAP_COLORS.runwayMark
  for (let x = a.runway.x - a.runway.hw + 4; x < a.runway.x + a.runway.hw - 4; x += 8) {
    ctx.fillRect(x, a.runway.z - 0.5, 4, 1)
  }

  ctx.fillStyle = MAP_COLORS.street
  for (const s of CITY.streets) fillBox(ctx, s)
  ctx.fillStyle = MAP_COLORS.park
  for (const p of CITY.parks) fillBox(ctx, p)

  const edge = 1.2 / scale
  for (const b of CITY.buildings) {
    ctx.fillStyle = MAP_COLORS.buildingEdge
    fillBox(ctx, b.box)
    ctx.fillStyle = MAP_COLORS.building
    ctx.fillRect(b.box.x - b.box.hw + edge, b.box.z - b.box.hd + edge, b.box.hw * 2 - edge * 2, b.box.hd * 2 - edge * 2)
  }
  ctx.fillStyle = MAP_COLORS.tower
  fillBox(ctx, a.tower)
  ctx.fillStyle = MAP_COLORS.airportEdge
  for (const f of a.fences) fillBox(ctx, { ...f, hw: Math.max(f.hw, edge), hd: Math.max(f.hd, edge) })
  ctx.beginPath()
  ctx.arc(a.boardZone.x, a.boardZone.z, a.boardZone.r, 0, Math.PI * 2)
  ctx.lineWidth = 2 / scale
  ctx.strokeStyle = MAP_COLORS.board
  ctx.stroke()
  ctx.restore()
}

export function traceRouteAhead(ctx: CanvasRenderingContext2D, world: World, ox: number, oz: number): void {
  const route: readonly Vec2[] = CITY.route
  const { point, segment } = world.progress
  ctx.beginPath()
  ctx.moveTo(point.x - ox, point.z - oz)
  for (let i = segment + 1; i < route.length; i++) ctx.lineTo(route[i].x - ox, route[i].z - oz)
}

export function drawTeam(ctx: CanvasRenderingContext2D, world: World, ox: number, oz: number, r: number, line: number): void {
  for (const b of world.bots) {
    ctx.beginPath()
    ctx.arc(b.x - ox, b.z - oz, r, 0, Math.PI * 2)
    const color = BOT_COLORS[b.slot] ?? '#ffffff'
    if (b.alive) {
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = line * 0.6
      ctx.strokeStyle = 'rgb(0 0 0 / 0.7)'
      ctx.stroke()
    } else {
      ctx.lineWidth = line
      ctx.strokeStyle = color
      ctx.stroke()
    }
  }
}

export function drawBoss(ctx: CanvasRenderingContext2D, world: World, ox: number, oz: number, r: number, line: number): void {
  const boss = world.boss
  if (!boss || !boss.alive) return
  ctx.beginPath()
  ctx.arc(boss.x - ox, boss.z - oz, r, 0, Math.PI * 2)
  ctx.fillStyle = MAP_COLORS.boss
  ctx.fill()
  ctx.lineWidth = line
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
}

export function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.7, size * 0.8)
  ctx.lineTo(0, size * 0.4)
  ctx.lineTo(-size * 0.7, size * 0.8)
  ctx.closePath()
  ctx.fillStyle = MAP_COLORS.player
  ctx.fill()
  ctx.lineWidth = size * 0.18
  ctx.strokeStyle = '#111'
  ctx.stroke()
  ctx.restore()
}

export function drawPlaneIcon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number): void {
  const u = size / 8
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = '#111'
  ctx.fillRect(-1.5 * u, -8 * u, 3 * u, 16 * u)
  ctx.fillRect(-8 * u, -2 * u, 16 * u, 4 * u)
  ctx.fillRect(-4 * u, 4 * u, 8 * u, 3 * u)
  ctx.fillStyle = MAP_COLORS.plane
  ctx.fillRect(-0.75 * u, -7 * u, 1.5 * u, 14 * u)
  ctx.fillRect(-7 * u, -1 * u, 14 * u, 2 * u)
  ctx.fillRect(-3 * u, 5 * u, 6 * u, 1.2 * u)
  ctx.restore()
}
