import type { Objective } from '../game/World'
import type { RouteProgress } from '../level/route'
import type { Vec2 } from '../lib/math2'

export interface ObjectiveInfo {
  text: string
  target: Vec2 | null
}

export function objectiveInfo(
  objective: Objective,
  progress: RouteProgress,
  player: Vec2,
  boardZone: { x: number; z: number; r: number },
): ObjectiveInfo {
  switch (objective) {
    case 'reach-airport':
      return {
        text: `Đến sân bay · ${Math.max(0, Math.round(progress.total - progress.distance))}m`,
        target: progress.next,
      }
    case 'kill-boss':
      return { text: 'Hạ zombie khổng lồ!', target: null }
    case 'board': {
      const d = Math.hypot(boardZone.x - player.x, boardZone.z - player.z) - boardZone.r
      return { text: `Lên máy bay! · ${Math.max(0, Math.round(d))}m`, target: boardZone }
    }
    case 'escape':
      return { text: 'Cất cánh!', target: null }
  }
}
