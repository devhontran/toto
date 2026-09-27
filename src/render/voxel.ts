import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const SIZE = 16

export function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Paint = (x: number, y: number, color: number, alpha?: number) => void
type Draw = (paint: Paint, rng: () => number) => void

function pixelTexture(seed: number, draw: Draw): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(SIZE, SIZE)
  const paint: Paint = (x, y, color, alpha = 1) => {
    const i = ((y & 15) * SIZE + (x & 15)) * 4
    img.data[i] = (color >> 16) & 255
    img.data[i + 1] = (color >> 8) & 255
    img.data[i + 2] = color & 255
    img.data[i + 3] = Math.round(alpha * 255)
  }
  draw(paint, lcg(seed))
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestMipmapNearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

function pick(rng: () => number, palette: number[]): number {
  return palette[Math.floor(rng() * palette.length)]
}

const GRASS = [0x4f8a31, 0x5d9b3a, 0x66a63f, 0x477f2c, 0x72b048, 0x58933a]
const DIRT = [0x79553a, 0x8b6443, 0x6b4a31, 0x966c4a, 0x5c3f29, 0x80593c]
const OAK = [0xb8945f, 0xa2824e, 0x9c7b48, 0xaf8c55, 0x9a7846]
const OAK_SEAM = 0x6b5231
const BARK = [0x6b5231, 0x5a4428, 0x4a3820, 0x735a38, 0x524025]
const DARK_OAK = [0x4a3219, 0x3f2a14, 0x553a1e, 0x45301a]
const DARK_OAK_SEAM = 0x2a1b0b
const STONE = [0x8a8a8a, 0x7a7a7a, 0x9e9e9e, 0x6f6f6f, 0x858585]
const LEAVES = [0x3f7a2a, 0x4b8c32, 0x356b23, 0x58a03c, 0x2d5c1d]
const GRAVEL = [0x8a8380, 0x7a7472, 0x9d9795, 0x6b6563, 0xa8a2a0, 0x5d5856]

function drawDirt(paint: Paint, rng: () => number): void {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) paint(x, y, rng() < 0.05 ? 0x8f8f8f : pick(rng, DIRT))
}

function drawPlanks(paint: Paint, rng: () => number, palette: number[], seam: number): void {
  for (let row = 0; row < 4; row++) {
    const cut = Math.floor(rng() * SIZE)
    const tone = pick(rng, palette)
    for (let y = row * 4; y < row * 4 + 4; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (y === row * 4 + 3 || (x === cut && y !== row * 4 + 3)) paint(x, y, seam)
        else paint(x, y, rng() < 0.3 ? pick(rng, palette) : tone)
      }
    }
  }
}

