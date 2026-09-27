# public/models — manifest

All files optimized with `@gltf-transform/cli optimize --compress meshopt --texture-compress webp --texture-size 1024`.
Animation clip counts were verified unchanged before/after optimization (meshopt did not break any skinned clips).

Bounding boxes for the two skinned rigs (`character-man*.glb`, `zombie.glb`) below are computed by
evaluating the skin in bind pose (joint world matrix × inverse bind matrix × vertex), NOT the raw
`gltf-transform inspect` scene bbox — that tool's naive bbox for these two files is polluted by
stray IK/pole-target joints sitting far from the body (e.g. `PoleTarget.L` at `z≈1.8`), producing
bogus values like a "4.84 × 5.2 m" bbox that does not represent the visible mesh. The static/prop
files (house, van, tree, rifle, pistol) are unaffected by this and use the plain `inspect` bbox
directly.

---

## character-man.glb / character-man-alt.glb / character-man-longsleeves.glb / character-man-suit.glb

Same rig ("HumanArmature" skeleton, "BaseHuman" mesh, `PaletteMaterial001` single material +
64×4 palette texture — trivially recolorable by swapping the palette texture or tinting the
material). Use as player model and/or bot skins (4 outfit variants for visual variety).

- Mesh: `BaseHuman` (9 primitives, single material, single 64×4 palette texture)
- File sizes: 158.8 KB / 152.8 KB / 153.7 KB / 165.8 KB
- Bind-pose bbox (skin-evaluated, meters): X≈1.43, Y≈4.83–4.84 (height), Z≈0.82 (plain) / 0.91 (long sleeves) / 0.92 (suit)
- **Suggested scale to reach 1.8 m character height: `0.372`** (1.8 / 4.83)
- Animation clips (identical set on all 4, prefixed `HumanArmature|`):
  - `Man_Idle` — idle
  - `Man_Walk` — walk
  - `Man_Run` — run
  - `Man_Punch` — melee/attack (**no dedicated shoot/aim clip exists in this pack** — see gap note below)
  - `Man_Death` — death
  - `Man_Jump`, `Man_RunningJump` — jump / running jump
  - `Man_Standing`, `Man_Sitting` — idle variants
  - `Man_SwordSlash` — alt melee
  - `Man_Clapping` — misc/emote

**Gap:** no "shoot" or "holding-gun idle/aim" clip is included in this pack. For a shooter, use
`Man_Idle` as the base pose and attach a weapon prop (`rifle.glb`/`pistol.glb`) to the right-hand
bone (`Palm.R`/`MiddleHand.R`), and use `Man_Punch` as a placeholder "fire" animation trigger (or
just play `Man_Idle` while a muzzle-flash/tracer effect does the visual work, as this project's
`World.ts` already seems to do for tracers). Revisit if a proper aim-pose pack becomes available
(see CREDITS.md note on the Zombie Apocalypse Kit retry).

---

## zombie.glb

- Meshes: `Zombie` (main body, 137.16 KB), `Eyelid` (4.58 KB)
- Material: `Atlas`, texture `Zombie_Atlas.png` (512×512 webp)
- File size: 275.2 KB
- Bind-pose bbox (skin-evaluated, meters): X≈1.31, Y≈1.19 (height), Z≈0.73
- **Suggested scale to reach 1.8 m character height: `1.51`** (1.8 / 1.19) — verify visually,
  since 1.19 m is a hunched/crouched bind pose, not a straight standing height; scale slightly
  down from 1.51 if the zombie reads too tall once standing upright in an idle/walk cycle.
- Animation clips (each name appears twice: once bare, once prefixed `CharacterArmature|` — same
  data, just dual-named by the exporter; use either):
  - `Idle` — idle
  - `Walk` — walk
  - `Run`, `Run_Arms` — run variants
  - `Idle_Attack`, `Run_Attack`, `Punch` — attack (three variants: standing attack, running attack, punch)
  - `Death` — death
  - `Crawl` — crawl (legless/downed zombie variant)
  - `HitReact` — hit reaction
  - `Jump`, `Jump_Idle`, `Jump_Land` — jump
  - `Wave`, `Yes`, `No` — emotes (unlikely to be needed)

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

## rifle.glb

- Source: Kenney Blaster Kit `blaster-d.glb` (meshes `blaster-d` + `magazine`)
- File size: 11.2 KB
- Raw bbox (meters): X=0.165, Y=0.372, Z=0.908 (length along Z)
- No scaling needed if 1 unit = 1 m elsewhere in the scene (already a plausible real-world rifle
  length); attach at the character's right-hand bone.

## pistol.glb

- Source: Kenney Blaster Kit `blaster-k.glb`
- File size: 10.0 KB
- Raw bbox (meters): X=0.155, Y=0.334, Z=0.460 (length along Z)
- No scaling needed for the same reason as above.

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
