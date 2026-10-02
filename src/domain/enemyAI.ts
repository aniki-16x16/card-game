import { ENEMIES } from "../data/enemies.ts";
import type { EnemyProfile } from "../data/enemies.ts";
import { creature, sigils, normalCost } from "./cards.ts";
import { GROWTH_FORMS } from "../data/cards.ts";
import type { Card, Sigil } from "./cards.ts";
import type { Battle, Intent, Unit } from "./game.ts";
import { attackPower, intrinsicAttack } from "./combatStats.ts";
import { createRandom, deriveSeed } from "./random.ts";

export { ENEMIES };
export type { EnemyProfile };
export type EnemyAI = {
  profile: EnemyProfile;
  hand: Card[];
  drawnRound: number;
  plannedRound?: number;
};
const has = (card: Card, sigil: Sigil) => sigils(card).includes(sigil);
const living = (unit: Unit | null): unit is Unit => !!unit && unit.hp > 0;
const weights = {
  pack: { offense: 2, defense: 1.1, health: 0.25 },
  colony: { offense: 1.4, defense: 1.2, health: 0.3 },
  nursery: { offense: 1, defense: 1.3, health: 0.35 },
  sky: { offense: 2.1, defense: 0.8, health: 0.2 },
  reef: { offense: 2.4, defense: 0.5, health: 0.2 },
  march: { offense: 1.6, defense: 1, health: 0.25 },
  bulwark: { offense: 0.9, defense: 2.6, health: 0.65 },
  renewal: { offense: 1.1, defense: 1.5, health: 0.4 },
} satisfies Record<EnemyProfile, { offense: number; defense: number; health: number }>;

export function enemyCostCeiling(round: number): number {
  return round <= 3 ? 1 : round < 8 ? 2 : 3;
}
export function enemyProfile(seed: number, encounter: number): EnemyProfile {
  // Cycle through a seeded permutation, so consecutive encounters cannot repeat.
  const profiles = createRandom(deriveSeed(seed, "enemy:profiles")).shuffle(
    Object.keys(ENEMIES) as EnemyProfile[],
  );
  return profiles[Math.max(0, encounter - 1) % profiles.length];
}
export function createEnemy(
  seed: number,
  encounter: number,
  profile = enemyProfile(seed, encounter),
) {
  const cards = createRandom(deriveSeed(seed, `enemy:deck:${encounter}:${profile}`)).shuffle(
    ENEMIES[profile].deck.map((species, i) => creature(species, `enemy-${encounter}-${i}`)),
  );
  // The first three turns have low-cost options; the physical deck stays unchanged.
  while (cards.slice(0, 5).filter((card) => card.cost <= 1).length < 3) {
    const slot = cards.slice(0, 5).findIndex((card) => card.cost > 1);
    const index = cards.findIndex((card, index) => index >= 5 && card.cost <= 1);
    if (index < 0) break;
    [cards[slot], cards[index]] = [cards[index], cards[slot]];
  }
  return {
    ai: { profile, hand: cards.slice(0, 5), drawnRound: 1 } satisfies EnemyAI,
    deck: cards.slice(5),
  };
}

