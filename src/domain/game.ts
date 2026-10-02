import { MAP_SEED, createRandom, deriveSeed } from "./random.ts";
import { templates, makeCard, creature, makeSquirrel, sigils, load, SIGILS } from "./cards.ts";
import type { Card, Sigil } from "./cards.ts";
import { STARTER_DECK } from "../data/starterDeck.ts";
import { BattleEngine, SearchPause } from "./battleEngine.ts";
import { createEnemy, planEnemyTurn, enemyCostCeiling } from "./enemyAI.ts";
import type { EnemyAI, EnemyProfile } from "./enemyAI.ts";
export { enemyCostCeiling } from "./enemyAI.ts";
export * from "./cards.ts";
export { attackPower, intrinsicAttack } from "./combatStats.ts";
export type Unit = Card & {
  hp: number;
  age?: number;
  used?: Sigil[];
  base?: Card;
  submerged?: boolean;
  pushDirection?: 1 | -1;
  rush?: boolean;
  followedRound?: number;
  bloodBonus?: number;
};
export type Board = (Unit | null)[][];
export type Intent = { card: Card; row: number; col: number; costGated?: boolean };
export type Summon = { cardId: string; sacrifices: string[]; paid: boolean; error?: string };
export type DrawPile = "deck" | "squirrelDeck";
export type DeathCause = "killed" | "sacrificed" | "expired";
type BattleOperation =
  | { kind: "round" }
  | { kind: "deploy"; id: string; row: number; col: number }
  | { kind: "sacrifice"; id: string };
export type Battle = {
  mapSeed: number;
  nextId: number;
  round: number;
  balance: number;
  difficulty: "normal" | "elite" | "boss";
  player: Board;
  enemy: Board;
  hand: Card[];
  deck: Card[];
  enemyDeck: Card[];
  enemyAI?: EnemyAI;
  searches: { sourceId: string; name: string }[];
  searchAnswers?: string[];
  continuation?: { initial: Battle; operation: BattleOperation; answers: string[]; frames: number };
  squirrelDeck: Card[];
  canDraw: boolean;
  summon: Summon | null;
  intents: Intent[];
  log: string[];
  status: "playing" | "won" | "lost";
  fatigue: number;
  encounter: number;
};
export function initialDeck(): Card[] {
  return STARTER_DECK.map((species, i) => creature(species, `starter-${i}`));
}
export const emptyBoard = (): Board => [Array(5).fill(null), Array(5).fill(null)];
export function transfer(
  deck: Card[],
  donorId: string,
  targetId: string,
): { deck: Card[]; error?: string; discarded?: Sigil[] } {
  const donor = deck.find((c) => c.id === donorId),
    target = deck.find((c) => c.id === targetId);
  const fail = (error: string) => ({ deck, error });
  if (!donor || !target || donorId === targetId) return fail("请选择不同的供体和受体。");
  if (deck.length <= 6) return fail("牌组至少需要保留 6 张卡。");
  if (!sigils(donor).length) return fail("贡品没有印记。");
  const next = { ...target, capacity: 6, added: [...target.added] };
  const discarded: Sigil[] = [];
  for (const sigil of sigils(donor)) {
    if (sigils(next).includes(sigil)) continue;
    if (next.added.length >= 4 || load(next) + SIGILS[sigil].weight > 6) {
      discarded.push(sigil);
      continue;
    }
    next.added.push(sigil);
  }
  return {
    discarded,
    deck: deck.filter((c) => c.id !== donorId).map((c) => (c.id === targetId ? next : c)),
  };
}
export function getIntents(
  round: number,
  encounter: number,
  mapSeed = MAP_SEED,
  difficulty: Battle["difficulty"] = "normal",
): Intent[] {
  if (!Number.isSafeInteger(round) || round < 1) return [];
  // Standalone empty-board preview; live combat plans against its actual board.
  const state = startBattle([], encounter, mapSeed, difficulty);
  for (let r = 2; r <= round; r++) {
    state.intents = [];
    if (!state.enemyAI!.hand.length && !state.enemyDeck.length) return [];
    state.round = r;
    planEnemyTurn(state);
  }
  return state.intents;
}
export const awaitingSearch = (state: Battle) =>
  state.status === "playing" && !!state.searches?.length && !!state.deck.length;
