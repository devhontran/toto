import type { Box } from './collision'

export class WallGrid {
  readonly boxes: readonly Box[]
  private readonly cellSize: number
  private readonly cells = new Map<number, number[]>()
  private readonly seen = new Set<number>()

  constructor(boxes: readonly Box[], cellSize = 16) {
    this.boxes = boxes
    this.cellSize = cellSize
    boxes.forEach((b, i) => {
      const minX = Math.floor((b.x - b.hw) / cellSize)
      const maxX = Math.floor((b.x + b.hw) / cellSize)
      const minZ = Math.floor((b.z - b.hd) / cellSize)
      const maxZ = Math.floor((b.z + b.hd) / cellSize)
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const k = this.key(cx, cz)
          let cell = this.cells.get(k)
          if (!cell) {
            cell = []
            this.cells.set(k, cell)
          }
          cell.push(i)
        }
      }
    })
  }

  private key(cx: number, cz: number): number {
    return (cx + 32768) * 65536 + (cz + 32768)
  }

  queryRect(minX: number, minZ: number, maxX: number, maxZ: number, out: Box[]): Box[] {
    out.length = 0
    this.seen.clear()
    const cs = this.cellSize
    for (let cx = Math.floor(minX / cs); cx <= Math.floor(maxX / cs); cx++) {
      for (let cz = Math.floor(minZ / cs); cz <= Math.floor(maxZ / cs); cz++) {
        const cell = this.cells.get(this.key(cx, cz))
        if (!cell) continue
        for (const i of cell) {
          if (this.seen.has(i)) continue
          this.seen.add(i)
          const b = this.boxes[i]
          if (b.x + b.hw < minX || b.x - b.hw > maxX || b.z + b.hd < minZ || b.z - b.hd > maxZ) continue
          out.push(b)
        }
      }
    }
    return out
  }

  query(x: number, z: number, radius: number, out: Box[]): Box[] {
    return this.queryRect(x - radius, z - radius, x + radius, z + radius, out)
  }

  querySegment(x0: number, z0: number, x1: number, z1: number, pad: number, out: Box[]): Box[] {
    return this.queryRect(Math.min(x0, x1) - pad, Math.min(z0, z1) - pad, Math.max(x0, x1) + pad, Math.max(z0, z1) + pad, out)
  }
}
