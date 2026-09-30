import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BattleEngine } from '../src/domain/battleEngine.ts'
import { allCreatures, allTokens, creature, SIGILS, initialDeck, startBattle, planDeploy, planRound, getRewards, sigils } from '../src/domain/game.ts'

const setup = () => {
  const s = startBattle(initialDeck(), 1, 123)
  s.intents = []; s.hand = []; s.canDraw = false
  const frames = []
  const e = new BattleEngine(s, (action, state) => frames.push({ action, state }))
  return { s, e, frames }
}
const unit = (species, id, patch = {}) => {
  const c = creature(species, id)
  return { ...c, hp: c.health, age: 0, used: [], base: structuredClone(c), ...patch }
}

test('card pool has 55 distinct cards, requested tribes and cost curve, all effects are defined', () => {
  const cards = allCreatures()
  assert.equal(cards.length, 55)
  assert.equal(new Set(cards.map(c => c.species)).size, 55)
  assert.deepEqual([0,1,2,3].map(n => cards.filter(c => c.cost === n).length), [14,25,12,4])
  assert.deepEqual(['beast','bird','insect','reptile','spider','special'].map(t => cards.filter(c => c.tribe === t).length), [14,12,12,11,4,2])
  for (const card of cards) {
    assert.ok(card.health > 0); assert.ok(card.art)
    for (const sigil of sigils(card)) assert.ok(SIGILS[sigil])
  }
  assert.equal(allTokens().length, 6)
  for (const c of allTokens()) assert.equal(c.token, true)
  for (let seed = 0; seed < 200; seed++) for (const c of getRewards(seed, 1)) assert.ok(!c.token && c.species !== 'squirrel')
})

test('flying bypasses ground units from either row and still aims at the chosen lane', () => {
  for (const row of [0,1]) {
    const {s,e,frames} = setup()
    s.player[row][2] = unit('crow', 'flyer')
    s.enemy[0][2] = unit('bear', 'wall'); s.enemy[1][2] = unit('beetle', 'rear')
    e.turn('player')
    assert.equal(s.balance, 1); assert.equal(s.enemy[0][2].hp, 6); assert.equal(s.enemy[1][2].hp, 2)
    assert.equal(frames[0].action.route, 'air'); assert.equal(frames[0].action.target, 'enemy-0-2')
  }
})

test('flying intercepts nearest flying unit and spills only into another flyer', () => {
  const {s,e} = setup()
  s.player[0][0] = unit('crow','a',{attack:5})
  s.enemy[0][0] = unit('crow','front'); s.enemy[1][0] = unit('crow','rear',{hp:6,health:6})
  e.turn('player'); assert.equal(s.balance, 0); assert.equal(s.enemy[0][0],null); assert.equal(s.enemy[1][0].hp,2)
  const next = setup(); next.s.player[0][0] = unit('crow','a',{attack:5}); next.s.enemy[0][0] = unit('crow','front'); next.s.enemy[1][0] = unit('bear','ground')
  next.e.turn('player'); assert.equal(next.s.enemy[1][0].hp,6); assert.equal(next.s.balance, 0)
})

test('rear flyer intercepts even when ground front is occupied; ground attacks hit front flyers', () => {
  const {s,e} = setup(); s.player[0][0] = unit('crow','a'); s.enemy[0][0] = unit('bear','wall'); s.enemy[1][0] = unit('crow','b')
  e.turn('player'); assert.equal(s.balance, 0); assert.equal(s.enemy[0][0].hp,6); assert.equal(s.enemy[1][0],null)
  s.player[0][0] = unit('wolf','wolf'); s.enemy[0][0] = unit('crow','front')
  e.turn('player'); assert.equal(s.enemy[0][0],null)
})

test('web suppresses flying dynamically and restores it when web bearer leaves', () => {
  const {s,e,frames} = setup(); s.player[1][1] = unit('crow','flyer'); s.enemy[0][1] = unit('spiderling','web')
  assert.equal(e.flying('player',1,1),false)
  e.turn('player'); assert.equal(frames.length,0)
  e.remove('enemy',0,1,'killed')
  assert.equal(e.flying('player',1,1),true)
  e.turn('player'); assert.equal(s.balance, 1); assert.ok(sigils(s.player[1][1]).includes('flying'))
})

