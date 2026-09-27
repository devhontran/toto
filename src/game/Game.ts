import * as THREE from 'three'
import { World } from './World'
import { FixedStep } from './fixedStep'
import { InputState, bindInput } from './Input'
import { CameraRig } from './CameraRig'
import { SceneView } from '../render/SceneView'
import { Viewmodel } from '../render/viewmodel'
import { Hud } from '../ui/hud'
import type { Assets } from '../level/assets'

const STEP = 1 / 60
const MAX_FRAME = 0.25
const AIM_DISTANCE = 20

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200)
  private readonly rig: CameraRig
  private readonly view: SceneView
  private readonly viewmodel = new Viewmodel()
  private readonly input = new InputState()
  private readonly unbindInput: () => void
  private readonly hud: Hud
  private readonly stepper = new FixedStep(STEP, MAX_FRAME)
  private readonly timer = new THREE.Timer()
  private readonly debug: boolean
  private world: World
  private fps = 60

  constructor(canvas: HTMLCanvasElement, assets: Assets) {
    this.debug = new URLSearchParams(location.search).has('debug')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.view = new SceneView(assets)
    this.view.setFirstPerson(true)
    this.view.scene.add(this.camera)
    this.camera.add(this.viewmodel.root)
    this.rig = new CameraRig(this.camera)
    this.unbindInput = bindInput(this.input, canvas)
    this.hud = new Hud(document.body, () => this.restart(), this.debug)
    this.world = this.createWorld()
    this.snapCamera()
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
    this.input.resetView()
    this.snapCamera()
  }

  private snapCamera(): void {
    const p = this.world.player
    this.rig.place(p.x, p.z, this.input.yaw, this.input.pitch)
  }

  private tick = (time: number): void => {
    this.timer.update(time)
    const dt = this.timer.getDelta()
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.1
    this.stepper.advance(dt, (step) => {
      const p = this.world.player
      const yaw = this.input.yaw
      this.world.step(step, this.input.consume(p.x + Math.sin(yaw) * AIM_DISTANCE, p.z + Math.cos(yaw) * AIM_DISTANCE))
    })
    if ((this.world.status === 'won' || this.world.status === 'lost') && this.input.locked) document.exitPointerLock()
    const p = this.world.player
    this.rig.place(p.x, p.z, this.input.yaw, this.input.pitch)
    this.viewmodel.update(p.weapon.def.id, p.weapon.mag, p.alive, p.x, p.z, dt)
    this.view.sync(this.world, dt, this.camera)
    this.hud.update(this.world, this.fps, this.input.locked, this.input.yaw, this.input.mapHeld, dt)
    this.renderer.render(this.view.scene, this.camera)
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
    this.viewmodel.dispose()
    this.view.dispose()
    this.renderer.dispose()
  }
}
