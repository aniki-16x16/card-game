import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENEMIES,
  enemyProfile,
  createEnemy,
  planEnemyTurn,
  scoreEnemyPlacement,
  chooseEnemySearch,
  enemyCostCeiling,
} from "../src/domain/enemyAI.ts";
import {
  initialDeck,
  creature,
  startBattle,
  prepareBattle,
  planRound,
  planEnemyDeploy,
  emptyBoard,
  planDeploy,
  planSearch,
  awaitingSearch,
  selectSummon,
} from "../src/domain/game.ts";
import { BattleEngine } from "../src/domain/battleEngine.ts";
import {
  newAdventure,
  availableNodes,
  enterNode,
  currentNode,
  isCombat,
  recordBattle,
  finishNode,
  battleProfile,
} from "../src/domain/adventure.ts";

const unit = (species, id, patch = {}) => {
  const card = creature(species, id);
  return { ...card, hp: card.health, age: 0, used: [], base: structuredClone(card), ...patch };
};
function scenario(profile, species) {
  const s = startBattle(initialDeck(), 1, 123, "normal", profile);
  s.enemyAI.hand = species.map((species, i) => creature(species, "candidate-" + i));
  s.enemyAI.plannedRound = 0;
  s.enemyAI.deployedRound = 0;
  s.enemyAI.energy = 1;
  s.enemyAI.energyRound = 1;
  s.enemy = emptyBoard();
  s.enemyDeck = [];
  s.intents = [];
  s.canDraw = false;
  return s;
}
const intent = (s) => {
  planEnemyTurn(s);
  assert.equal(s.intents.length, 1);
  return s.intents[0];
};

