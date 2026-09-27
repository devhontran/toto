import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { CameraRig, CHASE_BACK, CHASE_UP } from './CameraRig'

describe('CameraRig.chase', () => {
  it('settles behind and above the target, looking at it', () => {
    const camera = new THREE.PerspectiveCamera()
    const rig = new CameraRig(camera)
    rig.place(0, 0, Math.PI, 0)
    const plane = new THREE.Object3D()
    plane.position.set(10, 0, -20)
    plane.rotation.y = Math.PI / 2
    for (let i = 0; i < 600; i++) rig.chase(plane, 1 / 60)
    expect(camera.position.x).toBeCloseTo(10 - CHASE_BACK, 1)
    expect(camera.position.y).toBeCloseTo(CHASE_UP, 1)
    expect(camera.position.z).toBeCloseTo(-20, 1)
    const dir = camera.getWorldDirection(new THREE.Vector3())
    const toTarget = plane.position.clone().sub(camera.position).normalize()
    expect(dir.dot(toTarget)).toBeGreaterThan(0.999)
  })

  it('eases in from the first-person view instead of snapping', () => {
    const camera = new THREE.PerspectiveCamera()
    const rig = new CameraRig(camera)
    rig.place(0, 0, Math.PI, 0)
    const plane = new THREE.Object3D()
    plane.position.set(0, 0, -100)
    rig.chase(plane, 1 / 60)
    expect(camera.position.distanceTo(new THREE.Vector3(0, 1.6, 0))).toBeLessThan(10)
  })
})
