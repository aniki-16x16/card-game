import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { NodeEvent } from "../src/features/adventure/AdventureView";
import { creature } from "../src/domain/game";
import type { Adventure, NodeKind } from "../src/domain/adventure";
import "../src/app/index.css";
import "../src/app/App.css";

function sample(kind: NodeKind): Adventure {
  const deck = ["wolf", "beetle", "owl", "deer", "fox", "moth", "heron", "bear", "mouse"].map(
    (species, i) => creature(species as "wolf", `sample-${i}`),
  );
  deck[1].added = ["support", "thorns", "rebirth"];
  return {
    seed: 123,
    deck,
    nodes: [{ id: "event", floor: 1, x: 0.5, kind, next: [] }],
    path: [],
    visit: { nodeId: "event", attempts: 0, stat: "attack", done: kind === "battle", message: "" },
    safeUpgrades: false,
    status: "playing",
  };
}
let current = sample("transfer");
let show: (kind: NodeKind) => void;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const query = (selector: string) => {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
};
const click = async (selector: string) => {
  query(selector).click();
  await delay(30);
};
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const key = (element: HTMLElement, type: string, value: string) =>
  element.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true }));
async function place(slot: string, id: string) {
  await click(`[data-ritual-slot="${slot}"]`);
  await click(`[data-motion="hand-${id}"]`);
  await click(`[data-ritual-slot="${slot}"]`);
  check(document.querySelector(".deploy-stage"), "battle deploy animation is mounted");
  await delay(800);
  check(!document.querySelector(".deploy-stage"), "flight layer is cleaned up");
}
async function hold(duration: number) {
  const seal = query(".hold-seal");
  key(seal, "keydown", " ");
  await delay(duration);
  key(seal, "keyup", " ");
  await delay(750);
}
async function checks() {
  const results: string[] = [];
  show("transfer");
  await delay(50);
  await click('[data-ritual-slot="donor"]');
  check(
    !document.querySelector('[data-motion="hand-sample-0"]'),
    "sigilless donor must be excluded",
  );
  key(document.body, "keydown", "Escape");
  await delay(30);
  check(!document.querySelector(".event-hand"), "Escape closes hand before leaving");
  await place("donor", "sample-1");
  await place("target", "sample-0");
  check(current.deck.length === 9 && !current.visit?.done, "placement is a preview only");
  await hold(100);
  check(current.deck.length === 9, "short hold cancels");
  await hold(900);
  check(current.deck.length === 8 && current.visit?.done, "full hold consumes once");
  check(
    current.deck[0].added.join(",") === "armor,support,thorns,rebirth",
    "preview matches transfer",
  );
  results.push("PASS transfer: donor filtering, battle flight, preview, short hold, commit");
  show("remove");
  await delay(50);
  await place("target", "sample-0");
  await hold(100);
  check(current.deck.length === 9, "remove canceled");
  await hold(900);
  check(!current.deck.some((c) => c.id === "sample-0"), "remove committed");
  results.push("PASS remove: place, cancel, consume");
  show("upgrade");
  await delay(50);
  await place("target", "sample-0");
  await hold(900);
  check(current.visit?.attempts === 1 && current.deck[0].attack === 4, "upgrade once");
  results.push("PASS upgrade: shared placement and one hold per attempt");
  show("battle");
  await delay(1000);
  await click(".reward-card");
  check(current.deck.length === 9 && current.visit, "first click only selects reward");
  key(document.body, "keydown", "Escape");
  await delay(30);
  check(current.visit && !document.querySelector(".is-selected"), "escape cancels reward");
  await click(".reward-card");
  await click(".reward-card");
  await delay(1000);
  check(current.deck.length === 10 && !current.visit, "second click collects reward");
  results.push("PASS reward: select, Escape, collect once");
  show("transfer");
  await delay(50);
  await click(".table-leave");
  check(!current.visit, "leave completes node");
  results.push("PASS leave: returns to map");
  return results.join("\n");
}
export function Harness() {
  const [run, setRun] = useState(current);
  const [version, setVersion] = useState(0);
  const [report, setReport] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    show = (kind) =>
      flushSync(() => {
        current = sample(kind);
        setRun(current);
        setVersion((v) => v + 1);
      });
  }, []);
  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 200,
          display: "flex",
          gap: 4,
          width: "100%",
          overflowX: "auto",
          whiteSpace: "nowrap",
          fontSize: 10,
        }}
      >
        {(["transfer", "remove", "upgrade", "battle", "tribe"] as const).map((kind) => (
          <button key={kind} disabled={testing} onClick={() => show(kind)}>
            {kind}
          </button>
        ))}
        <button
          disabled={testing}
          onClick={() => {
            setTesting(true);
            setReport("RUNNING");
            void checks()
              .then(setReport)
              .catch((e) => setReport("FAIL " + e.message))
              .finally(() => setTesting(false));
          }}
        >
          运行交互检查
        </button>
      </nav>
      <details
        style={{ position: "fixed", top: 32, left: 8, zIndex: 201, fontSize: 11, maxWidth: "95vw" }}
      >
        <summary>检查结果</summary>
        <output
          style={{
            position: "fixed",
            top: 32,
            left: 8,
            zIndex: 201,
            whiteSpace: "pre",
            fontSize: 11,
            pointerEvents: "none",
            background: "#15231eee",
            maxWidth: "95vw",
            overflow: "auto",
          }}
        >
          {report}
        </output>
      </details>
      {run.visit ? (
        <main className="adventure">
          <NodeEvent
            key={version}
            run={run}
            onChange={(next) => {
              current = next;
              setRun(next);
            }}
            onInspect={() => {}}
          />
        </main>
      ) : (
        <p style={{ padding: 100 }}>已返回地图 · 牌组 {run.deck.length} 张</p>
      )}
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Harness />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
