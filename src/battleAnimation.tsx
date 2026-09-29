import { renderToStaticMarkup } from 'react-dom/server'
import { CardFace } from './Cards'
import type { BattleAction, Battle } from './game'

const find = (id?: string) => id ? document.querySelector<HTMLElement>(`[data-motion="${CSS.escape(id)}"]`) : null

export async function animateBattleAction(action: BattleAction, signal: AbortSignal, state: Battle) {
  const source = find(action.source), target = find(action.target)
  if (!target || signal.aborted) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const floating: HTMLElement[] = []
  const animations: Animation[] = []
  const run = (element: HTMLElement, frames: Keyframe[], duration: number) => {
    const animation = element.animate(frames, { duration: reduced ? 100 : duration, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'forwards' })
    animations.push(animation)
    return animation.finished.catch(() => {})
  }
  const cancel = () => animations.forEach(a => a.cancel())
  signal.addEventListener('abort', cancel, { once: true })
  let hidden: HTMLElement | null = null
  try {
    const end = target.getBoundingClientRect()
    if (action.kind === 'deploy' || action.kind === 'advance') {
      const start = source?.getBoundingClientRect() ?? end
      const overlay = document.createElement('div')
      overlay.className = 'card-flight camera-world'
      overlay.setAttribute('aria-hidden', 'true')
      const [side, row, col] = action.target.split('-')
      const card = state[side as 'player' | 'enemy'][Number(row)][Number(col)]
      if (!card) return
      overlay.innerHTML = `<div class="combat-slot">${renderToStaticMarkup(<CardFace card={card} />)}</div>`
      const width = action.kind === 'advance' || action.source?.startsWith('hand-') ? start.width : end.width * .65
      Object.assign(overlay.style, { left: `${start.left}px`, top: `${start.top}px`, width: `${end.width}px`, '--lane-width': `${end.width}px` })
      document.body.append(overlay); floating.push(overlay)
      if (source && !action.source?.startsWith('intent-')) { hidden = source; hidden.style.visibility = 'hidden' }
      const dx = end.left - start.left, dy = end.top - start.top
      await run(overlay, reduced ? [{ opacity: .4 }, { opacity: 1 }] : [
        { transform: `translate(0,0) scale(${width / end.width}) rotate(-5deg)`, opacity: .8 },
        { transform: `translate(${dx}px,${dy - 14}px) scale(1.04)`, opacity: 1, offset: .78 },
        { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 1 },
      ], action.kind === 'advance' ? 420 : 480)
    } else if (action.kind === 'attack' && source) {
      const start = source.getBoundingClientRect()
      const dx = end.left + end.width / 2 - start.left - start.width / 2
      const dy = end.top + end.height / 2 - start.top - start.height / 2
      const distance = Math.hypot(dx, dy) || 1
      await run(source, reduced ? [{ filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }] : [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-dx / distance * 10}px,${-dy / distance * 10}px)`, offset: .25 },
        { transform: `translate(${dx / distance * 45}px,${dy / distance * 45}px)`, filter: 'brightness(1.4)', offset: .65 },
        { transform: 'translate(0,0)', filter: 'brightness(1)' },
      ], 360)
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
    } else if (action.kind === 'death') {
      await run(target, [{ opacity: 1 }, { opacity: 0, transform: reduced ? 'none' : 'scale(.8)', filter: action.cause === 'sacrificed' ? 'sepia(1) saturate(3)' : 'grayscale(1)' }], 260)
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    floating.forEach(node => node.remove())
    if (hidden) hidden.style.visibility = ''
  }
}
