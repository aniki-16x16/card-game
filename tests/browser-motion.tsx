import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useBattleController } from "../src/features/battle/useBattleController";
import { BattleView } from "../src/features/battle/BattleView";
import { DeckSearch } from "../src/features/battle/DeckSearch";
import { creature, initialDeck, startBattle } from "../src/domain/game";
import "../src/app/index.css";
import "../src/app/App.css";
import "../src/features/catalog/CreatureCatalog.css";
import "../src/features/battle/BattleView.css";
import "../src/features/battle/BattleCamera.css";
import "../src/features/battle/BattleAnimation.css";

function sample() {
  const state = startBattle(initialDeck(), 1, 42);
  delete state.enemyAI;
  state.hand = [
    creature("squirrel", "free-a"),
    creature("ant", "free-b"),
    creature("fox", "paid"),
    creature("rabbit", "free-c"),
  ];
  state.canDraw = false;
  state.intents = [{ card: creature("wolf", "arrival"), row: 0, col: 4 }];
  return state;
}
export function MotionCheck() {
  const [initial] = useState(sample);
  const control = useBattleController(initial);
  const battle = control.battle!;
  const [balanceReport, setBalanceReport] = useState("");
  async function checkBalance() {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const check = (value: unknown, message: string) => {
      if (!value) throw new Error(message);
    };
    const ruler = () => document.querySelector<HTMLElement>(".balance-ruler")!;
    const marker = () => ruler().querySelector<HTMLElement>(".balance-pointer")!;
    const move = (balance: number) => flushSync(() => control.setBattle({ ...sample(), balance }));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    control.abort();
    setBalanceReport("RUNNING");
    try {
      move(0);
      await delay(750);
      check(!ruler().textContent?.trim(), "scale has no visible text");
      move(8);
      await delay(120);
      if (!reduced) {
        const left = parseFloat(marker().style.left);
        check(left > 50 && left < 90, "pressure moves visibly toward its endpoint");
        check(
          Number(ruler().style.getPropertyValue("--balance-emphasis")) > 0,
          "pressure change draws attention",
        );
      }
      await delay(650);
      check(
        Math.abs(parseFloat(marker().style.left) - 90) < 0.01,
        "positive pressure lands correctly",
      );
      check(
        Number(
          ruler()
            .querySelector<HTMLElement>('[data-value="10"]')!
            .style.getPropertyValue("--tick-danger"),
        ) > 0,
        "near victory lights the endpoint",
      );
      move(-8);
      await delay(100);
      const before = parseFloat(marker().style.left);
      move(9);
      if (!reduced)
        check(
          Math.abs(parseFloat(marker().style.left) - before) < 0.01,
          "rapid changes continue from the displayed pose",
        );
      await delay(750);
      check(
        Math.abs(parseFloat(marker().style.left) - 95) < 0.01,
        "latest pressure wins after interrupted movement",
      );
      move(-8);
      await delay(750);
      check(
        Math.abs(parseFloat(marker().style.left) - 10) < 0.01,
        "negative pressure lands correctly",
      );
      move(8);
      await delay(60);
      move(0);
      await delay(750);
      check(Math.abs(parseFloat(marker().style.left) - 50) < 0.01, "reset returns to the midpoint");
      check(
        Number(ruler().style.getPropertyValue("--balance-emphasis")) === 0,
        "emphasis settles after reset",
      );
      if (reduced)
        check(
          new DOMMatrixReadOnly(getComputedStyle(marker()).transform).m11 === 1,
          "reduced motion does not enlarge the pointer",
        );
      setBalanceReport(
        `PASS balance: no text, ${reduced ? "reduced motion" : "movement and emphasis"}, both endpoints, rapid reversal, reset`,
      );
    } catch (error) {
      setBalanceReport(`FAIL ${error instanceof Error ? error.message : error}`);
    }
  }
  return (
    <div className="app-shell battle-mode">
      <main>
        <div style={{ position: "fixed", top: 0, left: "35%", zIndex: 200 }}>
          <button disabled={balanceReport === "RUNNING"} onClick={() => void checkBalance()}>
            运行天平检查
          </button>
          <output aria-label="天平检查结果">{balanceReport}</output>
          <button
            onClick={() => {
              control.abort();
              control.setBattle(sample());
            }}
          >
            重置动画样例
          </button>
          <button
            onClick={() => {
              control.select("free-a");
              control.deploy(0, 0);
              control.select("free-b");
              control.deploy(0, 1);
            }}
          >
            连续部署两张
          </button>
          <button
            onClick={() => {
              control.select("free-a");
              control.deploy(0, 0);
              control.select("free-b");
              control.deploy(0, 1);
              control.end();
            }}
          >
            连续部署后结束回合
          </button>
          <button
            onClick={() => {
              control.select("paid");
              control.sacrifice("free-a");
              control.deploy(0, 0);
              control.select("free-c");
              control.deploy(0, 2);
            }}
          >
            献祭后连续部署
          </button>
          <output aria-label="动画状态">
            {JSON.stringify({
              pending: control.pending,
              selected: battle.summon?.cardId ?? null,
              hand: battle.hand.map((c) => c.id),
              player: battle.player.map((row) => row.map((c) => c?.id ?? null)),
              round: battle.round,
            })}
          </output>
        </div>
        <BattleView
          battle={battle}
          selected={battle.summon?.cardId ?? null}
          settling={control.settling}
          actionLabel={control.actionLabel}
          onSelect={control.select}
          onDeploy={control.deploy}
          onSacrifice={control.sacrifice}
          onDraw={control.draw}
          onEnd={control.end}
          onInspect={() => {}}
        />
        {!control.pending && !control.settling && (
          <DeckSearch battle={battle} onChoose={control.search} />
        )}
      </main>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <MotionCheck />
  </StrictMode>,
);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
