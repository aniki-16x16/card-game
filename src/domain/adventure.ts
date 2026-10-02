import { initialDeck, transfer, getRewards } from "./game.ts";
import { templates, makeCard, TRIBES } from "./cards.ts";
import type { Card, Tribe } from "./cards.ts";
import { createRandom, deriveSeed, MAP_SEED } from "./random.ts";
import { generateMap } from "./mapGenerator.ts";
import { enemyProfile } from "./enemyAI.ts";
export { generateMap } from "./mapGenerator.ts";

export type NodeKind =
  | "cost"
  | "tribe"
  | "remove"
  | "upgrade"
  | "item"
  | "transfer"
  | "battle"
  | "elite"
  | "boss";
export const NODE_NAMES: Record<NodeKind, string> = {
  cost: "费用选牌",
  tribe: "种族选牌",
  remove: "删卡",
  upgrade: "强化",
  item: "道具",
  transfer: "转移印记",
  battle: "战斗",
  elite: "精英战斗",
  boss: "Boss · 荒野之王",
};
export type MapNode = {
  id: string;
  floor: number;
  x: number;
  y?: number;
  kind: NodeKind;
  next: string[];
  bonus?: boolean;
};
export type Visit = {
  nodeId: string;
  category?: number | Tribe;
  targetId?: string;
  attempts: number;
  stat: "attack" | "health";
  done: boolean;
  message: string;
};
export type Adventure = {
  seed: number;
  deck: Card[];
  nodes: MapNode[];
  path: string[];
  visit: Visit | null;
  safeUpgrades: boolean;
  status: "playing" | "won" | "lost";
};
const combat = (kind: NodeKind) => ["battle", "elite", "boss"].includes(kind);
export { combat as isCombat };

export function battleProfile(run: Adventure) {
  const completed = run.path.filter((id) =>
    combat(run.nodes.find((node) => node.id === id)!.kind),
  ).length;
  return enemyProfile(run.seed, completed + 1);
}

