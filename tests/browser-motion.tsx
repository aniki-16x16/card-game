import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
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
  return (
    <div className="app-shell battle-mode">
      <main>
        <div style={{ position: "fixed", top: 0, left: "35%", zIndex: 200 }}>
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
          canForge={false}
          onSelect={control.select}
          onDeploy={control.deploy}
          onSacrifice={control.sacrifice}
          onDraw={control.draw}
          onEnd={control.end}
          onInspect={() => {}}
          onForge={() => {}}
          onReset={() => {
            control.abort();
            control.setBattle(sample());
          }}
          onLog={() => {}}
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
