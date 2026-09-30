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
      if (reduced) await run(source, [{ filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], 100)
      else await attackFlight(source, target, action.route === 'air', signal)
    } else if (action.kind === 'hit') {
      const number = document.createElement('div')
      number.className = 'damage-number'
      number.textContent = action.amount ? `−${action.amount}` : '格挡'
      Object.assign(number.style, { left: `${end.left + end.width / 2}px`, top: `${Math.max(80, Math.min(innerHeight - 80, end.top + end.height / 2))}px` })
      document.body.append(number); floating.push(number)
      await Promise.all([
        run(number, [{ opacity: 0, transform: 'translate(-50%,0) scale(.7)' }, { opacity: 1, offset: .2 }, { opacity: 0, transform: 'translate(-50%,-45px) scale(1.15)' }], 460),
        run(target, [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: reduced ? 'none' : 'translateX(-9px)', filter: 'brightness(1.8) sepia(.6)', offset: .2 }, { transform: reduced ? 'none' : 'translateX(7px)', offset: .45 }, { transform: 'translateX(0)', filter: 'brightness(1)' }], 460),
      ])
    } else if (action.kind === 'sacrifice' || action.kind === 'effect') {
      await run(target, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) sepia(.7)', offset: .5 }, { filter: 'brightness(1)' }], 300)
    } else if (action.kind === 'death') {
      const tint = action.cause === 'sacrificed' ? 'sepia(1) saturate(2)' : 'grayscale(1)'
      await run(target, reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
        { transform: 'perspective(700px) rotateX(0deg) rotateZ(0deg) scale(1)', opacity: 1 },
        { transform: 'perspective(700px) rotateX(-14deg) rotateZ(-5deg) scale(1.04)', offset: .15 },
        { transform: 'perspective(700px) rotateX(10deg) rotateZ(6deg) scale(1.02)', offset: .25 },
        { transform: 'perspective(700px) rotateX(-10deg) rotateZ(-7deg) scale(1.03)', offset: .35 },
        { transform: 'perspective(700px) rotateX(7deg) rotateZ(5deg) scale(1)', offset: .45 },
        { transform: 'perspective(700px) rotateX(-5deg) rotateZ(-3deg) scale(.98)', filter: tint, offset: .55 },
        { transform: 'perspective(700px) rotateX(0deg) rotateZ(1deg) scale(.94)', opacity: .9, offset: .68 },
        { transform: 'perspective(700px) rotateX(16deg) rotateZ(0deg) scale(.65)', opacity: 0, filter: tint },
      ], 440)
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
