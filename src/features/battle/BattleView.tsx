import { BattleHand } from './BattleHand'
import { sacrificePoints } from '../../domain/game'
import type { Battle, Card, DrawPile, Unit } from '../../domain/game'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CardFace } from '../../components/cards/Cards'
import { animate } from 'animejs'

type Props = {
  actionLabel: string
  battle: Battle
  selected: string | null
  settling: boolean
  canForge: boolean
  onSelect: (id: string | null) => void
  onDeploy: (row: number, col: number) => void
  onSacrifice: (id: string) => void
  onDraw: (pile: DrawPile) => void
  onInspect: (card: Card | Unit) => void
  onEnd: () => void
  onForge: () => void
  onReset: () => void
  onLog: () => void
}

export function BattleView(props: Props) {
  const { battle, selected, settling, onInspect } = props
  const card = battle.hand.find(c => c.id === selected)
  const choosingSacrifices = !!card && card.cost > 0 && !battle.summon?.paid
  const choosingSlot = !!card && !choosingSacrifices
  const availableSacrifices = sacrificePoints(battle)
  const locked = !!battle.summon?.paid
  const viewport = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 900, height: 600 })
  const screen = useRef<HTMLDivElement>(null)
  const camera = useRef<HTMLDivElement>(null)
  const balanceMarker = useRef<HTMLElement>(null)
  const [cameraStop, setCameraStop] = useState(1)
  const cardWidth = Math.max(128, Math.min(210, (size.width - 98) / 5))
  const worldWidth = 5 * cardWidth + 98
  const worldHeight = 4 * cardWidth * 4 / 3 + 57
  const scale = Math.min(1, size.width / worldWidth)
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const root = screen.current
    if (!root) return
    const blocked = () => !!document.querySelector('dialog[open]')
    const move = (direction: number) => setCameraStop(current => Math.max(0, Math.min(2, current + direction)))
    const onKey = (event: KeyboardEvent) => {
      if (blocked() || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toLowerCase()
      if (key !== 'w' && key !== 's') return
      event.preventDefault()
      if (!event.repeat) move(key === 'w' ? -1 : 1)
    }
    let lastWheel = -Infinity
    const onWheel = (event: WheelEvent) => {
      if (blocked() || event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX) || event.deltaY === 0) return
      event.preventDefault()
      const now = performance.now()
      // A wheel/trackpad gesture is one command, including its momentum tail.
      if (now - lastWheel > 180) move(event.deltaY < 0 ? -1 : 1)
      lastWheel = now
    }
    let touchStart: number | null = null
    const onTouchStart = (event: TouchEvent) => { touchStart = event.touches.length === 1 ? event.touches[0].clientY : null }
    const onTouchEnd = (event: TouchEvent) => {
      if (!blocked() && touchStart !== null && event.changedTouches.length) {
        const distance = touchStart - event.changedTouches[0].clientY
        if (Math.abs(distance) > 35) move(distance > 0 ? 1 : -1)
      }
      touchStart = null
    }
    const field = viewport.current
    window.addEventListener('keydown', onKey)
    root.addEventListener('wheel', onWheel, { passive: false })
    field?.addEventListener('touchstart', onTouchStart, { passive: true })
    field?.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      root.removeEventListener('wheel', onWheel)
      field?.removeEventListener('touchstart', onTouchStart)
      field?.removeEventListener('touchend', onTouchEnd)
    }
  }, [])
  const cameraOffset = Math.max(0, worldHeight * scale - size.height) * cameraStop / 2
  useLayoutEffect(() => {
    if (!camera.current) return
    const animation = animate(camera.current, {
      translateY: -cameraOffset, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220, ease: 'out(3)',
    })
    return () => { animation.cancel() }
  }, [cameraOffset])
  useLayoutEffect(() => {
    if (!balanceMarker.current) return
    const animation = animate(balanceMarker.current, {
      left: `${(battle.balance + 10) * 5}%`, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200, ease: 'out(3)',
    })
    return () => { animation.cancel() }
  }, [battle.balance])
  const cameraStyle = { '--world-width': `${worldWidth}px`, '--lane-width': `${cardWidth}px`, '--camera-scale': scale } as CSSProperties
  return <div className="combat-screen" ref={screen}>
    <aside className="combat-rail left-rail" aria-label="战斗状态">
      <div className="combat-identity"><span>❋</span><strong>雾林边境</strong><small>地图第 {battle.encounter} 层</small></div>
      <div className="combat-scale" aria-label="战斗天平"><span>{battle.difficulty === 'boss' ? '荒野之王' : battle.difficulty === 'elite' ? '精英' : '荒野守卫'}</span><strong>{battle.balance === 0 ? '平衡' : (battle.balance > 0 ? '敌方' : '我方') + '承压 ' + Math.abs(battle.balance)}</strong><div className="scale-track"><i ref={balanceMarker}/></div><div className="scale-ends"><span data-motion="life-player">我方 −10</span><span data-motion="life-enemy">敌方 +10</span></div></div>
      <div className="combat-round"><span>回合</span><strong>{String(battle.round).padStart(2, '0')}</strong><span>{settling ? '交锋结算中' : '你的部署阶段'}</span></div>

      <div className="rail-menu"><a href="/creatures" target="_blank" rel="noopener noreferrer" title="在新标签页打开生物图鉴">生物图鉴 ↗</a><button onClick={props.onLog}>战斗记录</button><button disabled={settling} onClick={props.onReset}>重新开始</button></div>
    </aside>

    <section className={`combat-field camera-field ${settling ? 'is-resolving' : ''}`} aria-label="战场" style={cameraStyle}>
      <div className="camera-head" style={{ height: 62, width: worldWidth * scale }}><div style={{ '--lane-width': `${cardWidth * scale}px`, '--header-gap': `${12 * scale}px`, '--header-label': `${38 * scale}px` } as CSSProperties}>
      <div className="combat-columns"><span />{['I', 'II', 'III', 'IV', 'V'].map(n => <span key={n}>{n}</span>)}</div>
      <div className="combat-intents"><span className="rank-label">来袭</span>{Array.from({ length: 5 }, (_, col) => <div key={col}>{battle.intents.filter(i => i.col === col).map(i => <button data-motion={`intent-${i.card.id}`} key={i.card.id} onClick={() => onInspect(i.card)} onContextMenu={event => { event.preventDefault(); onInspect(i.card) }}>↓ {i.card.name}<small>{i.row === 0 ? '前排' : '后排'}</small></button>)}</div>)}</div>
      </div></div>
      <div className="camera-viewport" ref={viewport} tabIndex={0} aria-label="战场镜头：W 或滚轮向上，S 或滚轮向下">
      <div className="camera-space" ref={camera} data-camera-stop={cameraStop} style={{ height: worldHeight * scale, width: worldWidth * scale }}>
      <div className="camera-world" style={{ transform: `scale(${scale})` }}>
      {(['enemy', 'player'] as const).map(side => <div className={`combat-side ${side}`} key={side}>
        {(side === 'enemy' ? [1, 0] : [0, 1]).map(row => <div className="combat-rank" key={row}>
          <span className="rank-label">{side === 'enemy' ? '敌方' : '我方'}<b>{row === 0 ? '前排' : '后排'}</b></span>
          {battle[side][row].map((unit, col) => <button
            key={col} data-motion={`${side}-${row}-${col}`} data-slot={`${side}-${row}-${col}`}
            className={`combat-slot ${unit ? 'filled' : ''} ${side === 'player' && !settling ? (!unit && choosingSlot ? 'deployable' : unit && choosingSacrifices ? 'sacrificable' : '') : ''} ${side === 'player' && unit && battle.summon?.sacrifices.includes(unit.id) ? 'sacrifice-marked' : ''}`}
            aria-label={`${side === 'player' ? '我方' : '敌方'}${row === 0 ? '前排' : '后排'}第${col + 1}列${unit ? ` ${unit.name}` : ' 空位'}`}
            aria-pressed={side === 'player' && unit && choosingSacrifices ? battle.summon?.sacrifices.includes(unit.id) : undefined}
            disabled={settling}
            onClick={() => { if (unit && side === 'player' && choosingSacrifices) props.onSacrifice(unit.id); else if (unit) onInspect(unit); else if (side === 'player' && choosingSlot) props.onDeploy(row, col) }}
            onContextMenu={event => { if (unit) { event.preventDefault(); onInspect(unit) } }}
          >{unit ? <><CardFace card={unit} onInspect={onInspect} />{side === 'player' && battle.summon?.sacrifices.includes(unit.id) && <span className="sacrifice-badge">✕ 献祭标记</span>}</> : <span className="vacant-mark">{side === 'player' && choosingSlot ? '+' : '·'}</span>}</button>)}
        </div>)}
      </div>)}
      </div></div></div>
    </section>

    <aside className="combat-rail right-rail" aria-label="战斗操作">
      <button className="rail-forge" disabled={settling} onClick={props.onForge}>查看地图与牌组</button>
      <div className="combat-resource"><span>{choosingSacrifices ? '已标记费用' : locked ? '献祭已完成' : '可提供费用'}</span><strong>{choosingSacrifices ? sacrificePoints(battle, battle.summon?.sacrifices) : locked ? card?.cost : availableSacrifices}{choosingSacrifices && <small> / {card.cost}</small>}</strong></div>
      {(settling || card) && <div className="combat-instruction" role="status">{settling ? <p className="action-label">{props.actionLabel}</p> : card && <><strong>{card.name}</strong>{choosingSacrifices && availableSacrifices < card.cost && <p>费用不足</p>}{!locked && <button onClick={() => props.onSelect(null)}>{choosingSacrifices ? '取消献祭' : '取消选择'}</button>}<button onClick={() => onInspect(card)}>查看印记</button></>}</div>}
      <div className="draw-piles" aria-label="选择抽牌牌堆"><span>{battle.canDraw ? '本回合可抽 1 张' : '本回合抽牌已结束'}</span>
        <button disabled={settling || !!battle.summon || !battle.canDraw || !battle.deck.length || battle.status !== 'playing'} onClick={() => props.onDraw('deck')}>主牌堆 <strong>{battle.deck.length}</strong><small>抽取生物</small></button>
        <button disabled={settling || !!battle.summon || !battle.canDraw || !battle.squirrelDeck.length || battle.status !== 'playing'} onClick={() => props.onDraw('squirrelDeck')}>松鼠牌堆 <strong>{battle.squirrelDeck.length}</strong><small>0 费 · 0 攻 / 1 血</small></button>
      </div>
      <button className="primary combat-end" disabled={settling || locked || battle.status !== 'playing'} onClick={props.onEnd}>{settling ? '行动中…' : locked ? '请先完成部署' : '结束回合'} <span>→</span></button>
    </aside>

    <BattleHand cards={battle.hand} selected={selected} available={availableSacrifices}
      disabled={settling || locked || battle.status !== 'playing'} settling={settling}
      onSelect={props.onSelect} onInspect={onInspect}/>
  </div>
}

