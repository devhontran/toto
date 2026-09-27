# Zombie Escape — Milestone 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable top-down slice: player walks the town road with WASD, aims with the mouse, shoots zombies that spawn ahead and chase/attack, collides with houses and map bounds, sees HP/ammo in a HUD, and gets a win/lose screen.

**Architecture:** Pure-logic simulation (`World` + systems + entities, no Three.js imports) stepped at a fixed 60 Hz, fully unit-tested with Vitest. A thin render layer (`SceneView`) mirrors world state into Three.js each frame (instanced capsules for zombies, primitives for everything else). `Game` owns the loop: input → fixed steps → view sync → camera → HUD → render.

**Tech Stack:** Vite 8, TypeScript 6, Three.js 0.186, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-27-zombie-escape-design.md` (this plan = spec §6 milestone 1). Deviations from spec §2 file list: weapon data lives in `systems/weapons.ts` (split from `combat.ts`); render code lives in `src/render/SceneView.ts`; helpers in `src/lib/math2.ts` and `src/game/fixedStep.ts`. Bots, houses-with-interiors, vehicles, pickups, A* are later milestones — not here.

## Global Constraints

- Package manager: `pnpm`. Dev server: `pnpm dev` on port 3016 (already configured in `vite.config.ts`, `strictPort`).
- TypeScript: `strict: true` (added in Task 1). `erasableSyntaxOnly` is on → NO constructor parameter properties (`constructor(private x)`), NO `enum`. `verbatimModuleSyntax` is on → type-only imports MUST use `import type` / inline `type`.
- Logic files (`src/lib`, `src/systems`, `src/entities`, `src/ai`, `src/level`, `src/game/World.ts`, `src/game/fixedStep.ts`, `src/game/Input.ts` state class) MUST NOT import `three`.
- Coordinates: ground plane is XZ. Road runs toward **−Z**. Angle convention: `angle` 0 faces +Z; direction = `(sin(angle), cos(angle))`; Three.js `rotation.y = angle`.
- Numbers from spec: player 100 HP, speed 5 m/s; pistol 25 dmg / 4 per s / mag 12 / infinite reserve; shotgun 6×15 / 1 per s / mag 6 / ±15°; rifle 20 / 10 per s / mag 30; range 20 m; reload 1.5 s; walker 60 HP 2 m/s; runner 30 HP 5 m/s; zombie hit 10 dmg, 1 s cooldown, 1 m reach; hearing 25 m.
- NO explanatory code comments. Only a comment for a constraint the code cannot show.
- Commits: NO `Co-Authored-By` trailer or any AI attribution line.
- Tests colocated as `src/**/<name>.test.ts`. Run all: `pnpm test`.

## Review Focus

1. Two entities at the exact same position (spawned on top of each other) → collision separates them with finite numbers, never NaN. Pinned in Task 1.
2. Mouse aim point exactly on the player → facing angle keeps its previous value, never NaN. Pinned in Task 7.
3. Window loses focus while a key or mouse button is held → no stuck movement or endless firing after refocus. Pinned in Task 8.
4. A long frame hitch (tab backgrounded for seconds) → simulation runs a bounded number of steps, no freeze/spiral. Pinned in Task 7.
5. Pulling the trigger with an empty magazine and zero reserve → no crash, ammo never negative, weapon does not get stuck "reloading". Pinned in Task 3.

---

### Task 1: Tooling, math helpers, 2D collision

**Files:**
- Modify: `tsconfig.json`, `package.json`
- Create: `src/lib/math2.ts`, `src/systems/collision.ts`
- Test: `src/systems/collision.test.ts`

**Interfaces:**
- Produces:
  - `math2.ts`: `interface Vec2 { x: number; z: number }`, `normalize(x, z): Vec2`, `dirFromAngle(a): Vec2`, `angleOf(x, z): number`, `clamp(v, min, max): number`
  - `collision.ts`: `interface Circle { x; z; r }`, `interface Box { x; z; hw; hd }` (axis-aligned, half-width on X, half-depth on Z), `resolveCircleCircle(a: Circle, b: Circle, aShare = 0.5): boolean`, `resolveCircleBox(c: Circle, b: Box): boolean`, `overlapsCircleBox(c: Circle, b: Box): boolean`, `rayCircle(ox, oz, dx, dz, c: Circle): number | null`, `rayBox(ox, oz, dx, dz, b: Box): number | null` (ray fns take a normalized direction; return distance along ray, `0` if origin is inside)

- [ ] **Step 1: Install Vitest, enable strict, add test script**

```bash
pnpm add -D vitest
```

In `tsconfig.json`, add `"strict": true,` as the first entry under the `/* Linting */` block.
In `package.json` `scripts`, add `"test": "vitest run"`.

- [ ] **Step 2: Write `src/lib/math2.ts`**

```ts
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
```

- [ ] **Step 3: Write the failing test `src/systems/collision.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  resolveCircleCircle,
  resolveCircleBox,
  overlapsCircleBox,
  rayCircle,
  rayBox,
} from './collision'

describe('resolveCircleCircle', () => {
  it('separates overlapping circles evenly', () => {
    const a = { x: 0, z: 0, r: 0.5 }
    const b = { x: 0.6, z: 0, r: 0.5 }
    expect(resolveCircleCircle(a, b)).toBe(true)
    expect(b.x - a.x).toBeCloseTo(1)
    expect(a.x).toBeCloseTo(-0.2)
  })

  it('leaves separated circles alone', () => {
    const a = { x: 0, z: 0, r: 0.5 }
    const b = { x: 2, z: 0, r: 0.5 }
    expect(resolveCircleCircle(a, b)).toBe(false)
    expect(a.x).toBe(0)
    expect(b.x).toBe(2)
  })

  it('moves only b when aShare is 0', () => {
    const a = { x: 0, z: 0, r: 0.5 }
    const b = { x: 0.6, z: 0, r: 0.5 }
    resolveCircleCircle(a, b, 0)
    expect(a.x).toBe(0)
    expect(b.x).toBeCloseTo(1)
  })

  it('separates coincident circles without NaN', () => {
    const a = { x: 1, z: 1, r: 0.5 }
    const b = { x: 1, z: 1, r: 0.5 }
    resolveCircleCircle(a, b)
    for (const v of [a.x, a.z, b.x, b.z]) expect(Number.isFinite(v)).toBe(true)
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1)
  })
})

describe('resolveCircleBox', () => {
  const box = { x: 0, z: 0, hw: 1, hd: 1 }

  it('pushes a circle out through the nearest edge', () => {
    const c = { x: 1.2, z: 0, r: 0.5 }
    expect(resolveCircleBox(c, box)).toBe(true)
    expect(c.x).toBeCloseTo(1.5)
    expect(c.z).toBeCloseTo(0)
  })

  it('pushes out a circle whose center is inside the box', () => {
    const c = { x: 0.8, z: 0, r: 0.5 }
    expect(resolveCircleBox(c, box)).toBe(true)
    expect(c.x).toBeCloseTo(1.5)
  })

  it('pushes a circle off a corner to exactly its radius', () => {
    const c = { x: 1.3, z: 1.3, r: 0.5 }
    resolveCircleBox(c, box)
    expect(Math.hypot(c.x - 1, c.z - 1)).toBeCloseTo(0.5)
  })

  it('leaves an outside circle alone', () => {
    const c = { x: 3, z: 0, r: 0.5 }
    expect(resolveCircleBox(c, box)).toBe(false)
    expect(c.x).toBe(3)
  })
})

describe('overlapsCircleBox', () => {
  const box = { x: 0, z: 0, hw: 1, hd: 1 }
  it('detects overlap without mutating', () => {
    const c = { x: 1.2, z: 0, r: 0.5 }
    expect(overlapsCircleBox(c, box)).toBe(true)
    expect(c.x).toBe(1.2)
  })
  it('reports no overlap when apart', () => {
    expect(overlapsCircleBox({ x: 3, z: 0, r: 0.5 }, box)).toBe(false)
  })
})

describe('rayCircle', () => {
  it('returns distance to the near surface', () => {
    expect(rayCircle(0, 0, 0, -1, { x: 0, z: -5, r: 0.5 })).toBeCloseTo(4.5)
  })
  it('misses a circle off to the side', () => {
    expect(rayCircle(0, 0, 0, -1, { x: 3, z: -5, r: 0.5 })).toBeNull()
  })
  it('ignores a circle behind the origin', () => {
    expect(rayCircle(0, 0, 0, -1, { x: 0, z: 5, r: 0.5 })).toBeNull()
  })
  it('returns 0 when the origin is inside', () => {
    expect(rayCircle(0, 0, 1, 0, { x: 0.1, z: 0, r: 0.5 })).toBe(0)
  })
})