test("eight enemy rosters contain 18 physical, unmodified cards with unique identities and distinct compositions", () => {
  assert.equal(Object.keys(ENEMIES).length, 8);
  const compositions = new Set();
  for (const profile of Object.keys(ENEMIES)) {
    assert.equal(ENEMIES[profile].deck.length, 18);
    assert.ok(new Set(ENEMIES[profile].deck).size >= 5);
    compositions.add([...ENEMIES[profile].deck].sort().join(","));
    for (const seed of [0, 1, 123, 789]) {
      const a = createEnemy(seed, 2, profile),
        b = createEnemy(seed, 2, profile);
      assert.deepEqual(a, b);
      const cards = [...a.ai.hand, ...a.deck];
      assert.equal(new Set(cards.map((card) => card.id)).size, 18);
      assert.deepEqual(cards.map((card) => card.species).sort(), [...ENEMIES[profile].deck].sort());
      for (const card of cards) {
        assert.deepEqual(card, creature(card.species, card.id));
        assert.ok(!card.token && card.species !== "squirrel" && card.species !== "viper");
      }
      assert.equal(a.ai.hand.length, 5);
      assert.ok(a.ai.hand.some((card) => card.cost <= 1));
    }
  }
  assert.equal(compositions.size, 8);
});
test("seeded profiles cover all eight before repeating and planning is deterministic without mutating card templates", () => {
  for (const seed of [0, 123, 456]) {
    const cycle = Array.from({ length: 8 }, (_, i) => enemyProfile(seed, i + 1));
    assert.equal(new Set(cycle).size, 8);
    assert.equal(enemyProfile(seed, 9), cycle[0]);
  }
  const a = startBattle(initialDeck(), 2, 123),
    b = startBattle(initialDeck(), 2, 123);
  assert.deepEqual(a, b);
  const initial = structuredClone(a);
  assert.deepEqual(planRound(a), planRound(a));
  assert.deepEqual(a, initial);
});
test("adventure rotates profiles by actual battle count, independent of events and map floor numbers", () => {
  for (const seed of [0, 123, 456]) {
    let run = newAdventure(seed);
    const seen = [];
    while (run.status === "playing") {
      run = enterNode(run, availableNodes(run)[0]);
      const node = currentNode(run);
      if (isCombat(node.kind)) {
        seen.push(battleProfile(run));
        run = recordBattle(run, "won");
      }
      run = finishNode(run);
    }
    assert.equal(seen.length, 8);
    assert.equal(new Set(seen).size, 8);
    assert.deepEqual(
      seen,
      Array.from({ length: 8 }, (_, i) => enemyProfile(seed, i + 1)),
    );
  }
});
test("normal, elite and boss share decks, costs, choices and actual combat without extra stats or sigils", () => {
  for (const profile of Object.keys(ENEMIES)) {
    let normal = startBattle(initialDeck(), 1, 123, "normal", profile);
    const elite = startBattle(initialDeck(), 1, 123, "elite", profile),
      boss = startBattle(initialDeck(), 1, 123, "boss", profile);
    assert.deepEqual({ ...elite, difficulty: "normal" }, normal);
    assert.deepEqual({ ...boss, difficulty: "normal" }, normal);
    for (const round of [1, 4, 8]) {
      normal = { ...normal, round, canDraw: false, balance: 0, status: "playing" };
      const baseline = planRound(normal);
      for (const difficulty of ["elite", "boss"]) {
        const other = planRound({ ...normal, difficulty });
        assert.deepEqual({ ...other.state, difficulty: "normal" }, baseline.state);
        assert.deepEqual(
          other.frames.map((f) => f.action),
          baseline.frames.map((f) => f.action),
        );
      }
    }
  }
  assert.deepEqual([1, 3, 4, 7, 8, 20].map(enemyCostCeiling), [1, 1, 2, 2, 3, 3]);
});
test("bulwark blocks an exposed high-damage lane while racing favors an open lane with the same card", () => {
  const shield = scenario("bulwark", ["beetle"]);
  shield.player[0][2] = unit("wolf", "threat");
  const race = structuredClone(shield);
  race.enemyAI.profile = "reef";
  assert.deepEqual([intent(shield).row, shield.intents[0].col], [0, 2]);
  const attack = intent(race);
  assert.equal(attack.row, 0);
  assert.notEqual(attack.col, 2);
});
test("pack hunters focus a wounded target and sky units distinguish flying targets and webs", () => {
  const pack = scenario("pack", ["coyote"]);
  pack.player[0][2] = unit("bear", "wounded", { hp: 1 });
  assert.deepEqual([intent(pack).row, pack.intents[0].col], [0, 2]);
  const sky = scenario("sky", ["crow"]);
  sky.player[0][3] = unit("crow", "air");
  assert.deepEqual([intent(sky).row, sky.intents[0].col], [0, 3]);
  const webbed = scenario("sky", ["crow"]);
  for (const col of [0, 1, 3, 4]) webbed.player[0][col] = unit("orbweaver", "web-" + col);
  webbed.player[0][2] = unit("bear", "ground");
  assert.deepEqual([intent(webbed).row, webbed.intents[0].col], [0, 2]);
});
test("colony keeps same-row allies together and selects a soldier once the colony is established", () => {
  const s = scenario("colony", ["soldierant", "worker"]);
  s.enemy[0][0] = unit("ant", "a");
  s.enemy[0][1] = unit("ant", "b");
  assert.equal(intent(s).card.species, "soldierant");
  assert.equal(s.intents[0].row, 0);
});
test("nursery positions catalyst between two growing units and protects juveniles behind its front", () => {
  const s = scenario("nursery", ["firefly", "bearcub"]);
  s.enemy[0][1] = unit("wolfpup", "pup");
  s.enemy[0][3] = unit("caterpillar", "larva", { age: 1 });
  assert.deepEqual([intent(s).card.species, s.intents[0].row, s.intents[0].col], ["firefly", 0, 2]);
  const child = scenario("nursery", ["piglet"]);
  child.enemy[0][2] = unit("beetle", "guard");
  assert.deepEqual([intent(child).row, child.intents[0].col], [1, 2]);
  const ranged = scenario("sky", ["owl"]);
  ranged.round = 4;
  ranged.enemy[0][1] = unit("beetle", "guard");
  assert.equal(intent(ranged).row, 1);
});
test("march leaves room for rush and places a migrating unit next to a follower", () => {
  const s = scenario("march", ["hare"]);
  s.enemy[0][1] = unit("pigeon", "follower");
  s.enemy[0][4] = unit("beetle", "wall");
  assert.deepEqual([intent(s).row, s.intents[0].col], [0, 2]);
});
test("renewal uses a live same-tribe draw and avoids spending a kin card once those targets are exhausted", () => {
  const live = scenario("renewal", ["dormouse", "mouse"]);
  live.enemyDeck = [creature("rat", "kin")];
  assert.equal(intent(live).card.species, "dormouse");
  const empty = scenario("renewal", ["dormouse", "mouse"]);
  assert.equal(intent(empty).card.species, "mouse");
});
test("placement estimates never mutate the board and choices cannot depend on hidden player cards", () => {
  const a = scenario("pack", ["fox", "hound"]);
  a.player[0][2] = unit("bear", "visible");
  const before = structuredClone(a);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 5; col++) scoreEnemyPlacement(a, a.enemyAI.hand[0], row, col);
  assert.deepEqual(a, before);
  const b = structuredClone(a);
  b.hand = [creature("crocodile", "hidden")];
  b.deck = [];
  b.squirrelDeck = [];
  assert.deepEqual(intent(a), intent(b));
});
test("announced card and lane stay locked after player deployment, without a second draw or entry", () => {
  const s = scenario("pack", ["fox", "hound"]);
  const announced = structuredClone(intent(s));
  const deck = structuredClone(s.enemyDeck),
    hand = structuredClone(s.enemyAI.hand);
  s.player[0][(announced.col + 1) % 5] = unit("bear", "new-threat", { attack: 0 });
  planEnemyTurn(s);
  assert.deepEqual(s.intents[0], announced);
  assert.deepEqual(s.enemyDeck, deck);
  assert.deepEqual(s.enemyAI.hand, hand);
  const plan = planEnemyDeploy(s);
  const entries = plan.frames.filter(
    (f) => f.action.kind === "deploy" && f.action.source === `intent-${announced.card.id}`,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action.target, `enemy-${announced.row}-${announced.col}`);
});
test("a full enemy board retains its announced card and resumes from a real hand when a slot opens", () => {
  const s = scenario("pack", ["fox"]);
  const blocked = creature("hound", "blocked");
  s.intents = [{ card: blocked, row: 0, col: 2, costGated: true }];
  s.enemyAI.plannedRound = 1;
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 5; col++)
      s.enemy[row][col] = unit("mouse", `${row}-${col}`, { attack: 0 });
  const plan = planRound(s);
  assert.ok(!plan.frames.some((f) => f.action.kind === "deploy"));
  assert.equal(plan.state.intents.length, 0);
  assert.equal(plan.state.enemyAI.hand.filter((c) => c.id === "blocked").length, 1);
  const next = plan.state;
  next.enemy[0][4] = null;
  next.round++;
  planEnemyTurn(next);
  assert.equal(next.intents.length, 1);
  assert.equal(next.intents[0].col, 4);
  assert.equal(next.intents[0].row, 0);
  assert.ok(
    [...next.enemyAI.hand, ...next.intents.map((i) => i.card)].some((c) => c.id === "blocked"),
  );
});
test("deployment rejects occupied squares even when the blocker will die during player attacks", () => {
  const s = scenario("bulwark", ["beetle"]);
  s.player[0][2] = unit("wolf", "threat");
  s.enemy[0][2] = unit("hedgehog", "doomed");
  assert.equal(scoreEnemyPlacement(s, s.enemyAI.hand[0], 0, 2), -Infinity);
  const chosen = intent(s);
  const next = planEnemyDeploy(s).state;
  assert.equal(next.enemy[0][2].id, "doomed");
  assert.equal(next.enemy[chosen.row][chosen.col].id, chosen.card.id);
  const rescued = scenario("bulwark", ["beetle"]);
  rescued.player[0][2] = unit("wolf", "threat");
  rescued.enemy[0][2] = unit("lizard", "tail", { hp: 1 });
  assert.equal(scoreEnemyPlacement(rescued, rescued.enemyAI.hand[0], 0, 2), -Infinity);
});
test("finite decks draw once, pay for every planned card, and exhaust all physical cards", () => {
  for (const profile of Object.keys(ENEMIES)) {
    const s = scenario(profile, []),
      enemy = createEnemy(123, 1, profile),
      played = [];
    s.enemyAI = enemy.ai;
    s.enemyDeck = enemy.deck;
    for (let round = 1; round <= 60; round++) {
      s.round = round;
      planEnemyTurn(s);
      assert.ok(s.intents.length <= 1);
      for (const arrival of s.intents) {
        assert.ok(arrival.card.cost <= s.enemyAI.energy);
        s.enemyAI.energy -= arrival.card.cost;
        played.push(arrival.card);
      }
      const after = structuredClone(s);
      planEnemyTurn(s);
      assert.deepEqual(s, after);
      s.intents = [];
      if (!s.enemyAI.hand.length && !s.enemyDeck.length) break;
    }
    assert.equal(played.length, 18);
    assert.equal(new Set(played.map((c) => c.id)).size, 18);
    assert.deepEqual(played.map((c) => c.species).sort(), [...ENEMIES[profile].deck].sort());
    s.round++;
    planEnemyTurn(s);
    assert.equal(s.enemyDeck.length, 0);
    assert.equal(s.enemyAI.hand.length, 0);
    assert.equal(s.intents.length, 0);
  }
});

