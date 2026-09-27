import * as THREE from 'three'
import type { WeaponId } from '../systems/weapons'

const ANCHOR = new THREE.Vector3(0.25, -0.25, -0.5)
const RECOIL_TIME = 0.06
const RECOIL_BACK = 0.05
const RECOIL_PITCH = 0.08
const BOB_RATE = 10
const BOB_X = 0.012
const BOB_Y = 0.01
const MOVING_SPEED = 0.5

type Part = [w: number, h: number, d: number, x: number, y: number, z: number]

const GUN_PARTS: Record<WeaponId, Part[]> = {
  pistol: [
    [0.05, 0.07, 0.2, 0, 0, -0.1],
    [0.045, 0.11, 0.05, 0, -0.07, -0.02],
  ],
  shotgun: [
    [0.06, 0.07, 0.3, 0, 0, -0.1],
    [0.045, 0.045, 0.35, 0, 0.01, -0.42],
    [0.065, 0.05, 0.12, 0, -0.045, -0.38],
    [0.05, 0.07, 0.16, 0, -0.02, 0.1],
    [0.045, 0.1, 0.05, 0, -0.07, -0.02],
  ],
  rifle: [
    [0.06, 0.08, 0.42, 0, 0, -0.18],
    [0.025, 0.025, 0.22, 0, 0.01, -0.5],
    [0.04, 0.13, 0.06, 0, -0.1, -0.2],
    [0.05, 0.07, 0.16, 0, -0.01, 0.1],
    [0.045, 0.1, 0.05, 0, -0.07, -0.02],
  ],
}

export class Viewmodel {
  readonly root = new THREE.Group()
  private readonly guns = new Map<WeaponId, THREE.Group>()
  private readonly box = new THREE.BoxGeometry(1, 1, 1)
  private readonly materials: THREE.Material[] = []
  private weaponId: WeaponId | null = null
  private lastMag = 0
  private recoil = 0
  private bobPhase = 0
  private bobAmount = 0
  private lastX = 0
  private lastZ = 0

  constructor() {
    const gunMat = this.material(0x3a3d42)
    const skinMat = this.material(0xc89f7a)
    const sleeveMat = this.material(0x3aa6c9)
    for (const id of Object.keys(GUN_PARTS) as WeaponId[]) {
      const gun = new THREE.Group()
      for (const part of GUN_PARTS[id]) gun.add(this.part(part, gunMat))
      gun.visible = false
      this.guns.set(id, gun)
      this.root.add(gun)
    }
    this.root.add(this.part([0.08, 0.08, 0.09, 0, -0.075, -0.01], skinMat))
    const sleeve = this.part([0.1, 0.1, 0.32, 0.02, -0.14, 0.17], sleeveMat)
    sleeve.rotation.x = 0.35
    this.root.add(sleeve)
    this.root.position.copy(ANCHOR)
  }

  update(weaponId: WeaponId, mag: number, alive: boolean, x: number, z: number, dt: number): void {
    this.root.visible = alive
    if (weaponId !== this.weaponId) {
      if (this.weaponId) this.guns.get(this.weaponId)!.visible = false
      this.guns.get(weaponId)!.visible = true
      this.weaponId = weaponId
    } else if (mag < this.lastMag) {
      this.recoil = RECOIL_TIME
    }
    this.lastMag = mag

    const speed = dt > 0 ? Math.hypot(x - this.lastX, z - this.lastZ) / dt : 0
    this.lastX = x
    this.lastZ = z
    const target = speed > MOVING_SPEED ? 1 : 0
    this.bobAmount += (target - this.bobAmount) * (1 - Math.exp(-10 * dt))
    this.bobPhase += dt * BOB_RATE * this.bobAmount

    this.recoil = Math.max(0, this.recoil - dt)
    const kick = this.recoil / RECOIL_TIME
    this.root.position.set(
      ANCHOR.x + Math.sin(this.bobPhase) * BOB_X * this.bobAmount,
      ANCHOR.y - Math.abs(Math.cos(this.bobPhase)) * BOB_Y * this.bobAmount,
      ANCHOR.z + kick * RECOIL_BACK,
    )
    this.root.rotation.x = kick * RECOIL_PITCH
  }

  dispose(): void {
    this.root.removeFromParent()
    this.box.dispose()
    for (const m of this.materials) m.dispose()
  }

  private material(color: number): THREE.Material {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true })
    this.materials.push(m)
    return m
  }

  private part([w, h, d, x, y, z]: Part, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(this.box, mat)
    mesh.scale.set(w, h, d)
    mesh.position.set(x, y, z)
    return mesh
  }
}
