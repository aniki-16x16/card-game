import test from "node:test";
import assert from "node:assert/strict";
import { motionScope } from "../src/features/battle/motion.ts";

test("aborting a motion settles its await and restores the original value", async () => {
  const controller = new AbortController();
  const scope = motionScope(controller.signal);
  const value = { x: 3 };
  const pending = scope.tween(value, { x: 100, duration: 10000 });
  controller.abort();
  await pending;
  assert.equal(value.x, 3);
  await scope.tween(value, { x: 200 });
  assert.equal(value.x, 3);
  scope.dispose();
});

test("completed motion can be disposed and restores its value", async () => {
  const scope = motionScope(new AbortController().signal);
  const value = { x: 3 };
  await scope.tween(value, { x: 12, duration: 1 });
  assert.equal(value.x, 12);
  scope.dispose();
  assert.equal(value.x, 3);
});
