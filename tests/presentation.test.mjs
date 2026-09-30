import test from 'node:test'
import assert from 'node:assert/strict'
import { handLayout } from '../src/features/battle/handLayout.ts'
import { sacrificeSchedule } from '../src/features/battle/sacrificeSchedule.ts'
import { cardBend } from '../src/features/battle/cardBend.ts'

test('attack card arches away from the table at its center and flattens on return', () => {
  const middle = cardBend(0, 200, 1.65)
  const top = cardBend(-100, 200, 1.65)
  const bottom = cardBend(100, 200, 1.65)
  assert.ok(middle.z > 0)
  assert.equal(top.z, 0)
  assert.equal(bottom.z, 0)
  assert.equal(top.angle, -bottom.angle)
  assert.ok(top.angle > 0)
  assert.deepEqual(cardBend(40, 200, 0), { y: 40, z: 0, angle: 0 })
})

test('fan is centered and the active card rises while neighbors make room', () => {
  const idle = handLayout(7, 760, -1)
  const active = handLayout(7, 760, 3)
  assert.equal(idle[0].x, -idle[6].x)
  assert.equal(idle[0].angle, -idle[6].angle)
  assert.ok(active[3].y < idle[3].y)
  assert.equal(active[3].angle, 0)
  assert.ok(active[2].x < idle[2].x)
  assert.ok(active[4].x > idle[4].x)
  assert.ok(active[3].z > Math.max(...active.filter((_, i) => i !== 3).map(p => p.z)))
})

test('empty, single and crowded narrow hands produce finite ordered positions', () => {
  assert.deepEqual(handLayout(0, 300, -1), [])
  assert.equal(handLayout(1, 300, -1)[0].x, 0)
  for (const count of [1, 6, 20]) {
    const poses = handLayout(count, 300, count - 1)
    assert.ok(poses.every(p => Object.values(p).every(Number.isFinite)))
    assert.ok(poses.every((p, i) => i === 0 || p.x > poses[i - 1].x))
  }
})

test('sacrifice playback is left-to-right at 100ms intervals without reordering rule snapshots', () => {
  const frames = ['player-0-4', 'player-1-0', 'player-0-0', 'player-0-2'].map(target => ({ action: { kind: 'death', target }, state: {} }))
  const original = structuredClone(frames)
  const schedule = sacrificeSchedule(frames)
  assert.deepEqual(schedule.map(entry => entry.frame.action.target), ['player-0-0', 'player-1-0', 'player-0-2', 'player-0-4'])
  assert.deepEqual(schedule.map(entry => entry.delay), [0, 100, 200, 300])
  assert.deepEqual(frames, original)
})