export function newAdventure(seed = MAP_SEED): Adventure {
  return {
    seed,
    deck: initialDeck(),
    nodes: generateMap(seed),
    path: [],
    visit: null,
    safeUpgrades: false,
    status: "playing",
  };
}
export function availableNodes(run: Adventure): string[] {
  if (run.status !== "playing" || run.visit) return [];
  return run.path.length
    ? run.nodes.find((n) => n.id === run.path.at(-1))!.next
    : run.nodes.filter((n) => n.floor === 1).map((n) => n.id);
}
export function getMapReachability(run: Adventure): {
  upcoming: Set<string>;
  reachable: Set<string>;
} {
  const upcoming = new Set(
    run.status !== "playing"
      ? []
      : run.visit
        ? (currentNode(run)?.next ?? [])
        : availableNodes(run),
  );
  const nodes = new Map(run.nodes.map((node) => [node.id, node]));
  const reachable = new Set<string>(),
    pending = [...upcoming];
  while (pending.length) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    const node = nodes.get(id);
    if (!node) continue;
    reachable.add(id);
    pending.push(...node.next);
  }
  return { upcoming, reachable };
}
export function enterNode(run: Adventure, id: string): Adventure {
  if (!availableNodes(run).includes(id)) return run;
  return {
    ...run,
    visit: {
      nodeId: id,
      attempts: 0,
      stat: createRandom(deriveSeed(run.seed, `upgrade-stat:${id}`)).int(2) ? "attack" : "health",
      done: false,
      message: "",
    },
  };
}
export function currentNode(run: Adventure): MapNode | undefined {
  return run.nodes.find((n) => n.id === run.visit?.nodeId);
}
export function finishNode(run: Adventure): Adventure {
  const node = currentNode(run);
  if (!node || run.status !== "playing" || (combat(node.kind) && !run.visit?.done)) return run;
  return {
    ...run,
    path: [...run.path, node.id],
    visit: null,
    status: node.kind === "boss" ? "won" : "playing",
  };
}
export function categoryOptions(run: Adventure): (number | Tribe)[] {
  const node = currentNode(run);
  if (!node || !["cost", "tribe"].includes(node.kind)) return [];
  const rng = createRandom(deriveSeed(run.seed, `categories:${node.id}`));
  return node.kind === "cost"
    ? rng.shuffle([0, 1, 2, 3]).slice(0, 3)
    : rng
        .shuffle(
          (Object.keys(TRIBES) as Tribe[]).filter(
            (tribe) =>
              templates.filter((c) => c.tribe === tribe && c.species !== "squirrel").length >= 3,
          ),
        )
        .slice(0, 3);
}
export function chooseCategory(run: Adventure, category: number | Tribe): Adventure {
  if (
    !run.visit ||
    run.visit.done ||
    run.visit.category !== undefined ||
    !categoryOptions(run).includes(category)
  )
    return run;
  return { ...run, visit: { ...run.visit, category } };
}
export function visitRewards(run: Adventure): Card[] {
  const node = currentNode(run),
    visit = run.visit;
  if (!node || !visit) return [];
  if (combat(node.kind)) return getRewards(deriveSeed(run.seed, node.id), node.floor);
  if (visit.category === undefined) return [];
  const pool = templates
    .map((card, index) => ({ card, index }))
    .filter(
      ({ card }) =>
        card.species !== "squirrel" &&
        (node.kind === "cost" ? card.cost === visit.category : card.tribe === visit.category),
    );
  return createRandom(deriveSeed(run.seed, `cards:${node.id}:${visit.category}`))
    .shuffle(pool)
    .slice(0, 3)
    .map(({ index }, i) => makeCard(index, `pick-${node.id}-${i}`));
}
export function takeReward(run: Adventure, id: string | null): Adventure {
  const node = currentNode(run);
  if (
    !run.visit ||
    !node ||
    (combat(node.kind)
      ? !run.visit.done
      : !["cost", "tribe"].includes(node.kind) ||
        run.visit.category === undefined ||
        run.visit.done)
  )
    return run;
  const card = visitRewards(run).find((c) => c.id === id);
  if (id !== null && !card) return run;
  return finishNode({ ...run, deck: card ? [...run.deck, card] : run.deck });
}
export function removeCard(run: Adventure, id: string): Adventure {
  if (
    currentNode(run)?.kind !== "remove" ||
    run.visit?.done ||
    run.deck.length <= 6 ||
    !run.deck.some((c) => c.id === id)
  )
    return run;
  return {
    ...run,
    deck: run.deck.filter((c) => c.id !== id),
    visit: { ...run.visit!, done: true, message: "卡牌已移除。" },
  };
}
export function transferAtNode(
  run: Adventure,
  donor: string,
  target: string,
): { run: Adventure; error?: string } {
  if (currentNode(run)?.kind !== "transfer" || run.visit?.done)
    return { run, error: "当前不能转移印记。" };
  const result = transfer(run.deck, donor, target);
  if (result.error) return { run, error: result.error };
  return {
    run: {
      ...run,
      deck: result.deck,
      visit: { ...run.visit!, done: true, message: "印记已转移，贡品已消耗。" },
    },
  };
}
export function upgradeRisk(run: Adventure): number {
  return run.safeUpgrades || !run.visit?.attempts ? 0 : run.visit.attempts === 1 ? 1 / 6 : 1 / 3;
}
export function upgradeCard(run: Adventure, id: string): Adventure {
  const visit = run.visit,
    card = run.deck.find((c) => c.id === id);
  if (
    currentNode(run)?.kind !== "upgrade" ||
    !visit ||
    visit.done ||
    visit.attempts >= 3 ||
    !card ||
    (visit.targetId && visit.targetId !== id)
  )
    return run;
  const eaten =
    createRandom(deriveSeed(run.seed, `upgrade:${visit.nodeId}:${visit.attempts}`)).next() <
    upgradeRisk(run);
  const safe = run.safeUpgrades || (eaten && card.species === "viper");
  return {
    ...run,
    safeUpgrades: safe,
    deck: eaten
      ? run.deck.filter((c) => c.id !== id)
      : run.deck.map((c) =>
          c.id === id
            ? { ...c, [visit.stat]: c[visit.stat] + (visit.stat === "attack" ? 1 : 2) }
            : c,
        ),
    visit: {
      ...visit,
      attempts: visit.attempts + 1,
      targetId: id,
      done: eaten || visit.attempts === 2,
      message: eaten
        ? safe && !run.safeUpgrades
          ? "强化者吞下蝰蛇后倒下了。此后，本局所有强化都不再有风险。"
          : `${card.name} 被吃掉，已永久离开牌组。`
        : `${card.name} ${visit.stat === "attack" ? "攻击 +1" : "生命 +2"}。`,
    },
  };
}
export function recordBattle(run: Adventure, result: "won" | "lost"): Adventure {
  if (!run.visit || run.visit.done || !combat(currentNode(run)!.kind)) return run;
  return {
    ...run,
    status: result === "lost" ? "lost" : run.status,
    visit: {
      ...run.visit,
      done: true,
      message: result === "won" ? "战斗胜利。选择奖励或跳过。" : "天平向你倾斜了 10 点。旅程结束。",
    },
  };
}
