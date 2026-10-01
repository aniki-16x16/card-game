import { createRandom, deriveSeed } from "./random.ts";
import { mapCurvePoint } from "./mapGeometry.ts";
import type { MapNode, NodeKind } from "./adventure.ts";

type Random = ReturnType<typeof createRandom>;
type Edge = [number, number];
const events: NodeKind[] = ["cost", "tribe", "remove", "upgrade", "transfer"];
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

// A monotone walk through the bipartite grid covers every node without crossing
// connections. Diagonal steps keep independent routes; horizontal/vertical steps
// create forks/merges. Backtracking enforces at most three entrances and exits.
function connections(from: number, to: number, rng: Random): Edge[] {
  const edges: Edge[] = [],
    exits = Array<number>(from).fill(0),
    entrances = Array<number>(to).fill(0);
  function walk(a: number, b: number): boolean {
    if (exits[a] === 3 || entrances[b] === 3) return false;
    edges.push([a, b]);
    exits[a]++;
    entrances[b]++;
    if (a === from - 1 && b === to - 1) return true;
    for (const [da, db] of rng.shuffle([
      [1, 1],
      [1, 0],
      [0, 1],
    ])) {
      if (a + da < from && b + db < to && walk(a + da, b + db)) return true;
    }
    edges.pop();
    exits[a]--;
    entrances[b]--;
    return false;
  }
  if (!walk(0, 0)) throw new Error("Unable to connect map layers");
  return edges;
}

function topology(rng: Random): MapNode[][] {
  const layers: MapNode[][] = [];
  let width = 1,
    previousWidth = 0;
  for (let floor = 1; floor <= 18; floor++) {
    if (floor === 2 || floor === 17) width = 2 + rng.int(2);
    else if (floor === 18) width = 1;
    else if (floor > 2) {
      const choices = [2, 3, 4, 5].filter(
        (n) => Math.abs(n - width) <= 2 && !(n === width && width === previousWidth),
      );
      previousWidth = width;
      width = choices[rng.int(choices.length)];
    }
    layers.push(
      Array.from({ length: width }, (_, i) => ({
        id: `n${floor}-${i}`,
        floor,
        x: 0,
        kind: "battle",
        next: [],
      })),
    );
  }
  for (let floor = 0; floor < layers.length - 1; floor++) {
    const from = layers[floor],
      to = layers[floor + 1];
    const targetDensity = 1.25 + rng.next() * 0.5;
    let best: Edge[] = [],
      bestScore = Infinity;
    for (let attempt = 0; attempt < 20; attempt++) {
      const edges = connections(from.length, to.length, rng);
      const outgoing = from.map((_, i) => edges.filter(([a]) => a === i).map(([, b]) => b));
      let score = Math.abs(edges.length / from.length - targetDensity);
      // Penalize a fork immediately reconverging. Different choices should remain
      // separate for several visits, rather than forming chains of tiny diamonds.
      for (const parent of layers[floor - 1] ?? []) {
        const children = parent.next.map((id) => from.findIndex((n) => n.id === id));
        for (let a = 0; a < children.length; a++)
          for (let b = a + 1; b < children.length; b++) {
            const left = outgoing[children[a]],
              right = outgoing[children[b]];
            if (left.length === 1 && right.length === 1 && left[0] === right[0]) score += 5;
            else score += left.filter((id) => right.includes(id)).length * 0.35;
          }
      }
      if (score < bestScore) {
        bestScore = score;
        best = edges;
      }
    }
    for (const [a, b] of best) from[a].next.push(to[b].id);
  }
  return layers;
}

