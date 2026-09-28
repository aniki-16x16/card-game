import type { Battle, Card, Unit } from './game'
import { CardFace } from './Cards'

type Props = {
  battle: Battle
  selected: string | null
  settling: boolean
  canForge: boolean
  onSelect: (id: string | null) => void
  onDeploy: (row: number, col: number) => void
  onInspect: (card: Card | Unit) => void
  onEnd: () => void
  onForge: () => void
  onRules: () => void
  onReset: () => void
  onLog: () => void
}

function Life({ value, max, enemy = false }: { value: number; max: number; enemy?: boolean }) {
  return <div className={`combat-life ${enemy ? 'hostile' : ''}`}>
    <span>{enemy ? '荒野守卫' : '你的生命'}</span>
    <strong>♥ {value}<small> / {max}</small></strong>
    <div className="life-meter"><i style={{ width: `${value / max * 100}%` }} /></div>
  </div>
}

export function BattleView(props: Props) {
  const { battle, selected, settling, onInspect } = props
  const card = battle.hand.find(c => c.id === selected)
  return <div className="combat-screen">
    <aside className="combat-rail left-rail" aria-label="战斗状态">
      <div className="combat-identity"><span>❋</span><strong>雾林边境</strong><small>第 {battle.encounter} 场遭遇</small></div>
      <Life value={battle.enemyHp} max={20 + battle.encounter * 4} enemy />
      <div className="combat-round"><span>回合</span><strong>{String(battle.round).padStart(2, '0')}</strong><span>{settling ? '交锋结算中' : '你的部署阶段'}</span></div>
      <Life value={battle.playerHp} max={24} />
      <div className="rail-menu"><button onClick={props.onRules}>游戏规则</button><button onClick={props.onLog}>战斗记录</button><button disabled={settling} onClick={props.onReset}>重新开始</button></div>
    </aside>

    <section className={`combat-field ${settling ? 'is-resolving' : ''}`} aria-label="战场">
      <div className="combat-columns"><span />{['I', 'II', 'III', 'IV', 'V'].map(n => <span key={n}>{n}</span>)}</div>
      <div className="combat-intents"><span className="rank-label">来袭</span>{Array.from({ length: 5 }, (_, col) => <div key={col}>{battle.intents.filter(i => i.col === col).map(i => <button key={i.card.id} onClick={() => onInspect(i.card)} onContextMenu={event => { event.preventDefault(); onInspect(i.card) }}>↓ {i.card.name}<small>{i.row === 0 ? '前排' : '后排'}</small></button>)}</div>)}</div>
      {(['enemy', 'player'] as const).map(side => <div className={`combat-side ${side}`} key={side}>
        {(side === 'enemy' ? [1, 0] : [0, 1]).map(row => <div className="combat-rank" key={row}>
          <span className="rank-label">{side === 'enemy' ? '敌方' : '我方'}<b>{row === 0 ? '前排' : '后排'}</b></span>
          {battle[side][row].map((unit, col) => <button
            key={col}
            className={`combat-slot ${unit ? 'filled' : ''} ${side === 'player' && !unit && card && card.cost <= battle.energy && !settling ? 'deployable' : ''}`}
            aria-label={`${side === 'player' ? '我方' : '敌方'}${row === 0 ? '前排' : '后排'}第${col + 1}列${unit ? ` ${unit.name}` : ' 空位'}`}
            disabled={settling}
            onClick={() => { if (unit) onInspect(unit); else if (side === 'player') props.onDeploy(row, col) }}
            onContextMenu={event => { if (unit) { event.preventDefault(); onInspect(unit) } }}
          >{unit ? <CardFace card={unit} compact onInspect={onInspect} /> : <span className="vacant-mark">{side === 'player' && card ? '+' : '·'}</span>}</button>)}
        </div>)}
      </div>)}
    </section>

    <aside className="combat-rail right-rail" aria-label="战斗操作">
      <button className="rail-forge" disabled={!props.canForge || settling} onClick={props.onForge}>⌘ 印记工坊</button>
      <div className="combat-resource"><span>可用能量</span><strong>{battle.energy}<small> / {battle.maxEnergy}</small></strong><div>{Array.from({ length: battle.maxEnergy }, (_, i) => <i key={i} className={i < battle.energy ? 'lit' : ''}>◆</i>)}</div></div>
      <div className="combat-instruction" role="status">{card ? <><strong>{card.name}</strong><p>{card.cost > battle.energy ? '能量不足，请选择其他手牌。' : '点击己方空位部署'}</p><button onClick={() => props.onSelect(null)}>取消选择</button><button onClick={() => onInspect(card)}>查看印记</button></> : <p>点击手牌部署<br/>右键卡片查看印记</p>}</div>
      <div className="combat-deck">牌库 <strong>{battle.deck.length}</strong><span>手牌 {battle.hand.length}</span></div>
      <button className="primary combat-end" disabled={settling || battle.status !== 'playing'} onClick={props.onEnd}>{settling ? '交锋中…' : '结束回合'} <span>→</span></button>
    </aside>

    <section className="combat-hand" aria-label="你的手牌"><div className="combat-hand-strip">
      {battle.hand.map(c => <button key={c.id} className={`combat-hand-card ${selected === c.id ? 'selected' : ''} ${c.cost > battle.energy ? 'unaffordable' : ''}`} aria-label={`选择 ${c.name}，${c.cost} 能量`} aria-pressed={selected === c.id} disabled={settling || battle.status !== 'playing'} onClick={() => props.onSelect(selected === c.id ? null : c.id)}><CardFace card={c} onInspect={onInspect} /></button>)}
      {!battle.hand.length && <p className="hand-empty">手牌已空 · 结束回合抽取新牌</p>}
    </div></section>
  </div>
}
