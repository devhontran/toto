# public/models — manifest

All files optimized with `@gltf-transform/cli optimize --compress meshopt --texture-compress webp --texture-size 1024`.

Characters (player, bots, zombies) and their guns are procedural blocky meshes built in
`src/render/blocky.ts`; no character GLBs ship. The whole city (houses, shops,
apartments, streets, parks, cars, airport, airliner) is procedural Minecraft-style voxel blocks with
code-generated 16×16 textures (`src/render/voxel.ts`, `src/render/city.ts` and siblings); no GLBs ship.

---

## Not included

- **Barricade/roadblock**: not found in the Kenney packs sourced this session (see CREDITS.md).
