import { motionScope } from './motion'
import { flightTable, flightRect, flightScale, mountFlight } from './tableFlight'
import { TABLE } from './tableLayout'

export async function deployFlight(source: HTMLElement | null, target: HTMLElement, markup: string, advance: boolean, signal: AbortSignal) {
  if (signal.aborted) return
  const table = flightTable(target)
  const end = flightRect(target, table), start = source ? flightRect(source, table) : end
  const hand = source?.dataset.motion?.startsWith('hand-')
  const matrix = hand && source ? new DOMMatrix(getComputedStyle(source).transform) : null
  // 手牌宽度来自屏幕；除以当前位置的投影倍率后才能接入桌面坐标。
  const startWidth = matrix && source ? source.offsetWidth * Math.hypot(matrix.a, matrix.b) / flightScale(table, { x: start.left + start.width / 2, y: start.top + start.height / 2 }) : advance ? start.width : end.width * .65
  const startAngle = matrix ? Math.atan2(matrix.b, matrix.a) * 180 / Math.PI : 0
  const stage = document.createElement('div')
  stage.className = 'deploy-stage'; stage.setAttribute('aria-hidden', 'true')
  const card = document.createElement('div')
  card.className = 'deploy-card camera-world'
  card.innerHTML = `<div class="combat-slot">${markup}</div>`
  const shadow = document.createElement('div')
  shadow.className = 'deploy-shadow'
  for (const node of [card, shadow]) Object.assign(node.style, {
    width: `${end.width}px`, height: `${end.height}px`, '--lane-width': `${end.width}px`,
  })
  stage.append(shadow, card)
  const flight = mountFlight(stage, table)
  const hidden = source && (hand || advance) ? source : null
  const visibility = hidden?.style.visibility ?? ''
  if (hidden) hidden.style.visibility = 'hidden'
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  // 手牌起飞时抵消桌面倾角，保持正面；落桌时 pitch 回到 0，贴合 30° 桌面。
  const pose = { travel: reduced ? 1 : 0, lift: 0, pitch: table && hand ? -TABLE.angle : 0, angle: startAngle, scale: reduced ? 1 : startWidth / end.width, opacity: reduced ? 0 : 1 }
  const motion = motionScope(signal)
  const render = () => {
    flight.sync()
    const destination = flightRect(target, table)
    const cx = start.left + start.width / 2 + (destination.left + destination.width / 2 - start.left - start.width / 2) * pose.travel
    const cy = start.top + start.height / 2 + (destination.top + destination.height / 2 - start.top - start.height / 2) * pose.travel
    if (!table) stage.style.perspectiveOrigin = `${cx}px ${cy}px`
    card.style.left = `${cx - end.width / 2}px`; card.style.top = `${cy - end.height / 2}px`
    card.style.transform = `translate3d(0,${-pose.lift * (table ? 0 : .3)}px,${pose.lift}px) rotateX(${pose.pitch}deg) rotateZ(${pose.angle}deg) scale(${pose.scale})`
    card.style.opacity = String(pose.opacity)
    shadow.style.left = card.style.left; shadow.style.top = `${cy - end.height / 2}px`
    shadow.style.transform = `scale(${pose.scale * (1 + pose.lift / 500)})`
    shadow.style.opacity = String(.32 / (1 + pose.lift / 55))
    shadow.style.filter = `blur(${3 + pose.lift / 12}px)`
  }
  render()
  const phase = (values: Partial<typeof pose>, duration: number, ease: string) =>
    motion.tween(pose, { ...values, duration, ease, onUpdate: render })
  try {
    if (reduced) { await phase({ opacity: 1, angle: 0 }, 100, 'linear'); return }
    await phase({ travel: .7, lift: advance ? 55 : 180, pitch: advance ? -12 : -38, angle: 0, scale: 1 }, advance ? 180 : 240, 'out(3)')
    if (signal.aborted) return
    await phase({ travel: 1, lift: 0, pitch: 0 }, 145, 'in(3)')
    if (signal.aborted) return
    await Promise.all([
      (async () => {
        await phase({ lift: 9, pitch: 3 }, 55, 'out(2)')
        if (!signal.aborted) await phase({ lift: 0, pitch: 0 }, 85, 'in(2)')
      })(),
      motion.tween(card, { filter: ['brightness(1.3)', 'brightness(1)'], duration: 140 }),
    ])
  } finally {
    motion.dispose(); flight.dispose()
    if (hidden) hidden.style.visibility = visibility
  }
}