test("enemy relay discounts real held cards, reinforcement consumes them once, and rebirth joins that same hand", () => {
  const s = scenario("colony", ["antqueen"]),
    e = new BattleEngine(s);
  const queenId = s.enemyAI.hand[0].id;
  for (let i = 0; i < 2; i++) {
    s.enemy[0][0] = unit("ant", "dead" + i);
    e.remove("enemy", 0, 0, "killed");
  }
  assert.equal(s.enemyAI.hand[0].cost, 1);
  assert.equal(intent(s).card.id, queenId);
  const result = planEnemyDeploy(s);
  assert.equal(result.state.enemyAI.energy, 0);
  const queen = result.state.enemy.flat().find((u) => u?.id === queenId);
  assert.equal(queen.cost, 3);
  const ready = scenario("renewal", ["rat"]),
    r = new BattleEngine(ready);
  ready.enemy[0][1] = unit("moth", "reborn");
  r.remove("enemy", 0, 1, "killed");
  assert.equal(ready.enemy[0][1].species, "rat");
  assert.deepEqual(
    ready.enemyAI.hand.map((c) => c.id),
    ["reborn"],
  );
  assert.equal(ready.intents.length, 0);
});
test("enemy search uses its profile and finite deck; kin and recall feed normal planning without extra entries", () => {
  const s = scenario("nursery", ["firefly"]);
  s.enemy[0][1] = unit("wolfpup", "pup");
  s.enemy[0][3] = unit("caterpillar", "larva", { age: 1 });
  s.enemyDeck = [creature("fox", "fox"), creature("firefly", "catalyst")];
  assert.equal(chooseEnemySearch(s).id, "catalyst");
  const before = structuredClone(s);
  assert.equal(chooseEnemySearch(s).id, "catalyst");
  assert.deepEqual(s, before);
  new BattleEngine(s).place(creature("skink", "seeker"), "enemy", 1, 4);
  assert.deepEqual(
    s.enemyDeck.map((c) => c.id),
    ["fox"],
  );
  assert.ok(s.enemyAI.hand.some((c) => c.id === "catalyst"));
  const home = scenario("sky", []),
    e = new BattleEngine(home);
  home.enemy[0][2] = unit("scoutbee", "home", { health: 3, hp: 1 });
  e.act("enemy", "home");
  assert.equal(home.enemyAI.hand[0].returnState.hp, 1);
  assert.equal(intent(home).card.id, "home");
});
test("search suspension replays the same enemy plan and hidden hand without duplicate cards or draws", () => {
  const s = scenario("pack", ["fox", "hound"]);
  s.enemyDeck = [creature("wolfpup", "next")];
  intent(s);
  s.hand = [creature("skink", "searcher")];
  s.summon = { cardId: "searcher", paid: true, sacrifices: [] };
  s.deck = [creature("beetle", "chosen")];
  const held = structuredClone(s.enemyAI),
    incoming = structuredClone(s.intents),
    reserve = structuredClone(s.enemyDeck);
  const paused = planDeploy(s, "searcher", 0, 0);
  assert.equal(awaitingSearch(paused.state), true);
  const final = planSearch(paused.state, "chosen");
  assert.deepEqual(final.state.enemyAI, held);
  assert.deepEqual(final.state.enemyDeck, reserve);
  assert.deepEqual(final.state.intents, incoming);
  assert.equal(final.state.hand.filter((c) => c.id === "chosen").length, 1);
});

