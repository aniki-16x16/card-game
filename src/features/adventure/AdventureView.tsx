import { useEffect, useRef, useState } from 'react'
import { Swords, Skull, Crown, Dices, PawPrint, Scissors, Flame, GitMerge, Gift, Check, LockKeyhole, Map, ArrowRight } from 'lucide-react'
import { CardFace } from '../../components/cards/Cards'
import { SigilIcon } from '../../components/cards/SigilIcon'
import { SIGILS, TRIBES, sigils, transfer } from '../../domain/game'
import type { Card, Sigil } from '../../domain/game'
import { availableNodes, currentNode, NODE_NAMES, categoryOptions, chooseCategory, visitRewards, takeReward, removeCard, upgradeCard, upgradeRisk, transferAtNode, finishNode, isCombat } from '../../domain/adventure'
import type { Adventure, NodeKind } from '../../domain/adventure'
import './Adventure.css'

const icons = { cost: Dices, tribe: PawPrint, remove: Scissors, upgrade: Flame, transfer: GitMerge, item: Gift, battle: Swords, elite: Skull, boss: Crown }
export function MapView({ run, onEnter, readOnly = false }: { run: Adventure; onEnter: (id: string) => void; readOnly?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => { if (run.path.length && !readOnly) root.current?.querySelector('.available')?.scrollIntoView({ block: 'center' }) }, [run.path.length, readOnly])
  const available = availableNodes(run), floors = [...new Set(run.nodes.map(n => n.floor))]
  const y = (floor: number) => floors.indexOf(floor) * 108 + 50
  return <div ref={root} className="journey-map" aria-label="冒险地图">
    <svg viewBox={`0 0 800 ${floors.length * 108}`} preserveAspectRatio="none" aria-hidden="true">{run.nodes.flatMap(node => node.next.map(id => { const next = run.nodes.find(n => n.id === id)!; return <line key={`${node.id}-${id}`} x1={node.x * 800} y1={y(node.floor)} x2={next.x * 800} y2={y(next.floor)} className={run.path.includes(node.id) && (run.path.includes(id) || run.visit?.nodeId === id) ? 'walked' : ''}/> }))}</svg>
    <div style={{height: floors.length * 108}}>{run.nodes.map(node => { const Icon = icons[node.kind], visited = run.path.includes(node.id), active = run.visit?.nodeId === node.id; return <button key={node.id} style={{left:`${node.x*100}%`,top:y(node.floor)}} className={`map-node ${node.kind} ${visited ? 'visited' : ''} ${active ? 'current' : ''} ${available.includes(node.id) ? 'available' : ''}`} disabled={readOnly || !available.includes(node.id)} onClick={() => onEnter(node.id)} aria-label={`${node.bonus ? '精英专属' : `第${node.floor}层`} ${NODE_NAMES[node.kind]}${visited ? ' 已完成' : ''}${active ? ' 当前节点' : ''}`}><span className="node-ring">{visited ? <Check/> : <Icon/>}</span><strong>{NODE_NAMES[node.kind]}</strong><small>{node.bonus ? '精英专属 · 额外节点' : `第 ${node.floor} 层`}</small></button> })}</div>
  </div>
}

