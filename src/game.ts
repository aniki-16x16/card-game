import { MAP_SEED, createRandom, deriveSeed } from './random.ts'

export type Sigil = 'ranged' | 'armor' | 'support' | 'thorns' | 'split' | 'rebirth' | 'triple' | 'undying'
export type Species = 'wolf' | 'deer' | 'owl' | 'beetle' | 'moth' | 'fox' | 'bear' | 'heron' | 'squirrel' | 'goat' | 'experiment'
export type Card = { id: string; name: string; species: Species; attack: number; health: number; cost: number; native: Sigil[]; added: Sigil[]; capacity: number }
export type Unit = Card & { hp: number }
export type Board = (Unit | null)[][]
export type Intent = { card: Card; row: number; col: number }
export type Summon = { cardId: string; sacrifices: string[]; paid: boolean }
export type DrawPile = 'deck' | 'squirrelDeck'
export type DeathCause = 'killed' | 'sacrificed'
export type Battle = { mapSeed: number; round: number; playerHp: number; enemyHp: number; player: Board; enemy: Board; hand: Card[]; deck: Card[]; squirrelDeck: Card[]; canDraw: boolean; summon: Summon | null; intents: Intent[]; log: string[]; status: 'playing' | 'won' | 'lost'; fatigue: number; encounter: number }
export const SIGILS: Record<Sigil, { name: string; icon: string; weight: number; description: string }> = {
  ranged: { name: '远射', icon: '↗', weight: 1, description: '位于后排时也能攻击同列；目标前排为空时直接伤害对方玩家。' },
  armor: { name: '硬甲', icon: '⬡', weight: 1, description: '每次受到攻击时，伤害减少 1，最低为 0。反伤不受此影响。' },
  support: { name: '鼓舞', icon: '✧', weight: 1, description: '位于后排时，使同列的友方前排攻击 +1。' },
  thorns: { name: '荆棘', icon: '✳', weight: 1, description: '被攻击后，对攻击者造成 1 点伤害，即使自身死亡。' },
  split: { name: '分袭', icon: '⋔', weight: 2, description: '改为攻击左右相邻两列，不攻击正前方；边缘只攻击一列。' },
  triple: { name: '丰饶祭品', icon: 'Ⅲ', weight: 2, description: '献祭时提供 3 点部署费用，多出的点数不保留。' },
  undying: { name: '永续祭品', icon: '∞', weight: 3, description: '献祭时不会死亡，保留位置、生命和印记；同一次召唤只能计费一次。被击杀时仍会死亡。' },
  rebirth: { name: '归魂', icon: '⟲', weight: 3, description: '死亡后返回手牌，献祭也会触发；再次召唤仍需支付献祭费用。' },
}
const templates: Omit<Card, 'id' | 'added'>[] = [
  { name: '苔原狼', species: 'wolf', attack: 3, health: 2, cost: 2, native: [], capacity: 3 },
  { name: '枝角鹿', species: 'deer', attack: 1, health: 5, cost: 2, native: ['support'], capacity: 3 },
  { name: '夜巡鸮', species: 'owl', attack: 2, health: 2, cost: 2, native: ['ranged'], capacity: 3 },
  { name: '铁背甲虫', species: 'beetle', attack: 1, health: 4, cost: 1, native: ['armor'], capacity: 3 },
  { name: '归魂蛾', species: 'moth', attack: 1, health: 1, cost: 1, native: ['rebirth'], capacity: 3 },
  { name: '赤尾狐', species: 'fox', attack: 2, health: 2, cost: 1, native: [], capacity: 3 },
  { name: '山脊熊', species: 'bear', attack: 3, health: 6, cost: 3, native: ['thorns'], capacity: 3 },
  { name: '裂风鹭', species: 'heron', attack: 2, health: 3, cost: 3, native: ['split'], capacity: 3 },
  { name: '黑山羊', species: 'goat', attack: 0, health: 1, cost: 1, native: ['triple'], capacity: 3 },
  { name: '实验生物', species: 'experiment', attack: 0, health: 1, cost: 1, native: ['undying'], capacity: 3 },
]
export function makeCard(index: number, id: string): Card { return { ...templates[index % templates.length], native: [...templates[index % templates.length].native], added: [], id } }
export function initialDeck(): Card[] { return [0, 3, 2, 1, 5, 4, 7, 6, 0, 3, 2, 5, 8, 9].map((t, i) => makeCard(t, `starter-${i}`)) }
export function makeSquirrel(id: string): Card { return { id, name: '松鼠', species: 'squirrel', attack: 0, health: 1, cost: 0, native: [], added: [], capacity: 3 } }
export const sigils = (card: Card): Sigil[] => [...card.native, ...card.added]
export const load = (card: Card): number => card.added.reduce((sum, s) => sum + SIGILS[s].weight, 0)
export const emptyBoard = (): Board => [Array(5).fill(null), Array(5).fill(null)]
export function transfer(deck: Card[], donorId: string, targetId: string, sigil: Sigil, remove: Sigil[] = []): { deck: Card[]; error?: string } {
  const donor = deck.find(c => c.id === donorId), target = deck.find(c => c.id === targetId)
  const fail = (error: string) => ({ deck, error })
  if (!donor || !target || donorId === targetId) return fail('请选择不同的供体和受体。')
  if (deck.length <= 6) return fail('牌组至少需要保留 6 张卡。')
  if (!sigils(donor).includes(sigil)) return fail('供体不拥有这个印记。')
  if (sigils(target).includes(sigil)) return fail('受体已经拥有这个印记。')
  const next = { ...target, added: [...target.added.filter(s => !remove.includes(s)), sigil] }
  if (load(next) > target.capacity) return fail('容量不足，请勾选要覆盖的外来印记。')
  return { deck: deck.filter(c => c.id !== donorId).map(c => c.id === targetId ? next : c) }
}
export function getIntents(round: number, encounter: number, mapSeed = MAP_SEED): Intent[] {
  if (round > 12) return []
  const sequence = [3, 0, 2, 5, 1, 6, 7, 0, 2, 6, 7, 6], col = createRandom(deriveSeed(mapSeed, `enemy:${encounter}:${round}`)).int(5)
  const card = makeCard(sequence[(round - 1) % sequence.length], `enemy-${round}-a`)
  const intents: Intent[] = [{ card, col, row: sigils(card).includes('ranged') || sigils(card).includes('support') ? 1 : 0 }]
  return intents
}
export function startBattle(cards: Card[], encounter = 1, mapSeed = MAP_SEED): Battle {
  const shuffled = createRandom(deriveSeed(mapSeed, `deck:${encounter}`)).shuffle(cards)
  const squirrels = Array.from({ length: 10 }, (_, i) => makeSquirrel(`squirrel-${i}`))
  return { mapSeed, round: 1, playerHp: 24, enemyHp: 20 + encounter * 4, player: emptyBoard(), enemy: emptyBoard(), hand: [...structuredClone(shuffled.slice(0, 5)), squirrels[0]], deck: structuredClone(shuffled.slice(5)), squirrelDeck: squirrels.slice(1), canDraw: true, summon: null, intents: getIntents(1, encounter, mapSeed), log: ['选择牌堆抽牌。松鼠免费部署；其他生物需要献祭己方单位。'], status: 'playing', fatigue: 0, encounter }
}
export function getRewards(mapSeed: number, encounter: number): Card[] {
  return createRandom(deriveSeed(mapSeed, `rewards:${encounter}`)).shuffle(templates.map((_, i) => i)).slice(0, 3).map((index, i) => makeCard(index, `reward-${encounter}-${i}`))
}
export const sacrificeValue = (card: Card): number => sigils(card).includes('triple') ? 3 : 1
export function sacrificePoints(state: Battle, ids?: readonly string[]): number {
  return state.player.flat().reduce((sum, unit) => sum + (unit && (!ids || ids.includes(unit.id)) ? sacrificeValue(unit) : 0), 0)
}
export function selectSummon(state: Battle, id: string | null): Battle {
  if (state.status !== 'playing' || state.summon?.paid) return state
  if (id !== null && !state.hand.some(card => card.id === id)) return state
  return { ...state, summon: id === null ? null : { cardId: id, sacrifices: [], paid: false } }
}
// Both causes are deaths. Only combat removal is a kill; death effects run for either cause.
function removeUnit(s: Battle, side: 'player' | 'enemy', row: number, col: number, cause: DeathCause): BattleAction {
  const unit = s[side][row][col]!
  s[side][row][col] = null
  s.log.unshift(`${side === 'player' ? '我方' : '敌方'} ${unit.name} ${cause === 'sacrificed' ? '被献祭' : '被击杀'}。`)
  if (sigils(unit).includes('rebirth')) {
    const { hp: _hp, ...restored } = unit
    if (side === 'player') { s.hand.push(restored); s.log.unshift(`${unit.name} 归魂，返回手牌。`) }
    else s.intents.push({ card: restored, row, col })
  }
  return { kind: 'death', cause, target: `${side}-${row}-${col}`, label: `${unit.name} ${cause === 'sacrificed' ? '献祭' : '被击杀'}` }
}
export function markSacrifice(state: Battle, id: string): { state: Battle; frames: BattleFrame[] } {
  const summon = state.summon, card = state.hand.find(c => c.id === summon?.cardId)
  if (state.status !== 'playing' || !summon || summon.paid || !card || card.cost === 0 || !state.player.flat().some(u => u?.id === id)) return { state, frames: [] }
  const s = structuredClone(state), next = s.summon!
  next.sacrifices = next.sacrifices.includes(id) ? next.sacrifices.filter(mark => mark !== id) : [...next.sacrifices, id]
  const frames: BattleFrame[] = []
  const hasLandingSlot = s.player.flat().some(unit => !unit || (next.sacrifices.includes(unit.id) && !sigils(unit).includes('undying')))
  if (sacrificePoints(s, next.sacrifices) >= card.cost && hasLandingSlot) {
    next.paid = true
    for (const mark of next.sacrifices) {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
        if (s.player[row][col]?.id === mark) {
          const unit = s.player[row][col]!
          const survives = sigils(unit).includes('undying')
          if (survives) s.log.unshift(`${unit.name} 献祭提供 ${sacrificeValue(unit)} 点费用，永续祭品使其存活。`)
          const action: BattleAction = survives
            ? { kind: 'sacrifice', target: `player-${row}-${col}`, label: `${unit.name} 献祭后存活` }
            : removeUnit(s, 'player', row, col, 'sacrificed')
          frames.push({ action, state: structuredClone(s) })
        }
      }
    }
    next.sacrifices = []
  }
  return { state: s, frames }
}
export function drawCard(state: Battle, pile: DrawPile): Battle {
  if (state.status !== 'playing' || !state.canDraw || state.summon || !state[pile].length) return state
  const s = structuredClone(state), card = s[pile].shift()!
  s.hand.push(card); s.canDraw = false
  s.log.unshift(`从${pile === 'deck' ? '主牌堆' : '松鼠牌堆'}抽到 ${card.name}。`)
  return s
}
export function deploy(state: Battle, id: string, row: number, col: number): Battle {
  const card = state.hand.find(c => c.id === id)
  if (state.status !== 'playing' || !card || state.summon?.cardId !== id || (card.cost > 0 && !state.summon.paid) || !Number.isInteger(row) || !Number.isInteger(col) || !state.player[row] || col < 0 || col > 4 || state.player[row][col]) return state
  const next = structuredClone(state)
  next.player[row][col] = { ...card, hp: card.health }; next.hand = next.hand.filter(c => c.id !== id); next.summon = null
  next.log.unshift(`部署 ${card.name} → ${col + 1} 列${row === 0 ? '前排' : '后排'}。`)
  return next
}
export type BattleAction = { kind: 'deploy' | 'attack' | 'hit' | 'advance' | 'death' | 'sacrifice'; source?: string; target: string; label: string; amount?: number; cause?: DeathCause }
export type BattleFrame = { action: BattleAction; state: Battle }
export function planRound(state: Battle): { frames: BattleFrame[]; state: Battle } {
  const frames: BattleFrame[] = []
  const result = resolveRound(state, (action, snapshot) => frames.push({ action, state: snapshot }))
  return { frames, state: result }
}
export function resolveRound(state: Battle, record?: (action: BattleAction, state: Battle) => void): Battle {
  if (state.status !== 'playing' || state.summon?.paid) return state
  const s = structuredClone(state), addLog = (message: string) => s.log.unshift(message)
  s.summon = null
  const emit = (action: BattleAction) => record?.(action, structuredClone(s))
  function checkEnd() {
    if (s.enemyHp <= 0) { s.enemyHp = 0; s.status = 'won'; return true }
    if (s.playerHp <= 0) { s.playerHp = 0; s.status = 'lost'; return true }
    return false
  }
  function cleanup() {
    for (const side of ['player', 'enemy'] as const) {
      const board = s[side]
      for (let c = 0; c < 5; c++) for (const r of [1, 0]) {
        const unit = board[r][c]
        if (unit && unit.hp <= 0) {
          emit(removeUnit(s, side, r, c, 'killed'))
        }
      }
    }
  }
  const arriving = [...s.intents].sort((a, b) => a.col - b.col || b.row - a.row).slice(0, 1)
  cleanup()
  for (const side of ['player', 'enemy'] as const) {
    if (side === 'enemy') {
      s.intents = s.intents.filter(intent => !arriving.includes(intent))
      for (const intent of arriving.sort((a, b) => a.col - b.col || b.row - a.row)) {
        const row = !s.enemy[intent.row][intent.col] ? intent.row : 1 - intent.row
        if (!s.enemy[row][intent.col]) { s.enemy[row][intent.col] = { ...intent.card, hp: intent.card.health }; addLog(`敌方 ${intent.card.name} 进入 ${intent.col + 1} 列${row === 0 ? '前排' : '后排'}。`); emit({ kind: 'deploy', source: `intent-${intent.card.id}`, target: `enemy-${row}-${intent.col}`, label: `敌方 ${intent.card.name} 入场` }) }
        else addLog(`第 ${intent.col + 1} 列已满，敌方 ${intent.card.name} 未能进场。`)
      }
    }
    const board = s[side], opponent = s[side === 'player' ? 'enemy' : 'player']
    const order = Array.from({ length: 5 }, (_, col) => [board[1][col], board[0][col]]).flat().filter((u): u is Unit => u !== null).map(u => u.id)
    for (const id of order) {
      let row = -1, col = -1
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) if (board[r][c]?.id === id) { row = r; col = c }
      if (row < 0) continue
      const attacker = board[row][col]!
      if (row === 1 && !sigils(attacker).includes('ranged')) continue
      const support = row === 0 && board[1][col] && sigils(board[1][col]!).includes('support') ? 1 : 0, power = attacker.attack + support
      if (power <= 0) continue
      const targets = sigils(attacker).includes('split') ? [col - 1, col + 1].filter(c => c >= 0 && c < 5) : [col]
      for (const targetCol of targets) {
        if (attacker.hp <= 0) break
        const defender = opponent[0][targetCol]
        const other = side === 'player' ? 'enemy' : 'player'
        const target = defender ? `${other}-0-${targetCol}` : `life-${other}`
        // Lunge toward the lane; life damage still animates on the life display.
        emit({ kind: 'attack', source: `${side}-${row}-${col}`, target: `${other}-0-${targetCol}`, label: `${attacker.name} 攻击第 ${targetCol + 1} 列` })
        if (defender) {
          const frontHp = defender.hp
          const damage = Math.max(0, power - (sigils(defender).includes('armor') ? 1 : 0)); defender.hp -= damage
          addLog(`${attacker.name} → ${defender.name}，造成 ${damage} 点伤害${support ? '（鼓舞 +1）' : ''}。`)
          emit({ kind: 'hit', target, amount: damage, label: `${defender.name} ${damage ? `受到 ${damage} 点伤害` : '硬甲格挡'}` })
          if (sigils(defender).includes('thorns')) { attacker.hp -= 1; addLog(`荆棘反伤：${attacker.name} 受到 1 点伤害。`); emit({ kind: 'hit', target: `${side}-${row}-${col}`, amount: 1, label: `${attacker.name} 受到荆棘反伤` }) }
          const overflow = Math.max(0, damage - frontHp), rear = opponent[1][targetCol]
          if (overflow > 0 && rear) {
            const rearDamage = Math.max(0, overflow - (sigils(rear).includes('armor') ? 1 : 0))
            rear.hp -= rearDamage
            addLog(`溢出伤害 → ${rear.name}，造成 ${rearDamage} 点伤害。`)
            emit({ kind: 'hit', target: `${other}-1-${targetCol}`, amount: rearDamage, label: `${rear.name} 受到 ${rearDamage} 点溢出伤害` })
            if (sigils(rear).includes('thorns')) {
              attacker.hp -= 1
              addLog(`荆棘反伤：${attacker.name} 受到 1 点伤害。`)
              emit({ kind: 'hit', target: `${side}-${row}-${col}`, amount: 1, label: `${attacker.name} 受到荆棘反伤` })
            }
          }
        } else {
          if (side === 'player') s.enemyHp -= power; else s.playerHp -= power
          addLog(`${attacker.name} 突破第 ${targetCol + 1} 列，${side === 'player' ? '敌方' : '我方'}生命 −${power}。`)
          emit({ kind: 'hit', target, amount: power, label: `${side === 'player' ? '敌方' : '我方'}生命 −${power}` })
        }
        cleanup(); if (checkEnd()) return s
      }
    }
  }
  s.round++; s.canDraw = true
  if (!s.deck.length && !s.squirrelDeck.length) { s.canDraw = false; s.fatigue++; s.playerHp -= s.fatigue; addLog(`两堆牌库耗尽：疲劳造成 ${s.fatigue} 点生命伤害。`); emit({ kind: 'hit', target: 'life-player', amount: s.fatigue, label: `疲劳伤害 −${s.fatigue}` }) }
  if (!checkEnd()) {
    // Start of the new round, before deployment: advance both sides once.
    // Never promote units during attack/death resolution.
    for (const side of ['player', 'enemy'] as const) {
      const board = s[side]
      for (let col = 0; col < 5; col++) {
        const rear = board[1][col]
        if (rear && !board[0][col]) {
          board[0][col] = rear
          board[1][col] = null
          addLog(`第 ${s.round} 回合开始：${side === 'player' ? '我方' : '敌方'} ${rear.name} 自动上前至第 ${col + 1} 列。`)
          emit({ kind: 'advance', source: `${side}-1-${col}`, target: `${side}-0-${col}`, label: `${rear.name} 上前补位 · 第 ${col + 1} 列` })
        }
      }
    }
    if (!s.intents.length) s.intents.push(...getIntents(s.round, s.encounter, s.mapSeed))
  }
  s.log = s.log.slice(0, 60)
  return s
}
