# public/models — manifest

All files optimized with `@gltf-transform/cli optimize --compress meshopt --texture-compress webp --texture-size 1024`.

Characters (player, bots, zombies) and their guns are procedural blocky meshes built in
`src/render/blocky.ts`; no character GLBs ship.

---

## house.glb

- Source mesh name: `building-type-n` (Kenney "building-type-n")
- Single mesh, single primitive, single material (`colormap`, 512×512 webp) — **no separate roof
  node/mesh**. Kenney's suburban building models ship as one fused mesh (walls+roof+trim in one
  draw call); there is no roof sub-mesh to toggle/fade independently. If a fade-when-inside effect
  is required, either (a) do it as a full-model opacity fade while the roof is somewhat forgiving
  visually at 1-story scale, or (b) source a different, modular building kit with separate roof
  pieces (not done here — flagged as a limitation, not silently worked around).
- File size: 25.8 KB
- Raw bbox (meters): X=1.784, Y=1.138 (height), Z=1.378
- **Suggested scale to reach ~10×12 m footprint: `6.8`** (using Z 1.378→~9.4 m and X
  1.784→~12.1 m at scale 6.8; footprint aspect ratio 1.29:1 vs. requested 12:10=1.2:1, close
  enough — verify visually and nudge ±0.3 if the footprint reads too deep/shallow). At scale 6.8
  the building would also be ~7.7 m tall (single story + roof), which is plausible for a 1-story
  house with an oversized cartoon roof; reduce scale to ~5.5–6 if the height reads too tall
  relative to the 1.8 m character.

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

## tree.glb

- Source: Kenney City Kit (Suburban) `tree-large.glb`
- File size: 5.9 KB
- Raw bbox (meters): X=0.210, Y=0.767 (height), Z=0.243
- Same small-unit convention as `house.glb`; use the same scale factor (~6.8) as the house/street
  props from this pack so trees and buildings stay proportionate to each other. At scale 6.8 the
  tree would be ~5.2 m tall, a reasonable street tree height.

---

## Not included

- **Barricade/roadblock**: not found in the Kenney packs sourced this session (see CREDITS.md).
- **Separate roof mesh**: not available in the Kenney suburban building model used (see house.glb
  note above).
