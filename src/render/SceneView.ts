import * as THREE from 'three'
import type { World } from '../game/World'
import type { Assets } from '../level/assets'
import { EXIT_ZONE, MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'
import { REVIVE_TIME } from '../entities/Bot'
import { ZOMBIE_ATTACK } from '../entities/Zombie'
import { HumanView, ZombieView } from './characters'
import { BOT_LOOKS, PLAYER_LOOK } from './blocky'
import { buildHouses, buildTrees } from './town'

const MAX_TRACERS = 128
const TRACER_Y = 1.25
const TRACER_WIDTH = 0.04
const TRACER_NEAR_SKIP = 1.5
const ATTACK_WINDOW = 0.3
const CULL_Y = 0.9
const CULL_RADIUS = 1.5
const GROUND_MARGIN = 160
const FOG_NEAR = 20
const FOG_FAR = 46

const COLORS = {
  background: '#6f7f96',
  ground: '#2b2f27',
  road: '#3a3a3e',
  tracer: '#fff1a8',
  exit: '#39ff88',
}

export class SceneView {
  readonly scene = new THREE.Scene()
  private readonly player: HumanView
  private readonly bots: HumanView[] = []
  private readonly reviveRing: THREE.Mesh
  private readonly zombies = new Map<number, ZombieView>()
  private readonly zombiePool: ZombieView[] = []
  private readonly seen = new Set<number>()
  private readonly tracers: THREE.InstancedMesh
  private readonly dummy = new THREE.Object3D()
  private readonly frustum = new THREE.Frustum()
  private readonly projView = new THREE.Matrix4()
  private readonly sphere = new THREE.Sphere()
  private world: World | null = null
  private firstPerson = false

  constructor(assets: Assets) {
    this.scene.background = new THREE.Color(COLORS.background)
    this.scene.fog = new THREE.Fog(COLORS.background, FOG_NEAR, FOG_FAR)
    this.scene.add(new THREE.HemisphereLight('#dfe6ff', '#4a4a3a', 1.8))
    const sun = new THREE.DirectionalLight('#fff2dd', 2.6)
    sun.position.set(10, 25, 5)
    this.scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF_WIDTH * 2 + GROUND_MARGIN, MAP_LENGTH + GROUND_MARGIN).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COLORS.ground }),
    )
    ground.position.z = -MAP_LENGTH / 2
    this.scene.add(ground)

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, MAP_LENGTH + GROUND_MARGIN).rotateX(-Math.PI / 2),
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

    this.player = new HumanView(PLAYER_LOOK)
    this.scene.add(this.player.body.root)
    for (const look of BOT_LOOKS) {
      const bot = new HumanView(look)
      this.scene.add(bot.body.root)
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
    this.player.sync(p, p.weapon.def.id, dt)
    this.player.body.root.visible = !this.firstPerson
    for (let i = 0; i < this.bots.length; i++) {
      const b = world.bots[i]
      const view = this.bots[i]
      if (!b) {
        view.body.root.visible = false
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
      const len = Math.hypot(dx, dz)
      if (len <= TRACER_NEAR_SKIP) continue
      const k = TRACER_NEAR_SKIP / len
      this.dummy.position.set(tr.x0 + dx * k, TRACER_Y, tr.z0 + dz * k)
      this.dummy.rotation.set(0, Math.atan2(dx, dz), 0)
      this.dummy.scale.set(1, 1, len - TRACER_NEAR_SKIP)
      this.dummy.updateMatrix()
      this.tracers.setMatrixAt(t, this.dummy.matrix)
      t++
    }
    this.tracers.count = t
    this.tracers.instanceMatrix.needsUpdate = true
  }

  setFirstPerson(on: boolean): void {
    this.firstPerson = on
    this.player.body.root.visible = !on
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
        view = this.zombiePool.pop() ?? new ZombieView()
        view.spawn(z.kind)
        this.scene.add(view.body.root)
        this.zombies.set(z.id, view)
      }
      this.sphere.center.set(z.x, CULL_Y, z.z)
      this.sphere.radius = CULL_RADIUS
      const onScreen = this.frustum.intersectsSphere(this.sphere)
      const since = ZOMBIE_ATTACK.cooldown - z.attackCooldown
      const f = view.frame
      f.x = z.x
      f.z = z.z
      f.angle = z.angle
      f.alive = z.alive
      f.hp = z.hp
      f.attack = z.alive && since < ATTACK_WINDOW ? since / ATTACK_WINDOW : -1
      view.sync(dt, onScreen)
      view.body.root.visible = onScreen
    }
    for (const [id, view] of this.zombies) {
      if (this.seen.has(id)) continue
      this.release(id, view)
    }
  }

  private release(id: number, view: ZombieView): void {
    this.zombies.delete(id)
    view.body.root.removeFromParent()
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
    this.zombiePool.length = 0
  }
}
