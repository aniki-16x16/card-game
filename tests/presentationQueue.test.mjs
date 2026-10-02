import test from "node:test";
import assert from "node:assert/strict";
import { presentationQueue } from "../src/features/battle/presentationQueue.ts";

test("independent deployments overlap while a reused slot waits for its death", async () => {
  const queue = presentationQueue();
  const events = [];
  let release;
  const death = new Promise((resolve) => {
    release = resolve;
  });
  const a = queue.enqueue(["player-0-0"], async () => {
    events.push("death");
    await death;
    events.push("dead");
  });
  const b = queue.enqueue(["player-0-1"], async () => {
    events.push("independent");
  });
  const c = queue.enqueue(["player-0-0"], async () => {
    events.push("replacement");
  });
  await b;
  assert.deepEqual(events, ["death", "independent"]);
  let idle = false;
  const drained = queue.idle().then(() => {
    idle = true;
  });
  await Promise.resolve();
  assert.equal(idle, false);
  release();
  await Promise.all([a, c, drained]);
  assert.deepEqual(events, ["death", "independent", "dead", "replacement"]);
  assert.equal(idle, true);
});

test("multi-slot reactions wait for every affected deployment", async () => {
  const queue = presentationQueue();
  let first, second;
  const a = queue.enqueue(
    ["a"],
    () =>
      new Promise((resolve) => {
        first = resolve;
      }),
  );
  const b = queue.enqueue(
    ["b"],
    () =>
      new Promise((resolve) => {
        second = resolve;
      }),
  );
  let reaction = false;
  const c = queue.enqueue(["a", "b"], async () => {
    reaction = true;
  });
  await Promise.resolve();
  first();
  await a;
  assert.equal(reaction, false);
  second();
  await Promise.all([b, c]);
  assert.equal(reaction, true);
});