test('flying split evaluates each sky lane independently', () => {
  const {s,e,frames} = setup(); s.player[0][2] = unit('eagle','eagle'); s.enemy[0][1] = unit('bear','ground'); s.enemy[1][3] = unit('crow','air')
  e.turn('player'); assert.equal(s.balance, 4); assert.equal(s.enemy[0][1].hp,6); assert.equal(s.enemy[1][3],null)
  assert.deepEqual(frames.filter(f=>f.action.kind==='attack').map(f=>f.action.target),['enemy-0-1','enemy-1-3'])
})

test('dive targets non-flying rear first and falls back to sky or ground route', () => {
  const {s,e} = setup(); s.player[0][0] = unit('falcon','f'); s.enemy[0][0] = unit('bear','b'); s.enemy[1][0] = unit('fox','rear')
  e.turn('player'); assert.equal(s.enemy[1][0],null); assert.equal(s.enemy[0][0].hp,6); assert.equal(s.balance, 0)
  e.turn('player'); assert.equal(s.balance, 3)
})

test('double strike retargets after a kill; split plus double performs four attacks', () => {
  const {s,e} = setup(); s.player[0][0] = unit('mantis','m'); s.enemy[0][0] = unit('fox','f')
  e.turn('player'); assert.equal(s.balance, 2)
  const b=setup(); b.s.player[0][2] = unit('mantis','m',{added:['split']}); b.e.turn('player')
  assert.equal(b.s.balance, 8); assert.equal(b.frames.filter(f=>f.action.kind==='attack').length,4)
})

test('poison requires positive damage and poison kills do not manufacture spill damage', () => {
  const {s,e} = setup(); s.player[0][0] = unit('snake','s'); s.enemy[0][0] = unit('beetle','b')
  e.turn('player'); assert.equal(s.enemy[0][0].hp,2)
  s.player[1][0] = unit('firefly','support'); s.enemy[1][0] = unit('bear','rear')
  e.turn('player'); assert.equal(s.enemy[0][0],null); assert.equal(s.enemy[1][0].hp,6); assert.equal(s.balance, 0)
})

test('poison and split can kill both columns without changing player life', () => {
  const {s,e} = setup(); s.player[0][2] = unit('snake','s',{added:['split']})
  s.enemy[0][1]=unit('bear','a'); s.enemy[0][3]=unit('bear','b')
  // Survive both thorns retaliations to finish the second strike.
  s.player[0][2].hp=3
  e.turn('player'); assert.equal(s.enemy[0][1],null); assert.equal(s.enemy[0][3],null); assert.equal(s.balance, 0)
})

test('hunt, pack and birdcatcher bonuses use actual target and current living board', () => {
  const {s,e} = setup(); s.player[0][0]=unit('coyote','c'); s.enemy[0][0]=unit('bear','b',{hp:5})
  e.turn('player'); assert.equal(s.enemy[0][0].hp,2)
  const b=setup(); b.s.player[0][2]=unit('mouse','m'); b.s.player[1][1]=unit('greywolf','p'); b.e.turn('player'); assert.equal(b.s.balance, 2)
  const c=setup(); c.s.player[0][0]=unit('wolfspider','w'); c.s.player[1][0]=unit('spiderling','net'); c.s.enemy[0][0]=unit('eagle','bird'); c.e.turn('player'); assert.equal(c.s.enemy[0][0],null)
})

test('scavenging observes kills on both sides, ignores sacrifice and natural death', () => {
  const {s,e} = setup(); s.player[1][2]=unit('hyena','h'); s.enemy[1][3]=unit('vulture','v'); s.player[0][0]=unit('mouse','m')
  e.remove('player',0,0,'sacrificed'); assert.equal(s.player[1][2].attack,2); assert.equal(s.enemy[1][3].attack,0)
  s.player[0][0]=unit('mayfly','m'); e.remove('player',0,0,'expired'); assert.equal(s.player[1][2].attack,2)
  s.player[0][0]=unit('mouse','m'); e.remove('player',0,0,'killed'); assert.equal(s.player[1][2].attack,3); assert.equal(s.enemy[1][3].attack,1)
})

test('devour restores health after kills but cannot resurrect a retaliated attacker', () => {
  const {s,e}=setup(); s.player[0][0]=unit('python','p',{hp:1}); s.enemy[0][0]=unit('mouse','m'); e.turn('player'); assert.equal(s.player[0][0].hp,2)
  const b=setup(); b.s.player[0][0]=unit('python','p',{hp:1}); b.s.enemy[0][0]=unit('hedgehog','h'); b.e.turn('player'); assert.equal(b.s.player[0][0],null)
})

