import { test } from "node:test";
import assert from "node:assert/strict";
import { BattleEngine } from "../src/domain/battleEngine.ts";
import {
  attackPower,
  creature,
  initialDeck,
  markSacrifice,
  planRound,
  selectSummon,
  startBattle,
} from "../src/domain/game.ts";

const unit = (species, id, patch = {}) => {
  const card = creature(species, id);
  // Explicit rule fixtures survive changes to the authored turtle/gecko cards.
  if (species === "turtle") card.native = ["burrow"];
  if (species === "gecko") card.native = ["submerge"];
  return { ...card, hp: card.health, age: 0, used: [], base: structuredClone(card), ...patch };
};
const setup = () => {
  const s = startBattle(initialDeck(), 1, 123);
  s.hand = [];
  s.intents = [];
  s.canDraw = false;
  const frames = [],
    e = new BattleEngine(s, (action, state) => frames.push({ action, state }));
  return { s, e, frames };
};
const opponents = (side) => (side === "player" ? "enemy" : "player");

test("burrow moves a living unit before a ground attack, preserving state without entry effects", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e, frames } = setup(),
      enemy = opponents(side);
    s[side][0][3] = unit("mouse", "attacker");
    const defender = unit("turtle", "burrower", { hp: 2, age: 4, added: ["porter"] });
    s[enemy][1][1] = defender;
    e.act(side, "attacker");
    assert.equal(s.balance, 0);
    assert.equal(s[enemy][1][1], null);
    assert.equal(s[enemy][0][3], defender);
    assert.equal(defender.hp, 1);
    assert.equal(defender.age, 4);
    assert.equal(s.hand.length, 0);
    assert.equal(s.intents.length, 0);
    assert.deepEqual(
      frames.map((f) => f.action.kind),
      ["advance", "attack", "hit"],
    );
    assert.equal(frames[0].action.target, `${enemy}-0-3`);
  }
});

test("burrow ignores sky attacks and responds to webbed flying and rear-ground dive attacks", () => {
  const { s, e } = setup();
  s.player[0][2] = unit("crow", "flyer");
  s.enemy[0][0] = unit("turtle", "blocker");
  e.act("player", "flyer");
  assert.equal(s.balance, 1);
  assert.equal(s.enemy[0][0].id, "blocker");
  s.enemy[1][2] = unit("spiderling", "web");
  e.act("player", "flyer");
  assert.equal(s.balance, 1);
  assert.equal(s.enemy[0][2].id, "blocker");
  const b = setup();
  b.s.player[0][3] = unit("falcon", "diver");
  b.s.enemy[0][3] = unit("bear", "front");
  b.s.enemy[0][0] = unit("turtle", "blocker", { hp: 5, health: 5 });
  b.e.act("player", "diver");
  assert.equal(b.s.enemy[1][3].id, "blocker");
  assert.equal(b.s.enemy[1][3].hp, 2);
  assert.equal(b.s.enemy[0][3].hp, 6);
  assert.equal(b.s.balance, 0);
});

test("burrow chooses the nearest available defender and can block successive split lanes", () => {
  const { s, e, frames } = setup();
  s.player[0][2] = unit("mouse", "split", { added: ["split"] });
  s.enemy[0][4] = unit("turtle", "far");
  s.enemy[1][2] = unit("turtle", "near", { hp: 5, health: 5 });
  e.act("player", "split");
  assert.equal(s.enemy[0][1].id, "near");
  assert.equal(s.enemy[0][1].hp, 4);
  assert.equal(s.enemy[0][3].id, "far");
  assert.equal(s.enemy[0][3].hp, 1);
  assert.equal(s.balance, 0);
  assert.equal(frames.filter((f) => f.action.kind === "advance").length, 2);
  const b = setup();
  b.s.player[0][2] = unit("mouse", "split", { added: ["split"] });
  b.s.enemy[1][2] = unit("turtle", "solo", { hp: 5, health: 5 });
  b.e.act("player", "split");
  assert.equal(b.s.enemy[0][3].id, "solo");
  assert.equal(b.s.enemy[0][3].hp, 3);
  assert.equal(b.s.balance, 0);
});

