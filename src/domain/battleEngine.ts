import { creature, makeToken, sigils } from './cards.ts'
import type { Card, Sigil, TokenKind } from './cards.ts'
import type { Battle, BattleAction, DeathCause, Recorder, Unit } from './game.ts'

type Side = 'player' | 'enemy'
const other = (side: Side): Side => side === 'player' ? 'enemy' : 'player'
const has = (card: Card, sigil: Sigil) => sigils(card).includes(sigil)
const slot = (side: Side, row: number, col: number) => `${side}-${row}-${col}`

// Each public operation runs on a cloned battle. No global RNG or event state.
export class BattleEngine {
  s: Battle
  record?: Recorder
  constructor(state: Battle, record?: Recorder) { this.s = state; this.record = record }
  emit(action: BattleAction) { this.record?.(action, structuredClone(this.s)) }
  effect(side: Side, row: number, col: number, label: string) {
    this.s.log.unshift(label)
    this.emit({ kind: 'effect', target: slot(side, row, col), label })
  }
  checkEnd(): boolean {
    if (this.s.balance >= 10) { this.s.balance = 10; this.s.status = 'won' }
    else if (this.s.balance <= -10) { this.s.balance = -10; this.s.status = 'lost' }
    return this.s.status !== 'playing'
  }
  find(side: Side, id: string): [number, number] | undefined {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) if (this.s[side][row][col]?.id === id) return [row, col]
  }
  token(kind: TokenKind): Card { return makeToken(kind, `token-${this.s.encounter}-${this.s.nextId++}`) }
  give(side: Side, card: Card, col: number) {
    if (side === 'player') this.s.hand.push(card)
    else this.s.intents.push({ card, row: 0, col })
    this.s.log.unshift(`${side === 'player' ? '我方获得' : '敌方预备'} ${card.name}。`)
  }
  remove(side: Side, row: number, col: number, cause: DeathCause) {
    const unit = this.s[side][row][col]
    if (!unit) return
    this.s[side][row][col] = null
    const { hp: _hp, age: _age, used: _used, base, ...card } = unit
    if (has(unit, 'rebirth')) this.give(side, structuredClone(base ?? card), col)
    if (has(unit, 'brood')) this.give(side, this.token('larva'), col)
    const reason = cause === 'killed' ? '被击杀' : cause === 'sacrificed' ? '被献祭' : '自然死亡'
    this.s.log.unshift(`${unit.name} ${reason}。`)
    this.emit({ kind: 'death', cause, target: slot(side, row, col), label: `${unit.name} ${reason}` })
    if (cause === 'killed') {
      for (const owner of ['player', 'enemy'] as const) for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
        const scavenger = this.s[owner][r][c]
        if (scavenger && scavenger.hp > 0 && has(scavenger, 'scavenge')) {
          scavenger.attack++
          this.effect(owner, r, c, `${scavenger.name} 食腐，攻击 +1。`)
        }
      }
    }
  }
  cleanup() {
    for (const side of ['player', 'enemy'] as const) for (let col = 0; col < 5; col++) for (const row of [1, 0]) {
      const unit = this.s[side][row][col]
      if (unit && unit.hp <= 0) this.remove(side, row, col, 'killed')
    }
  }
  // Web suppression is derived from current living board units, never permanently edits sigils.
  flying(side: Side, row: number, col: number): boolean {
    const unit = this.s[side][row][col]
    return !!unit && has(unit, 'flying') && !this.s[other(side)].some(rank => {
      const spider = rank[col]; return spider && spider.hp > 0 && has(spider, 'web')
    })
  }
  place(card: Card, side: Side, row: number, col: number, source?: string) {
    const unit: Unit = { ...structuredClone(card), hp: card.health, age: 0, used: [], base: structuredClone(card) }
    this.s[side][row][col] = unit
    this.s.log.unshift(`${side === 'player' ? '我方' : '敌方'} ${card.name} 部署至第 ${col + 1} 列。`)
    this.emit({ kind: 'deploy', source, target: slot(side, row, col), label: `${card.name} 部署` })
    if (has(unit, 'porter')) {
      this.give(side, creature('ant', `token-${this.s.encounter}-${this.s.nextId++}`), col)
      this.effect(side, row, col, `${unit.name} 搬运，获得蚂蚁。`)
    }
    // A nest token never executes entry effects, so copied nest sigils cannot recurse.
    if (has(unit, 'nest') && row === 0 && !this.s[side][1][col]) {
      if (side === 'player') {
        const egg = this.token('egg')
        this.s[side][1][col] = { ...egg, hp: 1, age: 0 }
        this.emit({ kind: 'deploy', source: slot(side, row, col), target: slot(side, 1, col), label: `${unit.name} 筑巢，放置一枚蛋` })
      } else {
        // Enemy tokens share the one-entry-per-round quota instead of bypassing it.
        this.s.intents.push({ card: this.token('egg'), row: 1, col })
        this.effect(side, row, col, `${unit.name} 筑巢，蛋进入下一回合预告。`)
      }
    }
    if (unit.hp <= 0) { this.remove(side, row, col, 'expired'); return }
    if (row === 0) {
      const defender = this.s[other(side)][0][col]
      if (defender && defender.hp > 0 && has(defender, 'ambush')) this.act(other(side), defender.id, true)
    }
    this.checkEnd()
  }
  rescue(side: Side, row: number, col: number) {
    const unit = this.s[side][row][col]
    if (!unit || unit.hp > 0 || !has(unit, 'tail')) return
    unit.hp = 1
    unit.native = unit.native.filter(s => s !== 'tail'); unit.added = unit.added.filter(s => s !== 'tail')
    this.give(side, this.token('tailToken'), col)
    this.effect(side, row, col, `${unit.name} 断尾，保留 1 血。`)
  }
  hit(side: Side, row: number, col: number, power: number, attacker: Unit, sourceSide: Side, sourceRow: number, sourceCol: number): { overflow: number; killed: Unit | null } {
    const defender = this.s[side][row][col]!
    const healthBefore = defender.hp
    const damage = Math.max(0, power - (has(defender, 'armor') ? 1 : 0))
    defender.hp -= damage
    this.s.log.unshift(`${attacker.name} → ${defender.name}，造成 ${damage} 点伤害。`)
    this.emit({ kind: 'hit', target: slot(side, row, col), amount: damage, label: `${defender.name} ${damage ? `受到 ${damage} 点伤害` : '硬甲格挡'}` })
    if (damage > 0 && has(attacker, 'poison')) {
      defender.hp = Math.min(0, defender.hp)
      this.effect(side, row, col, `${defender.name} 中毒。`)
    }
    this.rescue(side, row, col)
    if (has(defender, 'thorns')) {
      attacker.hp--
      this.emit({ kind: 'hit', target: slot(sourceSide, sourceRow, sourceCol), amount: 1, label: `${attacker.name} 受到荆棘反伤` })
      this.rescue(sourceSide, sourceRow, sourceCol)
    }
    if (defender.hp > 0 && has(defender, 'swarm')) {
      this.give(side, this.token('bee'), col)
      this.effect(side, row, col, `${defender.name} 蜂群，获得一只蜂。`)
    }
    return { overflow: Math.max(0, damage - healthBefore), killed: defender.hp <= 0 ? defender : null }
  }
  strike(side: Side, id: string, targetCol: number, stealth: boolean) {
    const position = this.find(side, id)
    if (!position) return
    const [row, col] = position, attacker = this.s[side][row][col]!, enemy = other(side), board = this.s[enemy]
    const air = this.flying(side, row, col)
    let targets: number[]
    if (has(attacker, 'dive') && board[1][targetCol] && !this.flying(enemy, 1, targetCol)) targets = [1]
    else if (air) targets = [0, 1].filter(r => board[r][targetCol] && this.flying(enemy, r, targetCol))
    else targets = board[0][targetCol] ? [0, ...(board[1][targetCol] ? [1] : [])] : []
    const defender = targets.length ? board[targets[0]][targetCol] : null
    let power = attacker.attack
    if (row === 0) {
      if (this.s[side][1][col] && has(this.s[side][1][col]!, 'support')) power++
      for (const neighbor of [col - 1, col + 1].filter(c => c >= 0 && c < 5)) {
        for (const rank of this.s[side]) if (rank[neighbor] && rank[neighbor]!.hp > 0 && has(rank[neighbor]!, 'pack')) power++
      }
    }
    if (defender && defender.hp < defender.health && has(attacker, 'hunt')) power += 2
    if (defender && has(defender, 'flying') && has(attacker, 'birdcatcher')) power += 2
    if (stealth) power *= 2
    if (power <= 0) return false
    const target = slot(enemy, targets[0] ?? 0, targetCol)
    this.emit({ kind: 'attack', source: slot(side, row, col), target, route: air ? 'air' : 'ground', label: `${attacker.name} ${air ? '飞行攻击' : '攻击'}第 ${targetCol + 1} 列` })
    const kills: Unit[] = []
    if (!defender) {
      this.s.balance += side === 'player' ? power : -power
      this.checkEnd()
      this.s.log.unshift(`${attacker.name} 突破第 ${targetCol + 1} 列，${enemy === 'player' ? '我方' : '敌方'}天平承受 ${power} 点。`)
      this.emit({ kind: 'hit', target: `life-${enemy}`, amount: power, label: `生命 −${power}` })
    } else {
      let remaining = power
      for (const targetRow of targets) {
        if (remaining <= 0) break
        const result = this.hit(enemy, targetRow, targetCol, remaining, attacker, side, row, col)
        if (result.killed) kills.push(result.killed)
        remaining = result.overflow
      }
    }
    if (attacker.hp > 0 && kills.length && has(attacker, 'devour')) {
      attacker.hp = Math.min(attacker.health, attacker.hp + kills.reduce((sum, victim) => sum + (victim.base?.health ?? victim.health), 0))
      this.effect(side, row, col, `${attacker.name} 吞食，生命恢复至 ${attacker.hp}。`)
    }
    this.cleanup(); this.checkEnd()
    return true
  }
  act(side: Side, id: string, reaction = false) {
    const position = this.find(side, id)
    if (!position || this.checkEnd()) return
    const [row, col] = position, attacker = this.s[side][row][col]!
    if (row === 1 && !has(attacker, 'ranged') && !this.flying(side, row, col)) return
    const targets = has(attacker, 'split') ? [col - 1, col + 1].filter(c => c >= 0 && c < 5) : [col]
    let attacked = false
    for (let repeat = 0; repeat < (!reaction && has(attacker, 'double') ? 2 : 1); repeat++) {
      const stealth = has(attacker, 'stealth') && !(attacker.used ?? []).includes('stealth')
      let volley = false
      for (const targetCol of targets) {
        if (!this.find(side, id) || this.checkEnd()) return
        volley = !!this.strike(side, id, targetCol, stealth) || volley
      }
      if (volley && stealth) attacker.used = [...(attacker.used ?? []), 'stealth']
      attacked ||= volley
    }
    const after = this.find(side, id)
    if (!after || !attacked || this.checkEnd()) return
    if (has(attacker, 'shortlived')) { this.remove(side, after[0], after[1], 'expired'); return }
    if (has(attacker, 'migrate')) {
      const [r, c] = after
      const nextCol = [c + 1, c - 1].find(n => n >= 0 && n < 5 && !this.s[side][r][n])
      if (nextCol !== undefined) {
        this.s[side][r][c] = null; this.s[side][r][nextCol] = attacker
        this.emit({ kind: 'advance', source: slot(side, r, c), target: slot(side, r, nextCol), label: `${attacker.name} 迁徙到第 ${nextCol + 1} 列` })
      }
    }
  }
  turn(side: Side) {
    const order = Array.from({ length: 5 }, (_, col) => [this.s[side][1][col], this.s[side][0][col]]).flat().filter((unit): unit is Unit => !!unit).map(unit => unit.id)
    for (const id of order) { if (this.checkEnd()) break; this.act(side, id) }
  }
  startRound() {
    for (const side of ['player', 'enemy'] as const) {
      for (let col = 0; col < 5; col++) for (const row of [1, 0]) {
        const unit = this.s[side][row][col]
        if (!unit) continue
        const timed = unit.species === 'egg' || ['breed', 'growth', 'metamorph'].some(sigil => has(unit, sigil as Sigil))
        if (!timed) continue
        unit.age = (unit.age ?? 0) + 1
        unit.used ??= []
        if (unit.species === 'egg') {
          const chick = creature('chick', unit.id)
          this.s[side][row][col] = { ...chick, hp: chick.health, age: 0, used: [], base: chick }
          this.effect(side, row, col, '蛋孵化为雏鸟。')
          continue
        }
        if (has(unit, 'breed') && !unit.used.includes('breed')) {
          unit.used.push('breed'); this.give(side, this.token('youngRabbit'), col)
          this.effect(side, row, col, `${unit.name} 繁育，获得幼兔。`)
        }
        if (has(unit, 'growth') && !unit.used.includes('growth')) {
          unit.used.push('growth'); unit.attack++
          if (!has(unit, 'flying')) unit.native.push('flying')
          this.effect(side, row, col, `${unit.name} 成长，攻击 +1 并获得飞行。`)
        }
        if (has(unit, 'metamorph') && unit.age >= 2 && !unit.used.includes('metamorph')) {
          unit.used.push('metamorph'); unit.species = 'butterfly'; unit.art = 'moth'; unit.name = '蝶'
          unit.attack = 3; unit.health = 3; unit.hp = 3
          if (!has(unit, 'flying')) unit.native.push('flying')
          this.effect(side, row, col, '蜕变为 3/3 的蝶，恢复生命并获得飞行。')
        }
      }
      for (let col = 0; col < 5; col++) {
        const rear = this.s[side][1][col]
        if (rear && !this.s[side][0][col]) {
          this.s[side][0][col] = rear; this.s[side][1][col] = null
          this.s.log.unshift(`第 ${this.s.round} 回合开始：${rear.name} 自动上前至第 ${col + 1} 列。`)
          this.emit({ kind: 'advance', source: slot(side, 1, col), target: slot(side, 0, col), label: `${rear.name} 上前补位 · 第 ${col + 1} 列` })
        }
      }
    }
  }
}
