import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateMap, newAdventure, availableNodes, enterNode, finishNode, currentNode, categoryOptions, chooseCategory, visitRewards, takeReward, removeCard, upgradeCard, upgradeRisk, transferAtNode, recordBattle, isCombat } from '../src/domain/adventure.ts'
import { creature, initialDeck, startBattle, getIntents, resolveRound } from '../src/domain/game.ts'
import { BattleEngine } from '../src/domain/battleEngine.ts'

function event(kind, seed=1, deck=initialDeck()) {
  const run={...newAdventure(seed),deck,nodes:[{id:'test',floor:1,x:.5,kind,next:[]}]}
  return enterNode(run,'test')
}
test('seeded maps are connected DAGs, converge, have at most five nodes per layer and exclusive elite rewards',()=>{
  for(let seed=0;seed<120;seed++) {
    const nodes=generateMap(seed)
    assert.deepEqual(nodes,generateMap(seed))
    assert.equal(nodes.filter(n=>n.kind==='boss').length,1)
    assert.equal(nodes.some(n=>n.kind==='item'),false)
    const seen=new Set(), walk=id=>{if(seen.has(id))return;seen.add(id);const n=nodes.find(n=>n.id===id);assert.ok(n);if(!n.next.length)assert.equal(n.kind,'boss');assert.ok(n.next.length<=3);for(const next of n.next){assert.ok(nodes.find(x=>x.id===next).floor>n.floor);walk(next)}}
    walk(nodes[0].id);assert.equal(seen.size,nodes.length)
    for(const floor of new Set(nodes.map(n=>n.floor)))assert.ok(nodes.filter(n=>n.floor===floor).length<=5)
    for(const n of nodes.filter(n=>n.bonus)){const parents=nodes.filter(p=>p.next.includes(n.id));assert.equal(parents.length,1);assert.equal(parents[0].kind,'elite');assert.ok(['upgrade','transfer'].includes(n.kind))}
  }
  assert.notDeepEqual(generateMap(1),generateMap(2))
})
test('route entry is locked while visiting and cannot revisit or teleport',()=>{
  const r=newAdventure(99), a=availableNodes(r)[0], entered=enterNode(r,a)
  assert.equal(enterNode(r,'n18-0'),r);assert.deepEqual(availableNodes(entered),[])
  assert.equal(enterNode(entered,a),entered)
  const next=finishNode(entered);assert.equal(enterNode(next,a),next);assert.equal(next.path.length,1)
})
test('two-stage categories lock and yield three distinct matching cards with stable IDs',()=>{
  for(let seed=0;seed<40;seed++)for(const kind of ['cost','tribe']) {
    const r=event(kind,seed), options=categoryOptions(r)
    assert.equal(options.length,3);assert.equal(new Set(options).size,3)
    for(const option of options){const chosen=chooseCategory(r,option);assert.equal(chooseCategory(chosen,options[1]),chosen);const cards=visitRewards(chosen);assert.equal(cards.length,3);assert.equal(new Set(cards.map(c=>c.species)).size,3);assert.ok(cards.every(c=>(kind==='cost'?c.cost:c.tribe)===option));assert.deepEqual(cards,visitRewards(chosen));const got=takeReward(chosen,cards[0].id);assert.equal(got.deck.length,r.deck.length+1);assert.equal(got.visit,null);assert.equal(takeReward(got,cards[0].id),got)}
  }
})
test('one deletion or transfer per node and minimum deck size',()=>{
  const r=event('remove'), n=removeCard(r,r.deck[0].id)
  assert.equal(n.deck.length,r.deck.length-1);assert.equal(removeCard(n,n.deck[0].id),n)
  const small=event('remove',1,initialDeck().slice(0,6));assert.equal(removeCard(small,small.deck[0].id),small)
  const forge=event('transfer'), result=transferAtNode(forge,'starter-1','starter-0','armor',[])
  assert.equal(result.error,undefined);assert.equal(result.run.deck.length,13);assert.ok(result.run.deck.find(c=>c.id==='starter-0').added.includes('armor'));assert.equal(transferAtNode(result.run,'starter-2','starter-0','ranged',[]).run,result.run)
})
test('upgrade first is safe, risks are 1/6 and 1/3, stat and target are fixed per visit',()=>{
  const r=event('upgrade'), before=structuredClone(r), id=r.deck[0].id
  assert.equal(upgradeRisk(r),0)
  let n=upgradeCard(r,id);assert.deepEqual(r,before);assert.equal(n.visit.attempts,1);assert.equal(upgradeRisk(n),1/6)
  assert.equal(upgradeCard(n,r.deck[1].id),n)
  const stat=r.visit.stat;assert.equal(n.deck[0][stat],r.deck[0][stat]+(stat==='attack'?1:2))
  n={...n,safeUpgrades:true};n=upgradeCard(n,id);n=upgradeCard(n,id);assert.equal(n.visit.attempts,3);assert.equal(n.visit.done,true);assert.equal(upgradeCard(n,id),n)
  const fresh={...event('upgrade',2,n.deck),safeUpgrades:true};assert.equal(upgradeCard(fresh,id).visit.attempts,1)
})
test('only viper species consumed by an upgrade permanently removes risk, not poison or instance ID',()=>{
  let riskySeed
  for(let seed=0;seed<1000;seed++){let r=event('upgrade',seed,[creature('viper','unique-copy')]);r=upgradeCard(r,'unique-copy');const next=upgradeCard(r,'unique-copy');if(next.deck.length===0){riskySeed=seed;break}}
  assert.notEqual(riskySeed,undefined)
  let v=event('upgrade',riskySeed,[creature('viper','unique-copy')]);assert.deepEqual(v.deck[0].native,[]);v=upgradeCard(v,'unique-copy');v=upgradeCard(v,'unique-copy');assert.equal(v.safeUpgrades,true);assert.equal(v.deck.length,0);assert.equal(v.visit.done,true)
  let impostor=event('upgrade',riskySeed,[{...creature('snake','viper'),added:['rebirth','brood','undying']}]);impostor=upgradeCard(impostor,'viper');impostor=upgradeCard(impostor,'viper');assert.equal(impostor.safeUpgrades,false);assert.equal(impostor.deck.length,0)
  const later={...event('upgrade',riskySeed),safeUpgrades:v.safeUpgrades};let safe=upgradeCard(later,later.deck[0].id);safe=upgradeCard(safe,later.deck[0].id);safe=upgradeCard(safe,later.deck[0].id);assert.equal(safe.deck.length,later.deck.length)
  assert.equal(newAdventure(riskySeed).safeUpgrades,false)
})
test('third upgrade risk is exactly one third and attempts stop after consumption',()=>{
  const r=event('upgrade');const third={...r,visit:{...r.visit,attempts:2,targetId:r.deck[0].id}}
  assert.equal(upgradeRisk(third),1/3)
  const done=upgradeCard(third,r.deck[0].id);assert.equal(done.visit.done,true);assert.equal(upgradeCard(done,r.deck[0].id),done)
})
test('full route runs through rewards and events to boss completion; loss prevents further progress',()=>{
  let r=newAdventure(123)
  while(r.status==='playing'){
    r=enterNode(r,availableNodes(r)[0]);const node=currentNode(r)
    if(isCombat(node.kind)){assert.equal(finishNode(r),r);r=recordBattle(r,'won');r=node.kind==='boss'?finishNode(r):takeReward(r,null)}
    else r=finishNode(r)
  }
  assert.equal(r.status,'won');assert.equal(r.path.length,18);assert.deepEqual(availableNodes(r),[])
  const loss=recordBattle(event('battle'),'lost');assert.equal(loss.status,'lost');assert.deepEqual(availableNodes(loss),[]);assert.equal(finishNode(loss),loss)
})
test('scale starts neutral, cancels damage and ends immediately at positive or negative ten',()=>{
  const s=startBattle(initialDeck(),1,1);s.intents=[];const e=new BattleEngine(s)
  s.player[0][0]={...creature('wolf','p'),attack:7,hp:3};s.enemy[0][1]={...creature('wolf','e'),attack:4,hp:3}
  e.turn('player');assert.equal(s.balance,7);assert.equal(s.status,'playing');e.turn('enemy');assert.equal(s.balance,3)
  e.turn('player');assert.equal(s.balance,10);assert.equal(s.status,'won');e.turn('enemy');assert.equal(s.balance,10)
  const loss=startBattle(initialDeck(),1,2);loss.balance=-9;loss.enemy[0][0]={...creature('mouse','m'),hp:1};new BattleEngine(loss).turn('enemy');assert.equal(loss.balance,-10);assert.equal(loss.status,'lost')
  assert.equal(startBattle(initialDeck(),18,1,'boss').balance,0)
})
test('boss and elite use one arrival and distinct configurations; fatigue moves scale',()=>{
  for(const kind of ['normal','elite','boss'])for(let round=1;round<12;round++)assert.equal(getIntents(round,6,1,kind).length,1)
  assert.ok(getIntents(1,18,1,'boss')[0].card.native.includes('armor'));assert.ok(getIntents(2,18,1,'boss')[0].card.native.includes('flying'))
  const s=startBattle(initialDeck(),1,1);s.intents=[];s.deck=[];s.squirrelDeck=[];s.balance=-9;const n=resolveRound(s);assert.equal(n.balance,-10);assert.equal(n.status,'lost')
})
