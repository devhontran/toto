import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { World } from '../game/World'
import type { Assets } from '../level/assets'
import { EXIT_ZONE, MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'
import { REVIVE_TIME } from '../entities/Bot'
import { ZOMBIE_ATTACK } from '../entities/Zombie'
import { createRigTemplate, type RigTemplate } from './rig'
import { HUMAN_CLIPS, HumanView, ZOMBIE_CLIPS, ZombieView } from './characters'
import { buildHouses, buildTrees } from './town'

const MAX_TRACERS = 128
const TRACER_Y = 1.1
const TRACER_WIDTH = 0.12
const CHARACTER_HEIGHT = 1.8
const ZOMBIE_HEIGHT = 1.6
const RIFLE_LENGTH = 0.8
const PISTOL_LENGTH = 0.35
const GUN_FORWARD = 0.15
const ATTACK_WINDOW = 0.4
const CULL_Y = 0.9
const CULL_RADIUS = 1.5

const COLORS = {
  background: '#0b0b10',
  ground: '#2b2f27',
  road: '#3a3a3e',
  tracer: '#fff1a8',
  exit: '#39ff88',
}

function makeGun(gltf: GLTF, length: number): THREE.Object3D {
  const holder = new THREE.Group()
  const model = gltf.scene.clone()
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const k = length / size.z
  model.scale.multiplyScalar(k)
  model.position.set(-center.x * k, -center.y * k, -center.z * k + GUN_FORWARD)
  holder.add(model)
  return holder
}

function humanTemplate(gltf: GLTF): RigTemplate {
  return createRigTemplate(gltf, {
    clips: Object.values(HUMAN_CLIPS),
    poseClip: HUMAN_CLIPS.idle,
    once: [HUMAN_CLIPS.death],
    height: CHARACTER_HEIGHT,
  })
}

export class SceneView {
  readonly scene = new THREE.Scene()
  private readonly player: HumanView
  private readonly bots: HumanView[] = []
  private readonly reviveRing: THREE.Mesh
  private readonly zombieTemplate: RigTemplate
  private readonly zombies = new Map<number, ZombieView>()
  private readonly zombiePool: ZombieView[] = []
  private readonly seen = new Set<number>()
  private readonly tracers: THREE.InstancedMesh
  private readonly dummy = new THREE.Object3D()
  private readonly frustum = new THREE.Frustum()
  private readonly projView = new THREE.Matrix4()
  private readonly sphere = new THREE.Sphere()
  private world: World | null = null

  constructor(assets: Assets) {
    const humanTemplates = [assets.man, assets.manAlt, assets.manLongsleeves, assets.manSuit].map(humanTemplate)
    this.zombieTemplate = createRigTemplate(assets.zombie, {
      clips: Object.values(ZOMBIE_CLIPS),
      poseClip: ZOMBIE_CLIPS.walk,
      once: [ZOMBIE_CLIPS.death],
      height: ZOMBIE_HEIGHT,
    })

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

    this.scene.add(buildHouses(assets.house))
    this.scene.add(buildTrees(assets.tree))

    const exit = new THREE.Mesh(
      new THREE.RingGeometry(EXIT_ZONE.r - 0.4, EXIT_ZONE.r, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: COLORS.exit }),
    )
    exit.position.set(EXIT_ZONE.x, 0.02, EXIT_ZONE.z)
    this.scene.add(exit)

    this.player = new HumanView(humanTemplates[0], {
      rifle: makeGun(assets.rifle, RIFLE_LENGTH),
      pistol: makeGun(assets.pistol, PISTOL_LENGTH),
    })
    this.scene.add(this.player.rig.root)
    for (let i = 1; i < humanTemplates.length; i++) {
      const bot = new HumanView(humanTemplates[i], { rifle: makeGun(assets.rifle, RIFLE_LENGTH) })
      this.scene.add(bot.rig.root)
      this.bots.push(bot)
    }

    this.reviveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }),
    )
    this.reviveRing.visible = false
    this.scene.add(this.reviveRing)


    this.tracers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(TRACER_WIDTH, TRACER_WIDTH, 1).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({ color: COLORS.tracer, transparent: true, opacity: 0.9 }),
      MAX_TRACERS,
    )
    this.tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.tracers.count = 0
    this.tracers.frustumCulled = false
    this.scene.add(this.tracers)
  }

  sync(world: World, dt: number, camera: THREE.Camera): void {
    if (world !== this.world) this.reset(world)
    const p = world.player
    this.player.sync(p, p.weapon.def.id === 'pistol' ? 'pistol' : 'rifle', dt)
    for (let i = 0; i < this.bots.length; i++) {
      const b = world.bots[i]
      const view = this.bots[i]
      if (!b) {
        view.rig.root.visible = false
        continue
      }
      view.sync(b, 'rifle', dt)
    }

    let ringOwner: { x: number; z: number; reviveProgress: number } | null = null
    if (!p.alive && p.reviveProgress > 0) ringOwner = p
    for (const b of world.bots) if (!b.alive && b.reviveProgress > 0) ringOwner = b
    if (ringOwner) {
      this.reviveRing.visible = true
      this.reviveRing.position.set(ringOwner.x, 0.05, ringOwner.z)
      const frac = Math.min(1, ringOwner.reviveProgress / REVIVE_TIME)
      this.reviveRing.scale.setScalar(0.5 + frac * 0.8)
    } else {
      this.reviveRing.visible = false
    }

    this.syncZombies(world, dt, camera)

    let t = 0
    for (const tr of world.tracers) {
      if (t >= MAX_TRACERS) break
      const dx = tr.x1 - tr.x0
      const dz = tr.z1 - tr.z0
      this.dummy.position.set(tr.x0, TRACER_Y, tr.z0)
      this.dummy.rotation.set(0, Math.atan2(dx, dz), 0)
      this.dummy.scale.set(1, 1, Math.max(Math.hypot(dx, dz), 0.01))
      this.dummy.updateMatrix()
      this.tracers.setMatrixAt(t, this.dummy.matrix)
      t++
    }
    this.tracers.count = t
    this.tracers.instanceMatrix.needsUpdate = true
  }

  private syncZombies(world: World, dt: number, camera: THREE.Camera): void {
    camera.updateMatrixWorld()
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projView)
    this.seen.clear()
    for (const z of world.zombies) {
      this.seen.add(z.id)
      let view = this.zombies.get(z.id)
      if (!view) {
        view = this.zombiePool.pop() ?? new ZombieView(this.zombieTemplate)
        view.spawn(z.kind)
        this.scene.add(view.rig.root)
        this.zombies.set(z.id, view)
      }
      view.sync({
        x: z.x,
        z: z.z,
        angle: z.angle,
        alive: z.alive,
        kind: z.kind,
        attacking: z.attackCooldown > ZOMBIE_ATTACK.cooldown - ATTACK_WINDOW,
      })
      this.sphere.center.set(z.x, CULL_Y, z.z)
      this.sphere.radius = CULL_RADIUS
      const onScreen = this.frustum.intersectsSphere(this.sphere)
      view.rig.root.visible = onScreen
      if (onScreen) view.rig.update(dt)
    }
    for (const [id, view] of this.zombies) {
      if (this.seen.has(id)) continue
      this.release(id, view)
    }
  }

  private release(id: number, view: ZombieView): void {
    this.zombies.delete(id)
    view.rig.root.removeFromParent()
    this.zombiePool.push(view)
  }

  private reset(world: World): void {
    this.world = world
    for (const [id, view] of this.zombies) this.release(id, view)
    this.player.reset()
    for (const b of this.bots) b.reset()
  }

  dispose(): void {
    for (const [id, view] of this.zombies) this.release(id, view)
    for (const view of this.zombiePool) view.rig.dispose()
    this.zombiePool.length = 0
    this.player.rig.dispose()
    for (const b of this.bots) b.rig.dispose()
  }
}