function assignEvents(layers: MapNode[][], rng: Random) {
  // Seven encounters plus the Boss on every route. Random extra event gaps move
  // encounter positions, while preventing consecutive mandatory combat layers.
  const gaps = Array<number>(8).fill(0);
  for (let i = 0; i < 2; i++) gaps[rng.int(gaps.length)]++;
  const battles: number[] = [];
  let floor = 2 + gaps[0];
  for (let i = 0; i < 7; i++) {
    battles.push(floor);
    floor += 2 + gaps[i + 1];
  }
  const eliteFloors = [battles[2], battles[5]];
  for (const layer of layers) {
    const depth = layer[0].floor;
    if (depth === 18) {
      layer[0].kind = "boss";
      continue;
    }
    if (battles.includes(depth)) {
      if (eliteFloors.includes(depth)) layer[rng.int(layer.length)].kind = "elite";
      continue;
    }
    if (depth === 1) {
      layer[0].kind = rng.int(2) ? "cost" : "tribe";
      continue;
    }
    const parents = layers[depth - 2];
    let best: NodeKind[] = [],
      bestScore = Infinity;
    // Exhaustive assignment is tiny (at most 5!): event choices on each layer
    // are distinct, and consecutive refinement of the same kind is minimized.
    function assign(chosen: NodeKind[], remaining: NodeKind[]) {
      if (chosen.length === layer.length) {
        if (depth === 17 && !chosen.includes("upgrade")) return;
        let score = 0;
        for (let i = 0; i < layer.length; i++)
          for (const parent of parents) {
            if (parent.next.includes(layer[i].id) && parent.kind === chosen[i])
              score += chosen[i] === "remove" ? 10 : 2;
          }
        if (score < bestScore) {
          bestScore = score;
          best = [...chosen];
        }
        return;
      }
      for (const kind of remaining)
        assign(
          [...chosen, kind],
          remaining.filter((k) => k !== kind),
        );
    }
    assign([], rng.shuffle(events));
    layer.forEach((node, i) => {
      node.kind = best[i];
    });
  }
}

function mergeEquivalentEncounters(layers: MapNode[][]) {
  // Same battle with the same exits has no decision value. Redirect all incoming
  // edges before removing it; event choices already have distinct core effects.
  for (let floor = layers.length - 2; floor > 0; floor--) {
    const signatures = new Map<string, MapNode>();
    layers[floor] = layers[floor].filter((node) => {
      if (node.kind !== "battle") return true;
      const signature = [...node.next].sort().join(",");
      const kept = signatures.get(signature);
      if (!kept) {
        signatures.set(signature, node);
        return true;
      }
      for (const parent of layers[floor - 1])
        parent.next = [...new Set(parent.next.map((id) => (id === node.id ? kept.id : id)))];
      return false;
    });
  }
}

function eliteRewards(layers: MapNode[][], rng: Random): Map<string, NodeKind> {
  const nodes = layers.flat(),
    byId = new Map(nodes.map((n) => [n.id, n]));
  return new Map(
    nodes
      .filter((n) => n.kind === "elite")
      .map((elite) => {
        const next = elite.next.map((id) => byId.get(id)!);
        const choices: NodeKind[] = ["upgrade", "transfer"];
        const kind = rng
          .shuffle(choices)
          .sort(
            (a, b) =>
              next.filter((n) => n.kind === a).length - next.filter((n) => n.kind === b).length,
          )[0];
        return [elite.id, kind];
      }),
  );
}

