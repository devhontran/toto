import type { FrameInput } from './World'
import { clamp, type Vec2 } from '../lib/math2'

export const LOOK_SENSITIVITY = 0.0025
export const PITCH_MIN = -1.2
export const PITCH_MAX = 1
export const START_YAW = Math.PI
export const START_PITCH = 0

export function relativeMove(yaw: number, strafe: number, forward: number): Vec2 {
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  return { x: forward * s - strafe * c, z: forward * c + strafe * s }
}

export class InputState {
  yaw = START_YAW
  pitch = START_PITCH
  locked = false
  fireHeld = false
  private readonly keys = new Set<string>()
  private reloadQueued = false
  private switchQueued: number | null = null

  handleKey(code: string, down: boolean): void {
    if (!down) {
      this.keys.delete(code)
      return
    }
    this.keys.add(code)
    if (code === 'KeyR') this.reloadQueued = true
    const digit = /^Digit([1-3])$/.exec(code)
    if (digit) this.switchQueued = Number(digit[1]) - 1
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * LOOK_SENSITIVITY
    this.pitch = clamp(this.pitch - dy * LOOK_SENSITIVITY, PITCH_MIN, PITCH_MAX)
  }

  resetView(): void {
    this.yaw = START_YAW
    this.pitch = START_PITCH
  }

  reset(): void {
    this.keys.clear()
    this.fireHeld = false
  }

  get strafe(): number {
    return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
  }

  get forward(): number {
    return (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0)
  }

  consume(aimX: number, aimZ: number): FrameInput {
    const move = relativeMove(this.yaw, this.strafe, this.forward)
    const frame: FrameInput = {
      moveX: move.x,
      moveZ: move.z,
      aimX,
      aimZ,
      fire: this.fireHeld,
      reload: this.reloadQueued,
      switchTo: this.switchQueued,
    }
    this.reloadQueued = false
    this.switchQueued = null
    return frame
  }
}

export function bindInput(state: InputState, el: HTMLElement): () => void {
  const keyDown = (e: KeyboardEvent) => {
    if (!e.repeat) state.handleKey(e.code, true)
  }
  const keyUp = (e: KeyboardEvent) => state.handleKey(e.code, false)
  const mouseMove = (e: MouseEvent) => {
    if (state.locked) state.look(e.movementX, e.movementY)
  }
  const pointerDown = (e: PointerEvent) => {
    if (!state.locked) {
      if (e.button === 0) void el.requestPointerLock()?.catch(() => {})
      return
    }
    if (e.button === 0) state.fireHeld = true
  }
  const pointerUp = (e: PointerEvent) => {
    if (e.button === 0) state.fireHeld = false
  }
  const lockChange = () => {
    state.locked = document.pointerLockElement === el
    if (!state.locked) state.reset()
  }
  const blur = () => state.reset()
  const contextMenu = (e: Event) => e.preventDefault()

  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('mousemove', mouseMove)
  el.addEventListener('pointerdown', pointerDown)
  window.addEventListener('pointerup', pointerUp)
  document.addEventListener('pointerlockchange', lockChange)
  window.addEventListener('blur', blur)
  el.addEventListener('contextmenu', contextMenu)

  return () => {
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('keyup', keyUp)
    window.removeEventListener('mousemove', mouseMove)
    el.removeEventListener('pointerdown', pointerDown)
    window.removeEventListener('pointerup', pointerUp)
    document.removeEventListener('pointerlockchange', lockChange)
    window.removeEventListener('blur', blur)
    el.removeEventListener('contextmenu', contextMenu)
    if (document.pointerLockElement === el) document.exitPointerLock()
  }
}
