import { deployFlight } from './deployFlight'
import { sacrificeSchedule } from './sacrificeSchedule'
import { motionScope } from './motion'
import { attackFlight } from './attackFlight'
import { renderToStaticMarkup } from 'react-dom/server'
import { CardFace } from '../../components/cards/Cards'
import type { BattleAction, Battle, BattleFrame } from '../../domain/game'

const find = (id?: string) => id ? document.querySelector<HTMLElement>(`[data-motion="${CSS.escape(id)}"]`) : null

export async function animateBattleAction(action: BattleAction, signal: AbortSignal, state: Battle, retained?: (() => void)[]) {
  const source = find(action.source), target = find(action.target)
  if (!target || signal.aborted) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const floating: HTMLElement[] = []
  const motion = motionScope(signal)
  const run = (element: HTMLElement, frames: { offset?: number; transform?: string; opacity?: number; filter?: string }[], duration: number) => motion.tween(element, {
    duration: reduced ? 100 : duration,
    ease: 'out(3)',
    keyframes: Object.fromEntries(frames.map((frame, index) => {
      const { offset, ...values } = frame
      return [String((offset ?? index / (frames.length - 1)) * 100) + '%', values]
    })),
  })
  try {
    const end = target.getBoundingClientRect()
    if (action.kind === 'deploy' || action.kind === 'advance') {
      const [side, row, col] = action.target.split('-')
      const card = state[side as 'player' | 'enemy'][Number(row)][Number(col)]
      if (card) await deployFlight(source, target, renderToStaticMarkup(<CardFace card={card}/>), action.kind === 'advance', signal)
    } else if (action.kind === 'attack' && source) {
      // 普通模式的攻击节奏与姿态在 attackFlight.ts 顶部 ATTACK 中调整。
      // 系统选择减少动态效果时，只闪亮原卡牌，不播放飞行与蓄力。
      if (reduced) await run(source, [{ filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], 100)
      else await attackFlight(source, target, action.route === 'air', signal)
    } else if (action.kind === 'hit') {
      const number = document.createElement('div')
      number.className = 'damage-number'
      number.textContent = action.amount ? `−${action.amount}` : '格挡'
      Object.assign(number.style, { left: `${end.left + end.width / 2}px`, top: `${Math.max(80, Math.min(innerHeight - 80, end.top + end.height / 2))}px` })
      document.body.append(number); floating.push(number)
      await Promise.all([
        run(number, [{ opacity: 0, transform: 'translate(-50%,0) scale(.7)' }, { opacity: 1, offset: .2 }, { opacity: 0, transform: 'translate(-50%,-45px) scale(1.15)' }], 240),
        run(target, [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: reduced ? 'none' : 'translateX(-9px)', filter: 'brightness(1.8) sepia(.6)', offset: .2 }, { transform: reduced ? 'none' : 'translateX(7px)', offset: .45 }, { transform: 'translateX(0)', filter: 'brightness(1)' }], 460),
      ])
    } else if (action.kind === 'sacrifice' || action.kind === 'effect') {
      await run(target, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) sepia(.7)', offset: .5 }, { filter: 'brightness(1)' }], 300)
    } else if (action.kind === 'death') {
      const tint = action.cause === 'sacrificed' ? 'sepia(1) saturate(2)' : 'grayscale(1)'
      if (reduced) await run(target, [{ opacity: 1 }, { opacity: 0 }], 100)
      else await motion.tween(target, {
        ease: 'out(2)',
        keyframes: [
          { translateX: -14, translateY: -20, rotateZ: -20, rotateX: -28, scale: 1.13, opacity: 1, filter: 'brightness(1.3)', duration: 75 },
          { translateX: 18, translateY: -10, rotateZ: 24, rotateX: 22, scale: 1.08, duration: 60 },
          { translateX: -16, translateY: -16, rotateZ: -25, rotateX: -24, scale: 1.1, duration: 60 },
          { translateX: 12, translateY: -5, rotateZ: 18, rotateX: 18, scale: 1.03, duration: 55 },
          { translateX: -8, translateY: 0, rotateZ: -12, rotateX: -12, scale: .98, filter: tint, duration: 55 },
          { translateX: 0, translateY: 16, rotateZ: 8, rotateX: 30, scale: .55, opacity: 0, duration: 145 },
        ],
      })
    }
  } finally {
    const cleanup = () => { motion.dispose(); floating.forEach(node => node.remove()) }
    if (retained && !signal.aborted) retained.push(cleanup)
    else cleanup()
  }
}

/** All marks are already rendered. Deaths overlap, starting 100ms apart. */
export async function animateSacrificeBatch(frames: BattleFrame[], signal: AbortSignal) {
  const motion = motionScope(signal)
  const retained: (() => void)[] = []
  try {
    await Promise.all(frames.map(({ action }) => {
      const badge = find(action.target)?.querySelector<HTMLElement>('.sacrifice-badge')
      return badge ? motion.tween(badge, {
        opacity: [.35, 1], scale: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : [1.22, 1],
        duration: 180, ease: 'out(3)',
      }) : Promise.resolve()
    }))
    if (signal.aborted) return
    await Promise.all(sacrificeSchedule(frames).map(async ({ frame, delay }) => {
      if (delay) await motion.tween({ progress: 0 }, { progress: 1, duration: delay, ease: 'linear' })
      if (!signal.aborted) await animateBattleAction(frame.action, signal, frame.state, retained)
    }))
  } finally {
    retained.forEach(cleanup => cleanup()); motion.dispose()
  }
}
