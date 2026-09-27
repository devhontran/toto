import * as THREE from 'three'

const OFFSET = new THREE.Vector3(0, 15, 8.5)
const LOOK_AHEAD = -3
const FOLLOW_SHARPNESS = 8

export class CameraRig {
  private readonly camera: THREE.PerspectiveCamera
  private readonly desired = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  snap(x: number, z: number): void {
    this.camera.position.set(x + OFFSET.x, OFFSET.y, z + OFFSET.z)
    this.look()
  }

  update(x: number, z: number, dt: number): void {
    this.desired.set(x + OFFSET.x, OFFSET.y, z + OFFSET.z)
    this.camera.position.lerp(this.desired, 1 - Math.exp(-FOLLOW_SHARPNESS * dt))
    this.look()
  }

  private look(): void {
    const p = this.camera.position
    this.camera.lookAt(p.x - OFFSET.x, 0, p.z - OFFSET.z + LOOK_AHEAD)
  }
}
