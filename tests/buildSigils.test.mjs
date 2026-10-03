import { test } from "node:test";
import assert from "node:assert/strict";
import { BattleEngine } from "../src/domain/battleEngine.ts";
import {
  creature,
  makeToken,
  initialDeck,
  startBattle,
  attackPower,
  intrinsicAttack,
  planDeploy,
  planRound,
  planSearch,
  selectSummon,
  drawCard,
  markSacrifice,
  awaitingSearch,
  SIGILS,
} from "../src/domain/game.ts";

const unit = (species, id, patch = {}) => {
  const card = creature(species, id);
  return { ...card, hp: card.health, age: 0, used: [], base: structuredClone(card), ...patch };
};
const setup = () => {
  const s = startBattle(initialDeck(), 1, 123);
  s.hand = [];
  s.intents = [];
  s.enemyAI = undefined;
  s.enemy = [Array(5).fill(null), Array(5).fill(null)];
  s.deck = [];
  s.enemyDeck = [];
  s.canDraw = false;
  const frames = [],
    e = new BattleEngine(s, (action, state) => frames.push({ action, state }));
  return { s, e, frames };
};
const other = (side) => (side === "player" ? "enemy" : "player");

test("all thirteen approved sigils have card hosts, distinct definitions and no rejected effects", () => {
  assert.equal(Object.keys(SIGILS).length, 48);
  for (const [sigil, species] of Object.entries({
    ember: "sheep",
    legacy: "moth",
    rush: "hare",
    follow: "pigeon",
    fury: "blackbear",
    blood: "warthog",
    catalyst: "firefly",
    seed: "caterpillar",
    colony: "soldierant",
    relay: "antqueen",
    kin: "dormouse",
    recall: "scoutbee",
    search: "skink",
  }))
    assert.ok(creature(species, species).native.includes(sigil));
  for (const name of ["标记", "追踪", "水幕", "涌袭"])
    assert.ok(!Object.values(SIGILS).some((s) => s.name === name));
});

test("sacrifice ember damages only the opposing front and legacy strengthens a wounded rear heir on either side", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup(),
      enemy = other(side);
    s[side][0][2] = unit("moth", "donor", { added: ["ember"] });
    s[side][1][2] = unit("wolfpup", "heir", { hp: 1 });
    s[enemy][0][2] = unit("beetle", "victim", { added: ["thorns", "poison"] });
    s[enemy][1][2] = unit("bear", "rear");
    e.remove(side, 0, 2, "sacrificed");
    assert.equal(s[enemy][0][2], null);
    assert.equal(s[enemy][1][2].hp, 6);
    assert.deepEqual([s[side][1][2].attack, s[side][1][2].health, s[side][1][2].hp], [2, 3, 2]);
    assert.equal(s.balance, 0);
    assert.equal(side === "player" ? s.hand[0].id : s.intents[0].card.id, "donor");
  }
});
test("ember and legacy ignore killed/natural deaths, hidden targets and absent heirs", () => {
  for (const cause of ["killed", "expired"]) {
    const { s, e } = setup();
    s.player[0][1] = unit("moth", "donor", { added: ["ember"] });
    s.player[1][1] = unit("wolfpup", "heir");
    s.enemy[0][1] = unit("bear", "target");
    e.remove("player", 0, 1, cause);
    assert.equal(s.player[1][1].attack, 1);
    assert.equal(s.enemy[0][1].hp, 6);
  }
  const { s, e } = setup();
  s.player[0][1] = unit("sheep", "donor");
  s.enemy[0][1] = unit("carp", "hidden", { submerged: true });
  e.remove("player", 0, 1, "sacrificed");
  assert.equal(s.enemy[0][1].hp, 3);
  assert.equal(s.balance, 0);
});
test("undying sacrifices cannot farm ember or legacy", () => {
  const { s } = setup();
  s.player[0][0] = unit("experiment", "donor", { added: ["ember", "legacy"] });
  s.player[1][0] = unit("wolfpup", "heir");
  s.enemy[0][0] = unit("bear", "target");
  s.hand = [creature("beetle", "paid")];
  const next = markSacrifice(selectSummon(s, "paid"), "donor").state;
  assert.equal(next.player[0][0].id, "donor");
  assert.equal(next.player[1][0].attack, 1);
  assert.equal(next.enemy[0][0].hp, 6);
});

