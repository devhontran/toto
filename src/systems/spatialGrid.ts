export class SpatialGrid<T extends { x: number; z: number }> {
  private readonly cells = new Map<number, T[]>()
  private readonly cellSize: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private key(cx: number, cz: number): number {
    return (cx + 32768) * 65536 + (cz + 32768)
  }

  clear(): void {
    this.cells.clear()
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.z / this.cellSize))
    let cell = this.cells.get(k)
    if (!cell) {
      cell = []
      this.cells.set(k, cell)
    }
    cell.push(item)
  }

  query(x: number, z: number, radius: number, out: T[]): T[] {
    out.length = 0
    const r2 = radius * radius
    const minX = Math.floor((x - radius) / this.cellSize)
    const maxX = Math.floor((x + radius) / this.cellSize)
    const minZ = Math.floor((z - radius) / this.cellSize)
    const maxZ = Math.floor((z + radius) / this.cellSize)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const cell = this.cells.get(this.key(cx, cz))
        if (!cell) continue
        for (const item of cell) {
          const dx = item.x - x
          const dz = item.z - z
          if (dx * dx + dz * dz <= r2) out.push(item)
        }
      }
    }
    return out
  }
}