function ForgeEvent({ run, onChange, onInspect }: { run: Adventure; onChange: (r: Adventure) => void; onInspect: (c: Card) => void }) {
  const [donor, setDonor] = useState(''), [target, setTarget] = useState(''), [chosen, setChosen] = useState<Sigil | ''>(''), [removed, setRemoved] = useState<Sigil[]>([])
  const a = run.deck.find(c => c.id === donor), b = run.deck.find(c => c.id === target)
  const preview = a && b && chosen ? transfer(run.deck,donor,target,chosen,removed) : null
  return <><div className="event-fields"><label>供体（会被消耗）<select value={donor} onChange={e => {setDonor(e.target.value);setChosen('')}}><option value="">选择供体</option>{run.deck.map(c => <option key={c.id} value={c.id}>{c.name} · {c.attack}/{c.health}</option>)}</select></label><label>受体<select value={target} onChange={e => {setTarget(e.target.value);setRemoved([])}}><option value="">选择受体</option>{run.deck.map(c => <option key={c.id} value={c.id}>{c.name} · {c.attack}/{c.health}</option>)}</select></label></div>
    <div className="sigil-choices">{a && sigils(a).map(s => <button key={s} className={chosen === s ? 'chosen' : ''} onClick={() => setChosen(s)}><SigilIcon sigil={s}/>{SIGILS[s].name}</button>)}</div>
    {b && <div className="replace-options">{b.added.map(s => <label key={s}><input type="checkbox" checked={removed.includes(s)} onChange={e => setRemoved(e.target.checked ? [...removed,s] : removed.filter(x => x !== s))}/>覆盖 {SIGILS[s].name}</label>)}</div>}
    <div className="event-preview">{a && <CardFace card={a} onInspect={onInspect}/>}<ArrowRight/>{b && <CardFace card={preview && !preview.error ? preview.deck.find(c => c.id === b.id)! : b} onInspect={onInspect}/>}</div>
    <p>{preview?.error || '每个转移节点可完成一次转移。天生印记不占容量，牌组至少保留 6 张。'}</p><button className="primary" disabled={!preview || !!preview.error || !chosen} onClick={() => {if(chosen) onChange(transferAtNode(run,donor,target,chosen,removed).run)}}>确认转移</button></>
}

export function NodeEvent({ run, onChange, onInspect }: { run: Adventure; onChange: (r: Adventure) => void; onInspect: (c: Card) => void }) {
  const node = currentNode(run)!, visit = run.visit!
  const [selected,setSelected] = useState('')
  const reward = ['cost','tribe'].includes(node.kind) || isCombat(node.kind)
  return <section className="node-event"><span className="eyebrow">{node.bonus ? '精英专属奖励' : `雾林之路 / 第 ${node.floor} 层`}</span><h1>{isCombat(node.kind) ? '战利品' : NODE_NAMES[node.kind]}</h1>
    {visit.message && <p className="event-message" role="status">{visit.message}</p>}
    {reward ? <>{visit.category === undefined && !isCombat(node.kind) ? <><p>先选择{node.kind === 'cost' ? '费用' : '种族'}，再从对应卡牌中选择一张。类别选定后不能更换。</p><div className="category-options">{categoryOptions(run).map(category => <button key={category} onClick={() => onChange(chooseCategory(run,category))}>{typeof category === 'number' ? `${category} 费` : TRIBES[category]}</button>)}</div></> : <><p>{visit.category !== undefined ? `已选择：${typeof visit.category === 'number' ? `${visit.category} 费` : TRIBES[visit.category]}` : '选择一张加入牌组，或跳过奖励。'}</p><div className="event-cards">{visitRewards(run).map(card => <button key={card.id} onClick={() => onChange(takeReward(run,card.id))} aria-label={`拿取 ${card.name}`}><CardFace card={card} onInspect={onInspect}/><span>加入牌组</span></button>)}</div><button className="secondary" onClick={() => onChange(takeReward(run,null))}>跳过拿牌</button></>}</> : <>
      {!visit.done && node.kind === 'transfer' && <ForgeEvent run={run} onChange={onChange} onInspect={onInspect}/>}
      {!visit.done && ['remove','upgrade'].includes(node.kind) && <><p>{node.kind === 'remove' ? '选择一张卡永久移除；牌组至少保留 6 张。' : `本次每轮${visit.stat === 'attack' ? '攻击 +1' : '生命 +2'}，最多三轮，必须强化同一张卡。`}</p>
        {node.kind === 'upgrade' && <p className="risk-note">已强化 {visit.attempts} / 3 次 · {run.safeUpgrades ? '本局强化已永久安全' : `下一轮被吃掉概率：${visit.attempts === 0 ? '0' : visit.attempts === 1 ? '1/6' : '1/3'}`}<br/>成功后可随时带走；被吃掉的卡永久移除，不触发战斗死亡印记。</p>}
        <div className="event-deck">{run.deck.map(card => <button key={card.id} aria-label={`选择 ${card.name}`} aria-pressed={(visit.targetId || selected) === card.id} disabled={!!visit.targetId && visit.targetId !== card.id} onClick={() => setSelected(card.id)}><CardFace card={card} onInspect={onInspect}/></button>)}</div>
        <button className="primary" disabled={!(visit.targetId || selected) || (node.kind === 'remove' && run.deck.length <= 6)} onClick={() => onChange(node.kind === 'remove' ? removeCard(run,selected) : upgradeCard(run,visit.targetId || selected))}>{node.kind === 'remove' ? '确认移除' : upgradeRisk(run) ? '承担风险，继续强化' : '安全强化'}</button>
      </>}
      <button className="secondary" onClick={() => onChange(finishNode(run))}>{visit.done ? '返回地图' : visit.attempts ? '带走卡牌，返回地图' : '放弃此节点，返回地图'}</button>
    </>}
  </section>
}