test("burrow never moves dead or submerged units or overwrites an underwater occupant", () => {
  const { s, e } = setup();
  s.player[0][2] = unit("mouse", "attacker");
  s.enemy[0][0] = unit("turtle", "dead", { hp: 0 });
  s.enemy[0][4] = unit("turtle", "hidden", { submerged: true });
  e.act("player", "attacker");
  assert.equal(s.balance, 1);
  s.enemy[0][0] = unit("turtle", "living");
  s.enemy[0][2] = unit("gecko", "occupant", { submerged: true });
  e.act("player", "attacker");
  assert.equal(s.balance, 2);
  assert.equal(s.enemy[0][2].id, "occupant");
  assert.equal(s.enemy[0][0].id, "living");
});

test("submerge protects from all attack routes while allowing direct life damage", () => {
  for (const side of ["player", "enemy"])
    for (const species of ["mouse", "crow", "falcon"]) {
      const { s, e } = setup(),
        enemy = opponents(side);
      s[side][0][2] = unit(species, "attacker");
      s[enemy][0][2] = unit("crow", "hidden-front", { submerged: true });
      s[enemy][1][2] = unit("crow", "hidden-rear", { submerged: true });
      e.act(side, "attacker");
      assert.equal(s.balance, (side === "player" ? 1 : -1) * s[side][0][2].attack);
      assert.equal(s[enemy][0][2].hp, 1);
      assert.equal(s[enemy][1][2].hp, 1);
    }
});

test("submerged front leaves rear untouched and submerged rear takes no overflow", () => {
  const { s, e } = setup();
  s.player[0][2] = unit("wolf", "attacker");
  s.enemy[0][2] = unit("gecko", "front", { submerged: true });
  s.enemy[1][2] = unit("fox", "rear");
  e.act("player", "attacker");
  assert.equal(s.balance, 3);
  assert.equal(s.enemy[1][2].hp, 1);
  s.enemy[0][2].submerged = false;
  s.enemy[1][2].submerged = true;
  s.balance = 0;
  e.act("player", "attacker");
  assert.equal(s.balance, 0);
  assert.equal(s.enemy[0][2], null);
  assert.equal(s.enemy[1][2].hp, 1);
});

test("all survivors submerge at their own turn end and only their own turn surfaces them", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup(),
      enemy = opponents(side);
    s[side][0][0] = unit("gecko", "front");
    s[side][1][1] = unit("gecko", "rear", { attack: 0 });
    s[enemy][0][4] = unit("gecko", "other", { submerged: true });
    e.turn(side);
    assert.equal(s[side][0][0].submerged, true);
    assert.equal(s[side][1][1].submerged, true);
    e.act(side, "front");
    assert.equal(Math.abs(s.balance), 1);
    e.beginTurn(side);
    assert.equal(s[side][0][0].submerged, false);
    assert.equal(s[side][1][1].submerged, false);
    assert.equal(s[enemy][0][4].submerged, true);
  }
});

test("a full round surfaces the player for deployment and leaves enemy divers underwater", () => {
  const { s } = setup();
  s.player[0][0] = unit("gecko", "p");
  s.enemy[0][0] = unit("gecko", "e", { hp: 2, health: 2, submerged: true });
  const before = structuredClone(s),
    plan = planRound(s);
  assert.equal(plan.state.player[0][0].submerged, false);
  assert.equal(plan.state.enemy[0][0].submerged, true);
  assert.equal(plan.state.player[0][0].hp, 1);
  assert.equal(plan.state.enemy[0][0].hp, 2);
  assert.equal(plan.state.balance, 0);
  const counterattack = plan.frames.find(
    (f) => f.action.kind === "attack" && f.action.source === "enemy-0-0",
  );
  assert.equal(counterattack.state.player[0][0].submerged, true);
  assert.equal(counterattack.state.enemy[0][0].submerged, false);
  assert.deepEqual(s, before);
});

test("shove moves a contiguous row toward the first gap, without touching another row", () => {
  for (const side of ["player", "enemy"])
    for (const row of [0, 1]) {
      const { s, e, frames } = setup();
      s[side][row][1] = unit("boar", "pusher", { attack: 0 });
      s[side][row][2] = unit("fox", "a", { hp: 1, age: 3 });
      s[side][row][3] = unit("mouse", "b");
      s[side][1 - row][2] = unit("mouse", "stay");
      e.act(side, "pusher");
      assert.deepEqual(
        s[side][row].map((u) => u?.id ?? null),
        [null, null, "pusher", "a", "b"],
      );
      assert.equal(s[side][row][3].hp, 1);
      assert.equal(s[side][row][3].age, 3);
      assert.equal(s[side][1 - row][2].id, "stay");
      for (const frame of frames) {
        const ids = frame.state[side]
          .flat()
          .filter(Boolean)
          .map((u) => u.id);
        assert.equal(new Set(ids).size, ids.length);
      }
    }
});

