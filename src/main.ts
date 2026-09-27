import './style.css'
import { Game } from './game/Game'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const game = new Game(canvas)
game.start()

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose())
}
