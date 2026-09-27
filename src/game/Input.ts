import type { FrameInput } from './World'

export class InputState {
  mouseX = 0
  mouseY = 0
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

  reset(): void {
    this.keys.clear()
    this.fireHeld = false
  }

  get moveX(): number {
    return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
  }

  get moveZ(): number {
    return (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0)
  }

  consume(aimX: number, aimZ: number): FrameInput {
    const frame: FrameInput = {
      moveX: this.moveX,
      moveZ: this.moveZ,
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
  const pointerMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    state.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1
    state.mouseY = -((e.clientY - r.top) / r.height) * 2 + 1
  }
  const pointerDown = (e: PointerEvent) => {
    if (e.button === 0) state.fireHeld = true
  }
  const pointerUp = (e: PointerEvent) => {
    if (e.button === 0) state.fireHeld = false
  }
  const blur = () => state.reset()
  const contextMenu = (e: Event) => e.preventDefault()

  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('pointermove', pointerMove)
  el.addEventListener('pointerdown', pointerDown)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('blur', blur)
  el.addEventListener('contextmenu', contextMenu)

  return () => {
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('keyup', keyUp)
    window.removeEventListener('pointermove', pointerMove)
    el.removeEventListener('pointerdown', pointerDown)
    window.removeEventListener('pointerup', pointerUp)
    window.removeEventListener('blur', blur)
    el.removeEventListener('contextmenu', contextMenu)
  }
}
