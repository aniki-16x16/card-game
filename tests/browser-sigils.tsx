import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { BattleView } from "../src/features/battle/BattleView";
import { animateBattleAction } from "../src/features/battle/battleAnimation";
import {
  creature,
  drawCard,
  initialDeck,
  markSacrifice,
  planDeploy,
  planRound,
  selectSummon,
  startBattle,
} from "../src/domain/game";
import type { BattleFrame, Battle, Species, Unit } from "../src/domain/game";
import "../src/app/index.css";
import "../src/app/App.css";
import "../src/features/battle/BattleView.css";
import "../src/features/battle/BattleCamera.css";
import "../src/features/battle/BattleAnimation.css";

const scenes = ["挖洞", "潜水", "推搡", "补位", "威吓", "成长"] as const;
type Scene = (typeof scenes)[number];
function unit(species: Species, id: string, patch: Partial<Unit> = {}): Unit {
  const card = creature(species, id);
  return { ...card, hp: card.health, age: 0, used: [], base: structuredClone(card), ...patch };
}
function sample(scene: Scene): Battle {
  const s = startBattle(initialDeck(), 1, 123);
  s.canDraw = false;
  s.intents = [];
  s.hand = [];
  if (scene === "挖洞") {
    s.player[0][2] = unit("mouse", "attacker");
    s.enemy[1][4] = unit("hound", "burrower", { hp: 5, health: 5 });
  } else if (scene === "潜水") {
    s.player[0][2] = unit("carp", "p");
    s.enemy[0][2] = unit("carp", "e", { submerged: true });
  } else if (scene === "推搡") {
    s.player[0][3] = unit("boar", "pusher", { attack: 0 });
    s.player[0][4] = unit("mouse", "wall", { attack: 0 });
    s.player[0][2] = unit("fox", "pushed", { attack: 0 });
  } else if (scene === "补位") {
    s.player[0][2] = unit("mouse", "victim");
    s.enemy[0][2] = unit("wolf", "attacker");
    s.hand = [creature("quail", "replacement"), creature("beetle", "summon")];
  } else if (scene === "成长") {
    s.player[0][0] = unit("wolfpup", "pup");
    s.player[0][2] = unit("fawn", "fawn");
    s.player[0][4] = unit("carp", "fish");
  } else {
    s.player[0][2] = unit("wolf", "target");
    s.enemy[0][2] = unit("iguana", "intimidator");
  }
  return s;
}

// Development-only scenes use the real battle component, engine and animation player.
export function SigilCheck() {
  const [scene, setScene] = useState<Scene>("挖洞"),
    [battle, setBattle] = useState(() => sample("挖洞"));
  const [settling, setSettling] = useState(false),
    [actionLabel, setActionLabel] = useState("");
  const [result, setResult] = useState("待播放");
  async function play(plan: { state: Battle; frames: BattleFrame[] }) {
    flushSync(() => {
      setSettling(true);
      setResult("播放中");
    });
    const controller = new AbortController();
    try {
      for (const frame of plan.frames) {
        flushSync(() => setActionLabel(frame.action.label));
        await animateBattleAction(frame.action, controller.signal, frame.state);
        flushSync(() => setBattle(frame.state));
      }
      setBattle(plan.state);
      setResult(`播放完成 · ${plan.frames.length} 个动作`);
    } finally {
      setSettling(false);
      setActionLabel("");
    }
  }
  function reset(next: Scene) {
    setScene(next);
    setBattle(sample(next));
    setResult("待播放");
  }
  return (
    <div style={{ padding: 12 }}>
      <nav
        aria-label="印记检查场景"
        style={{ display: "flex", alignItems: "center", gap: 16, padding: 8 }}
      >
        {scenes.map((name) => (
          <button disabled={settling} key={name} onClick={() => reset(name)}>
            {name}场景
          </button>
        ))}
        <button disabled={settling} onClick={() => reset(scene)}>
          重置场景
        </button>
        <output aria-label="播放结果">{result}</output>
      </nav>
      <div style={{ height: "calc(100dvh - 80px)" }}>
        <BattleView
          battle={battle}
          selected={battle.summon?.cardId ?? null}
          settling={settling}
          actionLabel={actionLabel}
          canForge={false}
          onSelect={(id) => setBattle(selectSummon(battle, id))}
          onDeploy={(row, col) => void play(planDeploy(battle, battle.summon!.cardId, row, col))}
          onSacrifice={(id) => void play(markSacrifice(battle, id))}
          onDraw={(pile) => setBattle(drawCard(battle, pile))}
          onEnd={() => void play(planRound({ ...battle, canDraw: false, intents: [] }))}
          onInspect={() => {}}
          onForge={() => {}}
          onReset={() => reset(scene)}
          onLog={() => {}}
        />
      </div>
    </div>
  );
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<SigilCheck />);
