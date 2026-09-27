import type * as THREE from 'three'

const EYE_HEIGHT = 1.6

export class CameraRig {
  private readonly camera: THREE.PerspectiveCamera

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.camera.rotation.order = 'YXZ'
  }

  place(x: number, z: number, yaw: number, pitch: number): void {
    this.camera.position.set(x, EYE_HEIGHT, z)
    this.camera.rotation.set(pitch, yaw + Math.PI, 0)
  }
}
