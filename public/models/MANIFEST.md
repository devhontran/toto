# public/models — manifest

All files optimized with `@gltf-transform/cli optimize --compress meshopt --texture-compress webp --texture-size 1024`.

Characters (player, bots, zombies) and their guns are procedural blocky meshes built in
`src/render/blocky.ts`; no character GLBs ship. Houses, trees, ground and road are procedural
Minecraft-style voxel blocks with code-generated 16×16 textures (`src/render/voxel.ts`,
`src/render/town.ts`); no building or tree GLBs ship.

---

## van.glb

- Source mesh: Kenney Car Kit `van.glb`, meshes `body`, `wheel-front-left/right`,
  `wheel-back-left/right` (wheels are separate nodes — not skinned, no animation; useful if you
  later want to spin wheels procedurally by rotating those nodes)
- File size: 30.0 KB
- Raw bbox (meters): X=1.5 (width), Y=1.35 (height), Z=2.75 (length)
- **Suggested scale to reach ~4.5 m length: `1.636`** (4.5 / 2.75) — yields ~2.45 m width and
  ~2.2 m height, a bit wide/tall for a real van at that length; if visual proportions matter more
  than exact length, `1.2`–`1.3` reads closer to a real-world van silhouette. Verify visually.

---

## Not included

- **Barricade/roadblock**: not found in the Kenney packs sourced this session (see CREDITS.md).
