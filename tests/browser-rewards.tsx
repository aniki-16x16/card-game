import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { NodeEvent } from "../src/features/adventure/AdventureView";
import { TribeSilhouette } from "../src/components/creatures/TribeSilhouette";
import { newAdventure, enterNode } from "../src/domain/adventure";
import { TRIBES } from "../src/domain/game";
import type { Tribe } from "../src/domain/game";
import "../src/app/index.css";
import "../src/app/App.css";
import "../src/features/catalog/CreatureCatalog.css";

function fixture(kind: "cost" | "tribe" | "elite") {
  const run = newAdventure(1);
  run.nodes = [{ id: "choice-test", floor: 1, kind, x: 0.5, next: [] }];
  const entered = enterNode(run, "choice-test");
  if (kind === "elite") entered.visit!.done = true;
  return entered;
}

export function RewardCheck() {
  const [run, setRun] = useState(() => fixture("tribe"));
  const [revision, setRevision] = useState(0);
  const [narrow, setNarrow] = useState(false);
  return (
    <main style={{ maxWidth: 1000, padding: 16, margin: "auto" }}>
      <header style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {(["tribe", "cost", "elite"] as const).map((kind) => (
          <button
            key={kind}
            onClick={() => {
              setRun(fixture(kind));
              setRevision((value) => value + 1);
            }}
          >
            {kind === "tribe" ? "重发种族" : kind === "cost" ? "重发费用" : "战利品"}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={narrow}
            onChange={(event) => setNarrow(event.target.checked)}
          />
          360px 容器
        </label>
        <output>
          牌组 {run.deck.length} 张 · 已完成 {run.path.length}
        </output>
      </header>
      <div style={{ width: narrow ? 360 : "100%", maxWidth: "100%" }}>
        {run.visit ? (
          <NodeEvent key={revision} run={run} onChange={setRun} onInspect={() => {}} />
        ) : (
          <p>收牌完成</p>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 20,
          marginTop: 32,
        }}
      >
        {(Object.keys(TRIBES) as Tribe[]).map((tribe) => (
          <figure key={tribe} style={{ textAlign: "center", margin: 0 }}>
            <TribeSilhouette tribe={tribe} />
            <figcaption>{TRIBES[tribe]}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <RewardCheck />
  </StrictMode>,
);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
