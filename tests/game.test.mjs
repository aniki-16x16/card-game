import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getIntents, getRewards, sacrificePoints, initialDeck, makeCard, makeSquirrel, selectSummon, markSacrifice, drawCard, startBattle, deploy, planRound, resolveRound, transfer, load } from '../src/game.ts'

const unit = (index, id, patch = {}) => { const card = makeCard(index, id); return { ...card, hp: card.health, ...patch } }
// Combat fixtures use a known hand independently of seeded shuffle order.
const quietBattle = () => ({ ...startBattle(initialDeck(), 1, 123), hand: [...initialDeck().slice(0, 5), makeSquirrel('squirrel-0')], deck: initialDeck().slice(5), intents: [] })

test('free squirrel deployment removes the hand card and rejects occupied or invalid slots', () => {
  const start = selectSummon(startBattle(initialDeck()), 'squirrel-0')
  const next = deploy(start, 'squirrel-0', 0, 0)
  assert.equal(next.hand.length, 5); assert.equal(next.player[0][0].hp, 1)
  assert.equal(start.player[0][0], null); assert.equal(next.summon, null)
  assert.equal(deploy(next, 'starter-0', 0, 1), next, 'unpaid cards cannot deploy')
  const selected = selectSummon({ ...next, hand: [...next.hand, makeSquirrel('extra')] }, 'extra')
  assert.equal(deploy(selected, 'extra', 0, 0), selected)
  assert.equal(deploy(selected, 'extra', 0, 5), selected)
  assert.equal(deploy(selected, 'extra', 0, 1.5), selected)
})
test('front blocks life damage and spills excess damage into rear', () => {
  const s = quietBattle(); s.player[0][0] = unit(0, 'p'); s.enemy[0][0] = unit(4, 'e', { native: [] }); s.enemy[1][0] = unit(1, 'rear')
  const next = resolveRound(s)
  assert.equal(next.enemy[0][0].id, 'rear'); assert.equal(next.enemy[0][0].hp, 2); assert.equal(next.enemy[1][0], null); assert.equal(next.enemyHp, 24)
  assert.equal(next.player[0][0].hp, 3, 'rear must not advance and counterattack during the current combat')
})
test('rear melee cannot attack; ranged rear can damage an empty lane', () => {
  const s = quietBattle(); s.player[1][0] = unit(0, 'melee'); s.player[1][1] = unit(2, 'ranged')
  assert.equal(resolveRound(s).enemyHp, 22)
})
test('support adds attack only to the same-column front', () => {
  const s = quietBattle(); s.player[0][0] = unit(0, 'wolf'); s.player[1][0] = unit(1, 'deer')
  assert.equal(resolveRound(s).enemyHp, 20)
})
test('armor reduces damage and thorns can kill the attacker after a lethal hit', () => {
  const s = quietBattle(); s.player[0][0] = unit(0, 'p', { hp: 1 }); s.enemy[0][0] = unit(3, 'e', { hp: 2, added: ['thorns'] })
  const next = resolveRound(s); assert.equal(next.player[0][0], null); assert.equal(next.enemy[0][0], null)
})
test('rear fox advances only at the next round start and cannot attack early', () => {
  const s = quietBattle(); s.player[1][0] = unit(5, 'fox')
  const next = resolveRound(s); assert.equal(next.player[0][0].id, 'fox'); assert.equal(next.player[1][0], null); assert.equal(next.enemyHp, 24)
  next.intents = []
  assert.equal(resolveRound(next).enemyHp, 22)
})

test('all rear species on both sides advance at round start, preserving damage and sigils', () => {
  const s = quietBattle()
  for (const side of ['player', 'enemy']) for (let col = 0; col < 5; col++) {
    s[side][1][col] = unit(col, `${side}-${col}`, { attack: 0, hp: 1, added: ['armor'] })
  }
  const next = resolveRound(s)
  assert.equal(next.round, 2)
  for (const side of ['player', 'enemy']) for (let col = 0; col < 5; col++) {
    assert.deepEqual(next[side][0][col], s[side][1][col])
    assert.equal(next[side][1][col], null)
    assert.equal(s[side][0][col], null, 'original state is untouched')
  }
})

