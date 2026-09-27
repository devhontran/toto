import * as THREE from 'three'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private timer = new THREE.Timer()
  private cube: THREE.Mesh

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    this.camera.position.set(0, 1.5, 5)
    this.camera.lookAt(0, 0, 0)

    this.scene.background = new THREE.Color('#0b0b10')
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.4))
    const sun = new THREE.DirectionalLight('#ffffff', 2)
    sun.position.set(3, 5, 4)
    this.scene.add(sun)

    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ff5a36' }),
    )
    this.scene.add(this.cube)

    this.resize()
    window.addEventListener('resize', this.resize)
  }

  start() {
    this.renderer.setAnimationLoop(this.tick)
  }

  private tick = (time: number) => {
    this.timer.update(time)
    const dt = this.timer.getDelta()
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private update(dt: number) {
    this.cube.rotation.x += dt * 0.6
    this.cube.rotation.y += dt * 0.9
  }

  private resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this.resize)
    this.renderer.dispose()
  }
}
