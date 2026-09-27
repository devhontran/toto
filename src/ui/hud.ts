import type { World } from '../game/World'
import { PLAYER_MAX_HP } from '../entities/Player'
import { BOT_MAX_HP } from '../entities/Bot'
import { EXIT_ZONE } from '../level/map'
import { ZOMBIE_STATS } from '../entities/Zombie'

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
  private readonly botFills: HTMLElement[]
  private readonly botRows: HTMLElement[]
  private readonly downed: HTMLElement
  private readonly hint: HTMLElement
  private readonly boss: HTMLElement
  private readonly bossFill: HTMLElement
  private readonly showFps: boolean

  constructor(parent: HTMLElement, onRestart: () => void, showFps: boolean) {
    this.showFps = showFps
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.root.innerHTML = `
      <div class="hud__fps" data-fps></div>
      <div class="hud__crosshair"></div>
      <div class="hud__hint" data-hint>Click để chơi</div>
      <div data-boss hidden style="position:absolute;top:14px;left:50%;transform:translateX(-50%);width:40vw;text-align:center">
        <div style="margin-bottom:4px;letter-spacing:0.08em">ZOMBIE KHỔNG LỒ</div>
        <div style="height:12px;background:rgb(0 0 0 / 0.55);border:2px solid rgb(0 0 0 / 0.8)">
          <div data-boss-fill style="height:100%;width:100%;background:#d42020"></div>
        </div>
      </div>
      <div class="hud__top">
        <span data-kills></span>
        <span data-distance></span>
      </div>
      <div class="hud__player-panel">
        <div class="hud__hp">
          <div class="hud__hp-bar"><div class="hud__hp-fill" data-hp-fill></div></div>
          <span data-hp-text></span>
        </div>
        <div class="hud__bots" data-bots>
          <div class="hud__bot" data-bot="0">
            <span class="hud__bot-label">B1</span>
            <div class="hud__hp-bar hud__hp-bar--small"><div class="hud__hp-fill" data-bot-fill="0"></div></div>
          </div>
          <div class="hud__bot" data-bot="1">
            <span class="hud__bot-label">B2</span>
            <div class="hud__hp-bar hud__hp-bar--small"><div class="hud__hp-fill" data-bot-fill="1"></div></div>
          </div>
          <div class="hud__bot" data-bot="2">
            <span class="hud__bot-label">B3</span>
            <div class="hud__hp-bar hud__hp-bar--small"><div class="hud__hp-fill" data-bot-fill="2"></div></div>
          </div>
        </div>
      </div>
      <div class="hud__downed" data-downed hidden>Đang gục — chờ đồng đội</div>
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
    this.botFills = [0, 1, 2].map((i) => q(`[data-bot-fill="${i}"]`))
    this.botRows = [0, 1, 2].map((i) => q(`[data-bot="${i}"]`))
    this.downed = q('[data-downed]')
    this.hint = q('[data-hint]')
    this.boss = q('[data-boss]')
    this.bossFill = q('[data-boss-fill]')
    this.fps.hidden = !showFps
    q('[data-restart]').addEventListener('click', onRestart)
  }

  update(world: World, fps: number, locked: boolean): void {
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

    for (let i = 0; i < this.botFills.length; i++) {
      const bot = world.bots[i]
      this.botRows[i].hidden = !bot
      if (!bot) continue
      this.botFills[i].style.width = `${(bot.hp / BOT_MAX_HP) * 100}%`
      this.botRows[i].classList.toggle('hud__bot--downed', !bot.alive)
    }
    this.downed.hidden = p.alive
    const boss = world.boss
    this.boss.hidden = !boss || !boss.alive
    if (boss && boss.alive) this.bossFill.style.width = `${(boss.hp / ZOMBIE_STATS.boss.hp) * 100}%`

    const ended = world.status === 'won' || world.status === 'lost'
    this.hint.hidden = locked || ended
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
