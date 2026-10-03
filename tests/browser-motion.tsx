import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { animateBattleAction } from "../src/features/battle/battleAnimation";
import { useBattleController } from "../src/features/battle/useBattleController";
import { BattleView } from "../src/features/battle/BattleView";
import { DeckSearch } from "../src/features/battle/DeckSearch";
import { creature, initialDeck, prepareBattle, startBattle } from "../src/domain/game";
import { SceneTransitionProvider } from "../src/components/transitions/SceneTransition";
import { useSceneTransition } from "../src/components/transitions/SceneTransitionContext";
import "../src/app/index.css";
import "../src/app/App.css";
import "../src/features/catalog/CreatureCatalog.css";
import "../src/features/battle/BattleView.css";
import "../src/features/battle/BattleCamera.css";
import "../src/features/battle/BattleAnimation.css";

function sample() {
  const state = startBattle(initialDeck(), 1, 42);
  delete state.enemyAI;
  state.enemy = [Array(5).fill(null), Array(5).fill(null)];
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
  const transition = useSceneTransition();
  const [initial] = useState(sample);
  const control = useBattleController(initial);
  const battle = control.battle!;
  const [balanceReport, setBalanceReport] = useState("");
  const [entranceReport, setEntranceReport] = useState("");
  const [hitDeathReport, setHitDeathReport] = useState("");
  async function checkHitDeath() {
    control.abort();
    setHitDeathReport("RUNNING");
    const state = sample();
    const card = creature("squirrel", "target");
    state.player[0][0] = { ...card, hp: 1 };
    flushSync(() => control.setBattle(state));
    const target = document.querySelector<HTMLElement>('[data-motion="player-0-0"]')!;
    const originalStyle = target.style.cssText;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const check = (value: unknown, message: string) => {
      if (!value) throw new Error(message);
    };
    try {
      const lethalStart = performance.now();
      await animateBattleAction(
        { kind: "hit", target: "player-0-0", amount: 1, lethal: true, label: "致死" },
        new AbortController().signal,
        state,
      );
      check(performance.now() - lethalStart < 80, "lethal hit still waits for motion");
      check(!document.querySelector(".damage-number"), "lethal hit created a number");
      check(target.style.cssText === originalStyle, "lethal hit changed the card pose");

      const hitStart = performance.now();
      const hit = animateBattleAction(
        { kind: "hit", target: "player-0-0", amount: 1, lethal: false, label: "存活" },
        new AbortController().signal,
        state,
      );
      check(!!document.querySelector(".damage-number"), "surviving hit has no feedback");
      await hit;
      check(performance.now() - hitStart < 350, "surviving hit is too slow");
      check(!document.querySelector(".damage-number"), "surviving hit leaked a number");

      for (const cause of ["killed", "sacrificed", "expired"] as const) {
        const retained: (() => void)[] = [];
        let done = false,
          sawWarmTint = false,
          sawFade = false,
          sawRotation = false;
        const death = animateBattleAction(
          { kind: "death", target: "player-0-0", cause, label: cause },
          new AbortController().signal,
          state,
          retained,
        ).then(() => {
          done = true;
        });
        while (!done) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          sawWarmTint ||= target.style.filter.includes("saturate");
          sawFade ||= target.style.opacity !== "" && Number(target.style.opacity) < 1;
          sawRotation ||= target.style.transform.includes("rotateZ");
          check(!document.querySelector(".damage-number"), `${cause} played hit feedback`);
        }
        await death;
        check(sawFade && target.style.opacity === "0", `${cause} did not fade out`);
        if (!reduced) check(sawWarmTint && sawRotation, `${cause} differs from sacrifice motion`);
        retained.forEach((cleanup) => cleanup());
        check(target.style.cssText === originalStyle, `${cause} failed to restore styles`);
      }

      const abort = new AbortController();
      const interrupted = animateBattleAction(
        { kind: "hit", target: "player-0-0", amount: 1, label: "中断" },
        abort.signal,
        state,
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      abort.abort();
      await interrupted;
      check(target.style.cssText === originalStyle, "aborted hit retained a pose");
      check(!document.querySelector(".damage-number"), "aborted hit leaked a number");
      setHitDeathReport(
        "PASS hit/death: lethal skips feedback, surviving hit <350ms, all deaths use sacrifice motion, abort clean",
      );
    } catch (error) {
      setHitDeathReport(`FAIL ${error instanceof Error ? error.message : error}`);
    }
  }
  async function checkEntrance() {
    control.abort();
    setEntranceReport("RUNNING");
    let completed = false,
      sawEmptyTable = false,
      sawFlight = false,
      sawHandArrival = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fanPositions = new Map<Element, number>();
    const prepared = prepareBattle(initialDeck(), 1, 123, "normal", "reef");
    transition.start(
      () => {
        control.setBattle(prepared);
        // Direct controller calls must also be rejected until enemy deployment completes.
        control.draw("deck");
        control.select(prepared.hand[0].id);
        control.end();
      },
      () => {
        completed = true;
        control.begin();
        control.begin(); // A duplicate completion signal must not deploy twice.
      },
    );
    try {
      const started = performance.now();
      while (performance.now() - started < 8000) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const covered = !!document.querySelector<HTMLDialogElement>(".scene-transition")?.open;
        const enemies = document.querySelectorAll(".combat-side.enemy .filled");
        const flying = !!document.querySelector(".deploy-stage");
        const hand = document.querySelector<HTMLElement>(".combat-hand");
        if (covered && enemies.length) throw new Error("enemy appears under transition cover");
        if (covered && flying) throw new Error("deployment starts before transition closes");
        if (covered && document.querySelector(".enemy-profile") && !enemies.length) {
          sawEmptyTable = true;
          if (!hand || getComputedStyle(hand).visibility !== "hidden")
            throw new Error("opening hand flashes during transition");
          const cards = [...hand.querySelectorAll<HTMLElement>(".combat-hand-card")];
          const positions = cards.map(
            (card) => new DOMMatrix(getComputedStyle(card).transform).m41,
          );
          if (cards.length !== prepared.hand.length || new Set(positions).size !== cards.length)
            throw new Error("opening cards are stacked instead of fanned before arrival");
          if (!document.querySelector<HTMLButtonElement>(".combat-end")?.disabled)
            throw new Error("player input unlocks during opening");
        }
        if (completed && hand && getComputedStyle(hand).visibility === "visible") {
          const lift = new DOMMatrix(getComputedStyle(hand).transform).m42;
          if (lift > 1 && lift < hand.clientHeight) sawHandArrival = true;
          for (const card of hand.querySelectorAll<HTMLElement>(".combat-hand-card")) {
            const x = new DOMMatrix(getComputedStyle(card).transform).m41;
            if (!fanPositions.has(card)) fanPositions.set(card, x);
            else if (Math.abs(x - fanPositions.get(card)!) > 1)
              throw new Error("opening cards abruptly spread after enemy deployment");
          }
        }
        if (flying) {
          if (!completed) throw new Error("deployment precedes transition completion");
          sawFlight = true;
        }
        if (completed && enemies.length && !flying && !document.querySelector(".is-resolving")) {
          if (!sawEmptyTable || !sawFlight || enemies.length !== 1)
            throw new Error("missing empty-table phase, deployment animation, or duplicate entry");
          if (!document.querySelector(".combat-side.enemy .is-submerged"))
            throw new Error("new enemy diver is not submerged");
          if (document.querySelectorAll(".combat-hand-card").length !== prepared.hand.length)
            throw new Error("opening draw was not blocked");
          if (!reduced && !sawHandArrival) throw new Error("missing bottom-up hand arrival");
          setEntranceReport(
            "PASS entrance: no hand flash, pre-fanned cards slide up after reveal, input locked, one submerged enemy",
          );
          return;
        }
      }
      throw new Error("opening did not finish");
    } catch (error) {
      setEntranceReport(`FAIL ${error instanceof Error ? error.message : error}`);
    }
  }
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
          <button disabled={hitDeathReport === "RUNNING"} onClick={() => void checkHitDeath()}>
            运行受击死亡检查
          </button>
          <output aria-label="受击死亡检查结果">{hitDeathReport}</output>
          <button disabled={entranceReport === "RUNNING"} onClick={() => void checkEntrance()}>
            运行入场检查
          </button>
          <output aria-label="入场检查结果">{entranceReport}</output>
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
          handReady={control.handReady}
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
    <SceneTransitionProvider>
      <MotionCheck />
    </SceneTransitionProvider>
  </StrictMode>,
);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