test("migration charges one pending rush, consumed by an entire split volley without stacking", () => {
  const { s, e } = setup();
  s.player[0][1] = unit("mouse", "runner", { native: ["migrate", "rush"] });
  e.act("player", "runner");
  const runner = s.player[0][2];
  assert.equal(runner.rush, true);
  assert.equal(attackPower(s, "player", 0, 2), 3);
  runner.native = ["rush", "split"];
  s.balance = 0;
  e.act("player", "runner");
  assert.equal(s.balance, 6);
  assert.equal(runner.rush, undefined);
  assert.equal(runner.attack, 1);
});
test("pushes trigger rush and follow chains terminate with one follow per unit per round", () => {
  const { s, e, frames } = setup();
  s.player[0][3] = unit("mouse", "leader", { native: ["migrate"] });
  for (const [col, id] of [
    [0, "a"],
    [1, "b"],
    [2, "c"],
  ])
    s.player[0][col] = unit("mouse", id, { native: ["follow", "rush"] });
  e.act("player", "leader");
  assert.deepEqual(
    s.player[0].map((u) => u?.id ?? null),
    [null, "a", "b", "c", "leader"],
  );
  for (const col of [1, 2, 3]) {
    assert.equal(s.player[0][col].followedRound, 1);
    assert.equal(s.player[0][col].rush, true);
  }
  assert.equal(frames.filter((f) => f.action.kind === "advance").length, 4);
  // Preserve a follower's stamp while another nearby unit vacates a square.
  s.player[0][3] = null;
  s.player[0][4] = null;
  s.player[0][3] = unit("mouse", "leader2", { native: ["migrate"] });
  e.act("player", "leader2");
  assert.equal(s.player[0][3], null);
  assert.equal(s.player[0][2].id, "b");
  s.round = 2;
  s.player[0][3] = s.player[0][4];
  s.player[0][4] = null;
  e.act("player", "leader2");
  assert.equal(s.player[0][3].id, "b");
  const p = setup();
  p.s.player[0][1] = unit("boar", "pusher", { attack: 0 });
  p.s.player[0][2] = unit("mouse", "rushed", { native: ["rush"] });
  p.e.act("player", "pusher");
  assert.equal(p.s.player[0][3].rush, true);
});
test("rear promotion does not charge rush and dead or submerged followers cannot move", () => {
  const { s, e } = setup();
  s.player[1][1] = unit("mouse", "rear", { native: ["rush"] });
  e.startRound();
  assert.equal(s.player[0][1].rush, undefined);
  s.player[0][1].native = ["migrate"];
  s.player[0][0] = unit("pigeon", "hidden", { submerged: true });
  e.act("player", "rear");
  assert.equal(s.player[0][0].id, "hidden");
  assert.equal(s.player[0][1], null);
});

test("fury and colony derive live attack from wounds and same-row allies on both sides", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup();
    s[side][0][2] = unit("blackbear", "main", { hp: 1, added: ["colony"] });
    s[side][0][1] = unit("bearcub", "ally");
    s[side][0][3] = unit("bearcub", "dead", { hp: 0 });
    s[side][1][2] = unit("bearcub", "rear");
    s[other(side)][0][2] = unit("iguana", "foe");
    assert.equal(attackPower(s, side, 0, 2), 5);
    e.remove(side, 0, 1, "sacrificed");
    assert.equal(attackPower(s, side, 0, 2), 4);
    s[side][0][2].hp = 4;
    assert.equal(attackPower(s, side, 0, 2), 1);
    assert.equal(s[side][0][2].attack, 2);
  }
});
test("blood pays once for a multi-lane action and its temporary bonus does not persist", () => {
  const { s, e } = setup();
  s.player[0][2] = unit("mouse", "blood", { hp: 3, health: 3, native: ["blood", "split"] });
  e.act("player", "blood");
  assert.equal(s.player[0][2].hp, 2);
  assert.equal(s.balance, 6);
  assert.equal(s.player[0][2].bloodBonus, undefined);
});
test("lethal blood loss is a natural death before attacks and cannot be rescued by tail or armor", () => {
  const { s, e, frames } = setup();
  s.player[0][0] = unit("mouse", "risk", { native: ["blood", "rebirth", "tail", "armor"] });
  e.act("player", "risk");
  assert.equal(s.player[0][0], null);
  assert.equal(s.hand[0].id, "risk");
  assert.equal(s.balance, 0);
  assert.ok(!frames.some((f) => f.action.kind === "attack"));
  assert.equal(frames.find((f) => f.action.kind === "death").action.cause, "expired");
});
test("blood does not tax zero-power or ineligible rear units", () => {
  const { s, e } = setup();
  s.player[0][0] = unit("mouse", "zero", { attack: 0, native: ["blood"] });
  s.player[1][1] = unit("mouse", "rear", { native: ["blood"] });
  e.turn("player");
  assert.equal(s.player[0][0].hp, 1);
  assert.equal(s.player[1][1].hp, 1);
  assert.equal(s.balance, 0);
});