function asUnit(card: Card): Unit {
  const { returnState, ...base } = normalCost(card);
  return {
    ...base,
    hp: returnState?.hp ?? base.health,
    used: returnState?.used ?? [],
    age: returnState?.age ?? 0,
    ...(returnState?.pushDirection ? { pushDirection: returnState.pushDirection } : {}),
    ...(returnState?.rush ? { rush: true } : {}),
  };
}
function flying(state: Battle, side: "enemy" | "player", row: number, col: number) {
  const unit = state[side][row][col];
  return (
    !!unit &&
    has(unit, "flying") &&
    !state[side === "enemy" ? "player" : "enemy"].some((rank) => {
      const web = rank[col];
      return living(web) && has(web, "web");
    })
  );
}
function targetRows(
  state: Battle,
  side: "enemy" | "player",
  row: number,
  col: number,
  targetCol: number,
) {
  const unit = state[side][row][col]!,
    other = side === "enemy" ? "player" : "enemy";
  const targetable = (r: number) => {
    const target = state[other][r][targetCol];
    return living(target) && !target.submerged;
  };
  if (has(unit, "dive")) return targetable(1) && !flying(state, other, 1, targetCol) ? [1] : [];
  if (flying(state, side, row, col))
    return [0, 1].filter((r) => targetable(r) && flying(state, other, r, targetCol));
  return targetable(0) ? [0, ...(targetable(1) ? [1] : [])] : [];
}
function attackColumns(unit: Card, col: number) {
  return (
    has(unit, "trisplit")
      ? [col - 1, col, col + 1]
      : has(unit, "split")
        ? [col - 1, col + 1]
        : [col]
  ).filter((c) => c >= 0 && c < 5);
}
// Estimate the visible board only; never inspect the player's hand or either player deck.
function offense(state: Battle, row: number, col: number) {
  const unit = state.enemy[row][col]!;
  if (row === 1 && !has(unit, "ranged")) return { score: 0, lethal: false };
  let score = 0,
    scale = 0;
  for (const c of attackColumns(unit, col)) {
    const r = targetRows(state, "enemy", row, col, c)[0],
      target = r === undefined ? null : state.player[r][c];
    let power = attackPower(state, "enemy", row, col);
    if (target && target.hp < target.health && has(unit, "hunt")) power += 2;
    if (target && has(target, "flying") && has(unit, "birdcatcher")) power += 2;
    if (power > 0 && has(unit, "blood")) {
      if (unit.hp <= 1) continue;
      power += 2;
    }
    if (has(unit, "stealth") && !unit.used?.includes("stealth")) power *= 2;
    if (!target) {
      // A visible burrower can intercept ground attacks on a physically empty square.
      const interceptRow = has(unit, "dive") ? 1 : 0;
      const intercepted =
        (has(unit, "dive") || !flying(state, "enemy", row, col)) &&
        !state.player[interceptRow][c] &&
        state.player.flat().some((u) => living(u) && !u.submerged && has(u, "burrow"));
      if (intercepted) score += power;
      else {
        scale += power;
        score += power * 1.8;
      }
    } else {
      const damage = Math.max(0, power - (has(target, "armor") ? 1 : 0));
      score += Math.min(target.hp, damage) * 1.1;
      if (damage > 0 && (damage >= target.hp || has(unit, "poison")))
        score += 2 + intrinsicAttack(target) * 0.7;
      if (has(target, "thorns") && unit.hp <= 1) score -= 3;
    }
  }
  return { score, lethal: scale >= 10 + state.balance };
}
function pressure(state: Battle, row: number, col: number) {
  let blocked = 0,
    danger = 0;
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 5; c++) {
      const attacker = state.player[r][c];
      if (
        !living(attacker) ||
        attacker.submerged ||
        (r === 1 && !has(attacker, "ranged")) ||
        !attackColumns(attacker, c).includes(col)
      )
        continue;
      const targets = targetRows(state, "player", r, c, col);
      if (!targets.includes(row)) continue;
      const power = attackPower(state, "player", r, c);
      if (targets[0] === row) danger += power;
      // A rear melee target alone never stops an ordinary ground attack.
      if (targets[0] === row) blocked += power;
    }
  return { blocked, danger };
}
function signature(state: Battle, unit: Unit, row: number, col: number, profile: EnemyProfile) {
  const rank = state.enemy[row],
    front = state.enemy[0][col];
  const adjacent = [col - 1, col + 1]
    .filter((c) => c >= 0 && c < 5)
    .map((c) => rank[c])
    .filter(living);
  const allies = rank.filter(living).filter((ally) => ally.id !== unit.id);
  let score = 0;
  if (has(unit, "leader"))
    score += adjacent.reduce((sum, ally) => sum + (ally.attack > 0 ? 2.5 : 1), 0);
  if (has(unit, "support")) score += row === 1 && living(front) && front.attack > 0 ? 5 : -2;
  if (has(unit, "colony"))
    score +=
      allies.filter((ally) => ally.tribe === unit.tribe).length * (profile === "colony" ? 3 : 1);
  score +=
    allies.filter((ally) => ally.tribe === unit.tribe && has(ally, "colony")).length *
    (profile === "colony" ? 4 : 1.5);
  if (has(unit, "catalyst")) {
    const growing = adjacent.filter(
      (ally) =>
        (has(ally, "growth") && !ally.used?.includes("growth")) ||
        (has(ally, "metamorph") && !ally.used?.includes("metamorph")),
    );
    score +=
      growing.reduce(
        (sum, ally) => sum + (has(ally, "growth") || (ally.age ?? 0) >= 1 ? 7 : 3),
        0,
      ) * (profile === "nursery" ? 1.5 : 1);
    if (!growing.length) score -= 4;
  }
  if (
    (has(unit, "growth") && !unit.used?.includes("growth")) ||
    (has(unit, "metamorph") && !unit.used?.includes("metamorph"))
  ) {
    score += profile === "nursery" ? 5 : 1.5;
    if (row === 1) score += living(front) ? 4 : 2;
    if (GROWTH_FORMS[unit.species]) score += 1;
  }
  if (has(unit, "porter")) score += profile === "colony" ? 3.5 : 1.5;
  if (has(unit, "kin"))
    score += state.enemyDeck.some((card) => card.tribe === unit.tribe)
      ? profile === "renewal"
        ? 5
        : 2
      : -1;
  if (has(unit, "search")) score += state.enemyDeck.length ? (profile === "renewal" ? 3 : 1) : -1;
  if (has(unit, "rebirth")) score += profile === "renewal" ? 2.5 : 1;
  if (has(unit, "recall") && profile === "renewal") score += 1.5;
  if (has(unit, "reinforce")) score -= 2; // Retain a free responder unless its board role is better.
  if (has(unit, "nest")) score += row === 0 && !state.enemy[1][col] ? 3 : 0;
  if (has(unit, "ranged")) score += row === 1 ? 3 : -0.5;
  if (profile === "sky" && flying(state, "enemy", row, col)) score += 2;
  if (
    profile === "pack" &&
    has(unit, "hunt") &&
    state.player.flat().some((u) => living(u) && u.hp < u.health)
  )
    score += 2;
  if (profile === "bulwark") {
    if (has(unit, "armor")) score += 2;
    if (has(unit, "thorns")) score += 1.5;
    if (has(unit, "ambush") && row === 0) score += 2;
  }
  if (has(unit, "migrate") || has(unit, "shove")) {
    const direction = unit.pushDirection ?? 1;
    const moving = has(unit, "shove")
      ? [col + direction, col + 2 * direction, col + 3 * direction, col + 4 * direction].some(
          (c) => c >= 0 && c < 5 && !rank[c],
        )
      : [col - 1, col + 1].some((c) => c >= 0 && c < 5 && !rank[c]);
    score += moving ? (profile === "march" ? 3 : 0.5) : -3;
    if (moving && has(unit, "rush")) score += 2;
    if (moving) score += adjacent.filter((ally) => has(ally, "follow")).length * 2;
  }
  if (has(unit, "follow"))
    score +=
      adjacent.filter((ally) => has(ally, "migrate") || has(ally, "shove")).length *
      (profile === "march" ? 3 : 1);
  return score;
}
export function scoreEnemyPlacement(
  state: Battle,
  card: Card,
  row: number,
  col: number,
  profile = state.enemyAI?.profile ?? "pack",
): number {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 1 || col < 0 || col > 4)
    return -Infinity;
  const occupied = state.enemy[row][col];
  if (occupied) {
    // Entry follows the player attack phase: a visibly doomed front can make room.
    // The real resolver still requires a free square and never overwrites a survivor.
    if (
      row !== 0 ||
      state.enemy[1][col] ||
      has(occupied, "tail") ||
      pressure(state, 0, col).danger - (has(occupied, "armor") ? 1 : 0) < occupied.hp
    )
      return -Infinity;
  }
  const unit = asUnit(card);
  if (unit.hp <= 0) return -Infinity;
  const enemy = state.enemy.map((rank) => [...rank]);
  enemy[row][col] = unit;
  const projected = { ...state, enemy },
    weight = weights[profile];
  const attack = offense(projected, row, col),
    threat = pressure(projected, row, col);
  // Submerged and returning attackers will vacate the defensive role before the next player attack.
  const stays = has(unit, "submerge") || has(unit, "recall") || has(unit, "shortlived") ? 0.15 : 1;
  const protection = threat.blocked * stays * (1 + Math.max(0, state.balance) / 5);
  const armor = has(unit, "armor") ? 1 : 0;
  const survives = Math.max(0, unit.hp - Math.max(0, threat.danger - armor));
  return (
    (attack.lethal ? 1000 : 0) +
    attack.score * weight.offense +
    protection * weight.defense +
    unit.hp * weight.health +
    Math.min(3, survives) * 0.2 +
    signature(projected, unit, row, col, profile) -
    (row === 1 && !has(unit, "ranged") ? intrinsicAttack(unit) * 0.45 : 0) -
    (has(unit, "blood") && unit.hp <= 1 ? 12 : 0)
  );
}
function bestPlacement(state: Battle, cards: readonly Card[]) {
  let best: { card: Card; row: number; col: number; score: number } | undefined;
  for (const card of cards)
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++) {
        const score =
          scoreEnemyPlacement(state, card, row, col) +
          (deriveSeed(
            state.mapSeed,
            `enemy:tie:${state.encounter}:${state.round}:${card.id}:${row}:${col}`,
          ) /
            0x100000000) *
            0.1;
        if (Number.isFinite(score) && (!best || score > best.score))
          best = { card, row, col, score };
      }
  return best;
}
export function chooseEnemySearch(state: Battle): Card | undefined {
  const affordable = state.enemyDeck.filter((card) => card.cost <= enemyCostCeiling(state.round));
  const pool = affordable.length ? affordable : state.enemyDeck;
  return (
    bestPlacement(state, pool)?.card ??
    [...pool].sort(
      (a, b) => intrinsicAttack(b) + b.health * 0.4 - intrinsicAttack(a) - a.health * 0.4,
    )[0]
  );
}
// Mutates only a rule operation's private battle clone. The announced intent is locked for this round.
export function planEnemyTurn(state: Battle): void {
  const ai = state.enemyAI;
  if (!ai || state.status !== "playing" || ai.plannedRound === state.round) return;
  ai.plannedRound = state.round;
  // Recover an entry whose two landing squares were blocked; cards are never discarded for a full board.
  for (const intent of state.intents)
    if (!ai.hand.some((card) => card.id === intent.card.id)) ai.hand.push(intent.card);
  state.intents = [];
  if (ai.drawnRound < state.round) {
    if (state.enemyDeck.length) ai.hand.push(state.enemyDeck.shift()!);
    ai.drawnRound = state.round;
  }
  const candidate = bestPlacement(
    state,
    ai.hand.filter((card) => card.cost <= enemyCostCeiling(state.round)),
  );
  if (!candidate) return;
  ai.hand = ai.hand.filter((card) => card.id !== candidate.card.id);
  state.intents = [
    {
      card: candidate.card,
      row: candidate.row,
      col: candidate.col,
      costGated: true,
    } satisfies Intent,
  ];
}