test("opening enemy deployment is visible before player deployment and player attacks precede enemy attacks", () => {
  const opening = startBattle(initialDeck(), 1, 123);
  assert.equal(opening.enemy.flat().filter(Boolean).length, 1);
  assert.equal(opening.enemyAI.deployedRound, 1);
  assert.equal(opening.intents.length, 0);

  const s = scenario("pack", ["beetle"]);
  const deployed = planEnemyDeploy(s).state;
  const [row, col] = [0, deployed.enemy[0].findIndex(Boolean)];
  const enemy = deployed.enemy[row][col];
  assert.ok(enemy);
  enemy.native = [];
  enemy.attack = 1;
  enemy.hp = enemy.health = 5;
  deployed.hand = [creature("squirrel", "player-entry")];
  const placement = planDeploy(selectSummon(deployed, "player-entry"), "player-entry", row, col);
  const player = placement.state.player[row][col];
  player.attack = 1;
  player.hp = player.health = 5;
  const combat = planRound(placement.state);
  assert.deepEqual(
    combat.frames.filter((f) => f.action.kind === "attack").map((f) => f.action.source),
    [`player-${row}-${col}`, `enemy-${row}-${col}`],
  );
  assert.equal(combat.state.balance, 0, "new enemy blocks the player's first attack");
  assert.equal(combat.state.enemy[row][col].hp, 4);
  assert.equal(combat.state.player[row][col].hp, 4);
});