export function makeTextures() {
  const grassTop = pixelTexture(11, (paint, rng) => {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) paint(x, y, pick(rng, GRASS))
  })
  const grassSide = pixelTexture(12, (paint, rng) => {
    drawDirt(paint, rng)
    for (let x = 0; x < SIZE; x++) {
      const depth = 3 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.2 ? 1 : 0)
      for (let y = 0; y < depth; y++) paint(x, y, pick(rng, GRASS))
    }
  })
  const dirt = pixelTexture(13, drawDirt)
  const planks = pixelTexture(14, (paint, rng) => drawPlanks(paint, rng, OAK, OAK_SEAM))
  const darkPlanks = pixelTexture(15, (paint, rng) => drawPlanks(paint, rng, DARK_OAK, DARK_OAK_SEAM))
  const logSide = pixelTexture(16, (paint, rng) => {
    for (let x = 0; x < SIZE; x++) {
      const base = pick(rng, BARK)
      for (let y = 0; y < SIZE; y++) paint(x, y, rng() < 0.35 ? pick(rng, BARK) : base)
    }
  })
  const logTop = pixelTexture(17, (paint, rng) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
        if (d > 7) paint(x, y, pick(rng, BARK))
        else paint(x, y, Math.floor(d) % 2 === 0 ? 0xb89660 : 0x9c7b48)
      }
    }
  })
  const cobble = pixelTexture(18, (paint, rng) => {
    const seeds = Array.from({ length: 11 }, () => ({ x: rng() * SIZE, y: rng() * SIZE, c: pick(rng, STONE) }))
    const owner = (x: number, y: number) => {
      let best = 0
      let bestD = Infinity
      seeds.forEach((s, i) => {
        const dx = Math.min(Math.abs(x - s.x), SIZE - Math.abs(x - s.x))
        const dy = Math.min(Math.abs(y - s.y), SIZE - Math.abs(y - s.y))
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      return best
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const o = owner(x + 0.5, y + 0.5)
        const edge = owner(x + 1.5, y + 0.5) !== o || owner(x + 0.5, y + 1.5) !== o
        paint(x, y, edge ? (rng() < 0.5 ? 0x4a4a4a : 0x565656) : rng() < 0.25 ? pick(rng, STONE) : seeds[o].c)
      }
    }
  })
  const glass = pixelTexture(19, (paint, rng) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const frame = x === 0 || y === 0 || x === 15 || y === 15
        const streak = (x + y === 10 || x + y === 11 || x + y === 20) && x > 2 && x < 13
        if (frame) paint(x, y, rng() < 0.3 ? 0xa9cbd2 : 0xdbeef2)
        else if (streak) paint(x, y, 0xf4fbfc, 0.75)
        else paint(x, y, 0xc6e4ec, 0.16)
      }
    }
  })
  const leaves = pixelTexture(20, (paint, rng) => {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) paint(x, y, pick(rng, LEAVES), rng() < 0.1 ? 0 : 1)
  })
  const gravel = pixelTexture(21, (paint, rng) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = pick(rng, GRAVEL)
        paint(x, y, c)
        if (rng() < 0.2) paint(x + 1, y, c)
      }
    }
  })
  const torch = pixelTexture(22, (paint) => {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) paint(x, y, 0, 0)
    for (let y = 8; y < SIZE; y++) {
      paint(7, y, 0x8a6a3f)
      paint(8, y, 0x6b5231)
    }
    paint(7, 6, 0xfff5b0)
    paint(8, 6, 0xffe066)
    paint(7, 7, 0xffcc33)
    paint(8, 7, 0xff9a1f)
  })
  const poppy = flowerTexture(23, 0xd82b1f, 0x9e1a12, 0x2b2b12)
  const dandelion = flowerTexture(24, 0xf7d82c, 0xd9a91a, 0xf7e98a)
  return { grassTop, grassSide, dirt, planks, darkPlanks, logSide, logTop, cobble, glass, leaves, gravel, torch, poppy, dandelion }
}

function flowerTexture(seed: number, petal: number, shade: number, core: number): THREE.CanvasTexture {
  const stem = [0x3f7a2a, 0x2d5c1d]
  return pixelTexture(seed, (paint) => {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) paint(x, y, 0, 0)
    for (let y = 9; y < SIZE; y++) paint(7, y, stem[y % 2])
    paint(6, 12, stem[0])
    paint(5, 11, stem[1])
    paint(8, 13, stem[0])
    paint(9, 12, stem[1])
    for (let y = 5; y < 9; y++) for (let x = 6; x < 10; x++) paint(x, y, (x + y) % 3 === 0 ? shade : petal)
    paint(7, 4, petal)
    paint(8, 4, shade)
    paint(5, 6, petal)
    paint(10, 7, shade)
    paint(7, 6, core)
    paint(8, 7, core)
  })
}

export type Textures = ReturnType<typeof makeTextures>

function planarUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 0.5
    const y = pos.getY(i) + 0.5
    const z = pos.getZ(i) + 0.5
    const nx = nor.getX(i)
    const ny = nor.getY(i)
    const nz = nor.getZ(i)
    if (Math.abs(nx) > 0.5) uv.setXY(i, nx > 0 ? 1 - z : z, y)
    else if (Math.abs(ny) > 0.5) uv.setXY(i, x, ny > 0 ? 1 - z : z)
    else uv.setXY(i, nz > 0 ? x : 1 - x, y)
  }
  return geo
}

function part(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return planarUV(new THREE.BoxGeometry(w, h, d).translate(x, y, z))
}

