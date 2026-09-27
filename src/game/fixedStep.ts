export class FixedStep {
  readonly step: number
  readonly maxFrame: number
  private acc = 0

  constructor(step: number, maxFrame: number) {
    this.step = step
    this.maxFrame = maxFrame
  }

  advance(frameDt: number, fn: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameDt, 0), this.maxFrame)
    let n = 0
    while (this.acc >= this.step) {
      fn(this.step)
      this.acc -= this.step
      n++
    }
    return n
  }
}