test('occupied front prevents promotion on both sides', () => {
  const s = quietBattle()
  for (const side of ['player', 'enemy']) {
    s[side][0][2] = unit(3, `${side}-front`, { attack: 0 })
    s[side][1][2] = unit(0, `${side}-rear`)
  }
  const next = resolveRound(s)
  for (const side of ['player', 'enemy']) {
    assert.equal(next[side][0][2].id, `${side}-front`)
    assert.equal(next[side][1][2].id, `${side}-rear`)
  }
})

test('deploying into an empty rear lane waits until the next round to advance', () => {
  const s = deploy(selectSummon(quietBattle(), 'squirrel-0'), 'squirrel-0', 1, 4)
  assert.equal(s.player[0][4], null)
  const next = resolveRound(s)
  assert.equal(next.enemyHp, 24)
  assert.equal(next.player[0][4].id, 'squirrel-0')
  assert.equal(next.player[1][4], null)
})

test('fatigue defeat does not start a new deployment phase or advance rear units', () => {
  const s = quietBattle(); s.deck = []; s.squirrelDeck = []; s.playerHp = 1; s.player[1][0] = unit(0, 'rear')
  const next = resolveRound(s)
  assert.equal(next.status, 'lost')
  assert.equal(next.player[0][0], null)
  assert.equal(next.player[1][0].id, 'rear')
})
test('split attacks neighboring lanes, and edge split only attacks one lane', () => {
  const s = quietBattle(); s.player[0][2] = unit(7, 'heron')
  assert.equal(resolveRound(s).enemyHp, 18)
  s.player[0][2] = null; s.player[0][0] = unit(7, 'edge')
  assert.equal(resolveRound(s).enemyHp, 21)
})
test('rebirth returns a dead card, and paid redeployment restores health', () => {
  const s = quietBattle(); s.player[0][0] = unit(4, 'moth'); s.enemy[0][0] = unit(0, 'wolf')
  const next = resolveRound(s); assert.equal(next.player[0][0], null); assert.ok(next.hand.some(c => c.id === 'moth'))
  assert.equal('hp' in next.hand.find(c => c.id === 'moth'), false)
  next.player[0][1] = { ...makeSquirrel('offering'), hp: 1 }
  const paid = markSacrifice(selectSummon(next, 'moth'), 'offering').state
  const redeployed = deploy(paid, 'moth', 0, 1)
  assert.equal(redeployed.player[0][1].hp, 1); assert.equal(redeployed.summon, null)
})
test('lethal player attack stops enemy counterattack; depleted life is clamped to zero', () => {
  const s = quietBattle(); s.enemyHp = 1; s.playerHp = 1; s.player[0][0] = unit(0, 'p'); s.enemy[0][1] = unit(0, 'e')
  const next = resolveRound(s); assert.equal(next.status, 'won'); assert.equal(next.enemyHp, 0); assert.equal(next.playerHp, 1)
  const loss = quietBattle(); loss.playerHp = 1; loss.enemy[0][0] = unit(0, 'e')
  assert.equal(resolveRound(loss).status, 'lost')
})
test('deck exhaustion causes increasing fatigue and can end the battle', () => {
  const s = quietBattle(); s.deck = []; s.squirrelDeck = []; s.playerHp = 3
  const next = resolveRound(s); assert.equal(next.playerHp, 2); assert.equal(next.fatigue, 1)
  next.intents = []
  assert.equal(resolveRound(next).status, 'lost')
})
test('repeated transfers consume donors and preserve native sigils, stats and capacity', () => {
  let cards = initialDeck()
  cards = transfer(cards, 'starter-1', 'starter-0', 'armor').deck
  cards = transfer(cards, 'starter-2', 'starter-0', 'ranged').deck
  cards = transfer(cards, 'starter-3', 'starter-0', 'support').deck
  const result = cards.find(c => c.id === 'starter-0')
  assert.deepEqual(result.added, ['armor', 'ranged', 'support']); assert.equal(load(result), 3)
  assert.equal(result.attack, 3); assert.equal(result.capacity, 3); assert.equal(cards.length, 11)
  assert.ok(transfer(cards, 'starter-5', 'starter-0', 'rebirth').error)
  const replacement = transfer(cards, 'starter-5', 'starter-0', 'rebirth', ['armor', 'ranged', 'support'])
  assert.equal(replacement.error, undefined); assert.deepEqual(replacement.deck.find(c => c.id === 'starter-0').added, ['rebirth'])
})
test('transfer rejects self, duplicate ability, missing ability, and a deck below minimum size', () => {
  const cards = initialDeck()
  assert.ok(transfer(cards, 'starter-1', 'starter-1', 'armor').error)
  assert.ok(transfer(cards, 'starter-1', 'starter-9', 'armor').error)
  assert.ok(transfer(cards, 'starter-0', 'starter-1', 'rebirth').error)
  assert.ok(transfer(cards.slice(0, 6), 'starter-1', 'starter-0', 'armor').error)
})
test('inherited sigils can be transferred again without increasing receiver capacity', () => {
  const first = transfer(initialDeck(), 'starter-1', 'starter-0', 'armor')
  const second = transfer(first.deck, 'starter-0', 'starter-3', 'armor')
  const receiver = second.deck.find(c => c.id === 'starter-3')
  assert.deepEqual(receiver.native, ['support']); assert.deepEqual(receiver.added, ['armor']); assert.equal(receiver.capacity, 3)
})


