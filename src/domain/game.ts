import { MAP_SEED, createRandom, deriveSeed } from './random.ts'
import { templates, makeCard, creature, makeSquirrel, sigils, load } from './cards.ts'
import type { Card, Sigil } from './cards.ts'
import { STARTER_DECK } from '../data/starterDeck.ts'
import { BattleEngine } from './battleEngine.ts'
export * from './cards.ts'
export type Unit = Card & { hp: number; age?: number; used?: Sigil[]; base?: Card }
export type Board = (Unit | null)[][]
export type Intent = { card: Card; row: number; col: number }
export type Summon = { cardId: string; sacrifices: string[]; paid: boolean }
export type DrawPile = 'deck' | 'squirrelDeck'
export type DeathCause = 'killed' | 'sacrificed' | 'expired'
export type Battle = { mapSeed: number; nextId: number; round: number; balance: number; difficulty: 'normal' | 'elite' | 'boss'; player: Board; enemy: Board; hand: Card[]; deck: Card[]; squirrelDeck: Card[]; canDraw: boolean; summon: Summon | null; intents: Intent[]; log: string[]; status: 'playing' | 'won' | 'lost'; fatigue: number; encounter: number }
export function initialDeck(): Card[] { return STARTER_DECK.map((species, i) => creature(species, `starter-${i}`)) }
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
export function getIntents(round: number, encounter: number, mapSeed = MAP_SEED, difficulty: Battle['difficulty'] = 'normal'): Intent[] {
  if (round > 12) return []
  const rng = createRandom(deriveSeed(mapSeed, `enemy:${encounter}:${round}`))
  const ceiling = difficulty === 'boss' ? 3 : difficulty === 'elite' ? 2 : round <= 3 ? 1 : round < 8 ? 2 : 3
  const pool = templates.map((card, index) => ({ card, index })).filter(({ card }) => card.attack > 0 && card.cost <= ceiling && card.species !== 'squirrel')
  const card = makeCard(pool[rng.int(pool.length)].index, `enemy-${round}-a`), col = rng.int(5)
  if (difficulty === 'elite') card.health += 1
  if (difficulty === 'boss') { card.health += 1; card.native = [...new Set([...card.native, round % 2 ? 'armor' as const : 'flying' as const])] }
  const intents: Intent[] = [{ card, col, row: sigils(card).includes('ranged') || sigils(card).includes('support') ? 1 : 0 }]
  return intents
}
export function startBattle(cards: Card[], encounter = 1, mapSeed = MAP_SEED, difficulty: Battle['difficulty'] = 'normal'): Battle {
  const shuffled = createRandom(deriveSeed(mapSeed, `deck:${encounter}`)).shuffle(cards)
  const squirrels = Array.from({ length: 10 }, (_, i) => makeSquirrel(`squirrel-${i}`))
  return { mapSeed, nextId: 1, round: 1, balance: 0, difficulty, player: emptyBoard(), enemy: emptyBoard(), hand: [...structuredClone(shuffled.slice(0, 5)), squirrels[0]], deck: structuredClone(shuffled.slice(5)), squirrelDeck: squirrels.slice(1), canDraw: true, summon: null, intents: getIntents(1, encounter, mapSeed, difficulty), log: ['选择牌堆抽牌。0 费生物可直接部署；其他生物需要献祭己方单位。'], status: 'playing', fatigue: 0, encounter }
}
export function getRewards(mapSeed: number, encounter: number): Card[] {
  return createRandom(deriveSeed(mapSeed, `rewards:${encounter}`)).shuffle(templates.map((card, i) => card.species === 'squirrel' ? -1 : i).filter(i => i >= 0)).slice(0, 3).map((index, i) => makeCard(index, `reward-${encounter}-${i}`))
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
export function markSacrifice(state: Battle, id: string): { state: Battle; frames: BattleFrame[] } {
  const summon = state.summon, card = state.hand.find(c => c.id === summon?.cardId)
  if (state.status !== 'playing' || !summon || summon.paid || !card || card.cost === 0 || !state.player.flat().some(u => u?.id === id)) return { state, frames: [] }
  const s = structuredClone(state), next = s.summon!
  next.sacrifices = next.sacrifices.includes(id) ? next.sacrifices.filter(mark => mark !== id) : [...next.sacrifices, id]
  const frames: BattleFrame[] = []
  const engine = new BattleEngine(s, (action, snapshot) => frames.push({ action, state: snapshot }))
  const hasLandingSlot = s.player.flat().some(unit => !unit || (next.sacrifices.includes(unit.id) && !sigils(unit).includes('undying')))
  if (sacrificePoints(s, next.sacrifices) >= card.cost && hasLandingSlot) {
    next.paid = true
    for (const mark of next.sacrifices) {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
        if (s.player[row][col]?.id === mark) {
          const unit = s.player[row][col]!
          const survives = sigils(unit).includes('undying')
          if (survives) s.log.unshift(`${unit.name} 献祭提供 ${sacrificeValue(unit)} 费，永续祭品使其存活。`)
          if (survives) engine.emit({ kind: 'sacrifice', target: `player-${row}-${col}`, label: `${unit.name} 献祭后存活` })
          else engine.remove('player', row, col, 'sacrificed')
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
export function deploy(state: Battle, id: string, row: number, col: number, record?: Recorder): Battle {
  const card = state.hand.find(c => c.id === id)
  if (state.status !== 'playing' || !card || state.summon?.cardId !== id || (card.cost > 0 && !state.summon.paid) || !Number.isInteger(row) || !Number.isInteger(col) || !state.player[row] || col < 0 || col > 4 || state.player[row][col]) return state
  const next = structuredClone(state)
  next.hand = next.hand.filter(c => c.id !== id); next.summon = null
  const engine = new BattleEngine(next, record)
  engine.place(card, 'player', row, col, 'hand-' + id)
  return next
}
export function planDeploy(state: Battle, id: string, row: number, col: number): { frames: BattleFrame[]; state: Battle } {
  const frames: BattleFrame[] = []
  const result = deploy(state, id, row, col, (action, snapshot) => frames.push({ action, state: snapshot }))
  return { frames, state: result }
}
export type BattleAction = { kind: 'deploy' | 'attack' | 'hit' | 'advance' | 'death' | 'sacrifice' | 'effect'; source?: string; target: string; label: string; amount?: number; cause?: DeathCause; route?: 'air' | 'ground' }
export type BattleFrame = { action: BattleAction; state: Battle }
export function planRound(state: Battle): { frames: BattleFrame[]; state: Battle } {
  const frames: BattleFrame[] = []
  const result = resolveRound(state, (action, snapshot) => frames.push({ action, state: snapshot }))
  return { frames, state: result }
}
export type Recorder = (action: BattleAction, state: Battle) => void
export function resolveRound(state: Battle, record?: Recorder): Battle {
  if (state.status !== 'playing' || state.summon?.paid) return state
  const s = structuredClone(state); s.summon = null
  const engine = new BattleEngine(s, record)
  const arriving = [...s.intents].sort((a, b) => a.col - b.col || b.row - a.row).slice(0, 1)
  engine.cleanup()
  engine.turn('player')
  if (engine.checkEnd()) return s
  s.intents = s.intents.filter(intent => !arriving.includes(intent))
  for (const intent of arriving) {
    const row = !s.enemy[intent.row][intent.col] ? intent.row : 1 - intent.row
    if (!s.enemy[row][intent.col]) engine.place(intent.card, 'enemy', row, intent.col, 'intent-' + intent.card.id)
    else s.log.unshift(`第 ${intent.col + 1} 列已满，敌方 ${intent.card.name} 未能进场。`)
  }
  if (engine.checkEnd()) return s
  engine.turn('enemy')
  if (engine.checkEnd()) return s
  s.round++; s.canDraw = true
  if (!s.deck.length && !s.squirrelDeck.length) {
    s.canDraw = false; s.fatigue++; s.balance -= s.fatigue
    engine.checkEnd()
    s.log.unshift(`两堆牌库耗尽：疲劳造成 ${s.fatigue} 点天平伤害。`)
    engine.emit({ kind: 'hit', target: 'life-player', amount: s.fatigue, label: `疲劳伤害 −${s.fatigue}` })
  }
  if (!engine.checkEnd()) {
    engine.startRound()
    if (!s.intents.length) s.intents.push(...getIntents(s.round, s.encounter, s.mapSeed, s.difficulty))
  }
  s.log = s.log.slice(0, 60)
  return s
}
