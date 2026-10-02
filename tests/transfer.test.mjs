import test from "node:test";
import assert from "node:assert/strict";
import { transfer, load } from "../src/domain/game.ts";
import { rulesDeck } from "./fixtures/deck.mjs";

function scenario(native, added, targetNative = [], targetAdded = []) {
  const deck = rulesDeck();
  deck[0] = { ...deck[0], native, added };
  deck[1] = { ...deck[1], native: targetNative, added: targetAdded };
  const before = structuredClone(deck);
  const result = transfer(deck, deck[0].id, deck[1].id);
  assert.deepEqual(deck, before);
  assert.equal(result.error, undefined);
  assert.equal(result.deck.length, deck.length - 1);
  return { ...result, card: result.deck.find((c) => c.id === deck[1].id) };
}
test("transfer preserves native then acquired order and discards beyond four acquired sigils", () => {
  const { card, discarded } = scenario(["armor", "ranged"], ["support", "thorns", "follow"]);
  assert.deepEqual(card.added, ["armor", "ranged", "support", "thorns"]);
  assert.deepEqual(discarded, ["follow"]);
  assert.equal(load(card), 4);
});
test("transfer caps weight at six, skips oversized sigils and keeps checking in order", () => {
  const { card, discarded } = scenario(
    ["rebirth", "trisplit"],
    ["armor", "ranged"],
    ["undying", "search"],
    ["split"],
  );
  assert.deepEqual(card.native, ["undying", "search"]);
  assert.deepEqual(card.added, ["split", "rebirth", "armor"]);
  assert.deepEqual(discarded, ["trisplit", "ranged"]);
  assert.equal(load(card), 6);
});
test("duplicate sigils take no capacity and existing acquired sigils remain first", () => {
  const { card, discarded } = scenario(
    ["armor", "ranged"],
    ["armor", "thorns"],
    ["armor"],
    ["ranged"],
  );
  assert.deepEqual(card.added, ["ranged", "thorns"]);
  assert.deepEqual(discarded, []);
});
test("full receivers discard every new sigil and still consume the donor", () => {
  const { card, discarded } = scenario(["armor"], ["ranged"], [], ["rebirth", "trisplit"]);
  assert.deepEqual(card.added, ["rebirth", "trisplit"]);
  assert.deepEqual(discarded, ["armor", "ranged"]);
});
