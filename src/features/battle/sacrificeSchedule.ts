import type { BattleFrame } from '../../domain/game.ts'

export function sacrificeSchedule(frames: BattleFrame[]) {
  return [...frames].sort((a, b) => {
    const [, ar, ac] = a.action.target.split('-').map(Number)
    const [, br, bc] = b.action.target.split('-').map(Number)
    return ac - bc || ar - br
  }).map((frame, index) => ({ frame, delay: index * 100 }))
}