test('animation timeline orders columns left to right and rear before front, without mutating input', () => {
  const s = quietBattle()
  s.player[0][0] = unit(0, 'front')
  s.player[1][0] = unit(2, 'rear')
  s.player[0][1] = unit(5, 'right')
  const original = structuredClone(s)
  const plan = planRound(s)
  assert.deepEqual(plan.frames.filter(f => f.action.kind === 'attack').map(f => f.action.source), ['player-1-0', 'player-0-0', 'player-0-1'])
  assert.deepEqual(plan.frames.map(f => f.action.kind), ['attack', 'hit', 'attack', 'hit', 'attack', 'hit'])
  assert.equal(plan.frames[0].state.enemyHp, 24)
  assert.equal(plan.frames[1].state.enemyHp, 22)
  assert.deepEqual(plan.state, resolveRound(s))
  assert.deepEqual(s, original)
})

test('hit, retaliation, death, and next-round promotion are separate snapshots', () => {
  const s = quietBattle()
  s.player[0][0] = unit(0, 'front', { hp: 1 })
  s.player[1][0] = unit(5, 'rear')
  s.enemy[0][0] = unit(6, 'thorns', { hp: 1 })
  const plan = planRound(s)
  assert.deepEqual(plan.frames.map(f => f.action.kind), ['attack', 'hit', 'hit', 'death', 'death', 'advance'])
  assert.equal(plan.frames[1].state.enemy[0][0].hp, -2)
  assert.equal(plan.frames[1].state.player[0][0].hp, 1)
  assert.equal(plan.frames[2].state.player[0][0].hp, 0)
  const advance = plan.frames.at(-1)
  assert.equal(advance.state.round, 2)
  assert.equal(advance.state.player[0][0].id, 'rear')
  assert.equal(advance.state.player[1][0], null)
})

test('enemy entry is left to right and a lethal hit stops the animation plan', () => {
  const s = quietBattle()
  s.intents = [{card: makeCard(5, 'right'), col: 4, row: 0}, {card: makeCard(5, 'left'), col: 1, row: 0}]
  s.player[0][0] = unit(0, 'lethal'); s.enemyHp = 1
  const plan = planRound(s)
  assert.deepEqual(plan.frames.map(f => f.action.kind), ['attack', 'hit'])
  assert.equal(plan.state.enemy[0][1], null)
  assert.equal(plan.state.enemy[0][4], null)
  assert.equal(plan.state.status, 'won')
})