export function chooseSearch(state: Battle, cardId: string): Battle {
  return planSearch(state, cardId).state;
}
export function planSearch(
  state: Battle,
  cardId: string,
): { state: Battle; frames: BattleFrame[] } {
  if (!awaitingSearch(state) || !state.deck.some((card) => card.id === cardId))
    return { state, frames: [] };
  if (state.continuation) {
    const continuation = state.continuation,
      frames: BattleFrame[] = [];
    const next = executeOperation(
      continuation.initial,
      continuation.operation,
      (action, snapshot) => frames.push({ action, state: snapshot }),
      [...continuation.answers, cardId],
      continuation.frames,
    );
    return { state: next, frames };
  }
  return { state: chooseSearchDirect(state, cardId), frames: [] };
}
function chooseSearchDirect(state: Battle, cardId: string): Battle {
  if (!awaitingSearch(state)) return state;
  const index = state.deck.findIndex((card) => card.id === cardId);
  if (index < 0) return state;
  const next = structuredClone(state),
    [card] = next.deck.splice(index, 1);
  next.hand.push(card);
  next.searches.shift();
  if (!next.deck.length) next.searches = [];
  next.log.unshift(`检索获得 ${card.name}。`);
  return next;
}
// Replay deterministic, side-effect-free rule operations with the recorded choices.
// Only new frames are played; a choice can pause any nested deployment/death chain.
function executeOperation(
  initial: Battle,
  operation: BattleOperation,
  record?: Recorder,
  answers: string[] = [],
  skipFrames = 0,
): Battle {
  let frameCount = 0;
  const output: BattleFrame[] = [];
  const flush = () => {
    for (const frame of output) record?.(frame.action, frame.state);
  };
  const input = { ...structuredClone(initial), searchAnswers: [...answers] };
  const recorder: Recorder = (action, snapshot) => {
    if (frameCount++ >= skipFrames) {
      delete snapshot.searchAnswers;
      output.push({ action, state: snapshot });
    }
  };
  try {
    const result =
      operation.kind === "round"
        ? resolveRoundCore(input, recorder)
        : operation.kind === "deploy"
          ? deployCore(input, operation.id, operation.row, operation.col, recorder)
          : markSacrificeCore(input, operation.id, recorder);
    // Preserve identity on invalid actions, so callers never animate a no-op.
    if (result === input) return initial;
    delete result.searchAnswers;
    if (!result.deck.length) result.searches = [];
    if (!(operation.kind === "sacrifice" && result.summon?.error)) flush();
    return result;
  } catch (error) {
    if (!(error instanceof SearchPause)) throw error;
    const result = error.state;
    delete result.searchAnswers;
    result.continuation = {
      initial: structuredClone(initial),
      operation,
      answers: [...answers],
      frames: frameCount,
    };
    flush();
    return result;
  }
}
export function startBattle(
  cards: Card[],
  encounter = 1,
  mapSeed = MAP_SEED,
  difficulty: Battle["difficulty"] = "normal",
  profile?: EnemyProfile,
): Battle {
  const shuffled = createRandom(deriveSeed(mapSeed, `deck:${encounter}`)).shuffle(cards);
  const squirrels = Array.from({ length: 10 }, (_, i) => makeSquirrel(`squirrel-${i}`));
  const enemy = createEnemy(mapSeed, encounter, profile);
  const state: Battle = {
    mapSeed,
    nextId: 1,
    round: 1,
    balance: 0,
    difficulty,
    player: emptyBoard(),
    enemy: emptyBoard(),
    hand: [...structuredClone(shuffled.slice(0, 5)), squirrels[0]],
    deck: structuredClone(shuffled.slice(5)),
    enemyDeck: enemy.deck,
    enemyAI: enemy.ai,
    searches: [],
    squirrelDeck: squirrels.slice(1),
    canDraw: true,
    summon: null,
    intents: [],
    log: ["选择牌堆抽牌。0 费生物可直接部署；其他生物需要献祭己方单位。"],
    status: "playing",
    fatigue: 0,
    encounter,
  };
  planEnemyTurn(state);
  return state;
}
export function getRewards(mapSeed: number, encounter: number): Card[] {
  return createRandom(deriveSeed(mapSeed, `rewards:${encounter}`))
    .shuffle(
      templates.map((card, i) => (card.species === "squirrel" ? -1 : i)).filter((i) => i >= 0),
    )
    .slice(0, 3)
    .map((index, i) => makeCard(index, `reward-${encounter}-${i}`));
}
export const sacrificeValue = (card: Card): number => (sigils(card).includes("triple") ? 3 : 1);
export function sacrificePoints(state: Battle, ids?: readonly string[]): number {
  return state.player
    .flat()
    .reduce(
      (sum, unit) => sum + (unit && (!ids || ids.includes(unit.id)) ? sacrificeValue(unit) : 0),
      0,
    );
}
export function selectSummon(state: Battle, id: string | null): Battle {
  if (state.status !== "playing" || state.summon?.paid || awaitingSearch(state)) return state;
  if (id !== null && !state.hand.some((card) => card.id === id)) return state;
  return { ...state, summon: id === null ? null : { cardId: id, sacrifices: [], paid: false } };
}
export function markSacrifice(state: Battle, id: string): { state: Battle; frames: BattleFrame[] } {
  const frames: BattleFrame[] = [];
  const result = executeOperation(state, { kind: "sacrifice", id }, (action, snapshot) =>
    frames.push({ action, state: snapshot }),
  );
  return { state: result, frames };
}
function markSacrificeCore(state: Battle, id: string, record: Recorder): Battle {
  const summon = state.summon,
    card = state.hand.find((c) => c.id === summon?.cardId);
  if (
    state.status !== "playing" ||
    awaitingSearch(state) ||
    !summon ||
    summon.paid ||
    !card ||
    card.cost === 0 ||
    !state.player.flat().some((u) => u?.id === id)
  )
    return state;
  const s = structuredClone(state),
    next = s.summon!;
  delete next.error;
  next.sacrifices = next.sacrifices.includes(id)
    ? next.sacrifices.filter((mark) => mark !== id)
    : [...next.sacrifices, id];
  const engine = new BattleEngine(s, record, true);
  const hasLandingSlot = s.player
    .flat()
    .some(
      (unit) => !unit || (next.sacrifices.includes(unit.id) && !sigils(unit).includes("undying")),
    );
  if (sacrificePoints(s, next.sacrifices) >= card.cost && hasLandingSlot) {
    next.paid = true;
    for (const mark of next.sacrifices) {
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 5; col++) {
          if (s.player[row][col]?.id === mark) {
            const unit = s.player[row][col]!;
            const survives = sigils(unit).includes("undying");
            if (survives)
              s.log.unshift(`${unit.name} 献祭提供 ${sacrificeValue(unit)} 费，永续祭品使其存活。`);
            if (survives)
              engine.emit({
                kind: "sacrifice",
                target: `player-${row}-${col}`,
                label: `${unit.name} 献祭后存活`,
              });
            else engine.remove("player", row, col, "sacrificed");
          }
        }
    }
    if (s.status === "playing" && s.summon?.paid && !s.player.flat().some((unit) => !unit)) {
      return {
        ...state,
        summon: {
          ...summon,
          sacrifices: [...next.sacrifices],
          error: "补位会占满落点，请调整祭品或先部署补位单位。",
        },
      };
    }
    next.sacrifices = [];
  }
  return s;
}
export function drawCard(state: Battle, pile: DrawPile): Battle {
  if (
    state.status !== "playing" ||
    awaitingSearch(state) ||
    !state.canDraw ||
    state.summon ||
    !state[pile].length
  )
    return state;
  const s = structuredClone(state),
    card = s[pile].shift()!;
  s.hand.push(card);
  s.canDraw = false;
  s.log.unshift(`从${pile === "deck" ? "主牌堆" : "松鼠牌堆"}抽到 ${card.name}。`);
  return s;
}
export function requiresDraw(state: Battle): boolean {
  return (
    state.status === "playing" &&
    state.canDraw &&
    (state.deck.length > 0 || state.squirrelDeck.length > 0)
  );
}
export function deploy(
  state: Battle,
  id: string,
  row: number,
  col: number,
  record?: Recorder,
): Battle {
  return executeOperation(state, { kind: "deploy", id, row, col }, record);
}
function deployCore(
  state: Battle,
  id: string,
  row: number,
  col: number,
  record?: Recorder,
): Battle {
  const card = state.hand.find((c) => c.id === id);
  if (
    state.status !== "playing" ||
    awaitingSearch(state) ||
    !card ||
    state.summon?.cardId !== id ||
    (card.cost > 0 && !state.summon.paid) ||
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    !state.player[row] ||
    col < 0 ||
    col > 4 ||
    state.player[row][col]
  )
    return state;
  const next = structuredClone(state);
  next.hand = next.hand.filter((c) => c.id !== id);
  next.summon = null;
  const engine = new BattleEngine(next, record, true);
  engine.place(card, "player", row, col, "hand-" + id);
  return next;
}
export function planDeploy(
  state: Battle,
  id: string,
  row: number,
  col: number,
): { frames: BattleFrame[]; state: Battle } {
  const frames: BattleFrame[] = [];
  const result = deploy(state, id, row, col, (action, snapshot) =>
    frames.push({ action, state: snapshot }),
  );
  return { frames, state: result };
}
export type BattleAction = {
  kind: "deploy" | "attack" | "hit" | "advance" | "death" | "sacrifice" | "effect";
  source?: string;
  target: string;
  label: string;
  amount?: number;
  cause?: DeathCause;
  route?: "air" | "ground";
};
export type BattleFrame = { action: BattleAction; state: Battle };
export function planRound(state: Battle): { frames: BattleFrame[]; state: Battle } {
  const frames: BattleFrame[] = [];
  const result = resolveRound(state, (action, snapshot) =>
    frames.push({ action, state: snapshot }),
  );
  return { frames, state: result };
}
export type Recorder = (action: BattleAction, state: Battle) => void;
export function resolveRound(state: Battle, record?: Recorder): Battle {
  return executeOperation(state, { kind: "round" }, record);
}
function resolveRoundCore(state: Battle, record?: Recorder): Battle {
  if (
    state.status !== "playing" ||
    awaitingSearch(state) ||
    state.summon?.paid ||
    requiresDraw(state)
  )
    return state;
  const s = structuredClone(state);
  s.summon = null;
  const engine = new BattleEngine(s, record, true);
  const arriving = [...s.intents]
    .filter((intent) => !intent.costGated || intent.card.cost <= enemyCostCeiling(s.round))
    .sort((a, b) => a.col - b.col || b.row - a.row)
    .slice(0, 1);
  engine.cleanup();
  engine.turn("player");
  if (engine.checkEnd()) return s;
  engine.beginTurn("enemy");
  for (const intent of arriving.filter((intent) => s.intents.includes(intent))) {
    const row = !s.enemy[intent.row][intent.col] ? intent.row : 1 - intent.row;
    if (!s.enemy[row][intent.col]) {
      s.intents = s.intents.filter((ready) => ready !== intent);
      engine.place(intent.card, "enemy", row, intent.col, "intent-" + intent.card.id);
    } else s.log.unshift(`第 ${intent.col + 1} 列已满，敌方 ${intent.card.name} 等待落点。`);
  }
  if (engine.checkEnd()) return s;
  engine.turn("enemy");
  if (engine.checkEnd()) return s;
  s.round++;
  s.canDraw = true;
  if (!s.deck.length && !s.squirrelDeck.length) {
    s.canDraw = false;
    s.fatigue++;
    s.balance -= s.fatigue;
    engine.checkEnd();
    s.log.unshift(`两堆牌库耗尽：疲劳造成 ${s.fatigue} 点天平伤害。`);
    engine.emit({
      kind: "hit",
      target: "life-player",
      amount: s.fatigue,
      label: `疲劳伤害 −${s.fatigue}`,
    });
  }
  if (!engine.checkEnd()) {
    engine.startRound();
    planEnemyTurn(s);
  }
  s.log = s.log.slice(0, 60);
  return s;
}
