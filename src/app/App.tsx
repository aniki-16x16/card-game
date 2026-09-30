import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { X } from 'lucide-react'
import { animateBattleAction, animateSacrificeBatch } from '../features/battle/battleAnimation'
import { Creature } from '../components/creatures/Creature'
import { CardFace } from '../components/cards/Cards'
import { SigilIcon } from '../components/cards/SigilIcon'
import { BattleView } from '../features/battle/BattleView'
import { AdventureView, MapView } from '../features/adventure/AdventureView'
import { newAdventure, enterNode, currentNode, isCombat, recordBattle, finishNode } from '../domain/adventure'
import type { Adventure } from '../domain/adventure'
import { SIGILS, planDeploy, drawCard, markSacrifice, selectSummon, load, planRound, sigils, startBattle } from '../domain/game'
import type { Battle, BattleFrame, Card, Unit } from '../domain/game'
import './App.css'
import '../features/battle/BattleView.css'
import '../features/battle/BattleCamera.css'
import '../features/battle/BattleAnimation.css'

function Modal({ children, onClose, label, wide = false, dismissible = true }: { children: ReactNode; onClose: () => void; label: string; wide?: boolean; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'map-dialog' : ''}`} onCancel={event => { event.preventDefault(); if(dismissible) onClose() }} aria-label={label}>{dismissible && <button className="close" onClick={onClose} aria-label="关闭"><X/></button>}{children}</dialog>
}
export default function App() {
  const [run,setRun] = useState<Adventure>(()=>newAdventure())
  const [battle,setBattle] = useState<Battle|null>(null)
  const [inspected,setInspected] = useState<Card|Unit|null>(null)
  const [reset,setReset] = useState(false), [showLog,setShowLog] = useState(false), [showMap,setShowMap] = useState(false)
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
  async function play(frames:BattleFrame[],finalState:Battle,markedState?:Battle) {
    if(playing.current) return
    playing.current=true
    const controller=new AbortController(); animationAbort.current=controller
    flushSync(()=>{setSettling(true);setInspected(null);if(markedState){setBattle(markedState);setActionLabel('献祭')}})
    try {
      if(markedState) {
        await animateSacrificeBatch(frames,controller.signal)
        if(!controller.signal.aborted) flushSync(()=>setBattle(finalState))
        return
      }
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
      onSacrifice={id=>{if(playing.current)return;const p=markSacrifice(battle,id);if(p.frames.length && battle.summon)void play(p.frames,p.state,{...battle,summon:{...battle.summon,sacrifices:[...new Set([...battle.summon.sacrifices,id])]}});else setBattle(p.state)}}
      onDraw={pile=>{if(!playing.current)setBattle(drawCard(battle,pile))}}
      onInspect={setInspected} onEnd={()=>{if(playing.current)return;const p=planRound(battle);void play(p.frames,p.state)}}
      onForge={()=>setShowMap(true)} onReset={()=>setReset(true)} onLog={()=>setShowLog(true)}
      onDeploy={(row,col)=>{if(playing.current||!selected)return;const p=planDeploy(battle,selected,row,col);if(p.state!==battle)void play(p.frames,p.state)}}
    /></main> : <AdventureView run={run} onEnter={enter} onChange={acceptRun} onInspect={setInspected} onReset={()=>setReset(true)}/>}
    {inspected && <Modal label="生物印记" onClose={()=>setInspected(null)}><div className="sigil-detail-heading"><Creature species={inspected.species} art={inspected.art}/><div><span className="eyebrow">生物印记</span><h2>{inspected.name}</h2><p>攻击 {inspected.attack} · 生命 {detailHp} · 费用 {inspected.cost}</p></div></div><div className="sigil-detail-capacity">外来印记容量 <strong>{load(inspected)} / {inspected.capacity}</strong></div><div className="sigil-detail-list">{sigils(inspected).map(s=><div key={s}><span><SigilIcon sigil={s}/></span><div><h3>{SIGILS[s].name}</h3><p>{SIGILS[s].description}</p></div></div>)}{!sigils(inspected).length && <p>无印记。</p>}</div></Modal>}
    {showLog && battle && <Modal label="战斗记录" onClose={()=>setShowLog(false)}><h2>战斗记录</h2><ol className="battle-log-dialog">{battle.log.map((line,i)=><li key={i}>{line}</li>)}</ol></Modal>}
    {showMap && <Modal label="地图与牌组" wide onClose={()=>setShowMap(false)}><h2>当前路线与牌组</h2><div className="event-deck">{run.deck.map(c=><CardFace key={c.id} card={c}/>)}</div><MapView run={run} readOnly onEnter={()=>{}}/></Modal>}
    {reset && <Modal label="重新开始冒险" onClose={()=>setReset(false)}><h2>重新出发？</h2><p>当前旅程与牌组将被重置。</p><div className="modal-actions"><button className="secondary" onClick={()=>setReset(false)}>继续旅程</button><button className="primary" onClick={()=>{animationAbort.current?.abort();setRun(newAdventure(Date.now()));setBattle(null);setInspected(null);setShowMap(false);setReset(false);setSettling(false);window.scrollTo({top:0})}}>重新开始</button></div></Modal>}
    {battle && !settling && battle.status !== 'playing' && <Modal dismissible={false} label={battle.status==='won'?'遭遇胜利':'遭遇失败'} onClose={()=>{}}><h2>{battle.status==='won'?'天平为你倾斜。':'契约止于此处。'}</h2><p>{battle.status==='won'?'敌方承压达到 10 点。':'我方承压达到 10 点，本局冒险结束。'}</p><button className="primary" onClick={()=>{let next=recordBattle(run,battle.status as 'won'|'lost');if(battle.status==='won'&&currentNode(next)?.kind==='boss')next=finishNode(next);setRun(next);setBattle(null);window.scrollTo({top:0})}}>{battle.status==='won'?(currentNode(run)?.kind==='boss'?'查看通关结算':'领取战利品'):'查看本局结算'}</button></Modal>}
  </div>
}
