import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { NodeEvent } from "../src/features/adventure/AdventureView";
import { PauseMenu } from "../src/components/PauseMenu";
import { Modal } from "../src/components/Modal";
import { DeckSearch } from "../src/features/battle/DeckSearch";
import { chooseSearch, initialDeck, startBattle } from "../src/domain/game";
import type { Battle } from "../src/domain/game";
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
let showPause: (open: boolean) => void;
let showModalCheck: () => void;
let showSearch: () => void;
let pauseActions = 0;
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
function cardLayout(face: Element) {
  return ["", ".card-top", ".cost", ".creature", ".card-sigils", ".card-stats"].flatMap(
    (selector) => {
      const style = getComputedStyle(selector ? face.querySelector(selector)! : face);
      return [style.width, style.height, style.fontSize, style.paddingTop, style.paddingLeft].map(
        parseFloat,
      );
    },
  );
}
async function checkDeal(action: () => void, duration: number) {
  const seen = new Map<Element, number>();
  let failure = "";
  const sample = () => {
    for (const card of document.querySelectorAll(
      '.choice-cards[data-dealt="false"] .choice-slot',
    )) {
      const opacity = Number(getComputedStyle(card).opacity);
      if (!seen.has(card) && opacity > 0.03) failure = "new deal appeared before its animation";
      if (seen.has(card) && opacity + 0.005 < seen.get(card)!)
        failure = "deal opacity flashed backwards";
      seen.set(card, opacity);
    }
  };
  const observer = new MutationObserver(sample);
  observer.observe(document.getElementById("root")!, { childList: true, subtree: true });
  action();
  sample();
  const until = performance.now() + duration;
  while (performance.now() < until) {
    await new Promise(requestAnimationFrame);
    sample();
  }
  observer.disconnect();
  check(seen.size > 0, "a new deal was observed");
  check(!failure, failure);
  for (const card of document.querySelectorAll(".choice-slot"))
    check(
      Number(getComputedStyle(card).opacity) > 0.99,
      "cards remain visible after animation cleanup",
    );
}
async function place(slot: string, id: string) {
  await click(`[data-ritual-slot="${slot}"]`);
  await click(`[data-motion="hand-${id}"]`);
  check(document.querySelector(".deploy-stage"), "battle deploy animation is mounted");
  const inFlight = cardLayout(query(".deploy-card .card-face"));
  check(document.querySelector(".event-hand"), "hand remains mounted during its exit");
  await delay(120);
  check(
    Number(getComputedStyle(query(".event-hand")).opacity) < 0.95,
    "remaining hand animates out",
  );
  await delay(800);
  check(!document.querySelector(".deploy-stage"), "flight layer is cleaned up");
  check(!document.querySelector(".event-hand"), "hand is removed after exit finishes");
  const landed = cardLayout(query(`[data-ritual-slot="${slot}"] .card-face`));
  check(
    inFlight.every((value, i) => Math.abs(value - landed[i]) < 1),
    "flight and landed card layouts match",
  );
}
async function hold(duration: number) {
  const seal = query(".hold-seal");
  key(seal, "keydown", " ");
  await delay(duration);
  const liquid = query(".seal-liquid");
  const filled = new DOMMatrix(getComputedStyle(liquid).transform).m22;
  check(
    duration < 850 ? filled > 0 && filled < 1 : filled > 0.99,
    `hold background follows progress (duration=${duration}, fill=${filled})`,
  );
  key(seal, "keyup", " ");
  if (duration < 850) {
    await delay(80);
    check(
      new DOMMatrix(getComputedStyle(liquid).transform).m22 < filled,
      "released progress falls quickly",
    );
    await delay(120);
    check(
      new DOMMatrix(getComputedStyle(liquid).transform).m22 < 0.01,
      "released progress drains fully",
    );
  }
  await delay(750);
}
async function checks() {
  const results: string[] = [];
  pauseActions = 0;
  await checkDeal(() => show("tribe"), 850);
  await checkDeal(() => query(".category-card").click(), 1800);
  results.push("PASS dealing: category and reward stages start hidden and fade monotonically");
  show("transfer");
  await delay(50);
  await click('[data-ritual-slot="donor"]');
  check(
    !document.querySelector('[data-motion="hand-sample-0"]'),
    "sigilless donor must be excluded",
  );
  key(document.body, "keydown", "Escape");
  await delay(300);
  check(document.querySelector(".event-hand"), "Escape preserves the hand for the pause menu");
  await click(".event-table");
  check(document.querySelector(".event-hand"), "closing hand stays mounted for its exit animation");
  await delay(300);
  check(!document.querySelector(".event-hand"), "table background closes hand before leaving");
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
  results.push(
    "PASS transfer: one-click placement, hand exit, matching landing layout, hold fill/drain",
  );
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
  check(
    current.visit && document.querySelector(".is-selected"),
    "Escape preserves reward selection",
  );
  await click(".event-table");
  check(
    current.visit && !document.querySelector(".is-selected"),
    "table background cancels reward",
  );
  await click(".reward-card");
  await click(".reward-card");
  await delay(1000);
  check(current.deck.length === 10 && !current.visit, "second click collects reward");
  results.push("PASS reward: Escape preserves selection, background cancels, collect once");
  show("transfer");
  await delay(50);
  await click(".table-leave");
  check(!current.visit, "leave completes node");
  results.push("PASS leave: returns to map");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const openPause = async () => {
    flushSync(() => showPause(true));
    const dialog = query(".pause-menu-dialog") as unknown as HTMLDialogElement;
    check(dialog.open, "pause menu uses a modal dialog");
    check(!dialog.querySelector(".close"), "pause menu has no close icon");
    check(document.activeElement?.textContent?.trim() === "继续游戏", "resume receives focus");
    if (!reduced) check(dialog.getAnimations().length > 0, "pause menu animates on entry");
    await delay(250);
    return dialog;
  };
  let dialog = await openPause();
  query(".pause-menu-actions button").click();
  check(dialog.open, "resume keeps the modal open until its exit completes");
  await delay(220);
  check(!document.querySelector(".pause-menu-dialog"), "resume closes after exit");
  dialog = await openPause();
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  check(dialog.open, "Escape cancellation keeps the modal open during exit");
  await delay(220);
  check(!document.querySelector(".pause-menu-dialog"), "Escape closes after exit");
  dialog = await openPause();
  const rect = dialog.getBoundingClientRect();
  const pointer = (x: number, y: number) => {
    dialog.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }),
    );
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
  };
  pointer(rect.left + 5, rect.top + 5);
  await delay(220);
  check(dialog.open, "dialog padding does not dismiss the pause menu");
  pointer(rect.left - 5, rect.top - 5);
  check(dialog.open, "backdrop dismiss waits for exit");
  await delay(220);
  check(!document.querySelector(".pause-menu-dialog"), "backdrop closes after exit");
  dialog = await openPause();
  const action = query(".pause-menu-actions button:last-child");
  action.click();
  action.click();
  check(pauseActions === 0, "menu action waits for the exit animation");
  await delay(220);
  check(
    pauseActions === 1 && !document.querySelector(".pause-menu-dialog"),
    "rapid clicks execute the menu action once",
  );
  results.push(
    "PASS pause: entry/exit motion, resume, Escape, backdrop, focus, deferred action once",
  );
  flushSync(showModalCheck);
  const standard = query('.modal[aria-label="通用弹窗检查"]') as unknown as HTMLDialogElement;
  check(
    standard.open && (reduced || standard.getAnimations().length),
    "shared modal animates on entry",
  );
  await delay(250);
  query('.modal[aria-label="通用弹窗检查"] .close').click();
  check(standard.open, "close icon waits for the exit animation");
  await delay(220);
  check(!standard.isConnected, "close icon removes the shared modal after exit");
  flushSync(showSearch);
  dialog = query(".deck-search-dialog") as unknown as HTMLDialogElement;
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  await delay(250);
  check(dialog.open && !dialog.querySelector(".close"), "mandatory search cannot be dismissed");
  query(".deck-search-grid button").click();
  await delay(250);
  dialog = query(".deck-search-dialog") as unknown as HTMLDialogElement;
  check(
    dialog.open && query(".deck-search-grid").children.length === 2,
    "next search reopens after the first exit",
  );
  query(".deck-search-grid button").click();
  await delay(250);
  check(!document.querySelector(".deck-search-dialog"), "final search dismisses after exit");
  results.push(
    "PASS shared modal: close icon animation, mandatory choice, consecutive search dialogs",
  );
  return results.join("\n");
}
export function Harness() {
  const [run, setRun] = useState(current);
  const [version, setVersion] = useState(0);
  const [report, setReport] = useState("");
  const [testing, setTesting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [modalCheck, setModalCheck] = useState(false);
  const [searchBattle, setSearchBattle] = useState<Battle | null>(null);
  useEffect(() => {
    showPause = setPaused;
    showModalCheck = () => setModalCheck(true);
    showSearch = () => {
      const battle = startBattle(initialDeck(), 1, 123);
      battle.searches = [
        { sourceId: "same-source", name: "检索" },
        { sourceId: "same-source", name: "检索" },
      ];
      setSearchBattle(battle);
    };
    show = (kind) =>
      flushSync(() => {
        current = sample(kind);
        setRun(current);
        setVersion((v) => v + 1);
      });
  }, []);
  return (
    <>
      {modalCheck && (
        <Modal label="通用弹窗检查" onClose={() => setModalCheck(false)}>
          <h2>通用弹窗检查</h2>
        </Modal>
      )}
      {searchBattle && (
        <DeckSearch
          battle={searchBattle}
          onChoose={(id) => setSearchBattle(chooseSearch(searchBattle, id))}
        />
      )}
      {paused && (
        <PauseMenu
          onClose={() => setPaused(false)}
          actions={[
            {
              label: "检查操作",
              onSelect: () => {
                pauseActions++;
              },
            },
          ]}
        />
      )}
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
