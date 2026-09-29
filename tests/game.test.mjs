import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialDeck, makeCard, startBattle, deploy, planRound, resolveRound, transfer, load } from '../src/game.ts'

const unit = (index, id, patch = {}) => { const card = makeCard(index, id); return { ...card, hp: card.health, ...patch } }
const quietBattle = () => ({ ...startBattle(initialDeck()), intents: [] })

test('deployment charges energy, removes the hand card, and rejects occupied or unaffordable slots', () => {
  const start = startBattle(initialDeck())
  const next = deploy(start, 'starter-0', 0, 0)
  assert.equal(next.energy, 1); assert.equal(next.hand.length, 4); assert.equal(next.player[0][0].hp, 2)
  assert.equal(start.player[0][0], null)
  assert.equal(deploy(next, 'starter-1', 0, 0), next)
  assert.equal(deploy(next, 'starter-2', 0, 1), next)
})
test('front blocks life damage and spills excess damage into rear', () => {
  const s = quietBattle(); s.player[0][0] = unit(0, 'p'); s.enemy[0][0] = unit(4, 'e', { native: [] }); s.enemy[1][0] = unit(1, 'rear')
  const next = resolveRound(s)
  assert.equal(next.enemy[0][0].id, 'rear'); assert.equal(next.enemy[0][0].hp, 3); assert.equal(next.enemy[1][0], null); assert.equal(next.enemyHp, 24)
  assert.equal(next.player[0][0].hp, 2, 'rear must not advance and counterattack during the current combat')
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
  const s = deploy(quietBattle(), 'starter-0', 1, 4)
  assert.equal(s.player[0][4], null)
  const next = resolveRound(s)
  assert.equal(next.enemyHp, 24)
  assert.equal(next.player[0][4].id, 'starter-0')
  assert.equal(next.player[1][4], null)
})

test('fatigue defeat does not start a new deployment phase or advance rear units', () => {
  const s = quietBattle(); s.deck = []; s.playerHp = 1; s.player[1][0] = unit(0, 'rear')
  const next = resolveRound(s)
  assert.equal(next.status, 'lost')
  assert.equal(next.player[0][0], null)
  assert.equal(next.player[1][0].id, 'rear')
})
test('split attacks neighboring lanes, and edge split only attacks one lane', () => {
  const s = quietBattle(); s.player[0][2] = unit(7, 'heron')
  assert.equal(resolveRound(s).enemyHp, 20)
  s.player[0][2] = null; s.player[0][0] = unit(7, 'edge')
  assert.equal(resolveRound(s).enemyHp, 22)
})
test('rebirth returns a dead card, and redeployment restores health while spending energy', () => {
  const s = quietBattle(); s.player[0][0] = unit(4, 'moth'); s.enemy[0][0] = unit(0, 'wolf')
  const next = resolveRound(s); assert.equal(next.player[0][0], null); assert.ok(next.hand.some(c => c.id === 'moth'))
  assert.equal('hp' in next.hand.find(c => c.id === 'moth'), false)
  const redeployed = deploy(next, 'moth', 0, 1)
  assert.equal(redeployed.player[0][1].hp, 1); assert.equal(redeployed.energy, next.energy - 1)
})
test('lethal player attack stops enemy counterattack; depleted life is clamped to zero', () => {
  const s = quietBattle(); s.enemyHp = 1; s.playerHp = 1; s.player[0][0] = unit(0, 'p'); s.enemy[0][1] = unit(0, 'e')
  const next = resolveRound(s); assert.equal(next.status, 'won'); assert.equal(next.enemyHp, 0); assert.equal(next.playerHp, 1)
  const loss = quietBattle(); loss.playerHp = 1; loss.enemy[0][0] = unit(0, 'e')
  assert.equal(resolveRound(loss).status, 'lost')
})
test('deck exhaustion causes increasing fatigue and can end the battle', () => {
  const s = quietBattle(); s.deck = []; s.playerHp = 3
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
  assert.equal(result.attack, 3); assert.equal(result.capacity, 3); assert.equal(cards.length, 9)
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
    ['attack', 'enemy-0-0'], ['attack', 'enemy-0-4'], ['deploy', 'enemy-0-0'], ['deploy', 'enemy-0-4'], ['attack', 'player-0-0'], ['attack', 'player-0-4'],
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
    assert.equal(plan.state[other][0][2].hp, 5)
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
  s.enemy[1][0] = unit(3, 'rear', { added: ['thorns'] })
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
  assert.equal(next.enemy[0][0].hp, 4)
})

test('split life attacks aim at their respective neighboring columns', () => {
  const s = quietBattle(); s.player[0][2] = unit(7, 'split')
  assert.deepEqual(planRound(s).frames.filter(f => f.action.kind === 'attack').map(f => f.action.target), ['enemy-0-1', 'enemy-0-3'])
})