test('all player attacks finish before enemy deployment and counterattack', () => {
  const s = quietBattle()
  s.player[0][0] = unit(0, 'left'); s.player[0][4] = unit(0, 'right')
  s.intents = [{ card: makeCard(5, 'right-enemy'), row: 0, col: 4 }, { card: makeCard(5, 'left-enemy'), row: 0, col: 0 }]
  const plan = planRound(s)
  assert.deepEqual(plan.frames.filter(f => ['attack', 'deploy'].includes(f.action.kind)).map(f => [f.action.kind, f.action.target]), [
    ['attack', 'enemy-0-0'], ['attack', 'enemy-0-4'], ['deploy', 'enemy-0-0'], ['attack', 'player-0-0'],
  ])
  assert.equal(plan.state.enemyHp, 18)
  assert.equal(plan.frames[0].state.intents.length, 2)
})

test('empty front damages life and leaves rear untouched for either side', () => {
  for (const side of ['player', 'enemy']) {
    const s = quietBattle(), other = side === 'player' ? 'enemy' : 'player'
    s[side][0][2] = unit(0, 'attacker')
    s[other][1][2] = unit(1, 'rear', { native: [] })
    const plan = planRound(s)
    assert.equal(plan.state[other + 'Hp'], 21)
    assert.equal(plan.state[other][0][2].hp, 4)
    assert.equal(plan.frames.find(f => f.action.kind === 'attack').action.target, other + '-0-2')
    assert.equal(plan.frames.find(f => f.action.kind === 'hit').action.target, 'life-' + other)
  }
})

test('overflow never damages life, whether rear is absent or also killed', () => {
  for (const rearPresent of [false, true]) {
    const s = quietBattle()
    s.player[0][0] = unit(0, 'attacker', { attack: 10 })
    s.enemy[0][0] = unit(5, 'front', { hp: 1 })
    if (rearPresent) s.enemy[1][0] = unit(5, 'rear')
    const next = resolveRound(s)
    assert.equal(next.enemyHp, 24)
    assert.equal(next.enemy[0][0], null)
    assert.equal(next.enemy[1][0], null)
  }
})

test('overflow applies armor on each defender and rear thorns still retaliate', () => {
  const s = quietBattle()
  s.player[0][0] = unit(0, 'attacker', { attack: 5, hp: 1 })
  s.enemy[0][0] = unit(3, 'front', { hp: 1 })
  s.enemy[1][0] = unit(3, 'rear', { health: 4, hp: 4, added: ['thorns'] })
  const next = resolveRound(s)
  assert.equal(next.enemy[0][0].hp, 2)
  assert.equal(next.player[0][0], null)
  assert.equal(next.enemyHp, 24)
})

test('each attack checks front occupancy anew, including ranged then front attacks', () => {
  const s = quietBattle()
  s.player[1][0] = unit(2, 'ranged')
  s.player[0][0] = unit(0, 'front')
  s.enemy[0][0] = unit(5, 'defender', { hp: 1 })
  s.enemy[1][0] = unit(1, 'rear', { native: [] })
  const next = resolveRound(s)
  assert.equal(next.enemyHp, 21)
  assert.equal(next.enemy[0][0].hp, 3)
})

test('split life attacks aim at their respective neighboring columns', () => {
  const s = quietBattle(); s.player[0][2] = unit(7, 'split')
  assert.deepEqual(planRound(s).frames.filter(f => f.action.kind === 'attack').map(f => f.action.target), ['enemy-0-1', 'enemy-0-3'])
})


test('sacrifice marks are reversible and never remove units before reaching cost', () => {
  const s = quietBattle(); s.player[0][0] = unit(5, 'first'); s.player[1][2] = unit(5, 'second')
  const selected = selectSummon(s, 'starter-0')
  const marked = markSacrifice(selected, 'first')
  assert.equal(marked.frames.length, 0)
  assert.deepEqual(marked.state.summon.sacrifices, ['first'])
  assert.deepEqual(marked.state.player, s.player)
  assert.deepEqual(selected.summon.sacrifices, [])
  const unmarked = markSacrifice(marked.state, 'first').state
  assert.deepEqual(unmarked.summon.sacrifices, [])
  const canceled = selectSummon(marked.state, null)
  assert.equal(canceled.summon, null); assert.deepEqual(canceled.player, s.player)
  const switched = selectSummon(marked.state, 'starter-1')
  assert.deepEqual(switched.summon.sacrifices, [])
  assert.equal(markSacrifice(marked.state, 'enemy-unit').state, marked.state)
})

