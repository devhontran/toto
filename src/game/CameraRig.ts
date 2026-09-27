import * as THREE from 'three'

const EYE_HEIGHT = 1.6
export const CHASE_BACK = 24
export const CHASE_UP = 8
const CHASE_FOLLOW = 2.5
const CHASE_AIM = 8

export class CameraRig {
  private readonly camera: THREE.PerspectiveCamera
  private readonly target = new THREE.Vector3()
  private readonly forward = new THREE.Vector3()
  private readonly desired = new THREE.Vector3()
  private readonly aim = new THREE.Vector3()
  private chasing = false

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.camera.rotation.order = 'YXZ'
  }

  place(x: number, z: number, yaw: number, pitch: number): void {
    this.chasing = false
    this.camera.position.set(x, EYE_HEIGHT, z)
    this.camera.rotation.set(pitch, yaw + Math.PI, 0)
  }

  chase(object: THREE.Object3D, dt: number): void {
    object.updateWorldMatrix(true, false)
    object.getWorldPosition(this.target)
    object.getWorldDirection(this.forward)
    this.forward.y = 0
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, 1)
    this.forward.normalize()
    this.desired.copy(this.target).addScaledVector(this.forward, -CHASE_BACK)
    this.desired.y += CHASE_UP
    if (!this.chasing) {
      this.chasing = true
      this.camera.getWorldDirection(this.aim).multiplyScalar(10).add(this.camera.position)
    }
    this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * CHASE_FOLLOW))
    this.aim.lerp(this.target, 1 - Math.exp(-dt * CHASE_AIM))
    this.camera.lookAt(this.aim)
  }
}