function layout(layers: MapNode[][], rng: Random, rewards: Map<string, NodeKind>): MapNode[] {
  const nodes = layers.flat(),
    byId = new Map(nodes.map((node) => [node.id, node]));
  const anchors = new Map<string, number>();
  let center = 0.5;
  for (const layer of layers) {
    center = clamp(center + (rng.next() - 0.5) * 0.24, 0.34, 0.66);
    const span =
      layer.length === 1 ? 0 : Math.max((layer.length - 1) * 0.17, 0.28 + rng.next() * 0.48);
    const left = clamp(center - span / 2, 0.09, 0.91 - span);
    const gaps = Array.from({ length: layer.length - 1 }, () => 1 + rng.next() * 0.45);
    const total = gaps.reduce((sum, gap) => sum + gap, 0);
    let offset = 0;
    for (let i = 0; i < layer.length; i++) {
      layer[i].x = layer.length === 1 ? 0.5 : left + (offset / total) * span;
      anchors.set(layer[i].id, layer[i].x);
      offset += gaps[i] ?? 0;
    }
  }
  // Relax toward connected neighbors, retaining a seed-specific envelope and
  // ordered minimum spacing so labels fit even on the narrow map canvas.
  const parents = new Map(
    nodes.map((node) => [node.id, nodes.filter((n) => n.next.includes(node.id))]),
  );
  for (let pass = 0; pass < 10; pass++)
    for (const layer of pass % 2 ? [...layers].reverse() : layers) {
      if (layer.length === 1) continue;
      for (const node of layer) {
        const neighbors = [...parents.get(node.id)!, ...node.next.map((id) => byId.get(id)!)];
        const mean = neighbors.reduce((sum, n) => sum + n.x, 0) / neighbors.length;
        node.x = anchors.get(node.id)! * 0.55 + mean * 0.45;
      }
      const spacing = 0.16;
      layer[0].x = Math.max(0.09, layer[0].x);
      for (let i = 1; i < layer.length; i++)
        layer[i].x = Math.max(layer[i].x, layer[i - 1].x + spacing);
      layer.at(-1)!.x = Math.min(0.91, layer.at(-1)!.x);
      for (let i = layer.length - 2; i >= 0; i--)
        layer[i].x = Math.min(layer[i].x, layer[i + 1].x - spacing);
    }
  let y = 62;
  const bonuses: MapNode[] = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    for (const node of layer) node.y = y + (rng.next() - 0.5) * 32;
    const elite = layer.find((node) => node.kind === "elite");
    const gap = 150 + rng.next() * 52 + (elite ? 130 : 0);
    if (elite) {
      const kind = rewards.get(elite.id)!;
      const bonus: MapNode = {
        id: `${elite.id}-bonus`,
        floor: elite.floor + 0.5,
        x: elite.x,
        y: y + gap / 2,
        kind,
        next: [...elite.next],
        bonus: true,
      };
      elite.next = [bonus.id];
      bonuses.push(bonus);
    }
    y += gap;
  }
  // Insert the exclusive reward inside the elite's outgoing corridor. Keeping
  // it directly below the elite can obstruct a neighboring route drifting across
  // the map; following the corridor preserves the planar network instead.
  for (const bonus of bonuses) {
    const elite = byId.get(bonus.id.replace("-bonus", ""))!;
    const next = bonus.next.map((id) => byId.get(id)!);
    const from = { x: elite.x, y: elite.y! };
    const to = {
      x: next.reduce((sum, n) => sum + n.x, 0) / next.length,
      y: next.reduce((sum, n) => sum + n.y!, 0) / next.length,
    };
    function pointAtY(a: { x: number; y: number }, b: { x: number; y: number }, at: number) {
      let low = 0,
        high = 1;
      for (let i = 0; i < 18; i++) {
        const t = (low + high) / 2;
        if (mapCurvePoint(a, b, t).y < at) low = t;
        else high = t;
      }
      return mapCurvePoint(a, b, (low + high) / 2);
    }
    const neighbors = layers[elite.floor - 1]
      .filter((n) => n !== elite)
      .flatMap((n) =>
        n.next.map((id) => ({
          from: { x: n.x, y: n.y! },
          to: { x: byId.get(id)!.x, y: byId.get(id)!.y! },
        })),
      );
    const samples = neighbors.flatMap((edge) =>
      Array.from({ length: 81 }, (_, i) => mapCurvePoint(edge.from, edge.to, i / 80)),
    );
    let bestScore = -Infinity;
    const middle = bonus.y!;
    // Maximize clearance on a compact canvas. Euclidean clearance
    // matters here: horizontal separation alone fails on a steep diagonal.
    for (let at = from.y + 96; at <= Math.min(...next.map((n) => n.y!)) - 96; at += 12) {
      const desired = pointAtY(from, to, at).x;
      const crossings = neighbors.map((edge) => pointAtY(edge.from, edge.to, at).x);
      const left = Math.max(0.025, ...crossings.filter((x) => x < desired));
      const right = Math.min(0.975, ...crossings.filter((x) => x > desired));
      for (const x of [desired, desired - 0.025, desired + 0.025, (left + right) / 2]) {
        if (x < 0.09 || x > 0.91 || x - left < 0.045 || right - x < 0.045) continue;
        const clearance = Math.min(...samples.map((p) => Math.hypot((p.x - x) * 480, p.y - at)));
        const score = clearance - Math.abs(at - middle) * 0.04 - Math.abs(x - desired) * 60;
        if (score > bestScore) {
          bestScore = score;
          bonus.x = x;
          bonus.y = at;
        }
      }
    }
  }
  return [...nodes, ...bonuses].sort((a, b) => a.floor - b.floor || a.x - b.x);
}

export function generateMap(seed: number): MapNode[] {
  const layers = topology(createRandom(deriveSeed(seed, "map:topology")));
  assignEvents(layers, createRandom(deriveSeed(seed, "map:events")));
  mergeEquivalentEncounters(layers);
  const rewards = eliteRewards(layers, createRandom(deriveSeed(seed, "map:events:elite")));
  return layout(layers, createRandom(deriveSeed(seed, "map:layout")), rewards);
}