test('tail rescues lethal poison once and does not prevent sacrifice', () => {
  const {s,e}=setup(); s.player[0][0]=unit('snake','s'); s.enemy[0][0]=unit('lizard','l')
  e.turn('player'); assert.equal(s.enemy[0][0].hp,1); assert.ok(!sigils(s.enemy[0][0]).includes('tail')); assert.equal(s.intents[0].card.species,'tailToken')
  e.turn('player'); assert.equal(s.enemy[0][0],null)
  const b=setup(); b.s.player[0][0]=unit('lizard','l'); b.e.remove('player',0,0,'sacrificed'); assert.equal(b.s.hand.length,0)
})

test('stealth doubles only first volley, including both split columns', () => {
  const {s,e}=setup(); s.player[0][2]=unit('chameleon','c',{attack:1,added:['split','double']})
  e.turn('player'); assert.equal(s.balance, 6)
  e.turn('player'); assert.equal(s.balance, 10)
})

test('migrating units act only once and follow right then left empty-slot rule', () => {
  const {s,e,frames}=setup(); s.player[0][2]=unit('albatross','a')
  e.turn('player'); assert.equal(s.player[0][3].id,'a'); assert.equal(s.balance, 1)
  assert.equal(frames.filter(f=>f.action.kind==='attack').length,1)
  s.player[0][4]=unit('turtle','block'); e.turn('player'); assert.equal(s.player[0][2].id,'a')
})

test('shortlived plus rebirth returns a free flyer without counting a kill', () => {
  const {s,e,frames}=setup(); const c=creature('mayfly','m'); c.added=['rebirth']; e.place(c,'player',0,0)
  s.player[1][1]=unit('hyena','h'); e.turn('player')
  assert.equal(s.balance, 1); assert.equal(s.player[0][0],null); assert.equal(s.hand[0].id,'m'); assert.equal(s.hand[0].cost,0)
  assert.equal(s.player[1][1].attack,2); assert.equal(frames.at(-1).action.cause,'expired')
})

test('porter and nest entry effects are represented after deployment in animation frames', () => {
  const {s}=setup(); const c=creature('worker','w'); s.hand=[c]; s.summon={cardId:'w',sacrifices:[],paid:true}
  const plan=planDeploy(s,'w',0,0); assert.equal(plan.state.hand[0].species,'ant'); assert.equal(plan.frames[0].action.kind,'deploy'); assert.equal(plan.frames[1].action.kind,'effect')
  const b=setup(); b.e.place(creature('hen','h'),'player',0,2); assert.equal(b.s.player[1][2].species,'egg')
  b.e.startRound(); assert.equal(b.s.player[1][2].species,'chick'); assert.equal(b.s.player[1][2].attack,0)
  b.e.startRound(); assert.equal(b.s.player[1][2].attack,1); assert.ok(sigils(b.s.player[1][2]).includes('flying'))
})

test('enemy nests respect deployment limit and blocked nests do not overwrite units', () => {
  const {s,e,frames}=setup(); e.place(creature('hen','h'),'enemy',0,1)
  assert.equal(frames.filter(f=>f.action.kind==='deploy').length,1); assert.equal(s.enemy[1][1],null); assert.equal(s.intents[0].card.species,'egg')
  const b=setup(); b.s.player[1][1]=unit('mouse','keep'); b.e.place(creature('hen','h'),'player',0,1); assert.equal(b.s.player[1][1].id,'keep')
})

test('entry retaliation follows entry effects, kills instantly, and rebirth returns the deployed card', () => {
  const {s}=setup(); const c=creature('worker','w'); c.added=['rebirth']; s.hand=[c]; s.summon={cardId:'w',paid:true,sacrifices:[]}; s.enemy[0][0]=unit('crocodile','c')
  const plan=planDeploy(s,'w',0,0)
  assert.equal(plan.state.player[0][0],null)
  assert.deepEqual(plan.state.hand.map(c=>c.species),['ant','worker'])
  assert.deepEqual(plan.frames.filter(f=>['deploy','attack','death'].includes(f.action.kind)).map(f=>f.action.kind),['deploy','attack','death'])
})

test('ambush kills enemy arrival before its normal turn; rear ambush does not trigger', () => {
  const {s}=setup(); s.player[0][1]=unit('crocodile','c'); s.intents=[{card:creature('mouse','m'),row:0,col:1}]
  const plan=planRound(s); assert.equal(plan.state.enemy[0][1],null); assert.ok(!plan.frames.some(f=>f.action.kind==='attack' && f.action.source.startsWith('enemy')))
  const b=setup(); b.s.player[1][1]=unit('crocodile','c'); b.e.place(creature('mouse','m'),'enemy',0,1); assert.ok(b.s.enemy[0][1])
})

