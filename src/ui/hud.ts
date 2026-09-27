import type { World } from '../game/World'
import { PLAYER_MAX_HP } from '../entities/Player'
import { EXIT_ZONE } from '../level/map'

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export class Hud {
  private readonly root: HTMLDivElement
  private readonly hpFill: HTMLElement
  private readonly hpText: HTMLElement
  private readonly weapon: HTMLElement
  private readonly ammo: HTMLElement
  private readonly kills: HTMLElement
  private readonly distance: HTMLElement
  private readonly fps: HTMLElement
  private readonly end: HTMLElement
  private readonly endTitle: HTMLElement
  private readonly endStats: HTMLElement
  private readonly showFps: boolean

  constructor(parent: HTMLElement, onRestart: () => void, showFps: boolean) {
    this.showFps = showFps
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.root.innerHTML = `
      <div class="hud__fps" data-fps></div>
      <div class="hud__top">
        <span data-kills></span>
        <span data-distance></span>
      </div>
      <div class="hud__hp">
        <div class="hud__hp-bar"><div class="hud__hp-fill" data-hp-fill></div></div>
        <span data-hp-text></span>
      </div>
      <div class="hud__weapon">
        <span class="hud__weapon-name" data-weapon></span>
        <span class="hud__ammo" data-ammo></span>
      </div>
      <div class="hud__end" data-end hidden>
        <h1 data-end-title></h1>
        <p data-end-stats></p>
        <button type="button" data-restart>Chơi lại</button>
      </div>`
    parent.appendChild(this.root)
    const q = (sel: string) => this.root.querySelector<HTMLElement>(sel)!
    this.hpFill = q('[data-hp-fill]')
    this.hpText = q('[data-hp-text]')
    this.weapon = q('[data-weapon]')
    this.ammo = q('[data-ammo]')
    this.kills = q('[data-kills]')
    this.distance = q('[data-distance]')
    this.fps = q('[data-fps]')
    this.end = q('[data-end]')
    this.endTitle = q('[data-end-title]')
    this.endStats = q('[data-end-stats]')
    this.fps.hidden = !showFps
    q('[data-restart]').addEventListener('click', onRestart)
  }

  update(world: World, fps: number): void {
    const p = world.player
    const w = p.weapon
    this.hpFill.style.width = `${(p.hp / PLAYER_MAX_HP) * 100}%`
    setText(this.hpText, String(Math.ceil(p.hp)))
    setText(this.weapon, w.def.name)
    setText(
      this.ammo,
      w.reloading ? 'Đang nạp…' : `${w.mag} / ${w.def.infiniteReserve ? '∞' : w.reserve}`,
    )
    setText(this.kills, `Hạ: ${world.kills}`)
    const d = Math.round(Math.hypot(p.x - EXIT_ZONE.x, p.z - EXIT_ZONE.z))
    setText(this.distance, `Còn ${d}m`)
    if (this.showFps) setText(this.fps, `${Math.round(fps)} fps · ${world.aliveZombies} zombie`)

    const ended = world.status !== 'playing'
    this.end.hidden = !ended
    if (ended) {
      setText(this.endTitle, world.status === 'won' ? 'Đã thoát!' : 'Bạn đã gục')
      setText(this.endStats, `Thời gian ${formatTime(world.time)} · Hạ ${world.kills} zombie`)
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