test('meeting cost sacrifices immediately, locks the card and turn, and frees deployment slots', () => {
  const s = quietBattle()
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) s.player[row][col] = unit(5, row + '-' + col)
  const selected = selectSummon(s, 'starter-0')
  const first = markSacrifice(selected, '0-0').state
  const paid = markSacrifice(first, '1-4')
  assert.equal(paid.state.player[0][0], null); assert.equal(paid.state.player[1][4], null)
  assert.equal(paid.state.summon.paid, true)
  assert.deepEqual(paid.frames.map(f => f.action.cause), ['sacrificed', 'sacrificed'])
  assert.equal(selectSummon(paid.state, null), paid.state)
  assert.equal(selectSummon(paid.state, 'starter-1'), paid.state)
  assert.equal(resolveRound(paid.state), paid.state)
  assert.equal(drawCard(paid.state, 'deck'), paid.state)
  assert.equal(deploy(paid.state, 'starter-1', 0, 0), paid.state)
  assert.equal(deploy(paid.state, 'starter-0', 0, 1), paid.state)
  const deployed = deploy(paid.state, 'starter-0', 1, 4)
  assert.equal(deployed.player[1][4].id, 'starter-0')
  assert.equal(deployed.summon, null)
  assert.equal(deployed.player.flat().filter(Boolean).length, 9)
  assert.equal(s.player.flat().filter(Boolean).length, 10)
})

test('sacrifice triggers death/rebirth but not thorns or killed causes', () => {
  const s = quietBattle(); s.player[0][0] = unit(4, 'moth', { added: ['thorns'] })
  s.player[1][0] = unit(5, 'rear')
  const paid = markSacrifice(selectSummon(s, 'starter-1'), 'moth')
  assert.equal(paid.state.player[0][0], null)
  assert.equal(paid.state.player[1][0].id, 'rear', 'no immediate promotion')
  assert.equal(paid.state.playerHp, 24)
  assert.equal(paid.state.hand.find(c => c.id === 'moth').hp, undefined)
  assert.deepEqual(paid.frames.map(f => [f.action.kind, f.action.cause]), [['death', 'sacrificed']])
  const combat = quietBattle(); combat.player[0][0] = unit(0, 'wolf'); combat.enemy[0][0] = unit(4, 'enemy-moth')
  assert.equal(planRound(combat).frames.find(f => f.action.kind === 'death').action.cause, 'killed')
})

test('squirrel pile is separate and both piles share one draw per round', () => {
  const s = quietBattle(), original = structuredClone(s)
  assert.equal(s.hand.length, 6); assert.equal(s.squirrelDeck.length, 9)
  assert.deepEqual(s.hand.at(-1), makeSquirrel('squirrel-0'))
  const squirrelDraw = drawCard(s, 'squirrelDeck')
  assert.equal(squirrelDraw.hand.at(-1).species, 'squirrel')
  assert.equal(squirrelDraw.squirrelDeck.length, 8)
  assert.equal(squirrelDraw.deck.length, s.deck.length)
  assert.equal(drawCard(squirrelDraw, 'deck'), squirrelDraw)
  assert.equal(drawCard(squirrelDraw, 'squirrelDeck'), squirrelDraw)
  const next = resolveRound(squirrelDraw)
  assert.equal(next.canDraw, true)
  assert.equal(next.hand.length, squirrelDraw.hand.length, 'round end does not auto-draw')
  const mainDraw = drawCard(next, 'deck')
  assert.equal(mainDraw.hand.at(-1).id, s.deck[0].id)
  assert.equal(mainDraw.squirrelDeck.length, 8)
  assert.equal(mainDraw.canDraw, false)
  assert.deepEqual(s, original)
})

test('empty pile cannot consume a draw; fatigue requires both piles empty', () => {
  const s = quietBattle(); s.deck = []
  assert.equal(drawCard(s, 'deck'), s)
  assert.equal(resolveRound(s).playerHp, 24)
  assert.equal(drawCard(s, 'squirrelDeck').canDraw, false)
  s.squirrelDeck = []
  const next = resolveRound(s)
  assert.equal(next.playerHp, 23); assert.equal(next.canDraw, false)
})

