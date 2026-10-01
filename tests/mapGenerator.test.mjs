import test from 'node:test'
import assert from 'node:assert/strict'
import { generateMap, isCombat } from '../src/domain/adventure.ts'
import { mapCurvePoint } from '../src/domain/mapGeometry.ts'

test('a thousand maps offer distinct events, useful battle branches and stable route budgets', () => {
  const shapes = new Set(), widths = new Set(), encounterFloors = new Set()
  for (let seed = 0; seed < 1000; seed++) {
    const nodes = generateMap(seed), byId = new Map(nodes.map(n => [n.id, n]))
    const ordinary = nodes.filter(n => !n.bonus)
    assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length)
    assert.equal(nodes.filter(n => n.kind === 'elite').length, 2)
    const profile = Array.from({ length: 18 }, (_, i) => ordinary.filter(n => n.floor === i + 1).length)
    widths.add(profile.join(','))
    shapes.add(ordinary.map(n => `${n.id}:${n.next.map(id => id.replace('-bonus', '')).join(',')}`).join('|'))
    encounterFloors.add([...new Set(ordinary.filter(n => isCombat(n.kind)).map(n => n.floor))].join(','))
    assert.equal(profile[0], 1); assert.equal(profile[17], 1)
    assert.equal(nodes[0].x, .5)
    assert.equal(nodes.find(n => n.kind === 'boss').x, .5)
    assert.ok(profile.slice(1, 17).every(count => count >= 2 && count <= 5))
    assert.ok(ordinary.some(n => n.floor === 17 && n.kind === 'upgrade'))
    for (const node of nodes) {
      assert.equal(new Set(node.next).size, node.next.length)
      const next = node.next.map(id => byId.get(id))
      assert.ok(next.every(n => n && n.floor > node.floor))
      const eventKinds = next.filter(n => !isCombat(n.kind)).map(n => n.kind)
      assert.equal(new Set(eventKinds).size, eventKinds.length, `duplicate event choices at seed ${seed}, ${node.id}`)
      const fights = next.filter(n => n.kind === 'battle').map(n => [...n.next].sort().join(','))
      assert.equal(new Set(fights).size, fights.length, `equivalent fights at seed ${seed}, ${node.id}`)
    }
    // Dynamic programming visits every route, including both elite detours,
    // without enumerating the exponentially growing list of complete paths.
    const budgets = new Map()
    for (const node of [...nodes].reverse()) {
      const own = { steps: node.bonus ? 0 : 1, fights: isCombat(node.kind) ? 1 : 0 }
      const tails = node.next.flatMap(id => budgets.get(id))
      const possibilities = tails.length ? tails.map(t => ({ steps: own.steps + t.steps, fights: own.fights + t.fights })) : [own]
      budgets.set(node.id, [...new Map(possibilities.map(p => [`${p.steps}/${p.fights}`, p])).values()])
    }
    assert.deepEqual(budgets.get(nodes[0].id), [{ steps: 18, fights: 8 }])
  }
  assert.ok(shapes.size > 950, `only ${shapes.size} distinct graphs`)
  assert.ok(widths.size > 900, `only ${widths.size} distinct width profiles`)
  assert.ok(encounterFloors.size > 20, 'combat pacing should move between seeds')
})

test('layout stays ordered, separated and forward-moving on desktop and narrow canvases', () => {
  for (let seed = 0; seed < 400; seed++) {
    const nodes = generateMap(seed), byId = new Map(nodes.map(n => [n.id, n]))
    for (const node of nodes) {
      assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y))
      assert.ok(node.x >= .089 && node.x <= .911)
      assert.ok(node.y >= 40)
      for (const id of node.next) assert.ok(byId.get(id).y - node.y > 80)
    }
    for (const floor of new Set(nodes.map(n => n.floor))) {
      const layer = nodes.filter(n => n.floor === floor)
      for (let i = 1; i < layer.length; i++) {
        assert.ok(layer[i].x - layer[i - 1].x >= .159)
        assert.notEqual(layer[i].y, layer[i - 1].y)
      }
    }
  }
})

test('curved routes clear unrelated node circles, including exclusive elite rewards', () => {
  for (let seed = 0; seed < 400; seed++) {
    const nodes = generateMap(seed), byId = new Map(nodes.map(n => [n.id, n]))
    for (const [width, radius] of [[480, 26], [320, 20]]) for (const from of nodes) for (const id of from.next) {
      const to = byId.get(id)
      const nearby = nodes.filter(n => n !== from && n !== to && n.y >= from.y - 26 && n.y <= to.y + 26)
      for (let step = 1; step < 80; step++) {
        const point = mapCurvePoint({ x: from.x * width, y: from.y }, { x: to.x * width, y: to.y }, step / 80)
        for (const node of nearby) assert.ok(Math.hypot(node.x * width - point.x, node.y - point.y) >= radius,
          `seed ${seed}, width ${width}: ${from.id} → ${to.id} overlaps ${node.id}`)
      }
    }
  }
})
