import test from "node:test";
import assert from "node:assert/strict";
import { BattleEngine } from "../src/domain/battleEngine.ts";
import { creature, initialDeck, startBattle } from "../src/domain/game.ts";

const unit = (id, patch = {}) => ({
  ...creature("squirrel", id),
  attack: 1,
  health: 5,
  hp: 5,
  native: [],
  added: [],
  ...patch,
});
function setup(attacker, defender, rear) {
  const state = startBattle(initialDeck(), 1, 42);
  state.enemyAI = undefined;
  state.intents = [];
  state.player = [Array(5).fill(null), Array(5).fill(null)];
  state.enemy = [Array(5).fill(null), Array(5).fill(null)];
  state.player[0][0] = attacker;
  state.enemy[0][0] = defender;
  if (rear) state.enemy[1][0] = rear;
  const frames = [];
  const engine = new BattleEngine(state, (action, snapshot) =>
    frames.push({ action, state: snapshot }),
  );
  return { state, engine, frames };
}

test("hit presentation distinguishes surviving, lethal, blocked, poison and tail-rescued attacks", () => {
  const scenarios = [
    { name: "survives", attacker: {}, defender: {}, lethal: false },
    { name: "dies", attacker: { attack: 5 }, defender: {}, lethal: true },
    {
      name: "blocked poison",
      attacker: { native: ["poison"] },
      defender: { native: ["armor"], hp: 1 },
      lethal: false,
    },
    { name: "poison", attacker: { native: ["poison"] }, defender: {}, lethal: true },
    {
      name: "tail rescues damage",
      attacker: { attack: 5 },
      defender: { native: ["tail"] },
      lethal: false,
    },
    {
      name: "tail rescues poison",
      attacker: { native: ["poison"] },
      defender: { native: ["tail"] },
      lethal: false,
    },
  ];
  for (const scenario of scenarios) {
    const { state, engine, frames } = setup(
      unit("attacker", scenario.attacker),
      unit("defender", scenario.defender),
    );
    engine.act("player", "attacker");
    const hit = frames.find(({ action }) => action.kind === "hit" && action.target === "enemy-0-0");
    assert.equal(hit.action.lethal, scenario.lethal, scenario.name);
    assert.equal(state.enemy[0][0] === null, scenario.lethal, scenario.name);
    assert.equal(
      frames.some(({ action }) => action.kind === "death" && action.target === "enemy-0-0"),
      scenario.lethal,
      scenario.name,
    );
  }
});

test("thorns marks lethal retaliation while tail-rescued retaliation remains a hit", () => {
  for (const tail of [false, true]) {
    const { state, engine, frames } = setup(
      unit("attacker", { hp: 1, native: tail ? ["tail"] : [] }),
      unit("defender", { native: ["thorns"] }),
    );
    engine.act("player", "attacker");
    const hit = frames.find(
      ({ action }) => action.kind === "hit" && action.target === "player-0-0",
    );
    assert.equal(hit.action.lethal, !tail);
    assert.equal(state.player[0][0] === null, !tail);
  }
});

test("overflow skips only the dying front unit's hit and preserves the surviving rear hit", () => {
  const { state, engine, frames } = setup(
    unit("attacker", { attack: 3 }),
    unit("front", { hp: 1 }),
    unit("rear"),
  );
  engine.act("player", "attacker");
  assert.deepEqual(
    frames
      .filter(({ action }) => action.kind === "hit")
      .map(({ action }) => [action.target, action.lethal]),
    [
      ["enemy-0-0", true],
      ["enemy-1-0", false],
    ],
  );
  assert.equal(state.enemy[1][0].hp, 3);
});

test("lethal ember damage and blood self-damage also skip hit presentation", () => {
  const ember = setup(unit("offering", { native: ["ember"] }), unit("defender", { hp: 2 }));
  ember.engine.remove("player", 0, 0, "sacrificed");
  assert.equal(ember.frames.find(({ action }) => action.kind === "hit").action.lethal, true);
  assert.equal(ember.state.enemy[0][0], null);
  const blood = setup(unit("attacker", { native: ["blood"], hp: 1 }), unit("defender"));
  blood.engine.act("player", "attacker");
  assert.equal(blood.frames.find(({ action }) => action.kind === "hit").action.lethal, true);
  assert.equal(blood.state.player[0][0], null);
});
