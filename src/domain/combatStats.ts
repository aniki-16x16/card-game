import { sigils } from "./cards.ts";
import type { Battle } from "./game.ts";

// Positional bonuses are derived for both combat and card display; never alter base stats.
export function attackPower(
  state: Battle,
  side: "player" | "enemy",
  row: number,
  col: number,
): number {
  const unit = state[side][row][col];
  if (!unit || unit.hp <= 0) return 0;
  const has = (r: number, c: number, sigil: "support" | "leader") => {
    const ally = state[side][r][c];
    return ally && ally.hp > 0 && sigils(ally).includes(sigil);
  };
  let power = unit.attack;
  if (row === 0 && has(1, col, "support")) power++;
  for (const neighbor of [col - 1, col + 1].filter((c) => c >= 0 && c < 5))
    if (has(row, neighbor, "leader")) power++;
  const enemy = state[side === "player" ? "enemy" : "player"][0][col];
  if (
    row === 0 &&
    enemy &&
    enemy.hp > 0 &&
    !enemy.submerged &&
    sigils(enemy).includes("intimidate")
  )
    power--;
  return Math.max(0, power);
}
