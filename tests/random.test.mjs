import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRandom, deriveSeed } from '../src/domain/random.ts'

test('seeded sequences repeat, stay bounded, and zero is a valid seed', () => {
  for (const seed of [0, 1, 123, 4294967295]) {
    const a = createRandom(seed), b = createRandom(seed)
    const sequence = Array.from({length:100}, () => a.next())
    assert.deepEqual(sequence, Array.from({length:100}, () => b.next()))
    assert.ok(sequence.every(n => n >= 0 && n < 1))
    assert.ok(new Set(sequence).size > 90)
    assert.ok(Array.from({length:100}, () => a.int(5)).every(n => Number.isInteger(n) && n >= 0 && n < 5))
  }
  assert.notEqual(createRandom(1).next(), createRandom(2).next())
  assert.throws(() => createRandom(0).int(0), RangeError)
  assert.throws(() => createRandom(0).int(1.5), RangeError)
})

test('shuffle preserves inputs and seed namespaces isolate streams', () => {
  const source = Array.from({length:20}, (_, i) => i)
  const a = createRandom(deriveSeed(1750000000000, 'deck:1')).shuffle(source)
  assert.deepEqual(source, Array.from({length:20}, (_, i) => i))
  assert.deepEqual([...a].sort((a,b) => a-b), source)
  assert.deepEqual(a, createRandom(deriveSeed(1750000000000, 'deck:1')).shuffle(source))
  assert.notEqual(deriveSeed(1750000000000, 'deck:1'), deriveSeed(1750000000000, 'enemy:1'))
  assert.notEqual(deriveSeed(1750000000000, 'deck:1'), deriveSeed(1750000000001, 'deck:1'))
  assert.deepEqual(createRandom(0).shuffle([]), [])
})
