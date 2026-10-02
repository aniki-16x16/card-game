import { creature, grownForm, makeToken, sigils, originalForm, normalCost } from "./cards.ts";
import type { Card, Sigil, TokenKind } from "./cards.ts";
import type { Battle, BattleAction, DeathCause, Recorder, Unit } from "./game.ts";
import { attackPower } from "./combatStats.ts";
import { chooseEnemySearch } from "./enemyAI.ts";

type Side = "player" | "enemy";
const other = (side: Side): Side => (side === "player" ? "enemy" : "player");
const has = (card: Card, sigil: Sigil) => sigils(card).includes(sigil);
const slot = (side: Side, row: number, col: number) => `${side}-${row}-${col}`;

export class SearchPause extends Error {
  state: Battle;
  constructor(state: Battle) {
    super("Choose a card from the deck");
    this.state = state;
  }
}

// Each public operation runs on a cloned battle. No global RNG or event state.
export class BattleEngine {
  s: Battle;
  record?: Recorder;
  interactive: boolean;
  private deathDepth = 0;
  private reinforcementChain = new Set<string>();
  private movements: { side: Side; row: number; col: number; followers: string[] }[] = [];
  constructor(state: Battle, record?: Recorder, interactive = false) {
    this.s = state;
    this.record = record;
    this.interactive = interactive;
  }
  emit(action: BattleAction) {
    this.record?.(action, structuredClone(this.s));
  }
  effect(side: Side, row: number, col: number, label: string) {
    this.s.log.unshift(label);
    this.emit({ kind: "effect", target: slot(side, row, col), label });
  }
  checkEnd(): boolean {
    if (this.s.balance >= 10) {
      this.s.balance = 10;
      this.s.status = "won";
    } else if (this.s.balance <= -10) {
      this.s.balance = -10;
      this.s.status = "lost";
    }
    return this.s.status !== "playing";
  }
  find(side: Side, id: string): [number, number] | undefined {
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++) if (this.s[side][row][col]?.id === id) return [row, col];
  }
  token(kind: TokenKind): Card {
    return makeToken(kind, `token-${this.s.encounter}-${this.s.nextId++}`);
  }
  give(side: Side, card: Card, col: number) {
    if (side === "player") this.s.hand.push(card);
    else if (this.s.enemyAI) this.s.enemyAI.hand.push(card);
    else this.s.intents.push({ card, row: 0, col, costGated: true });
    this.s.log.unshift(`${side === "player" ? "我方获得" : "敌方预备"} ${card.name}。`);
  }
  remove(side: Side, row: number, col: number, cause: DeathCause) {
    this.deathDepth++;
    try {
      this.removeUnit(side, row, col, cause);
    } finally {
      if (--this.deathDepth === 0) this.reinforcementChain.clear();
    }
  }
  private removeUnit(side: Side, row: number, col: number, cause: DeathCause) {
    const unit = this.s[side][row][col];
    if (!unit) return;
    const waiting =
      side === "player"
        ? [...this.s.hand]
        : [...(this.s.enemyAI?.hand ?? []), ...this.s.intents.map((intent) => intent.card)];
    const ready = (card: Card) =>
      card.id !== unit.id &&
      card.health > 0 &&
      has(card, "reinforce") &&
      !this.reinforcementChain.has(card.id);
    const reinforcement = side === "player" ? this.s.hand.find(ready) : waiting.find(ready);
    this.s[side][row][col] = null;
    const {
      hp: _hp,
      age: _age,
      used: _used,
      submerged: _submerged,
      pushDirection: _direction,
      rush: _rush,
      followedRound: _followed,
      bloodBonus: _blood,
      returnState: _returned,
      base,
      ...card
    } = unit;
    if (has(unit, "rebirth")) this.give(side, structuredClone(base ?? card), col);
    if (has(unit, "brood")) this.give(side, this.token("larva"), col);
    const reason = cause === "killed" ? "被击杀" : cause === "sacrificed" ? "被献祭" : "自然死亡";
    this.s.log.unshift(`${unit.name} ${reason}。`);
    this.emit({
      kind: "death",
      cause,
      target: slot(side, row, col),
      label: `${unit.name} ${reason}`,
    });
    for (const card of waiting) {
      if (card.id === unit.id || !has(card, "relay") || card.tribe !== unit.tribe || card.cost <= 0)
        continue;
      card.cost--;
      card.costDiscount = (card.costDiscount ?? 0) + 1;
      this.s.log.unshift(`${card.name} 接力，费用降为 ${card.cost}。`);
      this.emit({
        kind: "effect",
        target: side === "player" ? `hand-${card.id}` : slot(side, row, col),
        label: `${card.name} 接力 · ${card.cost} 费`,
      });
    }
    if (cause === "sacrificed") {
      const heir = this.s[side][1][col];
      if (row === 0 && has(unit, "legacy") && heir && heir.hp > 0) {
        heir.attack++;
        heir.health++;
        heir.hp++;
        this.effect(side, 1, col, `${unit.name} 托孤，${heir.name} 获得 +1/+1。`);
      }
      if (has(unit, "ember")) this.effectDamage(other(side), 0, col, 2, `${unit.name} 余烬`);
    }
    if (cause === "killed") {
      for (const owner of ["player", "enemy"] as const)
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < 5; c++) {
            const scavenger = this.s[owner][r][c];
            if (scavenger && scavenger.hp > 0 && has(scavenger, "scavenge")) {
              scavenger.attack++;
              this.effect(owner, r, c, `${scavenger.name} 食腐，攻击 +1。`);
            }
          }
    }
    if (reinforcement && !this.s[side][row][col] && !this.checkEnd()) {
      this.reinforcementChain.add(reinforcement.id);
      if (side === "player") {
        this.s.hand = this.s.hand.filter((card) => card.id !== reinforcement.id);
        if (this.s.summon?.cardId === reinforcement.id) this.s.summon = null;
      } else {
        if (this.s.enemyAI)
          this.s.enemyAI.hand = this.s.enemyAI.hand.filter((card) => card.id !== reinforcement.id);
        this.s.intents = this.s.intents.filter((intent) => intent.card.id !== reinforcement.id);
      }
      this.place(
        reinforcement,
        side,
        row,
        col,
        `${side === "player" ? "hand-" : "intent-"}${reinforcement.id}`,
        `${reinforcement.name} 补位`,
      );
    }
  }
  cleanup() {
    for (const side of ["player", "enemy"] as const)
      for (let col = 0; col < 5; col++)
        for (const row of [1, 0]) {
          const unit = this.s[side][row][col];
          if (unit && unit.hp <= 0) this.remove(side, row, col, "killed");
        }
  }
  // Web suppression is derived from current living board units, never permanently edits sigils.
  flying(side: Side, row: number, col: number): boolean {
    const unit = this.s[side][row][col];
    return (
      !!unit &&
      has(unit, "flying") &&
      !this.s[other(side)].some((rank) => {
        const spider = rank[col];
        return spider && spider.hp > 0 && has(spider, "web");
      })
    );
  }
  private targetable(side: Side, row: number, col: number): boolean {
    const unit = this.s[side][row][col];
    return !!unit && unit.hp > 0 && !unit.submerged;
  }
  private effectDamage(side: Side, row: number, col: number, amount: number, label: string) {
    if (!this.targetable(side, row, col)) return;
    const target = this.s[side][row][col]!;
    target.hp -= amount;
    this.s.log.unshift(`${label} → ${target.name}，造成 ${amount} 点伤害。`);
    this.emit({
      kind: "hit",
      target: slot(side, row, col),
      amount,
      label: `${label} · ${target.name} −${amount}`,
    });
    if (target.hp <= 0) this.remove(side, row, col, "killed");
  }
  private move(
    side: Side,
    fromRow: number,
    fromCol: number,
    row: number,
    col: number,
    label: string,
  ) {
    const unit = this.s[side][fromRow][fromCol];
    if (!unit || this.s[side][row][col]) return;
    const followers = [fromCol - 1, fromCol + 1]
      .filter((c) => c >= 0 && c < 5)
      .map((c) => this.s[side][fromRow][c])
      .filter((ally): ally is Unit => !!ally && ally.hp > 0 && has(ally, "follow"))
      .map((ally) => ally.id);
    this.s[side][fromRow][fromCol] = null;
    this.s[side][row][col] = unit;
    if (fromCol !== col && has(unit, "rush")) unit.rush = true;
    this.movements.push({ side, row: fromRow, col: fromCol, followers });
    this.emit({
      kind: "advance",
      source: slot(side, fromRow, fromCol),
      target: slot(side, row, col),
      label,
    });
  }
  private followMoves() {
    while (this.movements.length) {
      const event = this.movements.shift()!;
      if (this.s[event.side][event.row][event.col]) continue;
      for (const id of event.followers) {
        const from = this.find(event.side, id);
        if (!from || from[0] !== event.row || Math.abs(from[1] - event.col) !== 1) continue;
        const unit = this.s[event.side][from[0]][from[1]]!;
        if (unit.hp <= 0 || unit.submerged || unit.followedRound === this.s.round) continue;
        unit.followedRound = this.s.round;
        this.move(
          event.side,
          from[0],
          from[1],
          event.row,
          event.col,
          `${unit.name} 追随至第 ${event.col + 1} 列`,
        );
        break;
      }
    }
  }
  private intercept(side: Side, row: number, col: number) {
    // Submerged units still occupy their square, so no other unit may overwrite them.
    if (this.s[side][row][col]) return;
    const candidates: { row: number; col: number }[] = [];
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 5; c++) {
        const unit = this.s[side][r][c];
        if (unit && this.targetable(side, r, c) && has(unit, "burrow"))
          candidates.push({ row: r, col: c });
      }
    candidates.sort(
      (a, b) =>
        Math.abs(a.col - col) - Math.abs(b.col - col) ||
        Math.abs(a.row - row) - Math.abs(b.row - row) ||
        a.col - b.col ||
        a.row - b.row,
    );
    const from = candidates[0];
    if (!from) return;
    const unit = this.s[side][from.row][from.col]!;
    this.move(side, from.row, from.col, row, col, `${unit.name} 挖洞，抵挡第 ${col + 1} 列攻击`);
    this.followMoves();
  }
  place(
    card: Card,
    side: Side,
    row: number,
    col: number,
    source?: string,
    label = `${card.name} 部署`,
  ) {
    const { returnState, ...fresh } = normalCost(structuredClone(card));
    const unit: Unit = {
      ...fresh,
      hp: returnState?.hp ?? fresh.health,
      age: returnState?.age ?? 0,
      used: returnState?.used ?? [],
      base: returnState?.base ?? structuredClone(fresh),
      ...(returnState?.rush ? { rush: true } : {}),
      ...(returnState?.pushDirection ? { pushDirection: returnState.pushDirection } : {}),
      ...(returnState?.followedRound !== undefined
        ? { followedRound: returnState.followedRound }
        : {}),
    };
    this.s[side][row][col] = unit;
    this.s.log.unshift(
      `${side === "player" ? "我方" : "敌方"} ${card.name} 部署至第 ${col + 1} 列。`,
    );
    this.emit({ kind: "deploy", source, target: slot(side, row, col), label });
    if (has(unit, "kin") || has(unit, "search")) {
      const deck = side === "player" ? this.s.deck : this.s.enemyDeck;
      if (has(unit, "kin")) {
        const index = deck.findIndex((card) => card.tribe === unit.tribe);
        if (index >= 0) {
          this.give(side, deck.splice(index, 1)[0], col);
          this.effect(side, row, col, `${unit.name} 寻亲，获得同族。`);
        } else this.effect(side, row, col, `${unit.name} 寻亲，主牌库没有同族。`);
      }
      if (has(unit, "search")) {
        if (!deck.length) this.effect(side, row, col, `${unit.name} 检索，主牌库已空。`);
        else if (side === "player") {
          this.s.searches.push({ sourceId: unit.id, name: unit.name });
          this.effect(side, row, col, `${unit.name} 检索，选择一张牌。`);
          const answer = this.s.searchAnswers?.shift();
          if (answer === undefined) {
            if (this.interactive) throw new SearchPause(this.s);
          } else {
            const index = deck.findIndex((card) => card.id === answer);
            if (index < 0) throw new Error("检索选择已失效");
            this.s.searches.shift();
            const card = deck.splice(index, 1)[0];
            this.give(side, card, col);
            this.effect(side, row, col, `${unit.name} 检索，获得 ${card.name}。`);
          }
        } else {
          const choice = chooseEnemySearch(this.s)!;
          deck.splice(deck.indexOf(choice), 1);
          this.give(side, choice, col);
          this.effect(side, row, col, `${unit.name} 检索，预备 ${choice.name}。`);
        }
      }
    }
    if (has(unit, "catalyst")) {
      for (const neighbor of [col - 1, col + 1].filter((c) => c >= 0 && c < 5)) {
        const growing = this.s[side][row][neighbor];
        if (growing && growing.hp > 0 && (has(growing, "growth") || has(growing, "metamorph"))) {
          growing.age = (growing.age ?? 0) + 1;
          this.mature(side, row, neighbor);
        }
      }
    }
    if (has(unit, "porter")) {
      this.give(side, creature("ant", `token-${this.s.encounter}-${this.s.nextId++}`), col);
      this.effect(side, row, col, `${unit.name} 搬运，获得蚂蚁。`);
    }
    // A nest token never executes entry effects, so copied nest sigils cannot recurse.
    if (has(unit, "nest") && row === 0 && !this.s[side][1][col]) {
      if (side === "player") {
        const egg = this.token("egg");
        this.s[side][1][col] = { ...egg, hp: 1, age: 0 };
        this.emit({
          kind: "deploy",
          source: slot(side, row, col),
          target: slot(side, 1, col),
          label: `${unit.name} 筑巢，放置一枚蛋`,
        });
      } else {
        // Enemy tokens share the one-entry-per-round quota instead of bypassing it.
        if (this.s.enemyAI) this.give(side, this.token("egg"), col);
        else this.s.intents.push({ card: this.token("egg"), row: 1, col });
        this.effect(side, row, col, `${unit.name} 筑巢，蛋加入敌方手牌。`);
      }
    }
    if (unit.hp <= 0) {
      this.remove(side, row, col, "expired");
      return;
    }
    if (row === 0) {
      const defender = this.s[other(side)][0][col];
      if (defender && defender.hp > 0 && !defender.submerged && has(defender, "ambush"))
        this.act(other(side), defender.id);
    }
    this.checkEnd();
  }
  rescue(side: Side, row: number, col: number) {
    const unit = this.s[side][row][col];
    if (!unit || unit.hp > 0 || !has(unit, "tail")) return;
    unit.hp = 1;
    unit.native = unit.native.filter((s) => s !== "tail");
    unit.added = unit.added.filter((s) => s !== "tail");
    this.give(side, this.token("tailToken"), col);
    this.effect(side, row, col, `${unit.name} 断尾，保留 1 血。`);
  }
  hit(
    side: Side,
    row: number,
    col: number,
    power: number,
    attacker: Unit,
    sourceSide: Side,
    sourceRow: number,
    sourceCol: number,
  ): { overflow: number; killed: Unit | null } {
    const defender = this.s[side][row][col]!;
    const healthBefore = defender.hp;
    const damage = Math.max(0, power - (has(defender, "armor") ? 1 : 0));
    defender.hp -= damage;
    this.s.log.unshift(`${attacker.name} → ${defender.name}，造成 ${damage} 点伤害。`);
    this.emit({
      kind: "hit",
      target: slot(side, row, col),
      amount: damage,
      label: `${defender.name} ${damage ? `受到 ${damage} 点伤害` : "硬甲格挡"}`,
    });
    if (damage > 0 && has(attacker, "poison")) {
      defender.hp = Math.min(0, defender.hp);
      this.effect(side, row, col, `${defender.name} 中毒。`);
    }
    this.rescue(side, row, col);
    if (has(defender, "thorns")) {
      attacker.hp--;
      this.emit({
        kind: "hit",
        target: slot(sourceSide, sourceRow, sourceCol),
        amount: 1,
        label: `${attacker.name} 受到荆棘反伤`,
      });
      this.rescue(sourceSide, sourceRow, sourceCol);
    }
    return {
      overflow: Math.max(0, damage - healthBefore),
      killed: defender.hp <= 0 ? defender : null,
    };
  }
  private attackRows(side: Side, row: number, col: number, targetCol: number): number[] {
    const unit = this.s[side][row][col]!,
      enemy = other(side);
    if (has(unit, "dive"))
      return this.targetable(enemy, 1, targetCol) && !this.flying(enemy, 1, targetCol) ? [1] : [];
    if (this.flying(side, row, col))
      return [0, 1].filter(
        (r) => this.targetable(enemy, r, targetCol) && this.flying(enemy, r, targetCol),
      );
    return this.targetable(enemy, 0, targetCol)
      ? [0, ...(this.targetable(enemy, 1, targetCol) ? [1] : [])]
      : [];
  }
  private powerAgainst(side: Side, row: number, col: number, target: Unit | null, stealth = false) {
    const attacker = this.s[side][row][col]!;
    let power = attackPower(this.s, side, row, col);
    if (target && target.hp < target.health && has(attacker, "hunt")) power += 2;
    if (target && has(target, "flying") && has(attacker, "birdcatcher")) power += 2;
    return stealth ? power * 2 : power;
  }
  strike(side: Side, id: string, targetCol: number, stealth: boolean) {
    const position = this.find(side, id);
    if (!position) return;
    const [row, col] = position,
      attacker = this.s[side][row][col]!,
      enemy = other(side),
      board = this.s[enemy];
    const air = this.flying(side, row, col);
    const dive = has(attacker, "dive");
    let targets: number[];
    const chooseTargets = () => this.attackRows(side, row, col, targetCol);
    targets = chooseTargets();
    let defender = targets.length ? board[targets[0]][targetCol] : null;
    // Check power before intercepting: an attack that deals no damage is not a threat.
    const powerAgainst = (target: Unit | null) =>
      this.powerAgainst(side, row, col, target, stealth);
    if (powerAgainst(defender) <= 0) return false;
    if (!defender && (dive || !air)) {
      this.intercept(enemy, dive ? 1 : 0, targetCol);
      targets = chooseTargets();
      defender = targets.length ? board[targets[0]][targetCol] : null;
    }
    const power = powerAgainst(defender);
    if (power <= 0) return false;
    const target = slot(enemy, targets[0] ?? (dive ? 1 : 0), targetCol);
    this.emit({
      kind: "attack",
      source: slot(side, row, col),
      target,
      route: air && !dive ? "air" : "ground",
      label: `${attacker.name} ${dive ? "俯冲攻击" : air ? "飞行攻击" : "攻击"}第 ${targetCol + 1} 列`,
    });
    const kills: Unit[] = [];
    if (!defender) {
      this.s.balance += side === "player" ? power : -power;
      this.checkEnd();
      this.s.log.unshift(
        `${attacker.name} 突破第 ${targetCol + 1} 列，${enemy === "player" ? "我方" : "敌方"}天平承受 ${power} 点。`,
      );
      this.emit({ kind: "hit", target: `life-${enemy}`, amount: power, label: `生命 −${power}` });
    } else {
      let remaining = power;
      for (const targetRow of targets) {
        if (remaining <= 0) break;
        const result = this.hit(enemy, targetRow, targetCol, remaining, attacker, side, row, col);
        if (result.killed) kills.push(result.killed);
        remaining = result.overflow;
      }
    }
    if (attacker.hp > 0 && kills.length && has(attacker, "devour")) {
      attacker.hp = Math.min(
        attacker.health,
        attacker.hp +
          kills.reduce((sum, victim) => sum + (victim.base?.health ?? victim.health), 0),
      );
      this.effect(side, row, col, `${attacker.name} 吞食，生命恢复至 ${attacker.hp}。`);
    }
    this.cleanup();
    this.checkEnd();
    return true;
  }
  act(side: Side, id: string) {
    const position = this.find(side, id);
    if (!position || this.checkEnd()) return;
    const [row, col] = position,
      attacker = this.s[side][row][col]!;
    if (attacker.hp <= 0 || attacker.submerged) return;
    const targets = (
      has(attacker, "trisplit")
        ? [col - 1, col, col + 1]
        : has(attacker, "split")
          ? [col - 1, col + 1]
          : [col]
    ).filter((c) => c >= 0 && c < 5);
    let attacked = false;
    const stealth = has(attacker, "stealth") && !(attacker.used ?? []).includes("stealth");
    const charging = !!attacker.rush;
    const canAttack =
      (row === 0 || has(attacker, "ranged")) &&
      targets.some((targetCol) => {
        const targetRow = this.attackRows(side, row, col, targetCol)[0];
        return (
          this.powerAgainst(
            side,
            row,
            col,
            targetRow === undefined ? null : this.s[other(side)][targetRow][targetCol],
          ) > 0
        );
      });
    if (canAttack && has(attacker, "blood")) {
      attacker.hp--;
      this.emit({
        kind: "hit",
        target: slot(side, row, col),
        amount: 1,
        label: `${attacker.name} 搏命 · 生命 −1`,
      });
      if (attacker.hp <= 0) {
        this.remove(side, row, col, "expired");
        return;
      }
      attacker.bloodBonus = 2;
    }
    for (const targetCol of row === 0 || has(attacker, "ranged") ? targets : []) {
      const current = this.find(side, id);
      if (!current || this.s[side][current[0]][current[1]] !== attacker || this.checkEnd()) return;
      attacked = !!this.strike(side, id, targetCol, stealth) || attacked;
    }
    if (attacked && stealth) attacker.used = [...(attacker.used ?? []), "stealth"];
    if (attacked && charging) delete attacker.rush;
    delete attacker.bloodBonus;
    const after = this.find(side, id);
    if (!after || this.s[side][after[0]][after[1]] !== attacker || this.checkEnd()) return;
    if (attacked && has(attacker, "shortlived")) {
      this.remove(side, after[0], after[1], "expired");
      return;
    }
    if (has(attacker, "shove")) this.push(side, after[0], after[1]);
    else if (attacked && has(attacker, "migrate")) {
      const [r, c] = after;
      const nextCol = [c + 1, c - 1].find((n) => n >= 0 && n < 5 && !this.s[side][r][n]);
      if (nextCol !== undefined) {
        this.move(side, r, c, r, nextCol, `${attacker.name} 迁徙到第 ${nextCol + 1} 列`);
        this.followMoves();
      }
    }
    const resting = this.find(side, id);
    if (resting && has(attacker, "recall") && !this.checkEnd()) {
      const {
        hp,
        age = 0,
        used = [],
        base,
        submerged: _submerged,
        pushDirection,
        rush,
        followedRound,
        bloodBonus: _bonus,
        ...card
      } = attacker;
      this.s[side][resting[0]][resting[1]] = null;
      this.give(
        side,
        {
          ...normalCost(card),
          returnState: {
            hp,
            age,
            used: [...used],
            base: structuredClone(base),
            rush,
            followedRound,
            pushDirection,
          },
        },
        resting[1],
      );
      this.effect(side, resting[0], resting[1], `${attacker.name} 归巢，返回手牌。`);
    }
  }
  private push(side: Side, row: number, col: number) {
    const unit = this.s[side][row][col]!,
      rank = this.s[side][row],
      direction = unit.pushDirection ?? 1;
    let gap = col + direction;
    while (gap >= 0 && gap < 5 && rank[gap]) gap += direction;
    if (gap < 0 || gap >= 5) {
      unit.pushDirection = direction === 1 ? -1 : 1;
      this.effect(
        side,
        row,
        col,
        `${unit.name} 推搡受阻，转向${unit.pushDirection === 1 ? "右" : "左"}侧。`,
      );
      return;
    }
    for (let target = gap; target !== col; target -= direction) {
      const from = target - direction,
        moving = rank[from]!;
      this.move(
        side,
        row,
        from,
        row,
        target,
        `${moving.name} ${moving.id === unit.id ? "推搡前进" : "被推搡"}至第 ${target + 1} 列`,
      );
    }
    this.followMoves();
  }
  beginTurn(side: Side) {
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++) {
        const unit = this.s[side][row][col];
        if (unit?.submerged) {
          unit.submerged = false;
          this.effect(side, row, col, `${unit.name} 浮出水面。`);
        }
      }
  }
  endTurn(side: Side) {
    if (this.checkEnd()) return;
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++) {
        const unit = this.s[side][row][col];
        if (unit && unit.hp > 0 && has(unit, "submerge") && !unit.submerged) {
          unit.submerged = true;
          this.effect(side, row, col, `${unit.name} 潜入水中。`);
        }
      }
  }
  turn(side: Side) {
    if (this.checkEnd()) return;
    this.beginTurn(side);
    const order = Array.from({ length: 5 }, (_, col) => [
      this.s[side][1][col],
      this.s[side][0][col],
    ])
      .flat()
      .filter((unit): unit is Unit => !!unit)
      .map((unit) => unit.id);
    for (const id of order) {
      if (this.checkEnd()) break;
      this.act(side, id);
    }
    this.endTurn(side);
  }
  private mature(side: Side, row: number, col: number) {
    const unit = this.s[side][row][col];
    if (!unit || unit.hp <= 0) return;
    unit.used ??= [];
    const leaveSeed = (species: Card["species"]) => {
      if (has(unit, "seed")) {
        const seed = originalForm(species, `token-${this.s.encounter}-${this.s.nextId++}`);
        this.give(side, seed, col);
        this.effect(side, row, col, `${unit.name} 留种，获得 ${seed.name}。`);
      }
    };
    if (has(unit, "growth") && !unit.used.includes("growth")) {
      const species = unit.species,
        grown = grownForm(unit);
      if (grown) {
        const name = unit.name,
          healthBefore = unit.health;
        Object.assign(unit, grown);
        unit.hp = Math.min(unit.health, unit.hp + unit.health - healthBefore);
        if (!grown.native.includes("growth")) unit.used.push("growth");
        this.effect(side, row, col, `${name} 长大为${unit.name}。`);
      } else {
        unit.used.push("growth");
        unit.attack++;
        unit.health++;
        unit.hp++;
        this.effect(side, row, col, `${unit.name} 成长，攻击和生命 +1。`);
      }
      leaveSeed(species);
    }
    if (has(unit, "metamorph") && (unit.age ?? 0) >= 2 && !unit.used.includes("metamorph")) {
      const species = unit.species;
      unit.used.push("metamorph");
      unit.species = "butterfly";
      unit.art = "moth";
      unit.name = "蝶";
      unit.attack = 3;
      unit.health = 3;
      unit.hp = 3;
      if (!has(unit, "flying")) unit.native.push("flying");
      this.effect(side, row, col, "蜕变为 3/3 的蝶，恢复生命并获得飞行。");
      leaveSeed(species);
    }
  }
  startRound() {
    this.beginTurn("player");
    for (const side of ["player", "enemy"] as const) {
      for (let col = 0; col < 5; col++)
        for (const row of [1, 0]) {
          const unit = this.s[side][row][col];
          if (!unit) continue;
          const timed = ["breed", "swarm", "growth", "metamorph"].some((sigil) =>
            has(unit, sigil as Sigil),
          );
          if (!timed) continue;
          unit.age = (unit.age ?? 0) + 1;
          unit.used ??= [];
          if (has(unit, "breed")) {
            this.give(side, this.token("youngRabbit"), col);
            this.effect(side, row, col, `${unit.name} 繁育，获得幼兔。`);
          }
          if (has(unit, "swarm")) {
            this.give(side, this.token("bee"), col);
            this.effect(side, row, col, `${unit.name} 蜂群，获得一只蜂。`);
          }
          this.mature(side, row, col);
        }
      for (let col = 0; col < 5; col++) {
        const rear = this.s[side][1][col];
        if (rear && !this.s[side][0][col]) {
          this.s.log.unshift(
            `第 ${this.s.round} 回合开始：${rear.name} 自动上前至第 ${col + 1} 列。`,
          );
          this.move(side, 1, col, 0, col, `${rear.name} 上前补位 · 第 ${col + 1} 列`);
          this.followMoves();
        }
      }
    }
  }
}