test("preparing a battle leaves enemies and energy untouched until opening deployment runs", () => {
  const prepared = prepareBattle(initialDeck(), 1, 123, "normal", "reef");
  const before = structuredClone(prepared);
  assert.equal(prepared.enemy.flat().filter(Boolean).length, 0);
  assert.equal(prepared.enemyAI.energy, 0);
  assert.equal(prepared.enemyAI.deployedRound, undefined);
  assert.equal(prepared.enemyAI.hand.length, 5);
  const plan = planEnemyDeploy(prepared);
  assert.deepEqual(prepared, before);
  assert.equal(plan.frames[0].action.kind, "deploy");
  assert.equal(plan.state.enemy.flat().filter(Boolean).length, 1);
  assert.equal(plan.state.enemy.flat().find(Boolean).submerged, true);
  assert.equal(planEnemyDeploy(plan.state).state, plan.state);
});

test("energy banks one per round and two-cost cards require a saving round between deployments", () => {
  let s = scenario("pack", ["wolf", "wolf", "wolf"]);
  s.enemyAI.energy = 0;
  s.enemyAI.energyRound = 0;
  const rounds = [],
    balances = [];
  for (let round = 1; round <= 6; round++) {
    s.round = round;
    s.enemy = emptyBoard();
    const before = structuredClone(s);
    const plan = planEnemyDeploy(s);
    assert.deepEqual(s, before);
    s = plan.state;
    if (plan.frames.some((f) => f.action.kind === "deploy")) rounds.push(round);
    balances.push(s.enemyAI.energy);
    assert.equal(planEnemyDeploy(s).state, s, "cannot gain or spend twice in one round");
  }
  assert.deepEqual(rounds, [2, 4, 6]);
  assert.deepEqual(balances, [1, 0, 1, 0, 1, 0]);
});

test("free deployments bank energy, full boards spend nothing, and failed survival still pays entry cost", () => {
  const free = scenario("pack", ["ant"]);
  const freePlan = planEnemyDeploy(free);
  assert.equal(freePlan.state.enemyAI.energy, 1);
  assert.equal(freePlan.state.enemy.flat().filter(Boolean).length, 1);
  const blocked = scenario("pack", ["wolf"]);
  blocked.enemyAI.energy = 2;
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 5; col++) blocked.enemy[row][col] = unit("beetle", `${row}-${col}`);
  const full = planEnemyDeploy(blocked);
  assert.equal(full.frames.length, 0);
  assert.equal(full.state.enemyAI.energy, 2);
  assert.equal(full.state.enemyAI.hand.length, 1);
  const ambush = scenario("pack", []);
  ambush.intents = [{ card: creature("hound", "entry"), row: 0, col: 2, costGated: true }];
  ambush.enemyAI.plannedRound = 1;
  ambush.player[0][2] = unit("crocodile", "ambush");
  const dead = planEnemyDeploy(ambush);
  assert.equal(dead.state.enemyAI.energy, 0);
  assert.equal(dead.state.enemy[0][2], null);
  assert.ok(dead.frames.some((f) => f.action.kind === "death"));
});

test("search paused during enemy attacks resumes without duplicating next-round energy or deployment", () => {
  const s = scenario("pack", ["wolf"]);
  s.enemyAI.deployedRound = 1;
  s.enemyAI.plannedRound = 1;
  s.enemyAI.energy = 1;
  s.player[0][0] = unit("mouse", "victim");
  s.enemy[0][0] = unit("wolf", "foe", { native: [], hp: 5, health: 5 });
  const responder = creature("beetle", "responder");
  Object.assign(responder, { native: ["search", "reinforce"], attack: 0, health: 5 });
  s.hand = [responder];
  s.deck = [creature("quail", "chosen")];
  const paused = planRound(s);
  assert.ok(awaitingSearch(paused.state));
  assert.equal(paused.state.round, 1);
  assert.equal(paused.state.enemyAI.energy, 1);
  const resumed = planSearch(paused.state, "chosen");
  assert.equal(resumed.state.round, 2);
  assert.equal(resumed.state.enemyAI.energy, 0);
  assert.equal(resumed.state.enemyAI.deployedRound, 2);
  assert.equal(
    resumed.frames.filter(
      (f) => f.action.kind === "deploy" && f.action.source === "intent-candidate-0",
    ).length,
    1,
  );
  assert.equal(
    new Set(
      resumed.state.enemy
        .flat()
        .filter(Boolean)
        .map((u) => u.id),
    ).size,
    2,
  );
});
