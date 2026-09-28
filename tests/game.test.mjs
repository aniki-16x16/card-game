import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialDeck, makeCard, startBattle, deploy, resolveRound, transfer, load } from '../src/game.ts'

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
test('front blocks rear; defeating front does not spill damage into rear', () => {
  const s = quietBattle(); s.player[0][0] = unit(0, 'p'); s.enemy[0][0] = unit(4, 'e', { native: [] }); s.enemy[1][0] = unit(1, 'rear')
  const next = resolveRound(s)
  assert.equal(next.enemy[0][0], null); assert.equal(next.enemy[1][0].hp, 5); assert.equal(next.enemyHp, 24)
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
test('advance enters vacant front and attacks once', () => {
  const s = quietBattle(); s.player[1][0] = unit(5, 'fox')
  const next = resolveRound(s); assert.equal(next.player[0][0].id, 'fox'); assert.equal(next.player[1][0], null); assert.equal(next.enemyHp, 22)
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
