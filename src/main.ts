import './style.css'
import { Game } from './game/Game'
import { loadAssets } from './level/assets'
import { LoadingOverlay } from './ui/loading'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const loading = new LoadingOverlay(document.body)
let game: Game | null = null
let disposed = false

loadAssets().then(
  (assets) => {
    if (disposed) return
    loading.dispose()
    game = new Game(canvas, assets)
    game.start()
  },
  (err: unknown) => {
    console.error(err)
    loading.fail()
  },
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true
    loading.dispose()
    game?.dispose()
  })
}
