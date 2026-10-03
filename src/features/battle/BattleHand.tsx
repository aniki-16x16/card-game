import { useLayoutEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { CardFace } from "../../components/cards/Cards";
import type { Card, Unit } from "../../domain/game";
import { handLayout } from "./handLayout";
import "./HandArrival.css";

type Props = {
  cards: Card[];
  selected: string | null;
  available: number;
  disabled: boolean;
  settling: boolean;
  arrival?: boolean;
  onSelect: (id: string | null) => void;
  onInspect: (card: Card | Unit) => void;
  emptyText?: string;
};

export function BattleHand({
  cards,
  selected,
  available,
  disabled,
  settling,
  arrival,
  onSelect,
  onInspect,
  emptyText = "手牌已空 · 从右侧牌堆选择抽牌",
}: Props) {
  const root = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(600);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = cards.findIndex((card) => card.id === (hovered ?? selected));
  const identities = cards.map((card) => card.id).join("|");
  useLayoutEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    // Keep the actual hovered/selected pose until the flight takes ownership.
    if (!root.current) return;
    const layout = handLayout(cards.length, root.current.clientWidth || width, active);
    const animations = Array.from(
      root.current.querySelectorAll<HTMLElement>(".combat-hand-card"),
    ).flatMap((element, index) => {
      // New hands need their fan layout while waiting; existing flight poses stay frozen.
      if (settling && element.dataset.handPlaced) return [];
      const pose = layout[index];
      element.style.width = `${pose.width}px`;
      element.style.marginLeft = `${-pose.width / 2}px`;
      element.style.zIndex = String(pose.z);
      // New cards must be fanned out before their first paint, not animate from a stack.
      if (!element.dataset.handPlaced) {
        element.style.transform = `translateX(${pose.x}px) translateY(${pose.y}px) rotate(${pose.angle}deg) scale(${pose.scale})`;
        element.dataset.handPlaced = "true";
        return [];
      }
      return [
        animate(element, {
          translateX: pose.x,
          translateY: pose.y,
          rotate: pose.angle,
          scale: pose.scale,
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260,
          ease: "out(4)",
        }),
      ];
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, [identities, cards.length, width, active, settling]);
  return (
    <section
      ref={root}
      className={`combat-hand fan-hand ${arrival === undefined ? "" : `hand-arrival ${arrival ? "" : "hand-arrival-pending"}`}`}
      aria-label="你的手牌"
      onPointerLeave={() => {
        if (!settling) setHovered(null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(null);
      }}
    >
      <div className="combat-hand-strip">
        {cards.map((card) => (
          <button
            key={card.id}
            data-motion={`hand-${card.id}`}
            className={`combat-hand-card ${selected === card.id ? "selected" : ""} ${card.cost > available && selected !== card.id ? "unaffordable" : ""}`}
            aria-label={`选择 ${card.name}，${card.cost} 费`}
            aria-pressed={selected === card.id}
            disabled={disabled}
            onPointerEnter={(event) => {
              if (!disabled && event.pointerType !== "touch") setHovered(card.id);
            }}
            onFocus={() => {
              if (!disabled) setHovered(card.id);
            }}
            onClick={() => onSelect(selected === card.id ? null : card.id)}
          >
            <CardFace card={card} onInspect={onInspect} />
          </button>
        ))}
        {!cards.length && <p className="hand-empty">{emptyText}</p>}
      </div>
    </section>
  );
}
