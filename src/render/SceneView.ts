import * as THREE from 'three'
import type { World } from '../game/World'
import type { Assets } from '../level/assets'
import { CITY } from '../level/city'
import { BOARD_ZONE } from '../level/map'
import { REVIVE_TIME } from '../entities/Bot'
import { HumanView, ZombieView } from './characters'
import { BOT_LOOKS, PLAYER_LOOK } from './blocky'
import { buildCity, CHUNK_SIZE } from './city'
import { Airplane } from './plane'

const MAX_TRACERS = 128
const TRACER_Y = 1.25
const TRACER_WIDTH = 0.04
const TRACER_NEAR_SKIP = 1.5
const ATTACK_WINDOW = 0.3
const FOG_NEAR = 20
const FOG_FAR = 46
const ESCAPE_FOG_NEAR = 60
const ESCAPE_FOG_FAR = 190
const ESCAPE_FOG_RAMP = 2
const CHUNK_REACH = CHUNK_SIZE * 0.75
const BOARD_SLACK = 0.5

const COLORS = {
  background: '#6f7f96',
  tracer: '#fff1a8',
}

export class SceneView {
  readonly scene = new THREE.Scene()
  readonly plane: THREE.Group
  private readonly airplane: Airplane
  private readonly chunks: THREE.Object3D[]
  private readonly fog: THREE.Fog
  private readonly eye = new THREE.Vector3()
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

  constructor(_assets: Assets) {
    this.scene.background = new THREE.Color(COLORS.background)
    this.fog = new THREE.Fog(COLORS.background, FOG_NEAR, FOG_FAR)
    this.scene.fog = this.fog
    this.scene.add(new THREE.HemisphereLight('#dfe6ff', '#4a4a3a', 1.8))
    const sun = new THREE.DirectionalLight('#fff2dd', 2.6)
    sun.position.set(10, 25, 5)
    this.scene.add(sun)

    const city = buildCity()
    this.chunks = city.chunks
    this.scene.add(city.root)
    this.airplane = new Airplane(city.textures, CITY.airport.plane)
    this.plane = this.airplane.root
    this.scene.add(this.plane)

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
    this.airplane.update(world.status, world.escapeTime, dt)
    this.syncEscape(world)

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
    this.cullChunks(camera)

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

  private syncEscape(world: World): void {
    const away = world.status === 'escaping' || world.status === 'won'
    const k = away ? Math.min(1, (world.status === 'won' ? ESCAPE_FOG_RAMP : world.escapeTime) / ESCAPE_FOG_RAMP) : 0
    this.fog.near = FOG_NEAR + (ESCAPE_FOG_NEAR - FOG_NEAR) * k
    this.fog.far = FOG_FAR + (ESCAPE_FOG_FAR - FOG_FAR) * k
    if (!away) return
    const boarded = (t: { x: number; z: number }) =>
      Math.hypot(t.x - BOARD_ZONE.x, t.z - BOARD_ZONE.z) <= BOARD_ZONE.r + BOARD_SLACK
    if (boarded(world.player)) this.player.body.root.visible = false
    world.bots.forEach((b, i) => {
      if (this.bots[i] && boarded(b)) this.bots[i].body.root.visible = false
    })
  }

  private cullChunks(camera: THREE.Camera): void {
    camera.getWorldPosition(this.eye)
    const reach = this.fog.far + CHUNK_REACH
    for (const c of this.chunks) c.visible = Math.hypot(c.userData.x - this.eye.x, c.userData.z - this.eye.z) < reach
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
      this.sphere.center.set(z.x, view.cullY, z.z)
      this.sphere.radius = view.cullRadius
      const onScreen = this.frustum.intersectsSphere(this.sphere)
      const since = z.attack.cooldown - z.attackCooldown
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
