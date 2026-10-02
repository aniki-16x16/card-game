import { renderToStaticMarkup } from "react-dom/server";
import { CardFace } from "../../components/cards/Cards";
import { attackPower } from "../../domain/game";
import type { Battle, BattleFrame } from "../../domain/game";
import { animateBattleAction, animateSacrificeBatch } from "./battleAnimation";
import { flightRect, mountFlight } from "./tableFlight";

const boardSlot = /^(player|enemy)-[01]-[0-4]$/;
const find = (id: string) =>
  document.querySelector<HTMLElement>(`.combat-screen [data-motion="${CSS.escape(id)}"]`);

/** Capture before committing rules. Only these detached actors are animated;
 * live React slots and hand cards are never rewound by an older presentation. */
export function prepareBattlePresentation(
  before: Battle,
  frames: BattleFrame[],
  signal: AbortSignal,
) {
  const keys = new Set(
    frames
      .flatMap(({ action }) => [action.source, action.target])
      .filter((id): id is string => !!id && boardSlot.test(id)),
  );
  const table = document.querySelector<HTMLElement>(".combat-screen .table-world");
  const stage = document.createElement("div");
  stage.className = "presentation-stage";
  stage.style.visibility = "hidden";
  const actors = new Map<string, HTMLElement>();
  for (const id of keys) {
    const slot = find(id);
    if (!slot) continue;
    const rect = flightRect(slot, table);
    const actor = document.createElement("div");
    actor.className = "combat-slot presentation-actor";
    actor.dataset.presentationSlot = id;
    Object.assign(actor.style, {
      position: "absolute",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      "--lane-width": `${rect.width}px`,
    });
    stage.append(actor);
    actors.set(id, actor);
  }
  const flight = mountFlight(stage, table);
  const sources = new Map<string, HTMLElement>();
  for (const { action } of frames) {
    if (!action.source || boardSlot.test(action.source) || sources.has(action.source)) continue;
    const source = find(action.source);
    if (!source) continue;
    const rect = source.getBoundingClientRect();
    const snapshot = document.createElement("div");
    snapshot.dataset.motion = action.source;
    snapshot.setAttribute("aria-hidden", "true");
    Object.assign(snapshot.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      visibility: "hidden",
      pointerEvents: "none",
    });
    if (action.source.startsWith("hand-")) {
      const style = getComputedStyle(source);
      Object.assign(snapshot.style, {
        left: "0px",
        top: "0px",
        width: `${source.offsetWidth}px`,
        height: `${source.offsetHeight}px`,
        transform: style.transform,
        transformOrigin: style.transformOrigin,
      });
    }
    document.body.append(snapshot);
    if (action.source.startsWith("hand-")) {
      const measured = snapshot.getBoundingClientRect();
      snapshot.style.left = `${rect.left - measured.left}px`;
      snapshot.style.top = `${rect.top - measured.top}px`;
    }
    sources.set(action.source, snapshot);
  }
  // Each job owns its own mask. A queued successor keeps the slot masked even
  // when its predecessor finishes, without hiding any detached actor.
  const mask = document.createElement("style");
  mask.textContent = [...keys]
    .map((id) => `.combat-screen [data-motion="${id}"] > * { visibility: hidden !important; }`)
    .join("\n");
  document.head.append(mask);
  const render = (state: Battle) => {
    for (const [id, actor] of actors) {
      const [side, r, c] = id.split("-");
      const row = Number(r),
        col = Number(c),
        team = side as "player" | "enemy";
      const unit = state[team][row][col];
      actor.innerHTML = unit
        ? renderToStaticMarkup(
            <CardFace card={unit} attack={attackPower(state, team, row, col)} compact />,
          )
        : "";
    }
  };
  render(before);
  const resolve = (id?: string) => (id ? (actors.get(id) ?? sources.get(id) ?? find(id)) : null);
  const retained: (() => void)[] = [];
  const release = () => retained.splice(0).forEach((cleanup) => cleanup());
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    release();
    flight.dispose();
    mask.remove();
    sources.forEach((source) => source.remove());
    signal.removeEventListener("abort", dispose);
  };
  signal.addEventListener("abort", dispose, { once: true });
  return {
    keys,
    dispose,
    async play() {
      if (signal.aborted) {
        dispose();
        return;
      }
      stage.style.visibility = "visible";
      try {
        let batched = 0;
        while (
          batched < frames.length &&
          ["death", "sacrifice"].includes(frames[batched].action.kind)
        )
          batched++;
        if (batched) {
          await animateSacrificeBatch(frames.slice(0, batched), signal, retained, resolve);
          if (signal.aborted) return;
          render(frames[batched - 1].state);
          release();
        }
        for (const frame of frames.slice(batched)) {
          if (signal.aborted) return;
          await animateBattleAction(frame.action, signal, frame.state, retained, resolve);
          if (signal.aborted) return;
          render(frame.state);
          release();
        }
      } finally {
        dispose();
      }
    },
  };
}
