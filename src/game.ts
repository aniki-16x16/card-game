export type Sigil = 'ranged' | 'armor' | 'support' | 'thorns' | 'split' | 'rebirth'
export type Species = 'wolf' | 'deer' | 'owl' | 'beetle' | 'moth' | 'fox' | 'bear' | 'heron'
export type Card = { id: string; name: string; species: Species; attack: number; health: number; cost: number; native: Sigil[]; added: Sigil[]; capacity: number }
export type Unit = Card & { hp: number }
export type Board = (Unit | null)[][]
export type Intent = { card: Card; row: number; col: number }
export type Battle = { round: number; energy: number; maxEnergy: number; playerHp: number; enemyHp: number; player: Board; enemy: Board; hand: Card[]; deck: Card[]; intents: Intent[]; log: string[]; status: 'playing' | 'won' | 'lost'; fatigue: number; encounter: number }
export const SIGILS: Record<Sigil, { name: string; icon: string; weight: number; description: string }> = {
  ranged: { name: '远射', icon: '↗', weight: 1, description: '位于后排时也能攻击同列最前方的敌人。' },
  armor: { name: '硬甲', icon: '⬡', weight: 1, description: '每次受到攻击时，伤害减少 1，最低为 0。反伤不受此影响。' },
  support: { name: '鼓舞', icon: '✧', weight: 1, description: '位于后排时，使同列的友方前排攻击 +1。' },
  thorns: { name: '荆棘', icon: '✳', weight: 1, description: '被攻击后，对攻击者造成 1 点伤害，即使自身死亡。' },
  split: { name: '分袭', icon: '⋔', weight: 2, description: '改为攻击左右相邻两列，不攻击正前方；边缘只攻击一列。' },
  rebirth: { name: '归魂', icon: '⟲', weight: 3, description: '死亡后返回手牌，仍需支付能量再次召唤。' },
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
]
export function makeCard(index: number, id: string): Card { return { ...templates[index % templates.length], native: [...templates[index % templates.length].native], added: [], id } }
export function initialDeck(): Card[] { return [0, 3, 2, 1, 5, 4, 7, 6, 0, 3, 2, 5].map((t, i) => makeCard(t, `starter-${i}`)) }
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
export function getIntents(round: number, encounter: number): Intent[] {
  if (round > 12) return []
  const sequence = [3, 0, 2, 5, 1, 6, 7, 0, 2, 6, 7, 6], col = (round * 2 + 4) % 5
  const card = makeCard(sequence[(round - 1) % sequence.length], `enemy-${round}-a`)
  const intents: Intent[] = [{ card, col, row: sigils(card).includes('ranged') || sigils(card).includes('support') ? 1 : 0 }]
  if (round % 3 === 0 || (encounter > 1 && round % 2 === 0)) intents.push({ card: makeCard(5, `enemy-${round}-b`), col: (col + 2) % 5, row: 0 })
  return intents
}
export function startBattle(cards: Card[], encounter = 1): Battle {
  return { round: 1, energy: 3, maxEnergy: 3, playerHp: 24, enemyHp: 20 + encounter * 4, player: emptyBoard(), enemy: emptyBoard(), hand: structuredClone(cards.slice(0, 5)), deck: structuredClone(cards.slice(5)), intents: getIntents(1, encounter), log: ['林间的雾气散开了。选择手牌，再选择己方空位部署。'], status: 'playing', fatigue: 0, encounter }
}
export function deploy(state: Battle, id: string, row: number, col: number): Battle {
  const card = state.hand.find(c => c.id === id)
  if (state.status !== 'playing' || !card || card.cost > state.energy || !state.player[row] || col < 0 || col > 4 || state.player[row][col]) return state
  const next = structuredClone(state)
  next.player[row][col] = { ...card, hp: card.health }; next.hand = next.hand.filter(c => c.id !== id); next.energy -= card.cost
  next.log.unshift(`部署 ${card.name} → ${col + 1} 列${row === 0 ? '前排' : '后排'}。`)
  return next
}
export function resolveRound(state: Battle): Battle {
  if (state.status !== 'playing') return state
  const s = structuredClone(state), addLog = (message: string) => s.log.unshift(message)
  function checkEnd() {
    if (s.enemyHp <= 0) { s.enemyHp = 0; s.status = 'won'; return true }
    if (s.playerHp <= 0) { s.playerHp = 0; s.status = 'lost'; return true }
    return false
  }
  function cleanup() {
    for (const side of ['player', 'enemy'] as const) {
      const board = s[side]
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
        const unit = board[r][c]
        if (unit && unit.hp <= 0) {
          board[r][c] = null; addLog(`${side === 'player' ? '我方' : '敌方'} ${unit.name} 倒下了。`)
          if (sigils(unit).includes('rebirth')) {
            const { hp: _hp, ...restored } = unit
            if (side === 'player') { s.hand.push(restored); addLog(`${unit.name} 归魂，返回手牌。`) }
            else s.intents.push({ card: restored, row: r, col: c })
          }
        }
      }
    }
  }
  const arriving = s.intents; s.intents = []
  for (const intent of arriving) {
    const row = !s.enemy[intent.row][intent.col] ? intent.row : 1 - intent.row
    if (!s.enemy[row][intent.col]) { s.enemy[row][intent.col] = { ...intent.card, hp: intent.card.health }; addLog(`敌方 ${intent.card.name} 进入 ${intent.col + 1} 列${row === 0 ? '前排' : '后排'}。`) }
    else addLog(`第 ${intent.col + 1} 列已满，敌方 ${intent.card.name} 未能进场。`)
  }
  cleanup()
  for (const side of ['player', 'enemy'] as const) {
    const board = s[side], opponent = s[side === 'player' ? 'enemy' : 'player']
    const order = board.flat().filter((u): u is Unit => u !== null).map(u => u.id)
    for (const id of order) {
      let row = -1, col = -1
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) if (board[r][c]?.id === id) { row = r; col = c }
      if (row < 0) continue
      const attacker = board[row][col]!
      if (row === 1 && !sigils(attacker).includes('ranged')) continue
      const support = row === 0 && board[1][col] && sigils(board[1][col]!).includes('support') ? 1 : 0, power = attacker.attack + support
      const targets = sigils(attacker).includes('split') ? [col - 1, col + 1].filter(c => c >= 0 && c < 5) : [col]
      for (const targetCol of targets) {
        if (attacker.hp <= 0) break
        const defender = opponent[0][targetCol] ?? opponent[1][targetCol]
        if (defender) {
          const damage = Math.max(0, power - (sigils(defender).includes('armor') ? 1 : 0)); defender.hp -= damage
          addLog(`${attacker.name} → ${defender.name}，造成 ${damage} 点伤害${support ? '（鼓舞 +1）' : ''}。`)
          if (sigils(defender).includes('thorns')) { attacker.hp -= 1; addLog(`荆棘反伤：${attacker.name} 受到 1 点伤害。`) }
        } else {
          if (side === 'player') s.enemyHp -= power; else s.playerHp -= power
          addLog(`${attacker.name} 突破第 ${targetCol + 1} 列，${side === 'player' ? '敌方' : '我方'}生命 −${power}。`)
        }
        cleanup(); if (checkEnd()) return s
      }
    }
  }
  s.round++; s.maxEnergy = Math.min(6, 3 + Math.floor((s.round - 1) / 2)); s.energy = s.maxEnergy
  if (s.deck.length) s.hand.push(s.deck.shift()!)
  else { s.fatigue++; s.playerHp -= s.fatigue; addLog(`牌库耗尽：疲劳造成 ${s.fatigue} 点生命伤害。`) }
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
        }
      }
    }
    s.intents.push(...getIntents(s.round, s.encounter))
  }
  s.log = s.log.slice(0, 60)
  return s
}