test("catalyst advances only one growth stage and seed returns raw templates without upgrades", () => {
  const { s, e } = setup();
  const egg = makeToken("egg", "egg");
  s.player[0][1] = { ...egg, added: ["seed"], attack: 2, health: 3, hp: 2, age: 0, used: [] };
  e.place(creature("firefly", "catalyst"), "player", 0, 2);
  assert.equal(s.player[0][1].species, "chick");
  assert.equal(s.player[0][1].attack, 2);
  assert.equal(s.player[0][1].hp, 2);
  assert.equal(s.hand.length, 1);
  assert.equal(s.hand[0].species, "egg");
  assert.deepEqual([s.hand[0].attack, s.hand[0].health, s.hand[0].added], [0, 1, []]);
  e.startRound();
  assert.equal(s.player[0][1].attack, 3);
  assert.equal(s.hand[1].species, "chick");
});
test("two catalysts finish metamorph without triggering breed or swarm and leave one raw larval form", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup();
    s[side][0][1] = unit("caterpillar", "larva", { added: ["breed", "swarm"], attack: 2 });
    e.place(creature("firefly", "one"), side, 0, 2);
    assert.equal(s[side][0][1].species, "caterpillar");
    assert.equal(side === "player" ? s.hand.length : s.intents.length, 0);
    e.place(creature("firefly", "two"), side, 0, 0);
    assert.equal(s[side][0][1].species, "butterfly");
    const copy = side === "player" ? s.hand[0] : s.intents[0].card;
    assert.equal(copy.species, "caterpillar");
    assert.equal(copy.attack, 0);
    assert.deepEqual(copy.added, []);
  }
});

test("relay discounts existing same-tribe hand cards for every death cause and resets cost on placement", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup(),
      card = creature("antqueen", "waiting");
    card.added = ["rebirth"];
    if (side === "player") s.hand = [card];
    else s.intents = [{ card, row: 0, col: 3, costGated: true }];
    for (const cause of ["sacrificed", "killed", "expired"]) {
      s[side][0][0] = unit("ant", "victim");
      e.remove(side, 0, 0, cause);
    }
    assert.equal(card.cost, 0);
    assert.equal(card.costDiscount, 3);
    if (side === "player") s.hand = [];
    else s.intents = [];
    e.place(card, side, 0, 3);
    assert.equal(s[side][0][3].cost, 3);
    assert.equal(s[side][0][3].costDiscount, undefined);
    e.remove(side, 0, 3, "sacrificed");
    const returned =
      side === "player"
        ? s.hand.find((c) => c.id === "waiting")
        : s.intents.find((i) => i.card.id === "waiting").card;
    assert.equal(returned.cost, 3);
  }
});
test("relay cannot discount a newly reborn self or unrelated waiting species", () => {
  const { s, e } = setup();
  s.hand = [creature("antqueen", "queen")];
  s.player[0][0] = unit("mouse", "mouse");
  e.remove("player", 0, 0, "killed");
  assert.equal(s.hand[0].cost, 3);
  s.player[0][0] = unit("antqueen", "self", { added: ["rebirth"] });
  e.remove("player", 0, 0, "killed");
  assert.equal(s.hand.find((c) => c.id === "self").cost, 3);
});
test("enemy relay makes a previously unaffordable generated arrival eligible without granting another entry", () => {
  const { s, e } = setup();
  const queen = creature("antqueen", "queen");
  s.intents = [{ card: queen, row: 0, col: 2, costGated: true }];
  assert.equal(planRound(s).state.enemy[0][2], null);
  for (let i = 0; i < 2; i++) {
    s.enemy[0][0] = unit("ant", "victim" + i);
    e.remove("enemy", 0, 0, "killed");
  }
  const next = planRound(s).state;
  assert.equal(next.enemy[0][2].id, "queen");
  assert.equal(next.enemy[0][2].cost, 3);
  assert.equal(next.enemy.flat().filter(Boolean).length, 1);
});