describe('rayBox', () => {
  const box = { x: 5, z: 0, hw: 1, hd: 1 }
  it('returns distance to the near face', () => {
    expect(rayBox(0, 0, 1, 0, box)).toBeCloseTo(4)
  })
  it('misses a box off to the side', () => {
    expect(rayBox(0, 0, 1, 0, { x: 5, z: 3, hw: 1, hd: 1 })).toBeNull()
  })
  it('misses when parallel and outside the slab', () => {
    expect(rayBox(0, 0, 0, -1, box)).toBeNull()
  })
  it('ignores a box behind the origin', () => {
    expect(rayBox(0, 0, -1, 0, box)).toBeNull()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test src/systems/collision.test.ts`
Expected: FAIL — cannot resolve `./collision`.

- [ ] **Step 5: Write `src/systems/collision.ts`**

```ts
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
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm test src/systems/collision.test.ts && pnpm exec tsc`
Expected: all PASS, tsc exits 0. (If `strict` surfaces errors in `src/game/Game.ts`/`src/main.ts`, fix them minimally — both files are rewritten in Task 8.)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json src/lib src/systems
git commit -m "feat: add vitest, 2D math and collision primitives"
```

---

### Task 2: Spatial hash grid

**Files:**
- Create: `src/systems/spatialGrid.ts`
- Test: `src/systems/spatialGrid.test.ts`

**Interfaces:**
- Produces: `class SpatialGrid<T extends { x: number; z: number }>` with `constructor(cellSize: number)`, `clear(): void`, `insert(item: T): void`, `query(x: number, z: number, radius: number, out: T[]): T[]` (clears `out`, fills it with items whose center is within `radius`, returns `out`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { SpatialGrid } from './spatialGrid'

type P = { x: number; z: number; id: number }

describe('SpatialGrid', () => {
  it('returns only items within radius, across cells and negative coords', () => {
    const g = new SpatialGrid<P>(4)
    const items: P[] = [
      { x: 0, z: 0, id: 1 },
      { x: 2.5, z: 0, id: 2 },
      { x: -3.9, z: -0.5, id: 3 },
      { x: 10, z: 10, id: 4 },
      { x: 0, z: -20, id: 5 },
    ]
    items.forEach((i) => g.insert(i))
    const out = g.query(0, 0, 4, [])
    expect(out.map((i) => i.id).sort()).toEqual([1, 2, 3])
  })

  it('clears the output array before filling', () => {
    const g = new SpatialGrid<P>(4)
    g.insert({ x: 0, z: 0, id: 1 })
    const out: P[] = [{ x: 99, z: 99, id: 99 }]
    g.query(0, 0, 1, out)
    expect(out.map((i) => i.id)).toEqual([1])
  })

  it('is empty after clear', () => {
    const g = new SpatialGrid<P>(4)
    g.insert({ x: 0, z: 0, id: 1 })
    g.clear()
    expect(g.query(0, 0, 10, [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/systems/spatialGrid.test.ts`
Expected: FAIL — cannot resolve `./spatialGrid`.

- [ ] **Step 3: Implement `src/systems/spatialGrid.ts`**

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/systems/spatialGrid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/spatialGrid.ts src/systems/spatialGrid.test.ts
git commit -m "feat: add spatial hash grid"
```

---

### Task 3: Weapons

**Files:**
- Create: `src/systems/weapons.ts`
- Test: `src/systems/weapons.test.ts`

**Interfaces:**
- Produces:
  - `type WeaponId = 'pistol' | 'shotgun' | 'rifle'`
  - `interface WeaponDef { id: WeaponId; name: string; damage: number; pellets: number; spread: number; fireRate: number; magSize: number; reloadTime: number; range: number; infiniteReserve: boolean; knockback: number }` (`spread` = max half-angle in radians)
  - `const WEAPONS: Record<WeaponId, WeaponDef>`
  - `class WeaponState` — `constructor(def: WeaponDef, reserve = 0)`; fields `def`, `mag`, `reserve`, `cooldown`, `reloadLeft`; getter `reloading: boolean`; methods `update(dt): void`, `startReload(): boolean`, `cancelReload(): void`, `tryFire(): boolean`
  - `pelletAngles(def: WeaponDef, rng: () => number): number[]` — angle offsets (radians) per pellet

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { WEAPONS, WeaponState, pelletAngles } from './weapons'

describe('WeaponState', () => {
  it('fires, consumes a round and respects fire rate', () => {
    const w = new WeaponState(WEAPONS.pistol)
    expect(w.tryFire()).toBe(true)
    expect(w.mag).toBe(11)
    expect(w.tryFire()).toBe(false)
    w.update(0.25)
    expect(w.tryFire()).toBe(true)
  })

  it('auto-reloads an empty pistol from infinite reserve', () => {
    const w = new WeaponState(WEAPONS.pistol)
    w.mag = 0
    expect(w.tryFire()).toBe(false)
    expect(w.reloading).toBe(true)
    w.update(1.5)
    expect(w.reloading).toBe(false)
    expect(w.mag).toBe(12)
  })

  it('reloads a rifle from limited reserve', () => {
    const w = new WeaponState(WEAPONS.rifle, 10)
    w.mag = 0
    expect(w.startReload()).toBe(true)
    w.update(1.5)
    expect(w.mag).toBe(10)
    expect(w.reserve).toBe(0)
  })

  it('does not reload a full magazine', () => {
    expect(new WeaponState(WEAPONS.pistol).startReload()).toBe(false)
  })

  it('cannot fire while reloading', () => {
    const w = new WeaponState(WEAPONS.pistol)
    w.mag = 5
    w.startReload()
    expect(w.tryFire()).toBe(false)
  })

  it('handles an empty magazine with zero reserve without getting stuck', () => {
    const w = new WeaponState(WEAPONS.rifle, 0)
    w.mag = 0
    expect(w.tryFire()).toBe(false)
    expect(w.reloading).toBe(false)
    expect(w.startReload()).toBe(false)
    w.update(5)
    expect(w.mag).toBe(0)
    expect(w.reserve).toBe(0)
  })

  it('cancelReload stops a reload in progress', () => {
    const w = new WeaponState(WEAPONS.pistol)
    w.mag = 3
    w.startReload()
    w.cancelReload()
    expect(w.reloading).toBe(false)
    w.update(2)
    expect(w.mag).toBe(3)
  })
})

describe('pelletAngles', () => {
  it('returns one centered angle for the pistol with a neutral rng', () => {
    expect(pelletAngles(WEAPONS.pistol, () => 0.5)).toEqual([0])
  })

  it('spreads six shotgun pellets across the cone', () => {
    const a = pelletAngles(WEAPONS.shotgun, () => 0.5)
    expect(a).toHaveLength(6)
    expect(a[0]).toBeCloseTo(-WEAPONS.shotgun.spread)
    expect(a[5]).toBeCloseTo(WEAPONS.shotgun.spread)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/systems/weapons.test.ts`
Expected: FAIL — cannot resolve `./weapons`.

- [ ] **Step 3: Implement `src/systems/weapons.ts`**

```ts
export type WeaponId = 'pistol' | 'shotgun' | 'rifle'

export interface WeaponDef {
  id: WeaponId
  name: string
  damage: number
  pellets: number
  spread: number
  fireRate: number
  magSize: number
  reloadTime: number
  range: number
  infiniteReserve: boolean
  knockback: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'Súng lục',
    damage: 25,
    pellets: 1,
    spread: 0.03,
    fireRate: 4,
    magSize: 12,
    reloadTime: 1.5,
    range: 20,
    infiniteReserve: true,
    knockback: 0.3,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 15,
    pellets: 6,
    spread: (15 * Math.PI) / 180,
    fireRate: 1,
    magSize: 6,
    reloadTime: 1.5,
    range: 20,
    infiniteReserve: false,
    knockback: 1.5,
  },
  rifle: {
    id: 'rifle',
    name: 'Súng trường',
    damage: 20,
    pellets: 1,
    spread: 0.04,
    fireRate: 10,
    magSize: 30,
    reloadTime: 1.5,
    range: 20,
    infiniteReserve: false,
    knockback: 0.2,
  },
}

export class WeaponState {
  readonly def: WeaponDef
  mag: number
  reserve: number
  cooldown = 0
  reloadLeft = 0

  constructor(def: WeaponDef, reserve = 0) {
    this.def = def
    this.mag = def.magSize
    this.reserve = reserve
  }

  get reloading(): boolean {
    return this.reloadLeft > 0
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0
        this.finishReload()
      }
    }
  }

  private finishReload(): void {
    const need = this.def.magSize - this.mag
    const take = this.def.infiniteReserve ? need : Math.min(need, this.reserve)
    this.mag += take
    if (!this.def.infiniteReserve) this.reserve -= take
  }

  startReload(): boolean {
    if (this.reloading || this.mag === this.def.magSize) return false
    if (!this.def.infiniteReserve && this.reserve === 0) return false
    this.reloadLeft = this.def.reloadTime
    return true
  }

  cancelReload(): void {
    this.reloadLeft = 0
  }

  tryFire(): boolean {
    if (this.reloading || this.cooldown > 0) return false
    if (this.mag === 0) {
      this.startReload()
      return false
    }
    this.mag--
    this.cooldown = 1 / this.def.fireRate
    return true
  }
}

export function pelletAngles(def: WeaponDef, rng: () => number): number[] {
  if (def.pellets === 1) return [(rng() * 2 - 1) * def.spread]
  const out: number[] = []
  for (let i = 0; i < def.pellets; i++) {
    const base = -def.spread + (2 * def.spread * i) / (def.pellets - 1)
    out.push(base + (rng() * 2 - 1) * def.spread * 0.1)
  }
  return out
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/systems/weapons.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/weapons.ts src/systems/weapons.test.ts
git commit -m "feat: add weapon definitions and ammo/reload state"
```

---

### Task 4: Hitscan combat

**Files:**
- Create: `src/systems/combat.ts`
- Test: `src/systems/combat.test.ts`

**Interfaces:**
- Consumes: `Circle`, `Box`, `rayCircle`, `rayBox` from `./collision`
- Produces:
  - `interface Hittable extends Circle { hp: number; alive: boolean }`
  - `castShot<T extends Hittable>(ox, oz, dx, dz, range, targets: readonly T[], walls: readonly Box[]): { target: T | null; dist: number }` — nearest alive target before any wall within range; `dist` = hit distance, wall distance, or `range`
  - `applyDamage(t: { hp: number; alive: boolean }, dmg: number): boolean` — returns `true` only on the killing blow

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { castShot, applyDamage } from './combat'

const mk = (x: number, z: number) => ({ x, z, r: 0.4, hp: 60, alive: true })

describe('castShot', () => {
  it('hits the nearest target in line', () => {
    const near = mk(0, -5)
    const far = mk(0, -10)
    const res = castShot(0, 0, 0, -1, 20, [far, near], [])
    expect(res.target).toBe(near)
    expect(res.dist).toBeCloseTo(4.6)
  })

  it('is blocked by a wall in front of the target', () => {
    const t = mk(0, -10)
    const res = castShot(0, 0, 0, -1, 20, [t], [{ x: 0, z: -5, hw: 2, hd: 0.5 }])
    expect(res.target).toBeNull()
    expect(res.dist).toBeCloseTo(4.5)
  })

  it('ignores dead targets', () => {
    const dead = { ...mk(0, -5), alive: false }
    const alive = mk(0, -8)
    expect(castShot(0, 0, 0, -1, 20, [dead, alive], []).target).toBe(alive)
  })

  it('misses targets beyond range', () => {
    const res = castShot(0, 0, 0, -1, 20, [mk(0, -30)], [])
    expect(res.target).toBeNull()
    expect(res.dist).toBe(20)
  })
})

describe('applyDamage', () => {
  it('reports the killing blow exactly once', () => {
    const t = mk(0, 0)
    expect(applyDamage(t, 25)).toBe(false)
    expect(t.hp).toBe(35)
    expect(applyDamage(t, 50)).toBe(true)
    expect(t.hp).toBe(0)
    expect(t.alive).toBe(false)
    expect(applyDamage(t, 50)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/systems/combat.test.ts`
Expected: FAIL — cannot resolve `./combat`.

- [ ] **Step 3: Implement `src/systems/combat.ts`**

```ts
import { rayBox, rayCircle, type Box, type Circle } from './collision'

export interface Hittable extends Circle {
  hp: number
  alive: boolean
}

export function castShot<T extends Hittable>(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  range: number,
  targets: readonly T[],
  walls: readonly Box[],
): { target: T | null; dist: number } {
  let best = range
  for (const w of walls) {
    const t = rayBox(ox, oz, dx, dz, w)
    if (t !== null && t < best) best = t
  }
  let target: T | null = null
  for (const c of targets) {
    if (!c.alive) continue
    const t = rayCircle(ox, oz, dx, dz, c)
    if (t !== null && t < best) {
      best = t
      target = c
    }
  }
  return { target, dist: best }
}

export function applyDamage(t: { hp: number; alive: boolean }, dmg: number): boolean {
  if (!t.alive) return false
  t.hp -= dmg
  if (t.hp <= 0) {
    t.hp = 0
    t.alive = false
    return true
  }
  return false
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/systems/combat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/combat.ts src/systems/combat.test.ts
git commit -m "feat: add hitscan shot casting and damage"
```

---

### Task 5: Player, Zombie entities and zombie AI

**Files:**
- Create: `src/entities/Player.ts`, `src/entities/Zombie.ts`, `src/ai/zombieBrain.ts`
- Test: `src/ai/zombieBrain.test.ts`

**Interfaces:**
- Consumes: `WEAPONS`, `WeaponState` (Task 3); `angleOf`, `normalize`, `dirFromAngle` (Task 1)
- Produces:
  - `Player.ts`: `PLAYER_SPEED = 5`, `PLAYER_RADIUS = 0.4`, `PLAYER_MAX_HP = 100`; `class Player { x; z; r; angle (init Math.PI = facing −Z); hp; alive; weapons: WeaponState[] (starts [pistol]); current: number; get weapon(): WeaponState; switchTo(i: number): void }`
  - `Zombie.ts`: `type ZombieKind = 'walker' | 'runner'`, `type ZombieState = 'wander' | 'chase'`, `interface Zombie { id; kind; x; z; r; angle; hp; alive; speed; state; attackCooldown; wanderAngle; wanderTimer; hasAlert; alertX; alertZ; deadTime }`, constants `ZOMBIE_RADIUS = 0.4`, `ZOMBIE_SIGHT = 12`, `ZOMBIE_HEARING = 25`, `ZOMBIE_WANDER_FACTOR = 0.3`, `ZOMBIE_ATTACK = { damage: 10, cooldown: 1, range: 1 }`, `ZOMBIE_STATS`, `createZombie(id, kind, x, z): Zombie`
  - `zombieBrain.ts`: `interface Target { x; z; r; alive }`, `hearNoise(z: Zombie, nx: number, nz: number): void`, `updateZombie<T extends Target>(z: Zombie, targets: readonly T[], dt: number, rng: () => number): T | null` (returns the target it struck this step, else null; caller applies damage)

- [ ] **Step 1: Write `src/entities/Player.ts`**

```ts
import { WEAPONS, WeaponState } from '../systems/weapons'

export const PLAYER_SPEED = 5
export const PLAYER_RADIUS = 0.4
export const PLAYER_MAX_HP = 100

export class Player {
  x = 0
  z = 0
  r = PLAYER_RADIUS
  angle = Math.PI
  hp = PLAYER_MAX_HP
  alive = true
  weapons: WeaponState[] = [new WeaponState(WEAPONS.pistol)]
  current = 0

  get weapon(): WeaponState {
    return this.weapons[this.current]
  }

  switchTo(i: number): void {
    if (i === this.current || i < 0 || i >= this.weapons.length) return
    this.weapon.cancelReload()
    this.current = i
  }
}
```

- [ ] **Step 2: Write `src/entities/Zombie.ts`**

```ts
export type ZombieKind = 'walker' | 'runner'
export type ZombieState = 'wander' | 'chase'

export interface Zombie {
  id: number
  kind: ZombieKind
  x: number
  z: number
  r: number
  angle: number
  hp: number
  alive: boolean
  speed: number
  state: ZombieState
  attackCooldown: number
  wanderAngle: number
  wanderTimer: number
  hasAlert: boolean
  alertX: number
  alertZ: number
  deadTime: number
}

export const ZOMBIE_RADIUS = 0.4
export const ZOMBIE_SIGHT = 12
export const ZOMBIE_HEARING = 25
export const ZOMBIE_WANDER_FACTOR = 0.3
export const ZOMBIE_ATTACK = { damage: 10, cooldown: 1, range: 1 }
export const ZOMBIE_STATS: Record<ZombieKind, { hp: number; speed: number }> = {
  walker: { hp: 60, speed: 2 },
  runner: { hp: 30, speed: 5 },
}

export function createZombie(id: number, kind: ZombieKind, x: number, z: number): Zombie {
  const s = ZOMBIE_STATS[kind]
  return {
    id,
    kind,
    x,
    z,
    r: ZOMBIE_RADIUS,
    angle: 0,
    hp: s.hp,
    alive: true,
    speed: s.speed,
    state: 'wander',
    attackCooldown: 0,
    wanderAngle: 0,
    wanderTimer: 0,
    hasAlert: false,
    alertX: 0,
    alertZ: 0,
    deadTime: 0,
  }
}
```

- [ ] **Step 3: Write the failing test `src/ai/zombieBrain.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createZombie, ZOMBIE_ATTACK } from '../entities/Zombie'
import { hearNoise, updateZombie } from './zombieBrain'

const rng = () => 0.5
const target = (x: number, z: number) => ({ x, z, r: 0.4, alive: true })

describe('updateZombie', () => {
  it('chases a target within sight', () => {
    const z = createZombie(1, 'walker', 0, -10)
    updateZombie(z, [target(0, 0)], 0.1, rng)
    expect(z.state).toBe('chase')
    expect(z.z).toBeCloseTo(-9.8)
    expect(z.x).toBeCloseTo(0)
  })

  it('wanders slowly when the target is out of sight', () => {
    const z = createZombie(1, 'walker', 0, -20)
    updateZombie(z, [target(0, 0)], 0.1, rng)
    expect(z.state).toBe('wander')
    expect(Math.hypot(z.x, z.z + 20)).toBeLessThanOrEqual(2 * 0.3 * 0.1 + 1e-9)
  })

  it('ignores dead targets', () => {
    const z = createZombie(1, 'walker', 0, -5)
    updateZombie(z, [{ ...target(0, 0), alive: false }], 0.1, rng)
    expect(z.state).toBe('wander')
  })

  it('strikes a target in reach, then waits for cooldown', () => {
    const z = createZombie(1, 'walker', 0, -1.2)
    const t = target(0, 0)
    expect(updateZombie(z, [t], 0.016, rng)).toBe(t)
    expect(z.attackCooldown).toBe(ZOMBIE_ATTACK.cooldown)
    expect(updateZombie(z, [t], 0.016, rng)).toBeNull()
    expect(updateZombie(z, [t], 1, rng)).toBe(t)
  })

  it('does nothing when dead', () => {
    const z = createZombie(1, 'walker', 0, -1.2)
    z.alive = false
    expect(updateZombie(z, [target(0, 0)], 0.1, rng)).toBeNull()
    expect(z.z).toBe(-1.2)
  })
})

describe('hearNoise', () => {
  it('alerts a zombie within hearing range and it heads to the noise', () => {
    const z = createZombie(1, 'walker', 0, -20)
    hearNoise(z, 0, 0)
    expect(z.hasAlert).toBe(true)
    updateZombie(z, [], 0.1, rng)
    expect(z.state).toBe('chase')
    expect(z.z).toBeCloseTo(-19.8)
  })

  it('ignores noise beyond hearing range', () => {
    const z = createZombie(1, 'walker', 0, -30)
    hearNoise(z, 0, 0)
    expect(z.hasAlert).toBe(false)
  })

  it('ignores noise when dead', () => {
    const z = createZombie(1, 'walker', 0, -5)
    z.alive = false
    hearNoise(z, 0, 0)
    expect(z.hasAlert).toBe(false)
  })

  it('clears the alert on arrival', () => {
    const z = createZombie(1, 'walker', 0, -0.5)
    hearNoise(z, 0, 0)
    updateZombie(z, [], 0.1, rng)
    expect(z.hasAlert).toBe(false)
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm test src/ai/zombieBrain.test.ts`
Expected: FAIL — cannot resolve `./zombieBrain`.

- [ ] **Step 5: Implement `src/ai/zombieBrain.ts`**

```ts
import {
  ZOMBIE_ATTACK,
  ZOMBIE_HEARING,
  ZOMBIE_SIGHT,
  ZOMBIE_WANDER_FACTOR,
  type Zombie,
} from '../entities/Zombie'
import { angleOf, dirFromAngle, normalize } from '../lib/math2'

export interface Target {
  x: number
  z: number
  r: number
  alive: boolean
}

export function hearNoise(z: Zombie, nx: number, nz: number): void {
  if (!z.alive) return
  if (Math.hypot(nx - z.x, nz - z.z) > ZOMBIE_HEARING) return
  z.hasAlert = true
  z.alertX = nx
  z.alertZ = nz
}

function moveToward(z: Zombie, tx: number, tz: number, step: number): void {
  const n = normalize(tx - z.x, tz - z.z)
  z.x += n.x * step
  z.z += n.z * step
  z.angle = angleOf(tx - z.x, tz - z.z)
}

export function updateZombie<T extends Target>(
  z: Zombie,
  targets: readonly T[],
  dt: number,
  rng: () => number,
): T | null {
  if (!z.alive) return null
  z.attackCooldown = Math.max(0, z.attackCooldown - dt)

  let target: T | null = null
  let best = ZOMBIE_SIGHT
  for (const t of targets) {
    if (!t.alive) continue
    const d = Math.hypot(t.x - z.x, t.z - z.z)
    if (d <= best) {
      best = d
      target = t
    }
  }

  if (target) {
    z.state = 'chase'
    z.hasAlert = false
    z.angle = angleOf(target.x - z.x, target.z - z.z)
    if (best - z.r - target.r <= ZOMBIE_ATTACK.range) {
      if (z.attackCooldown === 0) {
        z.attackCooldown = ZOMBIE_ATTACK.cooldown
        return target
      }
      return null
    }
    moveToward(z, target.x, target.z, z.speed * dt)
    return null
  }

  if (z.hasAlert) {
    z.state = 'chase'
    if (Math.hypot(z.alertX - z.x, z.alertZ - z.z) < 1) z.hasAlert = false
    else moveToward(z, z.alertX, z.alertZ, z.speed * dt)
    return null
  }

  z.state = 'wander'
  z.wanderTimer -= dt
  if (z.wanderTimer <= 0) {
    z.wanderAngle = rng() * Math.PI * 2
    z.wanderTimer = 2 + rng() * 2
  }
  z.angle = z.wanderAngle
  const d = dirFromAngle(z.wanderAngle)
  z.x += d.x * z.speed * ZOMBIE_WANDER_FACTOR * dt
  z.z += d.z * z.speed * ZOMBIE_WANDER_FACTOR * dt
  return null
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm test src/ai/zombieBrain.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/entities src/ai
git commit -m "feat: add player/zombie entities and zombie chase AI"
```

---

### Task 6: Map layout and zombie spawner

**Files:**
- Create: `src/level/map.ts`, `src/systems/spawner.ts`
- Test: `src/systems/spawner.test.ts`

**Interfaces:**
- Consumes: `Box`, `overlapsCircleBox` (Task 1); `ZOMBIE_RADIUS`, `ZombieKind` (Task 5); `clamp` (Task 1)
- Produces:
  - `map.ts`: `MAP_HALF_WIDTH = 20`, `MAP_LENGTH = 300`, `PLAYER_START = { x: 0, z: -5 }`, `EXIT_ZONE = { x: 0, z: -290, r: 6 }`, `HOUSE_HEIGHT = 4`, `HOUSES: Box[]`, `boundaryWalls(): Box[]`
  - `spawner.ts`: `SPAWN_INTERVAL = 0.5`, `maxAlive(progress): number`, `runnerChance(progress): number`, `class Spawner { update(dt, playerZ, alive, walls: readonly Box[], rng, spawn: (kind: ZombieKind, x: number, z: number) => void): void }`

- [ ] **Step 1: Write `src/level/map.ts`**

```ts
import type { Box } from '../systems/collision'

export const MAP_HALF_WIDTH = 20
export const MAP_LENGTH = 300
export const PLAYER_START = { x: 0, z: -5 }
export const EXIT_ZONE = { x: 0, z: -290, r: 6 }
export const HOUSE_HEIGHT = 4

export const HOUSES: Box[] = [
  { x: -13, z: -40, hw: 5, hd: 6 },
  { x: 13, z: -85, hw: 5, hd: 6 },
  { x: -13, z: -130, hw: 5, hd: 6 },
  { x: 13, z: -175, hw: 5, hd: 6 },
  { x: -13, z: -215, hw: 5, hd: 6 },
  { x: 13, z: -250, hw: 5, hd: 6 },
]

export function boundaryWalls(): Box[] {
  const t = 1
  const half = MAP_LENGTH / 2
  return [
    { x: -MAP_HALF_WIDTH - t, z: -half, hw: t, hd: half + 2 },
    { x: MAP_HALF_WIDTH + t, z: -half, hw: t, hd: half + 2 },
    { x: 0, z: t, hw: MAP_HALF_WIDTH + 2, hd: t },
    { x: 0, z: -MAP_LENGTH - t, hw: MAP_HALF_WIDTH + 2, hd: t },
  ]
}
```

- [ ] **Step 2: Write the failing test `src/systems/spawner.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { Spawner, maxAlive } from './spawner'
import { HOUSES } from '../level/map'
import type { ZombieKind } from '../entities/Zombie'

function seq(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

function collect() {
  const out: { kind: ZombieKind; x: number; z: number }[] = []
  return { out, spawn: (kind: ZombieKind, x: number, z: number) => out.push({ kind, x, z }) }
}

describe('Spawner', () => {
  it('spawns a walker 22-42m ahead of the player', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -5, 0, HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ kind: 'walker', x: 0, z: -37 })
  })

  it('waits SPAWN_INTERVAL between spawns', () => {
    const { out, spawn } = collect()
    const s = new Spawner()
    s.update(0.1, -5, 0, HOUSES, () => 0.5, spawn)
    s.update(0.1, -5, 1, HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(1)
    s.update(0.5, -5, 1, HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(2)
  })

  it('stops at the alive cap for current progress', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -5, maxAlive(5 / 300), HOUSES, () => 0.5, spawn)
    expect(out).toHaveLength(0)
  })

  it('retries when the chosen spot is inside a house', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -5, 0, HOUSES, seq(0.2, 0.5, 0.5, 0.5, 0.9), spawn)
    expect(out).toHaveLength(1)
    expect(out[0].x).toBe(0)
  })

  it('favours runners near the end and clamps inside the map', () => {
    const { out, spawn } = collect()
    new Spawner().update(0.016, -280, 0, HOUSES, () => 0.5, spawn)
    expect(out[0].kind).toBe('runner')
    expect(out[0].z).toBe(-299)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/systems/spawner.test.ts`
Expected: FAIL — cannot resolve `./spawner`.

- [ ] **Step 4: Implement `src/systems/spawner.ts`**

```ts
import { overlapsCircleBox, type Box } from './collision'
import { ZOMBIE_RADIUS, type ZombieKind } from '../entities/Zombie'
import { MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'
import { clamp } from '../lib/math2'

export const SPAWN_INTERVAL = 0.5
const SPAWN_AHEAD_MIN = 22
const SPAWN_AHEAD_RANGE = 20
const SPAWN_ATTEMPTS = 3

export function maxAlive(progress: number): number {
  return Math.round(20 + 80 * progress)
}

export function runnerChance(progress: number): number {
  return 0.1 + 0.5 * progress
}

export class Spawner {
  private timer = 0

  update(
    dt: number,
    playerZ: number,
    alive: number,
    walls: readonly Box[],
    rng: () => number,
    spawn: (kind: ZombieKind, x: number, z: number) => void,
  ): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = SPAWN_INTERVAL
    const progress = clamp(-playerZ / MAP_LENGTH, 0, 1)
    if (alive >= maxAlive(progress)) return
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
      const x = (rng() * 2 - 1) * (MAP_HALF_WIDTH - 1)
      const z = Math.max(-MAP_LENGTH + 1, playerZ - SPAWN_AHEAD_MIN - rng() * SPAWN_AHEAD_RANGE)
      const probe = { x, z, r: ZOMBIE_RADIUS }
      if (walls.some((w) => overlapsCircleBox(probe, w))) continue
      spawn(rng() < runnerChance(progress) ? 'runner' : 'walker', x, z)
      return
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test src/systems/spawner.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/level src/systems/spawner.ts src/systems/spawner.test.ts
git commit -m "feat: add town map layout and ahead-of-player zombie spawner"
```

---

### Task 7: World simulation and fixed-step clock

**Files:**
- Create: `src/game/World.ts`, `src/game/fixedStep.ts`
- Test: `src/game/World.test.ts`, `src/game/fixedStep.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces:
  - `fixedStep.ts`: `class FixedStep { constructor(step: number, maxFrame: number); advance(frameDt: number, fn: (dt: number) => void): number }` — returns steps run
  - `World.ts`:
    - `interface FrameInput { moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean; reload: boolean; switchTo: number | null }`
    - `type GameStatus = 'playing' | 'won' | 'lost'`
    - `interface Tracer { x0: number; z0: number; x1: number; z1: number; life: number }`
    - `interface WorldOptions { rng?: () => number; spawning?: boolean; allWeapons?: boolean }`
    - constants `TRACER_LIFE = 0.06`, `CORPSE_LIFE = 3`, `DESPAWN_BEHIND = 40`
    - `class World { readonly player: Player; readonly zombies: Zombie[]; readonly walls: Box[]; readonly tracers: Tracer[]; status: GameStatus; kills: number; time: number; constructor(opts?: WorldOptions); spawnZombie(kind, x, z): Zombie; get aliveZombies(): number; step(dt: number, input: FrameInput): void }`

- [ ] **Step 1: Write the failing test `src/game/fixedStep.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { FixedStep } from './fixedStep'

describe('FixedStep', () => {
  it('runs whole steps for the elapsed time', () => {
    const f = new FixedStep(1 / 60, 0.25)
    expect(f.advance(1 / 30, () => {})).toBe(2)
  })

  it('carries the remainder to the next frame', () => {
    const f = new FixedStep(1 / 60, 0.25)
    expect(f.advance(0.01, () => {})).toBe(0)
    expect(f.advance(0.01, () => {})).toBe(1)
  })

  it('caps a long hitch at maxFrame worth of steps', () => {
    const f = new FixedStep(1 / 60, 0.25)
    const n = f.advance(5, () => {})
    expect(n).toBeGreaterThanOrEqual(14)
    expect(n).toBeLessThanOrEqual(15)
  })

  it('ignores negative frame time', () => {
    expect(new FixedStep(1 / 60, 0.25).advance(-1, () => {})).toBe(0)
  })

  it('passes the fixed step to the callback', () => {
    const seen: number[] = []
    new FixedStep(0.5, 1).advance(1, (dt) => seen.push(dt))
    expect(seen).toEqual([0.5, 0.5])
  })
})
```

- [ ] **Step 2: Write the failing test `src/game/World.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { World, CORPSE_LIFE, type FrameInput } from './World'

const DT = 1 / 60

function input(over: Partial<FrameInput> = {}): FrameInput {
  return { moveX: 0, moveZ: 0, aimX: 0, aimZ: -100, fire: false, reload: false, switchTo: null, ...over }
}

function run(world: World, seconds: number, inp: FrameInput) {
  const n = Math.round(seconds / DT)
  for (let i = 0; i < n; i++) world.step(DT, inp)
}

function quiet(allWeapons = false) {
  return new World({ rng: () => 0.5, spawning: false, allWeapons })
}

describe('World', () => {
  it('moves the player forward with W', () => {
    const w = quiet()
    run(w, 1, input({ moveZ: -1 }))
    expect(w.player.z).toBeCloseTo(-10, 1)
  })

  it('stops the player at a house wall', () => {
    const w = quiet()
    w.player.x = 0
    w.player.z = -40
    run(w, 3, input({ moveX: -1 }))
    expect(w.player.x).toBeCloseTo(-7.6, 2)
  })

  it('kills a zombie in front with pistol fire and counts the kill', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', 0, -15)
    run(w, 1, input({ fire: true }))
    expect(z.alive).toBe(false)
    expect(w.kills).toBe(1)
  })

  it('stops shots at house walls', () => {
    const w = quiet()
    w.player.x = 0
    w.player.z = -40
    const z = w.spawnZombie('walker', -19.5, -40)
    w.step(DT, input({ fire: true, aimX: -30, aimZ: -40 }))
    expect(z.hp).toBe(60)
    expect(w.tracers[0].x1).toBeCloseTo(-8, 1)
  })

  it('takes zombie hits and loses at 0 hp', () => {
    const w = quiet()
    w.spawnZombie('walker', 0, -5.9)
    w.step(DT, input())
    expect(w.player.hp).toBe(90)
    run(w, 10.5, input())
    expect(w.player.hp).toBe(0)
    expect(w.status).toBe('lost')
  })

  it('wins on reaching the exit zone', () => {
    const w = quiet()
    w.player.z = -288
    w.step(DT, input())
    expect(w.status).toBe('won')
  })

  it('alerts zombies beyond sight with gunfire', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', 0, -28)
    w.step(DT, input({ fire: true, aimX: 100, aimZ: -5 }))
    expect(z.hasAlert).toBe(true)
    expect(z.state).toBe('chase')
  })

  it('keeps its facing when the aim point sits on the player', () => {
    const w = quiet()
    w.step(DT, input({ aimX: w.player.x, aimZ: w.player.z }))
    expect(w.player.angle).toBe(Math.PI)
  })

  it('removes corpses after CORPSE_LIFE', () => {
    const w = quiet()
    const z = w.spawnZombie('walker', 5, -20)
    z.alive = false
    z.hp = 0
    run(w, CORPSE_LIFE + 0.1, input())
    expect(w.zombies).toHaveLength(0)
  })

  it('despawns zombies left far behind', () => {
    const w = quiet()
    w.spawnZombie('walker', 0, 36)
    w.step(DT, input())
    expect(w.zombies).toHaveLength(0)
  })

  it('switches weapons when owned', () => {
    const w = quiet(true)
    w.step(DT, input({ switchTo: 1 }))
    expect(w.player.weapon.def.id).toBe('shotgun')
  })

  it('freezes after the game ends', () => {
    const w = quiet()
    w.status = 'lost'
    w.step(DT, input({ moveZ: -1 }))
    expect(w.player.z).toBe(-5)
  })
})
```

- [ ] **Step 3: Run to verify both fail**

Run: `pnpm test src/game`
Expected: FAIL — cannot resolve `./fixedStep` / `./World`.

- [ ] **Step 4: Implement `src/game/fixedStep.ts`**

```ts
export class FixedStep {
  readonly step: number
  readonly maxFrame: number
  private acc = 0

  constructor(step: number, maxFrame: number) {
    this.step = step
    this.maxFrame = maxFrame
  }

  advance(frameDt: number, fn: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameDt, 0), this.maxFrame)
    let n = 0
    while (this.acc >= this.step) {
      fn(this.step)
      this.acc -= this.step
      n++
    }
    return n
  }
}
```

- [ ] **Step 5: Implement `src/game/World.ts`**

```ts
import { Player, PLAYER_SPEED } from '../entities/Player'
import { createZombie, ZOMBIE_ATTACK, type Zombie, type ZombieKind } from '../entities/Zombie'
import { hearNoise, updateZombie } from '../ai/zombieBrain'
import { resolveCircleBox, resolveCircleCircle, type Box } from '../systems/collision'
import { applyDamage, castShot } from '../systems/combat'
import { pelletAngles, WEAPONS, WeaponState } from '../systems/weapons'
import { SpatialGrid } from '../systems/spatialGrid'
import { Spawner } from '../systems/spawner'
import { boundaryWalls, EXIT_ZONE, HOUSES, PLAYER_START } from '../level/map'
import { angleOf, normalize } from '../lib/math2'

export interface FrameInput {
  moveX: number
  moveZ: number
  aimX: number
  aimZ: number
  fire: boolean
  reload: boolean
  switchTo: number | null
}

export type GameStatus = 'playing' | 'won' | 'lost'

export interface Tracer {
  x0: number
  z0: number
  x1: number
  z1: number
  life: number
}

export interface WorldOptions {
  rng?: () => number
  spawning?: boolean
  allWeapons?: boolean
}

export const TRACER_LIFE = 0.06
export const CORPSE_LIFE = 3
export const DESPAWN_BEHIND = 40
const MUZZLE_OFFSET = 0.6
const PLAYER_CROWD_SHARE = 0.1

export class World {
  readonly player = new Player()
  readonly zombies: Zombie[] = []
  readonly walls: Box[] = [...HOUSES, ...boundaryWalls()]
  readonly tracers: Tracer[] = []
  status: GameStatus = 'playing'
  kills = 0
  time = 0

  private readonly rng: () => number
  private readonly spawning: boolean
  private readonly grid = new SpatialGrid<Zombie>(4)
  private readonly spawner = new Spawner()
  private readonly near: Zombie[] = []
  private readonly targets: Player[]
  private nextId = 1

  constructor(opts: WorldOptions = {}) {
    this.rng = opts.rng ?? Math.random
    this.spawning = opts.spawning ?? true
    this.player.x = PLAYER_START.x
    this.player.z = PLAYER_START.z
    this.targets = [this.player]
    if (opts.allWeapons) {
      this.player.weapons.push(new WeaponState(WEAPONS.shotgun, 24), new WeaponState(WEAPONS.rifle, 90))
    }
  }

  spawnZombie(kind: ZombieKind, x: number, z: number): Zombie {
    const zombie = createZombie(this.nextId++, kind, x, z)
    this.zombies.push(zombie)
    return zombie
  }

  get aliveZombies(): number {
    let n = 0
    for (const z of this.zombies) if (z.alive) n++
    return n
  }

  step(dt: number, input: FrameInput): void {
    if (this.status !== 'playing') return
    this.time += dt
    this.updatePlayer(dt, input)
    this.updateZombies(dt)
    this.updateTracers(dt)
    if (this.spawning) {
      this.spawner.update(dt, this.player.z, this.aliveZombies, this.walls, this.rng, (k, x, z) =>
        this.spawnZombie(k, x, z),
      )
    }
    this.updateStatus()
  }

  private updatePlayer(dt: number, input: FrameInput): void {
    const p = this.player
    if (input.switchTo !== null) p.switchTo(input.switchTo)
    if (input.reload) p.weapon.startReload()
    const m = normalize(input.moveX, input.moveZ)
    p.x += m.x * PLAYER_SPEED * dt
    p.z += m.z * PLAYER_SPEED * dt
    for (const w of this.walls) resolveCircleBox(p, w)
    const ax = input.aimX - p.x
    const az = input.aimZ - p.z
    if (ax * ax + az * az > 1e-4) p.angle = angleOf(ax, az)
    p.weapon.update(dt)
    if (input.fire && p.weapon.tryFire()) this.fire()
  }

  private fire(): void {
    const p = this.player
    const def = p.weapon.def
    const ox = p.x + Math.sin(p.angle) * MUZZLE_OFFSET
    const oz = p.z + Math.cos(p.angle) * MUZZLE_OFFSET
    for (const offset of pelletAngles(def, this.rng)) {
      const a = p.angle + offset
      const dx = Math.sin(a)
      const dz = Math.cos(a)
      const hit = castShot(ox, oz, dx, dz, def.range, this.zombies, this.walls)
      this.tracers.push({ x0: ox, z0: oz, x1: ox + dx * hit.dist, z1: oz + dz * hit.dist, life: TRACER_LIFE })
      if (hit.target) {
        hit.target.x += dx * def.knockback
        hit.target.z += dz * def.knockback
        if (applyDamage(hit.target, def.damage)) this.kills++
      }
    }
    for (const z of this.zombies) hearNoise(z, p.x, p.z)
  }

  private updateZombies(dt: number): void {
    const p = this.player
    this.grid.clear()
    for (const z of this.zombies) if (z.alive) this.grid.insert(z)

    for (const z of this.zombies) {
      if (!z.alive) {
        z.deadTime += dt
        continue
      }
      const struck = updateZombie(z, this.targets, dt, this.rng)
      if (struck) applyDamage(struck, ZOMBIE_ATTACK.damage)
      this.grid.query(z.x, z.z, z.r * 2, this.near)
      for (const o of this.near) if (o.id > z.id) resolveCircleCircle(z, o)
      if (p.alive) resolveCircleCircle(p, z, PLAYER_CROWD_SHARE)
      for (const w of this.walls) resolveCircleBox(z, w)
    }
    for (const w of this.walls) resolveCircleBox(p, w)

    let keep = 0
    for (const z of this.zombies) {
      const expired = z.alive ? z.z - p.z > DESPAWN_BEHIND : z.deadTime > CORPSE_LIFE
      if (!expired) this.zombies[keep++] = z
    }
    this.zombies.length = keep
  }

  private updateTracers(dt: number): void {
    let keep = 0
    for (const t of this.tracers) {
      t.life -= dt
      if (t.life > 0) this.tracers[keep++] = t
    }
    this.tracers.length = keep
  }

  private updateStatus(): void {
    const p = this.player
    if (!p.alive) this.status = 'lost'
    else if (Math.hypot(p.x - EXIT_ZONE.x, p.z - EXIT_ZONE.z) <= EXIT_ZONE.r) this.status = 'won'
  }
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm test`
Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/World.ts src/game/World.test.ts src/game/fixedStep.ts src/game/fixedStep.test.ts
git commit -m "feat: add world simulation step and fixed-step clock"
```

---

### Task 8: Input, camera, render view, HUD, game loop — playable in the browser

**Files:**
- Create: `src/game/Input.ts`, `src/game/CameraRig.ts`, `src/render/SceneView.ts`, `src/ui/hud.ts`
- Modify: `src/game/Game.ts` (full rewrite), `src/style.css` (append HUD styles)
- Test: `src/game/Input.test.ts`

**Interfaces:**
- Consumes: `World`, `FrameInput`, `FixedStep` (Task 7); map constants (Task 6); `PLAYER_MAX_HP` (Task 5)
- Produces:
  - `Input.ts`: `class InputState { mouseX; mouseY (NDC, −1..1); fireHeld; handleKey(code: string, down: boolean): void; reset(): void; get moveX(); get moveZ(); consume(aimX: number, aimZ: number): FrameInput }`, `bindInput(state: InputState, el: HTMLElement): () => void` (returns unbind)
  - `CameraRig.ts`: `class CameraRig { constructor(camera: THREE.PerspectiveCamera); snap(x, z): void; update(x, z, dt): void }`
  - `SceneView.ts`: `class SceneView { readonly scene: THREE.Scene; sync(world: World): void }`
  - `hud.ts`: `class Hud { constructor(parent: HTMLElement, onRestart: () => void, showFps: boolean); update(world: World, fps: number): void; dispose(): void }`

- [ ] **Step 1: Write the failing test `src/game/Input.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { InputState } from './Input'

describe('InputState', () => {
  it('maps WASD to move axes (W = toward -Z)', () => {
    const s = new InputState()
    s.handleKey('KeyW', true)
    s.handleKey('KeyD', true)
    expect(s.moveZ).toBe(-1)
    expect(s.moveX).toBe(1)
  })

  it('cancels opposite keys', () => {
    const s = new InputState()
    s.handleKey('KeyA', true)
    s.handleKey('KeyD', true)
    expect(s.moveX).toBe(0)
  })

  it('queues reload and weapon switch once per press', () => {
    const s = new InputState()
    s.handleKey('KeyR', true)
    s.handleKey('Digit2', true)
    const first = s.consume(0, 0)
    expect(first.reload).toBe(true)
    expect(first.switchTo).toBe(1)
    const second = s.consume(0, 0)
    expect(second.reload).toBe(false)
    expect(second.switchTo).toBeNull()
  })

  it('reset clears held keys and fire so nothing sticks after focus loss', () => {
    const s = new InputState()
    s.handleKey('KeyW', true)
    s.fireHeld = true
    s.reset()
    const f = s.consume(0, 0)
    expect(f.moveZ).toBe(0)
    expect(f.fire).toBe(false)
  })

  it('passes the aim point through', () => {
    const f = new InputState().consume(3, -7)
    expect(f.aimX).toBe(3)
    expect(f.aimZ).toBe(-7)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/game/Input.test.ts`
Expected: FAIL — cannot resolve `./Input`.

- [ ] **Step 3: Implement `src/game/Input.ts`**

```ts
import type { FrameInput } from './World'

export class InputState {
  mouseX = 0
  mouseY = 0
  fireHeld = false
  private readonly keys = new Set<string>()
  private reloadQueued = false
  private switchQueued: number | null = null

  handleKey(code: string, down: boolean): void {
    if (!down) {
      this.keys.delete(code)
      return
    }
    this.keys.add(code)
    if (code === 'KeyR') this.reloadQueued = true
    const digit = /^Digit([1-3])$/.exec(code)
    if (digit) this.switchQueued = Number(digit[1]) - 1
  }

  reset(): void {
    this.keys.clear()
    this.fireHeld = false
  }

  get moveX(): number {
    return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
  }

  get moveZ(): number {
    return (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0)
  }

  consume(aimX: number, aimZ: number): FrameInput {
    const frame: FrameInput = {
      moveX: this.moveX,
      moveZ: this.moveZ,
      aimX,
      aimZ,
      fire: this.fireHeld,
      reload: this.reloadQueued,
      switchTo: this.switchQueued,
    }
    this.reloadQueued = false
    this.switchQueued = null
    return frame
  }
}

export function bindInput(state: InputState, el: HTMLElement): () => void {
  const keyDown = (e: KeyboardEvent) => {
    if (!e.repeat) state.handleKey(e.code, true)
  }
  const keyUp = (e: KeyboardEvent) => state.handleKey(e.code, false)
  const pointerMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    state.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1
    state.mouseY = -((e.clientY - r.top) / r.height) * 2 + 1
  }
  const pointerDown = (e: PointerEvent) => {
    if (e.button === 0) state.fireHeld = true
  }
  const pointerUp = (e: PointerEvent) => {
    if (e.button === 0) state.fireHeld = false
  }
  const blur = () => state.reset()
  const contextMenu = (e: Event) => e.preventDefault()

  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('pointermove', pointerMove)
  el.addEventListener('pointerdown', pointerDown)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('blur', blur)
  el.addEventListener('contextmenu', contextMenu)

  return () => {
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('keyup', keyUp)
    window.removeEventListener('pointermove', pointerMove)
    el.removeEventListener('pointerdown', pointerDown)
    window.removeEventListener('pointerup', pointerUp)
    window.removeEventListener('blur', blur)
    el.removeEventListener('contextmenu', contextMenu)
  }
}
```

- [ ] **Step 4: Run test**

Run: `pnpm test src/game/Input.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/game/CameraRig.ts`**

```ts
import * as THREE from 'three'

const OFFSET = new THREE.Vector3(0, 20, 11)
const LOOK_AHEAD = -3
const FOLLOW_SHARPNESS = 8

export class CameraRig {
  private readonly camera: THREE.PerspectiveCamera
  private readonly desired = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  snap(x: number, z: number): void {
    this.camera.position.set(x + OFFSET.x, OFFSET.y, z + OFFSET.z)
    this.look()
  }

  update(x: number, z: number, dt: number): void {
    this.desired.set(x + OFFSET.x, OFFSET.y, z + OFFSET.z)
    this.camera.position.lerp(this.desired, 1 - Math.exp(-FOLLOW_SHARPNESS * dt))
    this.look()
  }

  private look(): void {
    const p = this.camera.position
    this.camera.lookAt(p.x - OFFSET.x, 0, p.z - OFFSET.z + LOOK_AHEAD)
  }
}
```

- [ ] **Step 6: Write `src/render/SceneView.ts`**

```ts
import * as THREE from 'three'
import type { World } from '../game/World'
import { EXIT_ZONE, HOUSE_HEIGHT, HOUSES, MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'

const MAX_ZOMBIES = 400
const MAX_TRACERS = 128
const BODY_HEIGHT = 1
const BODY_RADIUS = 0.4
const TRACER_Y = 1.1

const COLORS = {
  background: '#0b0b10',
  ground: '#2b2f27',
  road: '#3a3a3e',
  house: '#8a6f55',
  player: '#3d7eff',
  gun: '#222222',
  walker: '#5f8f3e',
  runner: '#b4c94a',
  corpse: '#3a4a2a',
  tracer: '#ffd66b',
  exit: '#39ff88',
}

export class SceneView {
  readonly scene = new THREE.Scene()
  private readonly player = new THREE.Group()
  private readonly zombies: THREE.InstancedMesh
  private readonly tracerPos = new Float32Array(MAX_TRACERS * 6)
  private readonly tracerGeo = new THREE.BufferGeometry()
  private readonly dummy = new THREE.Object3D()
  private readonly color = new THREE.Color()

  constructor() {
    this.scene.background = new THREE.Color(COLORS.background)
    this.scene.fog = new THREE.Fog(COLORS.background, 30, 60)
    this.scene.add(new THREE.HemisphereLight('#cfd8ff', '#2a2a20', 0.8))
    const sun = new THREE.DirectionalLight('#fff2dd', 2)
    sun.position.set(10, 25, 5)
    this.scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF_WIDTH * 2 + 20, MAP_LENGTH + 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COLORS.ground }),
    )
    ground.position.z = -MAP_LENGTH / 2
    this.scene.add(ground)

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, MAP_LENGTH).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COLORS.road }),
    )
    road.position.set(0, 0.01, -MAP_LENGTH / 2)
    this.scene.add(road)

    const houseMat = new THREE.MeshStandardMaterial({ color: COLORS.house })
    for (const h of HOUSES) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(h.hw * 2, HOUSE_HEIGHT, h.hd * 2), houseMat)
      mesh.position.set(h.x, HOUSE_HEIGHT / 2, h.z)
      this.scene.add(mesh)
    }

    const exit = new THREE.Mesh(
      new THREE.RingGeometry(EXIT_ZONE.r - 0.4, EXIT_ZONE.r, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: COLORS.exit }),
    )
    exit.position.set(EXIT_ZONE.x, 0.02, EXIT_ZONE.z)
    this.scene.add(exit)

    const bodyGeo = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_HEIGHT, 4, 12).translate(
      0,
      BODY_HEIGHT / 2 + BODY_RADIUS,
      0,
    )
    this.player.add(new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: COLORS.player })))
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: COLORS.gun }),
    )
    gun.position.set(0.2, TRACER_Y, 0.45)
    this.player.add(gun)
    this.scene.add(this.player)

    this.zombies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial(), MAX_ZOMBIES)
    this.zombies.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.zombies.setColorAt(0, this.color.set(COLORS.walker))
    this.zombies.count = 0
    this.zombies.frustumCulled = false
    this.scene.add(this.zombies)
    this.dummy.rotation.order = 'YXZ'

    this.tracerGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage),
    )
    const tracers = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ color: COLORS.tracer }))
    tracers.frustumCulled = false
    this.scene.add(tracers)
  }

  sync(world: World): void {
    const p = world.player
    this.player.position.set(p.x, 0, p.z)
    this.player.rotation.set(0, p.angle, p.alive ? 0 : Math.PI / 2)

    let n = 0
    for (const z of world.zombies) {
      if (n >= MAX_ZOMBIES) break
      this.dummy.position.set(z.x, z.alive ? 0 : BODY_RADIUS, z.z)
      this.dummy.rotation.set(z.alive ? 0 : -Math.PI / 2, z.angle, 0)
      this.dummy.scale.setScalar(z.kind === 'runner' ? 0.9 : 1)
      this.dummy.updateMatrix()
      this.zombies.setMatrixAt(n, this.dummy.matrix)
      this.color.set(!z.alive ? COLORS.corpse : z.kind === 'runner' ? COLORS.runner : COLORS.walker)
      this.zombies.setColorAt(n, this.color)
      n++
    }
    this.zombies.count = n
    this.zombies.instanceMatrix.needsUpdate = true
    if (this.zombies.instanceColor) this.zombies.instanceColor.needsUpdate = true

    let t = 0
    for (const tr of world.tracers) {
      if (t >= MAX_TRACERS) break
      this.tracerPos.set([tr.x0, TRACER_Y, tr.z0, tr.x1, TRACER_Y, tr.z1], t * 6)
      t++
    }
    this.tracerGeo.setDrawRange(0, t * 2)
    this.tracerGeo.attributes.position.needsUpdate = true
  }
}
```

- [ ] **Step 7: Write `src/ui/hud.ts`**

```ts
import type { World } from '../game/World'
import { PLAYER_MAX_HP } from '../entities/Player'
import { EXIT_ZONE } from '../level/map'

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export class Hud {
  private readonly root: HTMLDivElement
  private readonly hpFill: HTMLElement
  private readonly hpText: HTMLElement
  private readonly weapon: HTMLElement
  private readonly ammo: HTMLElement
  private readonly kills: HTMLElement
  private readonly distance: HTMLElement
  private readonly fps: HTMLElement
  private readonly end: HTMLElement
  private readonly endTitle: HTMLElement
  private readonly endStats: HTMLElement
  private readonly showFps: boolean

  constructor(parent: HTMLElement, onRestart: () => void, showFps: boolean) {
    this.showFps = showFps
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.root.innerHTML = `
      <div class="hud__fps" data-fps></div>
      <div class="hud__top">
        <span data-kills></span>
        <span data-distance></span>
      </div>
      <div class="hud__hp">
        <div class="hud__hp-bar"><div class="hud__hp-fill" data-hp-fill></div></div>
        <span data-hp-text></span>
      </div>
      <div class="hud__weapon">
        <span class="hud__weapon-name" data-weapon></span>
        <span class="hud__ammo" data-ammo></span>
      </div>
      <div class="hud__end" data-end hidden>
        <h1 data-end-title></h1>
        <p data-end-stats></p>
        <button type="button" data-restart>Chơi lại</button>
      </div>`
    parent.appendChild(this.root)
    const q = (sel: string) => this.root.querySelector<HTMLElement>(sel)!
    this.hpFill = q('[data-hp-fill]')
    this.hpText = q('[data-hp-text]')
    this.weapon = q('[data-weapon]')
    this.ammo = q('[data-ammo]')
    this.kills = q('[data-kills]')
    this.distance = q('[data-distance]')
    this.fps = q('[data-fps]')
    this.end = q('[data-end]')
    this.endTitle = q('[data-end-title]')
    this.endStats = q('[data-end-stats]')
    this.fps.hidden = !showFps
    q('[data-restart]').addEventListener('click', onRestart)
  }

  update(world: World, fps: number): void {
    const p = world.player
    const w = p.weapon
    this.hpFill.style.width = `${(p.hp / PLAYER_MAX_HP) * 100}%`
    setText(this.hpText, String(Math.ceil(p.hp)))
    setText(this.weapon, w.def.name)
    setText(
      this.ammo,
      w.reloading ? 'Đang nạp…' : `${w.mag} / ${w.def.infiniteReserve ? '∞' : w.reserve}`,
    )
    setText(this.kills, `Hạ: ${world.kills}`)
    const d = Math.round(Math.hypot(p.x - EXIT_ZONE.x, p.z - EXIT_ZONE.z))
    setText(this.distance, `Còn ${d}m`)
    if (this.showFps) setText(this.fps, `${Math.round(fps)} fps · ${world.aliveZombies} zombie`)

    const ended = world.status !== 'playing'
    this.end.hidden = !ended
    if (ended) {
      setText(this.endTitle, world.status === 'won' ? 'Đã thoát!' : 'Bạn đã gục')
      setText(this.endStats, `Thời gian ${formatTime(world.time)} · Hạ ${world.kills} zombie`)
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
```

- [ ] **Step 8: Append HUD styles to `src/style.css`**

```css
#game {
  cursor: crosshair;
}

.hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  font-weight: 600;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.8);
  user-select: none;
}

.hud__fps {
  position: absolute;
  top: 12px;
  left: 16px;
  font: 12px ui-monospace, monospace;
  opacity: 0.7;
}

.hud__top {
  position: absolute;
  top: 12px;
  right: 16px;
  display: flex;
  gap: 16px;
}

.hud__hp {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hud__hp-bar {
  width: 200px;
  height: 12px;
  background: rgb(255 255 255 / 0.15);
  border-radius: 6px;
  overflow: hidden;
}

.hud__hp-fill {
  height: 100%;
  background: #ff4d4d;
  transition: width 0.15s;
}

.hud__weapon {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.hud__ammo {
  font-size: 24px;
}

.hud__end {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgb(0 0 0 / 0.6);
  pointer-events: auto;
}

.hud__end[hidden] {
  display: none;
}

.hud__end button {
  padding: 10px 24px;
  font: inherit;
  color: #0b0b10;
  background: #fff;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
```

- [ ] **Step 9: Rewrite `src/game/Game.ts`**

```ts
import * as THREE from 'three'
import { World } from './World'
import { FixedStep } from './fixedStep'
import { InputState, bindInput } from './Input'
import { CameraRig } from './CameraRig'
import { SceneView } from '../render/SceneView'
import { Hud } from '../ui/hud'

const STEP = 1 / 60
const MAX_FRAME = 0.25
const AIM_HEIGHT = 1

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  private readonly rig: CameraRig
  private readonly view = new SceneView()
  private readonly input = new InputState()
  private readonly unbindInput: () => void
  private readonly hud: Hud
  private readonly stepper = new FixedStep(STEP, MAX_FRAME)
  private readonly timer = new THREE.Timer()
  private readonly raycaster = new THREE.Raycaster()
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AIM_HEIGHT)
  private readonly ndc = new THREE.Vector2()
  private readonly aim = new THREE.Vector3()
  private readonly debug: boolean
  private world: World
  private fps = 60

  constructor(canvas: HTMLCanvasElement) {
    this.debug = new URLSearchParams(location.search).has('debug')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.rig = new CameraRig(this.camera)
    this.unbindInput = bindInput(this.input, canvas)
    this.hud = new Hud(document.body, () => this.restart(), this.debug)
    this.world = this.createWorld()
    this.rig.snap(this.world.player.x, this.world.player.z)
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick)
  }

  private createWorld(): World {
    return new World({ allWeapons: this.debug })
  }

  private restart(): void {
    this.world = this.createWorld()
    this.input.reset()
    this.rig.snap(this.world.player.x, this.world.player.z)
  }

  private tick = (time: number): void => {
    this.timer.update(time)
    const dt = this.timer.getDelta()
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.1
    this.updateAim()
    this.stepper.advance(dt, (step) => this.world.step(step, this.input.consume(this.aim.x, this.aim.z)))
    this.view.sync(this.world)
    this.rig.update(this.world.player.x, this.world.player.z, dt)
    this.hud.update(this.world, this.fps)
    this.renderer.render(this.view.scene, this.camera)
  }

  private updateAim(): void {
    this.ndc.set(this.input.mouseX, this.input.mouseY)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, this.aim)) {
      this.aim.set(this.world.player.x, AIM_HEIGHT, this.world.player.z - 1)
    }
  }

  private resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this.resize)
    this.unbindInput()
    this.hud.dispose()
    this.renderer.dispose()
  }
}
```

`src/main.ts` stays as is (it already calls `new Game(canvas)`, `start()`, and `dispose()` on HMR).

- [ ] **Step 10: Full test + build**

Run: `pnpm test && pnpm build`
Expected: all tests PASS; tsc + vite build succeed (the >500 kB chunk warning from three.js is expected).

- [ ] **Step 11: Visual verification on http://localhost:3016**

Dev server must be running (`pnpm dev`; if port 3016 is already taken by an earlier `pnpm dev`, reuse it — HMR picks up changes). Using the browser tool:
1. Open `http://localhost:3016/?debug`. Screenshot. Expect: tilted top-down view, grey road running up the screen, brown house boxes on both sides, blue capsule player, HUD (HP bar bottom-left, "Súng lục 12 / ∞" bottom-right, "Hạ: 0 · Còn 285m" top-right, fps line top-left). Console: 0 errors.
2. Hold `W` ~3 s. Screenshot. Expect: camera followed the player up the road; green zombies visible ahead and walking toward the player.
3. Move mouse over a zombie, hold left mouse ~2 s. Expect: yellow tracer lines, zombies falling flat (dark green) and disappearing after ~3 s, "Hạ" counter increasing, ammo counting down and "Đang nạp…" on empty.
4. Press `2` then fire. Expect shotgun fan of 6 tracers (`?debug` grants all weapons).
5. Stand still until killed. Expect "Bạn đã gục" overlay; click "Chơi lại" → fresh run, HP 100.
Report FPS shown with ~50+ zombies alive.

- [ ] **Step 12: Commit**

```bash
git add src/game src/render src/ui src/style.css
git commit -m "feat: playable M1 slice — input, camera, render view, HUD"
```
