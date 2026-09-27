import * as THREE from 'three'
import { World } from './World'
import { FixedStep } from './fixedStep'
import { InputState, bindInput } from './Input'
import { CameraRig } from './CameraRig'
import { SceneView } from '../render/SceneView'
import { Hud } from '../ui/hud'
import type { Assets } from '../level/assets'

const STEP = 1 / 60
const MAX_FRAME = 0.25
const AIM_HEIGHT = 1

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  private readonly rig: CameraRig
  private readonly view: SceneView
  private readonly input = new InputState()
  private readonly unbindInput: () => void
  private readonly hud: Hud
  private readonly stepper = new FixedStep(STEP, MAX_FRAME)
  private readonly timer = new THREE.Timer()
  private readonly raycaster = new THREE.Raycaster()
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AIM_HEIGHT)
  private readonly ndc = new THREE.Vector2()
  private readonly aim = new THREE.Vector3()
  private readonly debug: boolean
  private world: World
  private fps = 60

  constructor(canvas: HTMLCanvasElement, assets: Assets) {
    this.debug = new URLSearchParams(location.search).has('debug')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.view = new SceneView(assets)
    this.rig = new CameraRig(this.camera)
    this.unbindInput = bindInput(this.input, canvas)
    this.hud = new Hud(document.body, () => this.restart(), this.debug)
    this.world = this.createWorld()
    this.rig.snap(this.world.player.x, this.world.player.z)
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick)
  }

  private createWorld(): World {
    return new World({ allWeapons: this.debug })
  }

  private restart(): void {
    this.world = this.createWorld()
    this.input.reset()
    this.rig.snap(this.world.player.x, this.world.player.z)
  }

  private tick = (time: number): void => {
    this.timer.update(time)
    const dt = this.timer.getDelta()
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.1
    this.updateAim()
    this.stepper.advance(dt, (step) => this.world.step(step, this.input.consume(this.aim.x, this.aim.z)))
    this.rig.update(this.world.player.x, this.world.player.z, dt)
    this.view.sync(this.world, dt, this.camera)
    this.hud.update(this.world, this.fps)
    this.renderer.render(this.view.scene, this.camera)
  }

  private updateAim(): void {
    this.ndc.set(this.input.mouseX, this.input.mouseY)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, this.aim)) {
      this.aim.set(this.world.player.x, AIM_HEIGHT, this.world.player.z - 1)
    }
  }

  private resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this.resize)
    this.unbindInput()
    this.hud.dispose()
    this.view.dispose()
    this.renderer.dispose()
  }
}
