import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

const CROSSFADE = 0.15

export interface RigTemplate {
  scene: THREE.Object3D
  clips: THREE.AnimationClip[]
  once: ReadonlySet<string>
  scale: number
  offsetY: number
  yaw: number
}

export interface RigOptions {
  clips: readonly string[]
  poseClip: string
  once: readonly string[]
  height: number
  yaw?: number
}

export function measureSkinned(root: THREE.Object3D, target: THREE.Box3): THREE.Box3 {
  root.updateMatrixWorld(true)
  target.makeEmpty()
  const box = new THREE.Box3()
  root.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return
    o.computeBoundingBox()
    box.copy(o.boundingBox!).applyMatrix4(o.matrixWorld)
    target.union(box)
  })
  return target
}

export function createRigTemplate(gltf: GLTF, opts: RigOptions): RigTemplate {
  const clips = opts.clips.map((name) => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name)
    if (!clip) throw new Error(`missing clip ${name}`)
    return clip
  })
  const scene = gltf.scene
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.frustumCulled = false
  })
  const mixer = new THREE.AnimationMixer(scene)
  mixer.clipAction(clips[opts.clips.indexOf(opts.poseClip)]).play()
  mixer.update(0)
  const box = measureSkinned(scene, new THREE.Box3())
  mixer.stopAllAction()
  mixer.uncacheRoot(scene)
  const height = box.max.y - box.min.y
  const scale = opts.height / height
  return {
    scene,
    clips,
    once: new Set(opts.once),
    scale,
    offsetY: -box.min.y * scale,
    yaw: opts.yaw ?? 0,
  }
}

export class AnimatedRig {
  readonly root = new THREE.Group()
  readonly model: THREE.Object3D
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null

  constructor(t: RigTemplate) {
    this.model = SkeletonUtils.clone(t.scene)
    this.model.scale.setScalar(t.scale)
    this.model.position.y = t.offsetY
    this.model.rotation.y = t.yaw
    this.root.add(this.model)
    this.mixer = new THREE.AnimationMixer(this.model)
    for (const clip of t.clips) {
      const action = this.mixer.clipAction(clip)
      if (t.once.has(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      this.actions.set(clip.name, action)
    }
  }

  get playing(): string | null {
    return this.current ? this.current.getClip().name : null
  }

  play(name: string, restart = false): void {
    const next = this.actions.get(name)
    if (!next || (next === this.current && !restart)) return
    const prev = this.current
    this.current = next
    next.reset().play()
    if (prev && prev !== next) prev.crossFadeTo(next, CROSSFADE, false)
  }

  snap(name: string): void {
    const next = this.actions.get(name)
    if (!next) return
    this.mixer.stopAllAction()
    this.current = next
    next.reset().play()
  }

  update(dt: number): void {
    this.mixer.update(dt)
  }

  bone(name: string): THREE.Object3D {
    const b = this.model.getObjectByName(name)
    if (!b) throw new Error(`missing bone ${name}`)
    return b
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.model)
    this.model.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose()
    })
  }
}
