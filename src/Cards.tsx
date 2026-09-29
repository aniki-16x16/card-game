import { Creature } from './Creature'
import { SIGILS, TRIBES, sigils } from './game'
import type { Card, Unit } from './game'

export function CardFace({ card, compact = false, onInspect }: { card: Card | Unit; compact?: boolean; onInspect?: (card: Card | Unit) => void }) {
  return <div onContextMenu={event => { if (onInspect) { event.preventDefault(); event.stopPropagation(); onInspect(card) } }} className={`card-face ${compact ? 'compact' : ''} tone-${card.species}`}>
    <div className="card-top"><span>{card.name}</span><span className="cost" title={card.cost ? `需要 ${card.cost} 费` : '免费召唤'}>{card.cost}<small>费</small></span></div>
    <span className="card-tribe">{TRIBES[card.tribe]}</span>
    <Creature species={card.art} />
    <div className="card-sigils">{sigils(card).length ? sigils(card).map(s => <span key={s} className={card.added.includes(s) ? 'inherited' : ''} title={`${SIGILS[s].name}：${SIGILS[s].description}`}>{SIGILS[s].icon}{!compact && sigils(card).length <= 2 && <small>{SIGILS[s].name}</small>}</span>) : <span className="no-sigil">—</span>}</div>
    <div className="card-stats"><span title="攻击"><i>⚔</i> {card.attack}</span><span className={'hp' in card && card.hp < card.health ? 'hurt' : ''} title="生命"><i>♥</i> {'hp' in card ? Math.max(0, card.hp) : card.health}</span></div>
  </div>
}