test("kin draws the first same-tribe card from the proper deck without consuming normal draws", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup(),
      cards = [creature("wolf", "wolf"), creature("mouse", "mouse"), creature("rat", "rat")];
    cards[1].health = 4;
    s.canDraw = true;
    if (side === "player") s.deck = cards;
    else s.enemyDeck = cards;
    const squirrels = s.squirrelDeck.length;
    e.place(creature("dormouse", "finder"), side, 0, 1);
    assert.deepEqual(
      (side === "player" ? s.deck : s.enemyDeck).map((c) => c.id),
      ["wolf", "rat"],
    );
    const drawn = side === "player" ? s.hand[0] : s.intents[0].card;
    assert.equal(drawn.id, "mouse");
    assert.equal(drawn.health, 4);
    assert.equal(s.canDraw, true);
    assert.equal(s.squirrelDeck.length, squirrels);
  }
});
test("recall preserves wounds, growth and stealth usage through redeployment without firing death effects", () => {
  const { s, e } = setup();
  s.player[0][1] = unit("mouse", "home", {
    health: 3,
    hp: 3,
    native: ["growth", "recall", "stealth", "brood", "rebirth"],
  });
  s.enemy[0][1] = unit("bear", "target", { health: 8, hp: 8 });
  e.startRound();
  e.act("player", "home");
  assert.equal(s.player[0][1], null);
  assert.equal(s.hand.length, 1);
  const returned = s.hand.pop();
  assert.equal(returned.returnState.hp, 3);
  assert.deepEqual(returned.returnState.used, ["growth", "stealth"]);
  e.place(returned, "player", 0, 1);
  e.startRound();
  assert.equal(s.player[0][1].health, 4);
  assert.equal(s.player[0][1].hp, 3);
  e.act("player", "home");
  assert.equal(s.enemy[0][1].hp, 2);
  assert.equal(s.hand[0].returnState.hp, 2);
  assert.equal(intrinsicAttack(s.hand[0]), 2);
  assert.equal(s.hand[0].species, "mouse");
});
test("shortlived resolves before recall and dead units cannot return twice", () => {
  const { s, e } = setup();
  s.player[0][0] = unit("mouse", "fleeting", { native: ["shortlived", "recall", "brood"] });
  e.act("player", "fleeting");
  assert.equal(s.player[0][0], null);
  assert.deepEqual(
    s.hand.map((c) => c.species),
    ["larva"],
  );
});
test("recall preserves a blocked shove's changed direction on redeployment", () => {
  const { s, e } = setup();
  s.player[0][4] = unit("mouse", "home", { native: ["shove", "recall"], attack: 0 });
  e.act("player", "home");
  assert.equal(s.hand[0].returnState.pushDirection, -1);
  e.place(s.hand.pop(), "player", 0, 2);
  assert.equal(s.player[0][2].pushDirection, -1);
  e.act("player", "home");
  assert.equal(s.player[0][2], null);
  assert.equal(s.hand[0].returnState.pushDirection, -1);
});