test('breed and growth trigger once; metamorph waits two starts and preserves added sigils', () => {
  const {s,e}=setup(); e.place(creature('rabbit','r'),'player',0,0); e.place(creature('caterpillar','c'),'player',0,2); s.player[0][2].added=['armor']
  e.startRound(); assert.equal(s.hand.filter(c=>c.species==='youngRabbit').length,1); assert.equal(s.player[0][2].species,'caterpillar')
  s.player[0][2].hp=1; e.startRound(); assert.equal(s.player[0][2].species,'butterfly'); assert.equal(s.player[0][2].hp,3); assert.ok(sigils(s.player[0][2]).includes('armor'))
  e.startRound(); assert.equal(s.hand.filter(c=>c.species==='youngRabbit').length,1)
})

test('growth applies to transferred hosts and does not repeat every round', () => {
  const {s,e}=setup(); s.player[0][0]=unit('wolf','w',{added:['growth']})
  e.startRound(); assert.equal(s.player[0][0].attack,4); assert.ok(sigils(s.player[0][0]).includes('flying'))
  e.startRound(); assert.equal(s.player[0][0].attack,4)
})

test('swarm triggers on blocked attacks, never on sacrifice or lethal hits', () => {
  const {s,e}=setup(); s.player[0][0]=unit('mouse','m'); s.enemy[0][0]=unit('queen','q',{added:['armor']})
  e.turn('player'); assert.equal(s.enemy[0][0].hp,6); assert.equal(s.intents[0].card.species,'bee')
  const b=setup(); b.s.player[0][0]=unit('queen','q'); b.e.remove('player',0,0,'sacrificed'); assert.equal(b.s.hand.length,0)
  const c=setup(); c.s.player[0][0]=unit('bear','b',{attack:9}); c.s.enemy[0][0]=unit('queen','q'); c.e.turn('player'); assert.equal(c.s.intents.length,0)
})

test('brood triggers on sacrifice, tokens have unique IDs, and rebirth restores base stats', () => {
  const {s,e}=setup(); const c=creature('cicada','c'); c.added=['rebirth']; e.place(c,'player',0,0); s.player[0][0].attack=12
  e.remove('player',0,0,'sacrificed'); assert.equal(s.hand[0].attack,0); assert.equal(s.hand[1].species,'larva')
  e.place(c,'player',0,0); e.remove('player',0,0,'sacrificed'); const tokens=s.hand.filter(c=>c.species==='larva'); assert.notEqual(tokens[0].id,tokens[1].id)
})

test('zero-health entry dies naturally after entry effects and does not feed scavenging', () => {
  const {s,e}=setup(); s.player[1][1]=unit('hyena','h'); e.place({...creature('worker','w'),health:0},'player',0,0)
  assert.equal(s.player[0][0],null); assert.equal(s.hand[0].species,'ant'); assert.equal(s.player[1][1].attack,2)
})

test('new-effect round plans are deterministic and leave source state untouched', () => {
  const {s}=setup(); s.player[0][0]=unit('mayfly','m',{added:['rebirth']}); s.player[1][1]=unit('caterpillar','c'); s.enemy[0][2]=unit('queen','q')
  const before=structuredClone(s); assert.deepEqual(planRound(s),planRound(s)); assert.deepEqual(s,before)
})

test('varied full-board rounds terminate, preserve source, and keep IDs unique after triggers', () => {
  const pool=allCreatures()
  for(let seed=0;seed<54;seed++) {
    const {s}=setup(); s.balance=0
    for(const [offset,side] of [[0,'player'],[17,'enemy']]) for(let r=0;r<2;r++) for(let c=0;c<5;c++) {
      const card=pool[(seed+offset+r*5+c)%pool.length]
      s[side][r][c]=unit(card.species,`${side}-${r}-${c}`)
    }
    const before=structuredClone(s), plan=planRound(s)
    assert.deepEqual(s,before)
    assert.ok(plan.frames.length<500)
    for(const side of ['player','enemy']) for(const u of plan.state[side].flat().filter(Boolean)) assert.ok(u.hp>0)
    const ids=[...plan.state.player.flat(),...plan.state.enemy.flat(),...plan.state.hand,...plan.state.intents.map(i=>i.card)].filter(Boolean).map(c=>c.id)
    assert.equal(new Set(ids).size,ids.length)
  }
})
