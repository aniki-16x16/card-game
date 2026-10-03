import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { BattleView } from "../src/features/battle/BattleView";
import { DeckSearch } from "../src/features/battle/DeckSearch";
import { ENEMIES, createEnemy } from "../src/domain/enemyAI";
import type { EnemyProfile } from "../src/domain/enemyAI";
import { animateBattleAction } from "../src/features/battle/battleAnimation";
import {
  creature,
  drawCard,
  initialDeck,
  markSacrifice,
  planDeploy,
  planEnemyDeploy,
  planRound,
  planSearch,
  selectSummon,
  startBattle,
} from "../src/domain/game";
import type { BattleFrame, Battle, Species, Unit } from "../src/domain/game";
import "../src/app/index.css";
import "../src/app/App.css";
import "../src/features/battle/BattleView.css";
import "../src/features/battle/BattleCamera.css";
import "../src/features/battle/BattleAnimation.css";

const scenes = [
  "挖洞",
  "潜水",
  "推搡",
  "补位",
  "威吓",
  "成长",
  "检索",
  "催生",
  "移动接力",
  "群势接力",
  "归巢",
  "能量节奏",
  ...Object.values(ENEMIES).map((enemy) => enemy.name),
] as const;
type Scene = (typeof scenes)[number];
function unit(species: Species, id: string, patch: Partial<Unit> = {}): Unit {
  const card = creature(species, id);
  return { ...card, hp: card.health, age: 0, used: [], base: structuredClone(card), ...patch };
}
function sample(scene: Scene): Battle {
  if (scene === "能量节奏") {
    const s = startBattle(initialDeck(), 1, 123, "normal", "pack");
    s.enemy = [Array(5).fill(null), Array(5).fill(null)];
    s.enemyAI = createEnemy(123, 1, "pack").ai;
    s.enemyAI.hand = [0, 1, 2].map((i) => creature("wolf", `energy-wolf-${i}`));
    s.enemyDeck = [];
    s.intents = [];
    s.hand = [];
    s.canDraw = false;
    for (let col = 0; col < 5; col++)
      s.player[0][col] = unit("beetle", `guard-${col}`, {
        attack: 0,
        health: 100,
        hp: 100,
        native: [],
      });
    return planEnemyDeploy(s).state;
  }
  const profile = (Object.keys(ENEMIES) as EnemyProfile[]).find(
    (profile) => ENEMIES[profile].name === scene,
  );
  if (profile) {
    const s = startBattle(initialDeck(), 1, 123, "normal", profile);
    s.canDraw = false;
    s.player[0][2] = unit("wolf", "threat");
    return s;
  }
  const s = startBattle(initialDeck(), 1, 123);
  s.canDraw = false;
  s.intents = [];
  s.enemyAI = undefined;
  s.enemy = [Array(5).fill(null), Array(5).fill(null)];
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
  } else if (scene === "检索") {
    s.hand = [creature("skink", "searcher")];
    s.player[0][4] = unit("mouse", "payment");
    s.deck = [
      creature("wolf", "chosen-wolf"),
      creature("antqueen", "chosen-queen"),
      creature("firefly", "chosen-catalyst"),
      creature("scoutbee", "chosen-scout"),
    ];
  } else if (scene === "催生") {
    s.hand = [creature("firefly", "catalyst")];
    s.player[0][0] = unit("wolfpup", "pup");
    s.player[0][2] = unit("caterpillar", "larva");
    s.player[0][4] = unit("mouse", "payment");
  } else if (scene === "移动接力") {
    s.player[0][1] = unit("pigeon", "follower");
    s.player[0][2] = unit("hare", "runner");
  } else if (scene === "群势接力") {
    s.hand = [creature("antqueen", "queen")];
    s.player[0][0] = unit("soldierant", "soldier");
    s.player[0][1] = unit("ant", "ally");
    s.player[0][3] = unit("ant", "victim");
    s.enemy[0][3] = unit("wolf", "hunter", { attack: 1 });
  } else if (scene === "归巢") {
    s.player[0][1] = unit("scoutbee", "scout", { hp: 1, health: 3 });
    s.player[0][4] = unit("mouse", "payment", { attack: 0 });
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
    <div
      style={{
        padding: 12,
        height: "100dvh",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <nav
        aria-label="印记检查场景"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: 8 }}
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
        {scene === "能量节奏" && (
          <output aria-label="能量检查">
            回合 {battle.round} · 能量 {battle.enemyAI?.energy} · 敌方单位{" "}
            {battle.enemy.flat().filter(Boolean).length}
          </output>
        )}
      </nav>
      <div style={{ minHeight: 0 }}>
        <BattleView
          battle={battle}
          selected={battle.summon?.cardId ?? null}
          settling={settling}
          actionLabel={actionLabel}
          onSelect={(id) => setBattle(selectSummon(battle, id))}
          onDeploy={(row, col) => void play(planDeploy(battle, battle.summon!.cardId, row, col))}
          onSacrifice={(id) => void play(markSacrifice(battle, id))}
          onDraw={(pile) => setBattle(drawCard(battle, pile))}
          onEnd={() =>
            void play(
              planRound({
                ...battle,
                canDraw: false,
                intents: battle.enemyAI ? battle.intents : [],
              }),
            )
          }
          onInspect={() => {}}
        />
      </div>
      {!settling && (
        <DeckSearch battle={battle} onChoose={(id) => void play(planSearch(battle, id))} />
      )}
    </div>
  );
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<SigilCheck />);