test("search pauses deployment, permits an arbitrary exact card choice, blocks other actions and resumes once", () => {
  const { s } = setup();
  s.hand = [creature("skink", "searcher")];
  s.summon = { cardId: "searcher", paid: true, sacrifices: [] };
  s.canDraw = true;
  s.deck = [creature("beetle", "first"), creature("wolf", "chosen"), creature("owl", "last")];
  const before = structuredClone(s),
    first = planDeploy(s, "searcher", 0, 1);
  assert.deepEqual(s, before);
  assert.equal(awaitingSearch(first.state), true);
  assert.equal(selectSummon(first.state, "missing"), first.state);
  assert.equal(drawCard(first.state, "deck"), first.state);
  assert.equal(planRound(first.state).state, first.state);
  assert.equal(planSearch(first.state, "missing").state, first.state);
  const second = planSearch(first.state, "chosen");
  assert.deepEqual(
    second.state.deck.map((c) => c.id),
    ["first", "last"],
  );
  assert.deepEqual(
    second.state.hand.map((c) => c.id),
    ["chosen"],
  );
  assert.equal(second.state.canDraw, true);
  assert.equal(second.state.continuation, undefined);
  assert.ok(!second.frames.some((f) => f.action.kind === "deploy"));
  assert.equal(awaitingSearch(second.state), false);
  assert.equal(planSearch(second.state, "first").state, second.state);
});
test("search resolves before ambush and the selected reinforcement can participate in that death chain", () => {
  const { s } = setup();
  s.hand = [creature("skink", "searcher")];
  s.summon = { cardId: "searcher", paid: true, sacrifices: [] };
  s.enemy[0][1] = unit("crocodile", "ambush");
  const replacement = creature("quail", "replacement");
  replacement.health = 10;
  s.deck = [replacement];
  const first = planDeploy(s, "searcher", 0, 1);
  assert.equal(first.state.player[0][1].id, "searcher");
  assert.ok(!first.frames.some((f) => f.action.kind === "attack"));
  const final = planSearch(first.state, "replacement");
  assert.equal(final.state.player[0][1].id, "replacement");
  assert.equal(final.state.player[0][1].hp, 5);
  assert.equal(final.state.deck.length, 0);
  assert.equal(final.state.hand.length, 0);
  assert.equal(final.state.searches.length, 0);
});
test("a mid-round search stops later enemies and its choice affects subsequent reinforcement reactions", () => {
  const { s } = setup();
  s.player[0][0] = unit("mouse", "victim0");
  s.player[0][1] = unit("mouse", "victim1");
  s.enemy[0][0] = unit("wolf", "foe0", { health: 5, hp: 5, native: [] });
  s.enemy[0][1] = unit("fox", "foe1", { health: 5, hp: 5 });
  const searcher = creature("beetle", "searcher");
  searcher.native = ["search", "reinforce"];
  searcher.attack = 0;
  searcher.health = 5;
  s.hand = [searcher];
  const saved = creature("quail", "saved");
  saved.health = 4;
  s.deck = [saved];
  const first = planRound(s);
  assert.equal(first.state.round, 1);
  assert.equal(first.state.player[0][1].id, "victim1");
  const final = planSearch(first.state, "saved");
  assert.equal(final.state.round, 2);
  assert.equal(final.state.player[0][1].id, "saved");
  assert.equal(final.state.player[0][0].id, "searcher");
  assert.ok(
    !final.frames.some((f) => f.action.kind === "attack" && f.action.source === "enemy-0-0"),
  );
  assert.equal(final.state.continuation, undefined);
});
test("nested searches retain prior choices and never duplicate cards or already played frames", () => {
  const { s } = setup();
  s.hand = [creature("skink", "one")];
  s.summon = { cardId: "one", paid: true, sacrifices: [] };
  s.enemy[0][0] = unit("crocodile", "ambush");
  const second = creature("mouse", "two");
  second.native = ["search", "reinforce"];
  s.deck = [second, creature("beetle", "final")];
  const first = planDeploy(s, "one", 0, 0);
  const mid = planSearch(first.state, "two");
  assert.equal(awaitingSearch(mid.state), true);
  assert.equal(mid.state.searches[0].sourceId, "two");
  const last = planSearch(mid.state, "final");
  assert.deepEqual(
    last.state.hand.map((c) => c.id),
    ["final"],
  );
  assert.equal(last.state.player[0][0], null);
  assert.equal(last.state.deck.length, 0);
  assert.ok(!last.frames.some((f) => f.action.kind === "deploy"));
  assert.ok(!JSON.stringify(last.state).includes('"continuation"'));
});
test("empty-deck search completes without a modal and enemy search uses a real finite reserve deterministically", () => {
  const { s } = setup();
  s.hand = [creature("skink", "searcher")];
  s.summon = { cardId: "searcher", paid: true, sacrifices: [] };
  const empty = planDeploy(s, "searcher", 0, 0).state;
  assert.equal(awaitingSearch(empty), false);
  assert.equal(empty.player[0][0].id, "searcher");
  const a = setup(),
    b = setup();
  for (const { s, e } of [a, b]) {
    s.enemyDeck = [creature("wolf", "later"), creature("fox", "now")];
    e.place(creature("skink", "seeker"), "enemy", 0, 2);
  }
  assert.deepEqual(a.s, b.s);
  assert.equal(a.s.intents[0].card.id, "now");
  assert.deepEqual(
    a.s.enemyDeck.map((c) => c.id),
    ["later"],
  );
  assert.equal(a.s.searches.length, 0);
});