test("blocked shove flips direction without moving, then pushes left on the next action", () => {
  const { s, e, frames } = setup();
  s.player[0][3] = unit("boar", "pusher", { attack: 0 });
  s.player[0][4] = unit("mouse", "wall");
  s.player[0][2] = unit("fox", "left");
  e.act("player", "pusher");
  assert.equal(s.player[0][3].pushDirection, -1);
  assert.equal(frames.filter((f) => f.action.kind === "advance").length, 0);
  e.act("player", "pusher");
  assert.equal(s.player[0][2].id, "pusher");
  assert.equal(s.player[0][1].id, "left");
  assert.equal(s.player[0][4].id, "wall");
  const b = setup();
  b.s.player[0][0] = unit("boar", "edge", { attack: 0, pushDirection: -1 });
  b.e.act("player", "edge");
  assert.equal(b.s.player[0][0].pushDirection, 1);
  assert.equal(b.s.player[0][1], null);
});

test("pushed units attack only once at their new columns; shortlived units die before pushing", () => {
  const { s, e, frames } = setup();
  s.player[0][0] = unit("boar", "pusher");
  s.player[0][1] = unit("mouse", "pushed");
  e.turn("player");
  assert.equal(s.balance, 3);
  assert.deepEqual(
    frames.filter((f) => f.action.kind === "attack").map((f) => f.action.target),
    ["enemy-0-0", "enemy-0-2"],
  );
  const b = setup();
  b.s.player[0][0] = unit("boar", "short", { added: ["shortlived"] });
  b.s.player[0][1] = unit("mouse", "stay");
  b.e.act("player", "short");
  assert.equal(b.s.player[0][0], null);
  assert.equal(b.s.player[0][1].id, "stay");
});

test("reinforce takes the first eligible card for all death causes and either row without payment", () => {
  for (const side of ["player", "enemy"])
    for (const row of [0, 1])
      for (const cause of ["killed", "sacrificed", "expired"]) {
        const { s, e, frames } = setup();
        s[side][row][3] = unit("mouse", "victim");
        const filler = creature("wolf", "filler"),
          first = { ...creature("wolf", "first"), added: ["reinforce", "porter"], cost: 3 },
          second = creature("quail", "second");
        if (side === "player") s.hand = [filler, first, second];
        else s.intents = [filler, first, second].map((card) => ({ card, row: 0, col: 0 }));
        e.remove(side, row, 3, cause);
        assert.equal(s[side][row][3].id, "first");
        assert.equal(s[side][row][3].hp, 3);
        const ready = side === "player" ? s.hand : s.intents.map((i) => i.card);
        assert.deepEqual(
          ready.map((c) => c.species),
          ["wolf", "quail", "ant"],
        );
        assert.deepEqual(
          frames.slice(0, 2).map((f) => f.action.kind),
          ["death", "deploy"],
        );
        assert.equal(frames[1].action.source, `${side === "player" ? "hand" : "intent"}-first`);
      }
});

test("reinforce does not replace enemies, fill ordinary empty slots, or return the dead card immediately", () => {
  const { s, e } = setup();
  s.hand = [creature("quail", "ready")];
  s.enemy[0][0] = unit("mouse", "enemy");
  e.remove("enemy", 0, 0, "killed");
  assert.equal(s.hand.length, 1);
  assert.equal(s.player[0][0], null);
  e.startRound();
  assert.equal(s.hand.length, 1);
  s.hand = [];
  s.player[0][0] = unit("quail", "self", { added: ["rebirth"] });
  e.remove("player", 0, 0, "killed");
  assert.equal(s.player[0][0], null);
  assert.equal(s.hand[0].id, "self");
});

test("reinforce consumes a pending enemy arrival without deploying the same card twice", () => {
  const { s } = setup();
  s.player[0][0] = unit("wolf", "attacker");
  s.enemy[0][0] = unit("mouse", "victim");
  s.intents = [{ card: creature("quail", "arrival"), row: 0, col: 4 }];
  const plan = planRound(s);
  assert.equal(plan.frames.filter((f) => f.action.kind === "deploy").length, 1);
  assert.equal(plan.state.enemy[0][0].id, "arrival");
  assert.equal(plan.state.enemy[0][4], null);
});

