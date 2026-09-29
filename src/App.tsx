import { SigilIcon } from './SigilIcon'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { animateBattleAction } from './battleAnimation'
import { Creature } from './Creature'
import { CardFace } from './Cards'
import { BattleView } from './BattleView'
import { SIGILS, planDeploy, drawCard, markSacrifice, selectSummon, initialDeck, load, getRewards, planRound, sigils, startBattle, transfer } from './game'
import type { Battle, BattleFrame, Card, Sigil, Unit } from './game'
import './App.css'
import './BattleView.css'
import './BattleCamera.css'
import './BattleAnimation.css'

function Modal({ children, onClose, label, dismissible = true }: { children: ReactNode; onClose: () => void; label: string; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className="modal" onCancel={event => { event.preventDefault(); if (dismissible) onClose() }} aria-label={label}>{dismissible && <button className="close" onClick={onClose} aria-label="关闭">×</button>}{children}</dialog>
}
export default function App() {
  const [deck, setDeck] = useState<Card[]>(initialDeck)
  const [battle, setBattle] = useState(() => startBattle(initialDeck()))
  const [mode, setMode] = useState<'battle' | 'forge'>('battle')
  const [engaged, setEngaged] = useState(false)
  const selected = battle.summon?.cardId ?? null
  const [inspected, setInspected] = useState<Card | Unit | null>(null)
  const [rules, setRules] = useState(false)
  const [reset, setReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [donorId, setDonor] = useState<string | null>(null)
  const [targetId, setTarget] = useState<string | null>(null)
  const [chosenSigil, setChosenSigil] = useState<Sigil | null>(null)
  const [removed, setRemoved] = useState<Sigil[]>([])
  const [pickRole, setPickRole] = useState<'donor' | 'target'>('donor')
  const [undoDeck, setUndoDeck] = useState<Card[] | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [settling, setSettling] = useState(false)
  const playing = useRef(false)
  const animationAbort = useRef<AbortController | null>(null)
  const [actionLabel, setActionLabel] = useState('')
  useEffect(() => () => animationAbort.current?.abort(), [])
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(''), 4200); return () => clearTimeout(timeout) }, [notice])
  const donor = deck.find(c => c.id === donorId), target = deck.find(c => c.id === targetId)
  const preview = donor && target && chosenSigil ? transfer(deck, donor.id, target.id, chosenSigil, removed) : null
  const detail = inspected
  const detailHp = detail && 'hp' in detail && typeof detail.hp === 'number' ? detail.hp : detail?.health
  const selectedCard = battle.hand.find(c => c.id === selected)
  const canForge = !battle.summon?.paid && (!engaged || battle.status !== 'playing')
  function clearForge() { setDonor(null); setTarget(null); setChosenSigil(null); setRemoved([]); setPickRole('donor') }
  function restart(cards = deck, encounter = battle.encounter) { setBattle(startBattle(cards, encounter)); setEngaged(false); setInspected(null); setUndoDeck(null) }
  async function play(frames: BattleFrame[], finalState: Battle) {
    if (playing.current) return
    playing.current = true
    const controller = new AbortController()
    animationAbort.current = controller
    setEngaged(true); setSettling(true); setInspected(null); setUndoDeck(null)
    try {
      for (const frame of frames) {
        if (controller.signal.aborted) return
        flushSync(() => setActionLabel(frame.action.label))
        await animateBattleAction(frame.action, controller.signal, frame.state)
        if (controller.signal.aborted) return
        flushSync(() => setBattle(frame.state))
      }
      setBattle(finalState)
    } finally {
      playing.current = false
      if (!controller.signal.aborted) { setSettling(false); setActionLabel('') }
    }
  }
  function endTurn() {
    if (playing.current || battle.status !== 'playing' || battle.summon?.paid) return
    const plan = planRound(battle)
    void play(plan.frames, plan.state)
  }
  function chooseForgeCard(card: Card) {
    if (pickRole === 'donor') { setDonor(card.id); setChosenSigil(sigils(card)[0] ?? null); if (targetId === card.id) setTarget(null); setPickRole('target') }
    else { setTarget(card.id); setRemoved([]); if (donorId === card.id) { setDonor(null); setChosenSigil(null); setPickRole('donor') } }
  }
  function doTransfer() {
    if (!preview || preview.error || !donor || !target || !chosenSigil) return
    setUndoDeck(deck); setDeck(preview.deck); setBattle(startBattle(preview.deck, battle.encounter)); setEngaged(false)
    setNotice(`${target.name} 获得「${SIGILS[chosenSigil].name}」，${donor.name} 已被消耗。`); clearForge()
  }
  return <div className={`app-shell ${mode === 'battle' ? 'battle-mode' : 'forge-mode'}`}>
    <header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()}><span className="brand-mark">❋</span><span>苔原契约<small>VERDANT PACT</small></span></a>
      <nav aria-label="主导航"><button className={mode === 'battle' ? 'active' : ''} onClick={() => setMode('battle')}><span>⚔</span> 战场</button><button className={mode === 'forge' ? 'active' : ''} disabled={!canForge || settling} title={canForge ? '改造你的牌组' : '战斗结束后开放'} onClick={() => { setMode('forge') }}><span>⌘</span> 印记工坊{!canForge && <small> · 战斗中</small>}</button></nav>
      <div className="top-actions"><span className="prototype"><i /> 可玩原型 <small>0.1</small></span><button className="icon-button" aria-label="游戏规则" onClick={() => setRules(true)}>?</button><button className="icon-button" aria-label="重新开始冒险" disabled={settling} onClick={() => setReset(true)}>↻</button></div>
    </header>
    {notice && <div className="toast" role="status">✦ {notice}</div>}
    <main>
      <div className="page-heading"><div><div className="eyebrow">THE WILDS AWAIT</div><h1>{mode === 'battle' ? '雾林边境' : '让印记，生根。'}</h1><p>{mode === 'battle' ? '在荒野中缔结契约，让每一个位置都有意义。' : '献出一个灵魂，将它的力量留在另一个生命中。'}</p></div><div className="journey"><span className="journey-dot done">✓</span><span className="journey-line"/><span className="journey-dot current">{String(battle.encounter).padStart(2, '0')}</span><span className="journey-line"/><span className="journey-dot">❋</span><small>旅程 · 第 {battle.encounter} 场遭遇</small></div></div>
      {mode === 'battle' ? <BattleView actionLabel={actionLabel} battle={battle} selected={selected} settling={settling} canForge={canForge} onSelect={id => { if (!playing.current) setBattle(selectSummon(battle, id)) }} onSacrifice={id => {
        if (playing.current) return
        const plan = markSacrifice(battle, id)
        if (plan.frames.length) void play(plan.frames, plan.state)
        else setBattle(plan.state)
      }} onDraw={pile => {
        if (playing.current) return
        const next = drawCard(battle, pile)
        if (next !== battle) { setBattle(next); setEngaged(true); setUndoDeck(null) }
      }} onInspect={setInspected} onEnd={endTurn} onForge={() => { setBattle(selectSummon(battle, null)); setMode('forge') }} onRules={() => setRules(true)} onReset={() => setReset(true)} onLog={() => setShowLog(true)} onDeploy={(row, col) => {
        if (!selectedCard || settling || battle.status !== 'playing') return
        const plan = planDeploy(battle, selectedCard.id, row, col)
        if (plan.state === battle) return
        void play(plan.frames, plan.state)
      }} /> : <div className="forge-layout"><section className="forge-main"><div className="section-label">印记仪式 <span>传承力量，而非次数。</span></div><div className="ritual"><button className={`ritual-slot ${pickRole === 'donor' ? 'picking' : ''}`} onClick={() => setPickRole('donor')}><span className="eyebrow">01 / 献出</span>{donor ? <CardFace onInspect={setInspected} card={donor}/> : <div className="ritual-empty"><span>◇</span><h3>选择供体</h3><p>这张卡将被消耗</p></div>}</button><div className="ritual-arrow"><span>⌘</span><span>→</span></div><button className={`ritual-slot ${pickRole === 'target' ? 'picking' : ''}`} onClick={() => setPickRole('target')}><span className="eyebrow">02 / 继承</span>{target ? <CardFace onInspect={setInspected} card={preview && !preview.error ? preview.deck.find(c => c.id === target.id)! : target}/> : <div className="ritual-empty"><span>❋</span><h3>选择受体</h3><p>保留天生印记和属性</p></div>}</button></div>
        <div className="ritual-options"><div><h3>传递一个印记</h3><div className="sigil-choices">{donor && sigils(donor).length ? sigils(donor).map(s => <button key={s} className={chosenSigil === s ? 'chosen' : ''} onClick={() => setChosenSigil(s)} title={SIGILS[s].description}><SigilIcon sigil={s}/> {SIGILS[s].name} <small>{SIGILS[s].weight} 容量</small></button>) : <p className="muted">{donor ? '这张生物没有可传递的印记，请更换供体。' : '从下方牌组选择一张拥有印记的生物。'}</p>}</div></div>{target && <div><h3>外来印记容量 <span>{preview && !preview.error ? load(preview.deck.find(c => c.id === target.id)!) : load(target)} / {target.capacity}</span></h3><div className="capacity-bar">{Array.from({ length: target.capacity }, (_, i) => <span key={i} className={i < (preview && !preview.error ? load(preview.deck.find(c => c.id === target.id)!) : load(target)) ? 'used' : ''}/>)}</div>{target.added.length > 0 && <div className="replace-options"><p>可勾选旧印记，覆盖并释放容量：</p>{target.added.map(s => <label key={s}><input type="checkbox" checked={removed.includes(s)} onChange={e => setRemoved(e.target.checked ? [...removed, s] : removed.filter(x => x !== s))}/>{SIGILS[s].name}（{SIGILS[s].weight}）</label>)}</div>}</div>}</div>
        <div className="ritual-confirm"><p className={preview?.error ? 'error-text' : ''}>{preview?.error ?? (donor && target && chosenSigil ? `消耗 ${donor.name}，将「${SIGILS[chosenSigil].name}」交给 ${target.name}。` : '选择供体、受体和印记，预览结果后完成转移。')}</p><button className="primary" disabled={!preview || !!preview.error} onClick={doTransfer}>完成印记转移 <span>↗</span></button></div>
        <div className="collection-heading"><h2>你的牌组 <span>{deck.length} 张</span></h2><div><span>正在选择：{pickRole === 'donor' ? '供体' : '受体'}</span>{undoDeck && <button className="text-button" onClick={() => { setDeck(undoDeck); setBattle(startBattle(undoDeck, battle.encounter)); setUndoDeck(null); clearForge(); setNotice('已撤销上一次转移。') }}>撤销上次转移</button>}</div></div><div className="collection">{deck.map(card => <button key={card.id} className={`collection-card ${donorId === card.id || targetId === card.id ? 'chosen' : ''}`} onClick={() => chooseForgeCard(card)} aria-label={`选为${pickRole === 'donor' ? '供体' : '受体'} ${card.name}`}><CardFace onInspect={setInspected} card={card}/><span className="collection-caption">{donorId === card.id ? '◇ 供体' : targetId === card.id ? '❋ 受体' : `外来印记 ${load(card)} / ${card.capacity}`}</span></button>)}</div>
      </section><aside className="forge-sidebar"><div className="forge-symbol">⌘</div><span className="eyebrow">A SOUL, REWRITTEN</span><h2>力量有边界，<br/>选择没有次数。</h2><p>每只生物拥有 3 点外来印记容量。你可以反复转移，也可以覆盖旧印记。</p><div className="forge-rules"><p><b>01</b> 天生印记不占容量，不能被覆盖。</p><p><b>02</b> 每次消耗一张供体，只继承选中的一个印记。</p><p><b>03</b> 保留至少 6 张卡，让旅程继续。</p></div><button className="primary" onClick={() => { restart(); setMode('battle') }}>进入战场 <span>→</span></button><small>生命恢复 · 已改造的卡牌保留</small></aside></div>}
      <footer><span>❋ VERDANT PACT <i> / </i> 苔原契约</span><span>五列阵线 · 双排策略 · 印记传承</span><span>原型数值 · 刷新页面会重置</span></footer>
    </main>

    {detail && <Modal label="生物印记" onClose={() => setInspected(null)}><div className="sigil-detail-heading"><Creature species={detail.species} art={detail.art}/><div><span className="eyebrow">生物印记</span><h2>{detail.name}</h2><p>攻击 {detail.attack} · 生命 {detailHp} · 费用 {detail.cost}</p></div></div><div className="sigil-detail-capacity">外来印记容量 <strong>{load(detail)} / {detail.capacity}</strong><span>天生印记不占容量</span></div><div className="sigil-detail-list">{sigils(detail).length ? sigils(detail).map(s => <div key={s}><span><SigilIcon sigil={s}/></span><div><h3>{SIGILS[s].name}<small>{detail.added.includes(s) ? '继承 · 占用' : '天生 · 转移占用'} {SIGILS[s].weight} 容量</small></h3><p>{SIGILS[s].description}</p></div></div>) : <p>没有印记。可在战前的印记工坊中继承其他生物的能力。</p>}</div><button className="primary" onClick={() => setInspected(null)}>返回</button></Modal>}
    {showLog && <Modal label="战斗记录" onClose={() => setShowLog(false)}><h2>战斗记录</h2><ol className="battle-log-dialog">{battle.log.map((line, i) => <li key={i}>{line}</li>)}</ol></Modal>}
    {rules && <Modal label="游戏规则" onClose={() => setRules(false)}><span className="eyebrow">FIELD MANUAL</span><h2>旅人的战斗手册</h2><p className="modal-description">镜头默认居中。按 W / S 或滚动鼠标滚轮，快速向敌方 / 己方切换一档；无需长按。</p><div className="rule-block"><h3>01 · 部署与交锋</h3><p>点击手牌后，选择己方场上单位作为祭品，每张默认提供 1 费，丰饶祭品提供 3 费。未凑够费用时只做标记，可以取消或再次点击取消标记；凑够且有部署空位后立即献祭，再选择空位部署，此时不可取消或换牌。0 费单位跳过献祭。结束回合后：我方攻击 → 敌方预告单位入场 → 敌方攻击 → 进入新回合，获得一次抽牌机会。双方均按列从左到右、同列从后排到前排依次行动。部署、攻击、受击和补位动画逐个播放。预告位置被占时尝试同列另一排；全列已满则放弃入场。</p></div><div className="rule-block"><h3>02 · 前排与后排</h3><p>普通生物只有在前排才能攻击，远射和未被结网压制的飞行单位也能从后排攻击。攻击瞬间同列敌方前排为空时，直接扣除对方生命，即使后排有单位。前排存在时先承受伤害，溢出伤害施加到同列后排；后排为空或仍有剩余伤害时，均不会扣除对方生命。飞行改为攻击同列天空，只被未受结网压制的飞行单位拦截；没有空中目标则直接伤害玩家，地面攻击仍能攻击前排飞行单位。俯冲优先攻击非飞行后排，飞行溢出只传给同列其他飞行单位。连击每轮重新判断目标，分袭对每列独立结算。每个新回合开始、进入部署阶段前，双方所有后排生物都会检查同列前排：为空则自动上前。无需印记；本回合新部署的后排生物，以及战斗中前排死亡后的空位，都要等到下回合开始才补位。</p></div><div className="rule-block"><h3>03 · 赢得遭遇</h3><p>敌方生命归零获胜，选一张奖励卡后进入工坊。你的生命归零则失败，可以重试或改造。每场战斗生命重置，卡牌不会因战斗死亡永久丢失。两个牌堆均耗尽后，每个新回合受到递增的疲劳伤害（1、2、3…）。</p></div><div className="rule-block"><h3>04 · 抽牌与死亡</h3><p>起手 5 张主牌和 1 张松鼠，松鼠牌堆共 10 张。每回合可从主牌堆或松鼠牌堆选择抽 1 张，次数不累积。松鼠为 0 攻 / 1 血、0 费。短命属于自然死亡，献祭属于献祭死亡，两者都不属于被击杀；归魂和遗卵会响应所有死亡，食腐和吞食只响应被击杀，荆棘只响应攻击。永续祭品献祭后留场，不死亡也不触发归魂，同一次召唤只能计费一次。敌方无需献祭，每回合最多部署一只生物，归魂及筑巢、蜂群等衍生物都进入预告队列并占用名额。印记只在战斗外改造，供体会被消耗，受体可以多次继承，只要不超过容量。地图种子在启动时取系统时间；相同种子与牌组可复现洗牌、敌方入场列和奖励。</p></div><div className="sigil-glossary">{Object.entries(SIGILS).map(([key, s]) => <div key={key}><b><SigilIcon sigil={key as Sigil}/> {s.name}<small>{s.weight} 容量</small></b><p>{s.description}</p></div>)}</div><button className="primary" onClick={() => setRules(false)}>准备好了 →</button></Modal>}
    {reset && <Modal label="重新开始冒险" onClose={() => setReset(false)}><span className="eyebrow">A NEW JOURNEY</span><h2>重新出发？</h2><p className="modal-description">当前战斗、奖励卡和印记改造都会重置，恢复最初的 14 张牌。</p><div className="modal-actions"><button className="secondary" onClick={() => setReset(false)}>继续旅程</button><button className="primary" onClick={() => { const cards = initialDeck(); setDeck(cards); restart(cards, 1); clearForge(); setMode('battle'); setReset(false); setNotice('新的旅程开始了。') }}>重新开始</button></div></Modal>}
    {!settling && battle.status !== 'playing' && mode === 'battle' && <Modal dismissible={battle.status !== 'won'} label={battle.status === 'won' ? '遭遇胜利' : '遭遇失败'} onClose={() => setMode('forge')}><span className="eyebrow">{battle.status === 'won' ? 'THE WILDS REMEMBER' : 'REST, AND RETURN'}</span><h2>{battle.status === 'won' ? '林地为你让路。' : '在雾中暂歇。'}</h2><p className="modal-description">{battle.status === 'won' ? '选择一位新伙伴，然后前往印记工坊，为下一场遭遇做准备。' : '你的契约仍然保留。调整阵型，或到工坊重新组合印记，再试一次。'}</p>{battle.status === 'won' ? <div className="reward-cards">{getRewards(battle.mapSeed, battle.encounter).map(card => { return <button key={card.id} onClick={() => { const next = [...deck, card]; setDeck(next); restart(next, battle.encounter + 1); clearForge(); setMode('forge'); setNotice(`${card.name} 加入了你的牌组。`) }}><CardFace onInspect={setInspected} card={card}/><span>选择伙伴 ＋</span></button> })}</div> : <div className="modal-actions"><button className="secondary" onClick={() => { restart(); setMode('forge') }}>前往工坊</button><button className="primary" onClick={() => restart()}>再次挑战 →</button></div>}</Modal>}
  </div>
}







