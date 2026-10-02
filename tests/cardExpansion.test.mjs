import { test } from "node:test";
import assert from "node:assert/strict";
import { BattleEngine } from "../src/domain/battleEngine.ts";
import {
  allCreatures,
  creature,
  makeToken,
  TRIBES,
  initialDeck,
  startBattle,
  planRound,
  sigilDescription,
} from "../src/domain/game.ts";
import {
  newAdventure,
  categoryOptions,
  chooseCategory,
  visitRewards,
} from "../src/domain/adventure.ts";

const unit = (species, id, patch = {}) => {
  const card = creature(species, id);
  return { ...card, hp: card.health, age: 0, used: [], base: structuredClone(card), ...patch };
};
const setup = () => {
  const state = startBattle(initialDeck(), 1, 123);
  state.intents = [];
  state.enemyAI = undefined;
  state.hand = [];
  state.canDraw = false;
  return { state, engine: new BattleEngine(state) };
};

test("new tribes keep proper generated-card identities and every fish can submerge", () => {
  for (const [species, tribe] of Object.entries({
    fox: "canine",
    greywolf: "canine",
    mouse: "rodent",
    squirrel: "rodent",
    rabbit: "rabbit",
    ant: "ant",
    worker: "ant",
    queen: "bee",
    bear: "bear",
    boar: "pig",
    goat: "sheep",
    hyena: "special",
    bat: "special",
    hedgehog: "special",
  }))
    assert.equal(creature(species, species).tribe, tribe);
  assert.equal(makeToken("bee", "bee").tribe, "bee");
  assert.equal(makeToken("youngRabbit", "baby").tribe, "rabbit");
  const fish = allCreatures().filter((c) => c.tribe === "fish");
  assert.equal(fish.length, 8);
  assert.ok(fish.every((c) => c.native.includes("submerge") && c.art === "fish"));
});

test("a full round grows both players' juvenile wolves and deer once into their authored adults", () => {
  for (const side of ["player", "enemy"]) {
    const { state } = setup();
    state[side][0][0] = unit("wolfpup", "pup");
    state[side][0][2] = unit("fawn", "fawn");
    const before = structuredClone(state),
      next = planRound(state).state;
    assert.deepEqual(state, before);
    const wolf = next[side].flat().find((c) => c?.id === "pup");
    const deer = next[side].flat().find((c) => c?.id === "fawn");
    assert.equal(wolf.species, "wolf");
    assert.deepEqual([wolf.cost, wolf.attack, wolf.health], [2, 3, 3]);
    assert.equal(deer.species, "deer");
    assert.deepEqual([deer.cost, deer.attack, deer.health, deer.native], [2, 1, 4, ["migrate"]]);
    const again = planRound({ ...next, canDraw: false, intents: [] }).state;
    assert.equal(again[side].flat().find((c) => c?.id === "pup").attack, 3);
  }
});

test("growth preserves upgrades, wounds and inherited sigils; rebirth restores the juvenile and its fee", () => {
  for (const [baby, adult] of [
    ["wolfpup", "wolf"],
    ["fawn", "deer"],
    ["bearcub", "blackbear"],
    ["piglet", "forestboar"],
  ]) {
    const { state, engine } = setup();
    const card = creature(baby, "growing");
    card.attack += 2;
    card.health += 3;
    card.added = ["rebirth", "ranged"];
    state.player[0][2] = {
      ...card,
      hp: card.health - 1,
      age: 0,
      used: [],
      base: structuredClone(card),
    };
    engine.startRound();
    const grown = state.player[0][2],
      target = creature(adult, "adult");
    assert.deepEqual(
      [grown.id, grown.species, grown.cost, grown.attack, grown.health, grown.hp],
      ["growing", adult, target.cost, target.attack + 2, target.health + 3, target.health + 2],
    );
    assert.deepEqual(grown.added, ["rebirth", "ranged"]);
    engine.remove("player", 0, 2, "sacrificed");
    assert.deepEqual(
      state.hand.find((returned) => returned.id === card.id),
      card,
    );
  }
});

test("every tribe remains discoverable at tribe nodes with three matching reward choices", () => {
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const run = {
      ...newAdventure(seed),
      nodes: [{ id: "tribes", floor: 1, x: 0.5, kind: "tribe", next: [] }],
      visit: { nodeId: "tribes", attempts: 0, stat: "attack", done: false, message: "" },
    };
    for (const tribe of categoryOptions(run)) {
      seen.add(tribe);
      const choices = visitRewards(chooseCategory(run, tribe));
      assert.equal(choices.length, 3);
      assert.equal(new Set(choices.map((c) => c.species)).size, 3);
      assert.ok(choices.every((c) => c.tribe === tribe && !c.token && c.species !== "squirrel"));
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(TRIBES).sort());
});

test("expanded cards participate in the first three enemy turns within their cost limit", () => {
  const seen = new Set();
  for (let seed = 0; seed < 400; seed++) {
    let battle = startBattle(initialDeck(), 1, seed);
    for (let round = 1; round <= 3; round++) {
      assert.ok(battle.intents.every(({ card }) => card.cost <= 1));
      for (const { card } of battle.intents) seen.add(card.species);
      battle = planRound({ ...battle, canDraw: false }).state;
    }
  }
  for (const species of ["wolfpup", "hound", "fawn", "carp", "honeybee", "soldierant"])
    assert.ok(seen.has(species), species);
  assert.match(sigilDescription(creature("wolfpup", "pup"), "growth"), /苔原狼（2 费，3\/3）/);
  assert.match(sigilDescription(creature("fawn", "fawn"), "growth"), /枝角鹿（2 费，1\/4，迁徙）/);
});