export function AdventureView({ run, onEnter, onChange, onInspect, onReset, onRules }: { run: Adventure; onEnter: (id:string)=>void; onChange:(r:Adventure)=>void; onInspect:(c:Card)=>void; onReset:()=>void; onRules:()=>void }) {
  const [showDeck,setShowDeck] = useState(false)
  return <main className="adventure"><header className="adventure-heading"><div><span className="eyebrow">VERDANT PACT / THE WILDS</span><h1>雾林之路</h1><p>18 层旅程 · Boss：荒野之王 · 种子 {run.seed}</p></div><div className="adventure-actions"><button onClick={()=>setShowDeck(!showDeck)}>{showDeck ? '收起牌组' : `查看牌组 · ${run.deck.length}`}</button><button onClick={onRules}>规则</button><a href="/creatures" target="_blank" rel="noopener noreferrer">图鉴 ↗</a><button onClick={onReset}>重新开始</button></div></header>
    {showDeck && <div className="event-deck">{run.deck.map(c=><button key={c.id} onClick={()=>onInspect(c)}><CardFace card={c}/></button>)}</div>}
    {run.status !== 'playing' ? <section className="journey-result">{run.status === 'won' ? <Crown size={60}/> : <Skull size={60}/>}<h1>{run.status === 'won' ? '你穿过了雾林。' : '契约止于此处。'}</h1><p>{run.status === 'won' ? '荒野之王已败，旅程完成。' : '天平向我方倾斜达到 10 点，本局冒险结束。'}</p><p>完成 {run.path.length} 个节点 · 牌组 {run.deck.length} 张</p><button className="primary" onClick={onReset}>开始新的旅程</button></section> : run.visit ? <NodeEvent key={run.visit.nodeId} run={run} onChange={onChange} onInspect={onInspect}/> : <div className="map-layout"><aside className="map-guide"><Map size={32}/><h2>选择下一站</h2><p>沿发光节点前进。每次交汇，都能重新规划构筑方向。</p><div className="map-legend">{(Object.keys(icons) as NodeKind[]).filter(k=>k!=='item').map(k=>{const Icon=icons[k];return <span key={k}><Icon size={18}/>{NODE_NAMES[k]}</span>})}</div><p><LockKeyhole size={16}/> 精英后的额外节点仅由精英路线抵达。</p><p>战斗天平每场归零，无跨战斗生命。</p><p>{run.safeUpgrades ? '强化者已死亡 · 本局强化永久安全' : '强化可连做三次，继续前留意风险。'}</p></aside><MapView run={run} onEnter={onEnter}/></div>}
  </main>
}