test('free selection can cancel, cannot sacrifice, and unfinished marks clear on ending turn', () => {
  const s = quietBattle(); s.player[0][0] = unit(5, 'offering')
  const free = selectSummon(s, 'squirrel-0')
  assert.equal(markSacrifice(free, 'offering').state, free)
  assert.equal(selectSummon(free, null).summon, null)
  const marked = markSacrifice(selectSummon(s, 'starter-0'), 'offering').state
  const next = resolveRound(marked)
  assert.equal(next.summon, null); assert.equal(next.player[0][0].id, 'offering')
})

test('zero-attack squirrels do not attack or trigger thorns; support can enable an attack', () => {
  const s = quietBattle()
  s.player[0][0] = { ...makeSquirrel('squirrel'), hp: 1 }
  s.enemy[0][0] = unit(6, 'bear', { attack: 0 })
  const plan = planRound(s)
  assert.equal(plan.frames.filter(f => f.action.kind === 'attack').length, 0)
  assert.equal(plan.state.player[0][0].hp, 1)
  s.player[1][0] = unit(1, 'support')
  const boosted = planRound(s)
  assert.equal(boosted.frames.filter(f => f.action.kind === 'attack').length, 1)
  assert.equal(boosted.state.player[0][0].id, 'support')
})

test('opening hand contains five shuffled main cards and one squirrel', () => {
  const cards = initialDeck(), before = structuredClone(cards)
  const s = startBattle(cards, 1, 20260929)
  assert.equal(s.hand.length, 6)
  assert.equal(s.hand.filter(c => c.species === 'squirrel').length, 1)
  assert.equal(s.deck.length, cards.length - 5)
  assert.deepEqual([...s.hand.filter(c => c.species !== 'squirrel'), ...s.deck].map(c => c.id).sort(), cards.map(c => c.id).sort())
  assert.deepEqual(cards, before)
  assert.deepEqual(startBattle(cards, 1, 20260929), s)
  assert.notDeepEqual(startBattle(cards, 1, 20260930).hand, s.hand)
  assert.equal(s.mapSeed, 20260929)
})

test('goat pays three points, can overpay, and does not bank excess points', () => {
  for (const index of [0, 3, 6]) {
    const s = quietBattle(), card = makeCard(index, 'summoned')
    s.hand.push(card); s.player[0][0] = unit(8, 'goat')
    assert.equal(sacrificePoints(s), 3)
    const paid = markSacrifice(selectSummon(s, card.id), 'goat')
    assert.equal(paid.state.summon.paid, true)
    assert.equal(paid.state.player[0][0], null)
    const placed = deploy(paid.state, card.id, 0, 0)
    const next = selectSummon(placed, 'starter-0')
    assert.equal(next.summon.paid, false)
    assert.equal(paid.frames[0].action.cause, 'sacrificed')
  }
})

test('undying sacrifice preserves wounds and sigils without triggering rebirth', () => {
  const s = quietBattle(); s.player[0][0] = unit(9, 'experiment', { health: 3, hp: 2, added: ['rebirth'] })
  const original = structuredClone(s.player[0][0])
  const paid = markSacrifice(selectSummon(s, 'starter-1'), 'experiment')
  assert.equal(paid.state.summon.paid, true)
  assert.deepEqual(paid.state.player[0][0], original)
  assert.equal(paid.state.hand.some(c => c.id === 'experiment'), false)
  assert.deepEqual(paid.frames.map(f => f.action.kind), ['sacrifice'])
  assert.equal(deploy(paid.state, 'starter-1', 0, 0), paid.state)
  const placed = deploy(paid.state, 'starter-1', 0, 1)
  const second = markSacrifice(selectSummon(placed, 'starter-4'), 'experiment')
  assert.equal(second.state.summon.paid, true)
  assert.deepEqual(second.state.player[0][0], original)
})

