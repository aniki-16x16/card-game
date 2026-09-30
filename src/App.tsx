import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { X } from 'lucide-react'
import { animateBattleAction } from './battleAnimation'
import { Creature } from './Creature'
import { CardFace } from './Cards'
import { SigilIcon } from './SigilIcon'
import { BattleView } from './BattleView'
import { AdventureView, MapView } from './AdventureView'
import { newAdventure, enterNode, currentNode, isCombat, recordBattle, finishNode } from './adventure'
import type { Adventure } from './adventure'
import { SIGILS, planDeploy, drawCard, markSacrifice, selectSummon, load, planRound, sigils, startBattle } from './game'
import type { Battle, BattleFrame, Card, Unit } from './game'
import './App.css'
import './BattleView.css'
import './BattleCamera.css'
import './BattleAnimation.css'

function Modal({ children, onClose, label, wide = false, dismissible = true }: { children: ReactNode; onClose: () => void; label: string; wide?: boolean; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'map-dialog' : ''}`} onCancel={event => { event.preventDefault(); if(dismissible) onClose() }} aria-label={label}>{dismissible && <button className="close" onClick={onClose} aria-label="关闭"><X/></button>}{children}</dialog>
}
export default function App() {
  const [run,setRun] = useState<Adventure>(()=>newAdventure())
  const [battle,setBattle] = useState<Battle|null>(null)
  const [inspected,setInspected] = useState<Card|Unit|null>(null)
  const [rules,setRules] = useState(false), [reset,setReset] = useState(false), [showLog,setShowLog] = useState(false), [showMap,setShowMap] = useState(false)
  const [settling,setSettling] = useState(false), [actionLabel,setActionLabel] = useState('')
  const playing = useRef(false), animationAbort = useRef<AbortController|null>(null)
  useEffect(()=>()=>animationAbort.current?.abort(),[])
  const selected = battle?.summon?.cardId ?? null
  function enter(id:string) {
    const next = enterNode(run,id)
    if(next === run) return
    setRun(next)
    const node = currentNode(next)!
    if(isCombat(node.kind)) setBattle(startBattle(next.deck,node.floor,next.seed,node.kind === 'boss' ? 'boss' : node.kind === 'elite' ? 'elite' : 'normal'))
    window.scrollTo({top:0})
  }
  function acceptRun(next:Adventure) { setRun(next); setInspected(null) }
  async function play(frames:BattleFrame[],finalState:Battle) {
    if(playing.current) return
    playing.current=true
    const controller=new AbortController(); animationAbort.current=controller
    setSettling(true);setInspected(null)
    try {
      for(const frame of frames) {
        if(controller.signal.aborted) return
        flushSync(()=>setActionLabel(frame.action.label))
        await animateBattleAction(frame.action,controller.signal,frame.state)
        if(controller.signal.aborted) return
        flushSync(()=>setBattle(frame.state))
      }
      setBattle(finalState)
    } finally { playing.current=false;if(!controller.signal.aborted){setSettling(false);setActionLabel('')} }
  }
  const detailHp=inspected && 'hp' in inspected ? inspected.hp : inspected?.health
  return <div className={`app-shell ${battle ? 'battle-mode' : 'adventure-mode'}`}>
    {battle ? <main><BattleView actionLabel={actionLabel} battle={battle} selected={selected} settling={settling} canForge={false}
      onSelect={id=>{if(!playing.current)setBattle(selectSummon(battle,id))}}
      onSacrifice={id=>{if(playing.current)return;const p=markSacrifice(battle,id);if(p.frames.length)void play(p.frames,p.state);else setBattle(p.state)}}
      onDraw={pile=>{if(!playing.current)setBattle(drawCard(battle,pile))}}
      onInspect={setInspected} onEnd={()=>{if(playing.current)return;const p=planRound(battle);void play(p.frames,p.state)}}
      onForge={()=>setShowMap(true)} onRules={()=>setRules(true)} onReset={()=>setReset(true)} onLog={()=>setShowLog(true)}
      onDeploy={(row,col)=>{if(playing.current||!selected)return;const p=planDeploy(battle,selected,row,col);if(p.state!==battle)void play(p.frames,p.state)}}
    /></main> : <AdventureView run={run} onEnter={enter} onChange={acceptRun} onInspect={setInspected} onReset={()=>setReset(true)} onRules={()=>setRules(true)}/>}
    {inspected && <Modal label="生物印记" onClose={()=>setInspected(null)}><div className="sigil-detail-heading"><Creature species={inspected.species} art={inspected.art}/><div><span className="eyebrow">生物印记</span><h2>{inspected.name}</h2><p>攻击 {inspected.attack} · 生命 {detailHp} · 费用 {inspected.cost}</p></div></div><div className="sigil-detail-capacity">外来印记容量 <strong>{load(inspected)} / {inspected.capacity}</strong></div><div className="sigil-detail-list">{sigils(inspected).map(s=><div key={s}><span><SigilIcon sigil={s}/></span><div><h3>{SIGILS[s].name}</h3><p>{SIGILS[s].description}</p></div></div>)}{!sigils(inspected).length && <p>无印记。</p>}</div></Modal>}
    {showLog && battle && <Modal label="战斗记录" onClose={()=>setShowLog(false)}><h2>战斗记录</h2><ol className="battle-log-dialog">{battle.log.map((line,i)=><li key={i}>{line}</li>)}</ol></Modal>}
    {showMap && <Modal label="地图与牌组" wide onClose={()=>setShowMap(false)}><h2>当前路线与牌组</h2><p>战斗中只能查看地图，胜利后继续前进。</p><div className="event-deck">{run.deck.map(c=><CardFace key={c.id} card={c}/>)}</div><MapView run={run} readOnly onEnter={()=>{}}/></Modal>}
    {rules && <Modal label="游戏规则" onClose={()=>setRules(false)}><h2>旅人的手册</h2><div className="rules-copy">
      <p><b>旅程：</b>从当前节点沿连线前进，共 18 层，精英支线额外经过一个高价值节点。战斗胜利后拿牌或跳过，返回地图；Boss 胜利后通关，战败结束本局。道具节点暂未开放。刷新页面会重置。</p>
      <p><b>天平：</b>每场从 0 开始。对玩家的直接伤害推动天平，双方伤害相互抵消，任一方承压达到 10 点立即落败。疲劳同样推动天平，没有全局生命。</p>
      <p><b>召唤：</b>起手 5 张主牌与 1 张松鼠。每回合可从主牌堆或松鼠堆抽一张。先选择手牌，再标记祭品，每张默认提供 1 费。凑够费用且有空位后立即献祭，此前可取消，此后必须部署。0 费无需献祭。</p>
      <p><b>交锋：</b>我方攻击 → 敌方最多部署一只 → 敌方攻击 → 新回合。每方从左到右、同列后排先于前排行动。普通单位只能从前排攻击；远射与飞行可从后排攻击。新回合开始时空前排由后排补位。</p>
      <p><b>攻击：</b>攻击瞬间前排为空才伤害玩家；否则打前排，溢出传给后排，剩余伤害消失。飞行只被同列有效飞行单位拦截，无空中目标则伤害玩家。地面仍能攻击前排飞行单位。俯冲优先攻击非飞行后排，连击每轮重新选目标。</p>
      <p><b>节点：</b>费用、种族选牌先三选一类别，再三选一卡牌，可放弃拿牌但不可更换类别。删卡和转移印记每节点一次，至少保留 6 张牌。精英奖励和普通战斗相同，额外收益来自其专属后续节点。</p>
      <p><b>强化：</b>每次访问固定攻击 +1 或生命 +2，同一张牌最多连续强化三次，第一轮安全，第二轮被吃掉概率 1/6，第三轮 1/3。每轮成功后可带走。被吃掉永久移除，不触发归魂等战斗死亡效果。以后访问节点可继续强化。</p>
      <p><b>死亡：</b>献祭与短命属于死亡，但不算被击杀；归魂、遗卵响应死亡，食腐、吞食响应击杀。卡牌战斗内的伤势与临时增益在战后清除，牌组强化与转移永久保留至本局结束。</p>
    </div><div className="sigil-glossary">{Object.entries(SIGILS).map(([key,s])=><div key={key}><b><SigilIcon sigil={key as keyof typeof SIGILS}/>{s.name}</b><p>{s.description}</p></div>)}</div></Modal>}
    {reset && <Modal label="重新开始冒险" onClose={()=>setReset(false)}><h2>重新出发？</h2><p>地图、牌组、强化及当前进度全部重置，使用新的地图种子。</p><div className="modal-actions"><button className="secondary" onClick={()=>setReset(false)}>继续旅程</button><button className="primary" onClick={()=>{animationAbort.current?.abort();setRun(newAdventure(Date.now()));setBattle(null);setInspected(null);setShowMap(false);setReset(false);setSettling(false);window.scrollTo({top:0})}}>重新开始</button></div></Modal>}
    {battle && !settling && battle.status !== 'playing' && <Modal dismissible={false} label={battle.status==='won'?'遭遇胜利':'遭遇失败'} onClose={()=>{}}><h2>{battle.status==='won'?'天平为你倾斜。':'契约止于此处。'}</h2><p>{battle.status==='won'?'敌方承压达到 10 点。':'我方承压达到 10 点，本局冒险结束。'}</p><button className="primary" onClick={()=>{let next=recordBattle(run,battle.status as 'won'|'lost');if(battle.status==='won'&&currentNode(next)?.kind==='boss')next=finishNode(next);setRun(next);setBattle(null);window.scrollTo({top:0})}}>{battle.status==='won'?(currentNode(run)?.kind==='boss'?'查看通关结算':'领取战利品'):'查看本局结算'}</button></Modal>}
  </div>
}
