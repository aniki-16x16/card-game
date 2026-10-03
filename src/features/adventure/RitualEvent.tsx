import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import { CardFace } from "../../components/cards/Cards";
import { BattleHand } from "../battle/BattleHand";
import { deployFlight } from "../battle/deployFlight";
import { motionScope } from "../battle/motion";
import { SIGILS, sigils, transfer } from "../../domain/game";
import type { Card } from "../../domain/game";
import {
  currentNode,
  finishNode,
  NODE_NAMES,
  removeCard,
  transferAtNode,
  upgradeCard,
  upgradeRisk,
} from "../../domain/adventure";
import type { Adventure } from "../../domain/adventure";
import { EventTable, HoldSeal } from "./EventTable";
import "../battle/BattleView.css";
import "../battle/BattleCamera.css";
import "../battle/BattleAnimation.css";

export function RitualEvent({
  run,
  onChange,
  onInspect,
}: {
  run: Adventure;
  onChange: (run: Adventure) => void;
  onInspect: (card: Card) => void;
}) {
  const kind = currentNode(run)!.kind;
  const visit = run.visit!;
  const isTransfer = kind === "transfer";
  const [donor, setDonor] = useState("");
  const [target, setTarget] = useState(visit.targetId ?? "");
  const [picking, setPicking] = useState<"donor" | "target" | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const a = run.deck.find((card) => card.id === donor);
  const b = run.deck.find((card) => card.id === target);
  const preview = isTransfer && a && b ? transfer(run.deck, donor, target) : null;
  const result = preview && !preview.error ? preview.deck.find((card) => card.id === target) : b;
  const choices = run.deck.filter((card) =>
    picking === "donor" ? card.id !== target && sigils(card).length > 0 : card.id !== donor,
  );
  const error = isTransfer
    ? preview?.error
    : kind === "remove" && run.deck.length <= 6
      ? "牌组至少保留 6 张。"
      : undefined;
  async function hideHand(signal: AbortSignal, retained: (() => void)[]) {
    const hand = root.current?.querySelector<HTMLElement>(".event-hand");
    if (!hand) return;
    const style = getComputedStyle(hand);
    const start = { transform: style.transform, opacity: Number(style.opacity) };
    hand.style.animation = "none";
    const motion = motionScope(signal);
    try {
      await motion.tween(hand, {
        transform: [start.transform, "translateY(140%)"],
        opacity: [start.opacity, 0],
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 230,
        ease: "in(3)",
      });
    } finally {
      if (signal.aborted) motion.dispose();
      else retained.push(() => motion.dispose());
    }
  }
  async function closeHand() {
    if (locked.current) return;
    locked.current = true;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const retained: (() => void)[] = [];
    flushSync(() => setBusy(true));
    try {
      await hideHand(signal, retained);
      if (!signal.aborted)
        flushSync(() => {
          setPicking(null);
          setBusy(false);
        });
    } finally {
      retained.forEach((cleanup) => cleanup());
      locked.current = false;
    }
  }
  const cancel = () => {
    if (picking) {
      void closeHand();
      return true;
    }
    if (!visit.done && (donor || target) && !visit.targetId) {
      setDonor("");
      setTarget("");
      return true;
    }
    return false;
  };
  function slotClick(slot: "donor" | "target") {
    if (locked.current || visit.done || (visit.targetId && !isTransfer)) return;
    if (picking === slot) void closeHand();
    else setPicking(slot);
  }
  async function placeCard(id: string | null) {
    if (!id || !picking || locked.current || visit.done) return;
    const slot = picking;
    const card = choices.find((card) => card.id === id);
    const destination = root.current?.querySelector<HTMLElement>(
      `[data-ritual-slot="${slot}"] .ritual-card-surface`,
    );
    const source = root.current?.querySelector<HTMLElement>(
      `[data-motion="hand-${CSS.escape(id)}"]`,
    );
    if (!card || !destination || !source) return;
    // The landing copy must already contain the same sigils as the final preview.
    const nextPreview = isTransfer && slot === "target" && a ? transfer(run.deck, donor, id) : null;
    const landing =
      nextPreview && !nextPreview.error ? nextPreview.deck.find((c) => c.id === id)! : card;
    locked.current = true;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const retained: (() => void)[] = [];
    flushSync(() => setBusy(true));
    try {
      // Flight captures the hand pose and hides the source before the hand starts retreating.
      const flight = deployFlight(
        source,
        destination,
        renderToStaticMarkup(<CardFace card={landing} />),
        false,
        signal,
        retained,
        "ritual",
      );
      await Promise.all([flight, hideHand(signal, retained)]);
      if (signal.aborted) return;
      flushSync(() => {
        if (slot === "donor") setDonor(card.id);
        else setTarget(card.id);
        setPicking(null);
        setBusy(false);
      });
    } finally {
      retained.forEach((cleanup) => cleanup());
      locked.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }
  async function commit() {
    if (locked.current || visit.done || error || !b || (isTransfer && !a)) return;
    const next = isTransfer
      ? transferAtNode(run, donor, target).run
      : kind === "remove"
        ? removeCard(run, target)
        : upgradeCard(run, target);
    if (next === run) return;
    locked.current = true;
    setBusy(true);
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const motion = motionScope(signal);
    const consumed = isTransfer || !next.deck.some((card) => card.id === target);
    const element = root.current?.querySelector<HTMLElement>(
      `[data-ritual-slot="${isTransfer ? "donor" : "target"}"] .card-face`,
    );
    try {
      if (element)
        await motion.tween(element, {
          opacity: consumed ? [1, 0] : 1,
          filter: consumed
            ? ["brightness(1)", "brightness(3) sepia(1)", "brightness(.15)"]
            : ["brightness(1)", "brightness(2)", "brightness(1)"],
          scale: consumed ? [1, 0.85] : [1, 1.05, 1],
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 650,
          ease: "inOut(3)",
        });
      if (!signal.aborted) onChange(next);
    } finally {
      motion.dispose();
      locked.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }
  const slot = (name: "donor" | "target", card: Card | undefined, label: string) => (
    <div className="ritual-place">
      <button
        className={"table-card-slot " + (picking === name ? "awaiting-card" : "")}
        data-ritual-slot={name}
        disabled={busy || visit.done || !!visit.targetId}
        aria-label={`选择${label}`}
        onClick={() => void slotClick(name)}
      >
        <div className="ritual-card-surface">
          {card ? (
            <CardFace card={card} onInspect={onInspect} />
          ) : (
            <span className="slot-etching">
              {name === "donor" ? <Sparkles /> : kind === "remove" ? <Flame /> : <span>◇</span>}
            </span>
          )}
        </div>
      </button>
      <span className="table-slot-label">{label}</span>
    </div>
  );
  return (
    <EventTable
      title={NODE_NAMES[kind]}
      busy={busy}
      onCancel={cancel}
      onLeave={() => onChange(finishNode(run))}
    >
      <div ref={root} className={"ritual-scene ritual-" + kind}>
        <div className="ritual-places">
          {isTransfer && slot("donor", a, "贡品")}
          {isTransfer && <ArrowRight className="ritual-direction" />}
          {slot(
            "target",
            visit.done ? b : result,
            isTransfer ? "接受方" : kind === "remove" ? "焚烧位" : "营火",
          )}
        </div>
        <div className="ritual-feedback" aria-live="polite">
          {error && <p>{error}</p>}
          {!!preview?.discarded?.length && !visit.done && (
            <p>将舍弃：{preview.discarded.map((sigil) => SIGILS[sigil].name).join("、")}</p>
          )}
          {!visit.done && kind === "upgrade" && b && (
            <p>
              {visit.stat === "attack" ? "攻击 +1" : "生命 +2"} · 风险{" "}
              {Math.round(upgradeRisk(run) * 100)}% · {visit.attempts}/3
            </p>
          )}
          {visit.done && <p>{visit.message}</p>}
        </div>
        {!visit.done && (
          <HoldSeal
            key={`${donor}:${target}:${visit.attempts}:${picking}`}
            disabled={busy || !!picking || !!error || !b || (isTransfer && !a)}
            label={
              isTransfer
                ? "按住刻印 · 消耗贡品"
                : kind === "remove"
                  ? "按住焚烧 · 永久移除"
                  : "按住添火 · 强化"
            }
            onComplete={() => void commit()}
          >
            {isTransfer ? <Sparkles /> : <Flame />}
          </HoldSeal>
        )}
        {picking && !visit.done && (
          <div className="event-hand hand-arrival" key={picking}>
            <BattleHand
              cards={choices}
              selected={null}
              available={Infinity}
              disabled={busy}
              settling={busy}
              onSelect={(id) => void placeCard(id)}
              onInspect={onInspect}
              emptyText="没有可选的卡牌"
            />
          </div>
        )}
      </div>
    </EventTable>
  );
}