function cappedBox(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const idx = Array.from(geo.index!.array)
  const face = (f: number) => idx.slice(f * 6, f * 6 + 6)
  geo.setIndex([0, 1, 4, 5, 2, 3].flatMap(face))
  geo.clearGroups()
  geo.addGroup(0, 24, 0)
  geo.addGroup(24, 12, 1)
  return geo
}

function stairGeometry(): THREE.BufferGeometry {
  return mergeGeometries([part(1, 0.5, 1, 0, -0.25, 0), part(1, 0.5, 0.5, 0, 0.25, -0.25)])
}

function slabGeometry(height: number): THREE.BufferGeometry {
  return part(1, height, 1, 0, height / 2 - 0.5, 0)
}

function paneGeometry(): THREE.BufferGeometry {
  return part(1, 1, 0.125, 0, 0, 0)
}

function torchGeometry(): THREE.BufferGeometry {
  return part(0.125, 0.625, 0.125, 0, -0.1875, 0)
}

function crossGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 4)
  const b = new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 4)
  return mergeGeometries([a, b])
}

export type BlockType =
  | 'cobble'
  | 'planks'
  | 'darkPlanks'
  | 'log'
  | 'glass'
  | 'stairs'
  | 'leaves'
  | 'torch'
  | 'grass'
  | 'poppy'
  | 'dandelion'
  | 'path'

export interface Rotation {
  x?: number
  y?: number
  z?: number
}

const PATH_HEIGHT = 0.0625

function lambert(map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map, ...extra })
}

function blockDefs(tex: Textures): Record<BlockType, () => [THREE.BufferGeometry, THREE.Material | THREE.Material[]]> {
  const flower = { alphaTest: 0.5, side: THREE.DoubleSide }
  return {
    cobble: () => [new THREE.BoxGeometry(1, 1, 1), lambert(tex.cobble)],
    planks: () => [new THREE.BoxGeometry(1, 1, 1), lambert(tex.planks)],
    darkPlanks: () => [new THREE.BoxGeometry(1, 1, 1), lambert(tex.darkPlanks)],
    log: () => [cappedBox(), [lambert(tex.logSide), lambert(tex.logTop)]],
    glass: () => [paneGeometry(), lambert(tex.glass, { transparent: true, depthWrite: false })],
    stairs: () => [stairGeometry(), lambert(tex.darkPlanks)],
    leaves: () => [new THREE.BoxGeometry(1, 1, 1), lambert(tex.leaves, { alphaTest: 0.5 })],
    torch: () => [torchGeometry(), new THREE.MeshBasicMaterial({ map: tex.torch, alphaTest: 0.5 })],
    grass: () => [cappedBox(), [lambert(tex.grassSide), lambert(tex.grassTop)]],
    poppy: () => [crossGeometry(), lambert(tex.poppy, flower)],
    dandelion: () => [crossGeometry(), lambert(tex.dandelion, flower)],
    path: () => [slabGeometry(PATH_HEIGHT), lambert(tex.dirt)],
  }
}

export class VoxelBatcher {
  readonly textures = makeTextures()
  private readonly matrices = new Map<BlockType, THREE.Matrix4[]>()
  private readonly dummy = new THREE.Object3D()

  addAt(type: BlockType, x: number, y: number, z: number, rot: Rotation = {}): void {
    this.dummy.position.set(x, y, z)
    this.dummy.rotation.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0)
    this.dummy.updateMatrix()
    let list = this.matrices.get(type)
    if (!list) {
      list = []
      this.matrices.set(type, list)
    }
    list.push(this.dummy.matrix.clone())
  }

  addBlock(type: BlockType, x: number, y: number, z: number, rot: Rotation = {}): void {
    this.addAt(type, x + 0.5, y + 0.5, z + 0.5, rot)
  }

  build(): THREE.Group {
    const group = new THREE.Group()
    const defs = blockDefs(this.textures)
    for (const [type, list] of this.matrices) {
      const [geometry, material] = defs[type]()
      const mesh = new THREE.InstancedMesh(geometry, material, list.length)
      list.forEach((m, i) => mesh.setMatrixAt(i, m))
      mesh.computeBoundingSphere()
      mesh.name = type
      group.add(mesh)
    }
    return group
  }
}