test('undying unit counts only once per summon and still dies when killed', () => {
  const s = quietBattle(); s.player[0][0] = unit(9, 'experiment')
  const marked = markSacrifice(selectSummon(s, 'starter-0'), 'experiment').state
  assert.equal(sacrificePoints(marked, marked.summon.sacrifices), 1)
  const toggled = markSacrifice(marked, 'experiment').state
  assert.equal(toggled.summon.paid, false)
  assert.equal(sacrificePoints(toggled, toggled.summon.sacrifices), 0)
  s.enemy[0][0] = unit(0, 'wolf')
  const plan = planRound(s)
  assert.equal(plan.state.player[0][0], null)
  assert.equal(plan.frames.find(f => f.action.kind === 'death').action.cause, 'killed')
})

test('combined sacrifice sigils work on any species, including transferred sigils', () => {
  let cards = transfer(initialDeck(), 'starter-12', 'starter-0', 'triple').deck
  assert.ok(cards.find(c => c.id === 'starter-0').added.includes('triple'))
  cards = transfer(cards, 'starter-13', 'starter-3', 'undying').deck
  assert.ok(cards.find(c => c.id === 'starter-3').added.includes('undying'))
  const s = quietBattle(); s.hand.push(makeCard(6, 'bear'))
  s.player[0][0] = unit(9, 'combined', { added: ['triple'] })
  const paid = markSacrifice(selectSummon(s, 'bear'), 'combined')
  assert.equal(paid.state.summon.paid, true)
  assert.equal(paid.state.player[0][0].id, 'combined')
  assert.equal(paid.frames[0].action.kind, 'sacrifice')
})

test('full board with surviving sacrifices stays cancellable until a landing slot can be freed', () => {
  const s = quietBattle()
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) s.player[row][col] = unit(9, `${row}-${col}`)
  s.player[1][4] = unit(5, 'mortal')
  const marked = markSacrifice(selectSummon(s, 'starter-1'), '0-0')
  assert.equal(marked.state.summon.paid, false)
  assert.equal(marked.frames.length, 0)
  assert.equal(selectSummon(marked.state, null).summon, null)
  const paid = markSacrifice(marked.state, 'mortal')
  assert.equal(paid.state.summon.paid, true)
  assert.equal(paid.state.player[1][4], null)
  assert.equal(paid.state.player[0][0].id, '0-0')
  assert.equal(deploy(paid.state, 'starter-1', 1, 4).summon, null)
})

test('enemy generation and actual deployment are capped at one, including rebirth backlog', () => {
  for (const encounter of [1, 2, 3]) for (let round = 1; round <= 13; round++) assert.ok(getIntents(round, encounter, 123).length <= 1)
  const s = quietBattle()
  s.intents = [{ card: makeCard(5, 'scheduled'), row: 0, col: 2 }]
  s.enemy[0][0] = unit(4, 'reborn'); s.player[0][0] = unit(0, 'wolf')
  const plan = planRound(s)
  assert.equal(plan.frames.filter(f => f.action.kind === 'deploy').length, 1)
  assert.equal(plan.state.intents.length, 1)
  assert.equal(plan.state.intents[0].card.id, 'reborn')
  const second = planRound(plan.state)
  assert.equal(second.frames.filter(f => f.action.kind === 'deploy').length, 1)
})

test('map seed controls independent enemy lanes and stable unique rewards', () => {
  const s = startBattle(initialDeck(), 1, 123)
  assert.deepEqual(planRound(s), planRound(s))
  assert.equal(planRound(s).state.mapSeed, 123)
  const rewards = getRewards(123, 1)
  assert.equal(new Set(rewards.map(c => c.species)).size, 3)
  getIntents(6, 2, 123); startBattle(initialDeck(), 2, 123)
  assert.deepEqual(getRewards(123, 1), rewards)
  const seen = new Set(Array.from({ length: 30 }, (_, seed) => getRewards(seed, 1)).flat().map(c => c.species))
  assert.ok(seen.has('goat')); assert.ok(seen.has('experiment'))
  assert.notDeepEqual(Array.from({length:12}, (_, i) => getIntents(i+1, 1, 123)), Array.from({length:12}, (_, i) => getIntents(i+1, 1, 456)))
})
