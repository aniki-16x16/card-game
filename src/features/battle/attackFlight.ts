import { motionScope } from './motion'
import { cardBend } from './cardBend'

/** Horizontal strips follow a cylindrical bend; Z is perpendicular to the table. */
export async function attackFlight(source: HTMLElement, target: HTMLElement, air: boolean, signal: AbortSignal) {
  const face = source.querySelector<HTMLElement>('.card-face')
  if (!face || signal.aborted) return
  const start = source.getBoundingClientRect()
  const visibility = source.style.visibility
  const motion = motionScope(signal)
  const stage = document.createElement('div')
  stage.className = 'attack-stage'
  stage.setAttribute('aria-hidden', 'true')
  const card = document.createElement('div')
  card.className = 'attack-card camera-world'
  const shadow = document.createElement('div')
  shadow.className = 'attack-shadow'
  for (const node of [card, shadow]) Object.assign(node.style, {
    width: `${start.width}px`, height: `${start.height}px`,
    left: `${start.left}px`, top: `${start.top}px`, '--lane-width': `${start.width}px`,
  })
  const count = 20, stripHeight = start.height / count
  const strips = Array.from({ length: count }, (_, index) => {
    const strip = document.createElement('div')
    strip.className = 'attack-strip'
    strip.style.height = `${stripHeight + .6}px`
    const surface = document.createElement('div')
    surface.className = 'combat-slot'
    surface.style.cssText = `position:absolute;width:100%;height:${start.height}px;top:${-index * stripHeight}px`
    surface.append(face.cloneNode(true))
    strip.append(surface); card.append(strip)
    return strip
  })
  stage.append(shadow, card); document.body.append(stage)
  source.style.visibility = 'hidden'
  const pose = { travel: 0, lift: 0, bend: 0, pitch: 0 }
  const render = () => {
    // Re-read endpoints so scrolling/resizing during a strike doesn't leave a stale target.
    const origin = source.getBoundingClientRect(), end = target.getBoundingClientRect()
    const dx = end.left + end.width / 2 - origin.left - origin.width / 2
    const dy = end.top + end.height / 2 - origin.top - origin.height / 2
    const direction = dy < 0 ? -1 : 1
    const x = origin.left - start.left + dx * pose.travel
    const y = origin.top - start.top + dy * pose.travel
    card.style.transform = `translate3d(${x}px,${y - pose.lift * .42}px,${pose.lift}px) rotateX(${pose.pitch * direction}deg)`
    strips.forEach((strip, index) => {
      const v = ((index + .5) / count - .5) * start.height
      const curve = cardBend(v, start.height, pose.bend)
      strip.style.transform = `translate3d(0,${start.height / 2 + curve.y - stripHeight / 2}px,${curve.z}px) rotateX(${curve.angle}deg)`
      strip.style.filter = `brightness(${1 - Math.abs(Math.sin(curve.angle * Math.PI / 180)) * .28})`
    })
    shadow.style.transform = `translate(${x}px,${y}px) scale(${1 + pose.lift / 400})`
    shadow.style.opacity = String(.28 / (1 + pose.lift / 65))
    shadow.style.filter = `blur(${4 + pose.lift / 14}px)`
  }
  render()
  const phase = (values: Partial<typeof pose>, duration: number, ease: string) =>
    motion.tween(pose, { ...values, duration, ease, onUpdate: render })
  try {
    await phase({ travel: -.045, lift: 26, bend: 1.65, pitch: -18 }, 180, 'out(3)')
    if (signal.aborted) return
    await phase({ travel: .48, lift: air ? 170 : 115, bend: 1.1, pitch: 12 }, 190, 'inOut(2)')
    if (signal.aborted) return
    await phase({ travel: 1, lift: 0, bend: .2, pitch: 0 }, 130, 'in(2)')
    if (signal.aborted) return
    await Promise.all([
      phase({ travel: .94, lift: 18, bend: .8 }, 85, 'out(3)'),
      motion.tween(target, { keyframes: [{ filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], duration: 120 }),
    ])
    if (signal.aborted) return
    await phase({ travel: 0, lift: 0, bend: 0, pitch: 0 }, 230, 'out(3)')
  } finally {
    motion.dispose(); stage.remove(); source.style.visibility = visibility
  }
}