test("reinforce and rebirth cascades terminate even when ambush repeatedly kills replacements", () => {
  const { s, e, frames } = setup();
  s.enemy[0][2] = unit("crocodile", "ambusher");
  s.player[0][2] = unit("mouse", "victim");
  s.hand = ["a", "b"].map((id) => ({ ...creature("quail", id), added: ["rebirth"] }));
  e.remove("player", 0, 2, "killed");
  assert.equal(s.player[0][2], null);
  assert.deepEqual(
    s.hand.map((c) => c.id),
    ["a", "b"],
  );
  assert.equal(frames.filter((f) => f.action.kind === "deploy").length, 2);
  s.player[0][2] = unit("mouse", "next");
  e.remove("player", 0, 2, "killed");
  assert.equal(frames.filter((f) => f.action.kind === "deploy").length, 4);
});

test("sacrifice stays cancellable if reinforcements would occupy every landing slot", () => {
  const { s } = setup();
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 5; col++) s.player[row][col] = unit("mouse", `${row}-${col}`);
  s.hand = [creature("beetle", "summon"), creature("quail", "fill")];
  const selected = selectSummon(s, "summon"),
    before = structuredClone(selected),
    result = markSacrifice(selected, "0-0");
  assert.deepEqual(selected, before);
  assert.equal(result.frames.length, 0);
  assert.equal(result.state.summon.paid, false);
  assert.match(result.state.summon.error, /补位/);
  assert.equal(result.state.player[0][0].id, "0-0");
  assert.equal(result.state.hand.length, 2);
  assert.equal(selectSummon(result.state, null).summon, null);
});

test("a selected reinforce card can deploy itself from a sacrifice and clear the summon lock", () => {
  const { s } = setup();
  s.player[0][0] = unit("mouse", "victim");
  s.hand = [{ ...creature("beetle", "summon"), added: ["reinforce"] }];
  const result = markSacrifice(selectSummon(s, "summon"), "victim");
  assert.equal(result.state.player[0][0].id, "summon");
  assert.equal(result.state.summon, null);
  assert.equal(result.state.hand.length, 0);
  assert.deepEqual(
    result.frames.map((f) => f.action.kind),
    ["death", "deploy"],
  );
});

test("intimidate affects the opposite front only and disappears with movement or death", () => {
  for (const side of ["player", "enemy"]) {
    const { s, e } = setup(),
      enemy = opponents(side);
    s[side][0][2] = unit("wolf", "attacker");
    s[side][1][2] = unit("owl", "rear");
    s[enemy][0][2] = unit("iguana", "scary");
    assert.equal(attackPower(s, side, 0, 2), 2);
    assert.equal(attackPower(s, side, 1, 2), 2);
    s[enemy][1][2] = s[enemy][0][2];
    s[enemy][0][2] = null;
    assert.equal(attackPower(s, side, 0, 2), 3);
    s[enemy][0][2] = s[enemy][1][2];
    s[enemy][1][2] = null;
    e.act(side, "attacker");
    assert.equal(s[enemy][0][2].hp, 1);
    e.remove(enemy, 0, 2, "sacrificed");
    assert.equal(attackPower(s, side, 0, 2), 3);
    assert.equal(s[side][0][2].attack, 3);
  }
});

test("intimidate clamps zero damage, combines with positional buffs, and suppresses stealth power", () => {
  const { s, e, frames } = setup();
  s.player[0][2] = unit("mouse", "attacker", { added: ["stealth"] });
  s.enemy[0][2] = unit("iguana", "scary");
  e.act("player", "attacker");
  assert.equal(frames.length, 0);
  assert.equal(s.enemy[0][2].hp, 3);
  s.player[1][2] = unit("reindeer", "support");
  s.player[0][1] = unit("greywolf", "leader");
  assert.equal(attackPower(s, "player", 0, 2), 2);
  e.act("player", "attacker");
  assert.equal(s.enemy[0][2], null);
  assert.equal(s.player[0][2].attack, 1);
});

test("rebirth clears submerged and push-direction runtime state", () => {
  const { s, e } = setup();
  s.player[0][2] = unit("boar", "unit", {
    added: ["rebirth"],
    submerged: true,
    pushDirection: -1,
    base: undefined,
  });
  e.remove("player", 0, 2, "sacrificed");
  assert.equal("submerged" in s.hand[0], false);
  assert.equal("pushDirection" in s.hand[0], false);
  e.place(s.hand.shift(), "player", 0, 2);
  assert.equal(s.player[0][2].submerged, undefined);
  assert.equal(s.player[0][2].pushDirection, undefined);
});
