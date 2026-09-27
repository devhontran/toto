import * as THREE from 'three'
import type { World } from '../game/World'
import { EXIT_ZONE, HOUSE_HEIGHT, HOUSES, MAP_HALF_WIDTH, MAP_LENGTH } from '../level/map'

const MAX_ZOMBIES = 400
const MAX_TRACERS = 128
const BODY_HEIGHT = 1
const BODY_RADIUS = 0.4
const TRACER_Y = 1.1
const TRACER_WIDTH = 0.12

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
  tracer: '#fff1a8',
  exit: '#39ff88',
}

export class SceneView {
  readonly scene = new THREE.Scene()
  private readonly player = new THREE.Group()
  private readonly zombies: THREE.InstancedMesh
  private readonly tracers: THREE.InstancedMesh
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
}
