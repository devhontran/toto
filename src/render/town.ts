import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HOUSES, MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'

const HOUSE_VISUAL_HEIGHT = 5
const ROAD_HALF = 6
const TREE_COUNT = 50
const TREE_HEIGHT = 4
const TREE_MARGIN = 1
const TREE_SEED = 1337

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function buildHouses(gltf: GLTF): THREE.Group {
  const group = new THREE.Group()
  const src = gltf.scene
  src.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(src)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  for (const h of HOUSES) {
    const pivot = new THREE.Group()
    pivot.position.set(h.x, 0, h.z)
    pivot.rotation.y = h.x < 0 ? Math.PI / 2 : -Math.PI / 2
    const model = src.clone()
    model.scale.set((h.hd * 2) / size.x, HOUSE_VISUAL_HEIGHT / size.y, (h.hw * 2) / size.z)
    model.position.set(-center.x * model.scale.x, -box.min.y * model.scale.y, -center.z * model.scale.z)
    pivot.add(model)
    group.add(pivot)
  }
  return group
}

function blocked(x: number, z: number, r: number): boolean {
  for (const h of HOUSES) {
    if (Math.abs(x - h.x) < h.hw + TREE_MARGIN + r && Math.abs(z - h.z) < h.hd + TREE_MARGIN + r) return true
  }
  return false
}

export function buildTrees(gltf: GLTF): THREE.Group {
  const group = new THREE.Group()
  const src = gltf.scene
  src.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(src)
  const size = box.getSize(new THREE.Vector3())
  const baseScale = TREE_HEIGHT / size.y
  const radius = (Math.max(size.x, size.z) / 2) * baseScale * 1.3
  const rng = lcg(TREE_SEED)
  const matrices: THREE.Matrix4[] = []
  const dummy = new THREE.Object3D()
  let guard = 0
  while (matrices.length < TREE_COUNT && guard++ < TREE_COUNT * 50) {
    const side = rng() < 0.5 ? -1 : 1
    const x = side * (ROAD_HALF + TREE_MARGIN + radius + rng() * (MAP_HALF_WIDTH - ROAD_HALF - TREE_MARGIN - radius * 2))
    const z = -rng() * MAP_LENGTH
    const s = 0.8 + rng() * 0.5
    const yaw = rng() * Math.PI * 2
    if (blocked(x, z, radius)) continue
    dummy.position.set(x, -box.min.y * baseScale * s, z)
    dummy.rotation.set(0, yaw, 0)
    dummy.scale.setScalar(baseScale * s)
    dummy.updateMatrix()
    matrices.push(dummy.matrix.clone())
  }
  const m = new THREE.Matrix4()
  src.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const inst = new THREE.InstancedMesh(o.geometry, o.material, matrices.length)
    matrices.forEach((mat, i) => inst.setMatrixAt(i, m.multiplyMatrices(mat, o.matrixWorld)))
    inst.computeBoundingSphere()
    group.add(inst)
  })
  return group
}
