import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CardFace } from "../../components/cards/Cards";
import { TribeSilhouette } from "../../components/creatures/TribeSilhouette";
import { TRIBES } from "../../domain/game";
import type { Card } from "../../domain/game";
import {
  categoryOptions,
  chooseCategory,
  isCombat,
  currentNode,
  takeReward,
  visitRewards,
  finishNode,
  NODE_NAMES,
} from "../../domain/adventure";
import type { Adventure } from "../../domain/adventure";
import "./RewardChoice.css";
import { useSceneTransition } from "../../components/transitions/SceneTransitionContext";
import { EventTable } from "./EventTable";

export function RewardChoice(props: {
  run: Adventure;
  onChange: (run: Adventure) => void;
  onInspect: (card: Card) => void;
}) {
  // Each new deal owns its animation lifecycle, including when a visit is restored.
  return (
    <ChoiceDeal
      key={`${props.run.visit!.nodeId}:${props.run.visit!.category ?? "category"}`}
      {...props}
    />
  );
}

function ChoiceDeal({
  run,
  onChange,
  onInspect,
}: {
  run: Adventure;
  onChange: (run: Adventure) => void;
  onInspect: (card: Card) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const locked = useRef(true);
  const alive = useRef(false);
  const animations = useRef<Animation[]>([]);
  const [busy, setBusy] = useState(true);
  const { active: sceneTransitionActive } = useSceneTransition();
  const [dealt, setDealt] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const category = run.visit!.category;
  const choosingCategory = category === undefined && !isCombat(currentNode(run)!.kind);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      animations.current.forEach((animation) => animation.cancel());
    };
  }, []);

  useLayoutEffect(() => {
    if (sceneTransitionActive || dealt) return;
    const cards = Array.from(root.current!.querySelectorAll<HTMLElement>(".choice-slot"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bounds = root.current!.getBoundingClientRect();
    const deal = cards.map((card, index) => {
      const rect = card.getBoundingClientRect();
      return card.animate(
        [
          {
            opacity: 0,
            transform: `translate(${bounds.right - rect.left - rect.width / 2}px, -90px) rotate(16deg) scale(.65)`,
          },
          { opacity: 1, transform: "translate(0, 0) rotate(0deg) scale(1)" },
        ],
        {
          duration: reduced ? 0 : 480,
          delay: reduced ? 0 : index * 110,
          easing: "cubic-bezier(.16, 1, .3, 1)",
          fill: "both",
        },
      );
    });
    animations.current = deal;
    void Promise.all(deal.map((animation) => animation.finished))
      .then(() => {
        if (!alive.current) return;
        locked.current = false;
        // Reveal the underlying cards in the same commit that releases the animation.
        flushSync(() => {
          setDealt(true);
          setBusy(false);
        });
        animations.current = [];
      })
      .catch(() => {
        /* Unmount cancels the current deal. */
      });
    return () => {
      deal.forEach((animation) => animation.cancel());
    };
  }, [sceneTransitionActive, dealt]);

  async function collect(next: Adventure, selected?: string) {
    if (locked.current) return;
    locked.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = Array.from(root.current!.querySelectorAll<HTMLElement>(".choice-slot"));
    const bounds = root.current!.getBoundingClientRect();
    const poses = cards.map((card) => {
      const button = card.querySelector<HTMLButtonElement>("button")!;
      const style = getComputedStyle(button);
      // Disabling the button must not remove its current hover/press pose mid-flight.
      button.style.transform = style.transform;
      button.style.filter = style.filter;
      button.style.transition = "none";
      return {
        transform: getComputedStyle(card).transform,
        opacity: getComputedStyle(card).opacity,
      };
    });
    flushSync(() => setBusy(true));
    animations.current.forEach((animation) => animation.cancel());
    const collection = cards.map((card, index) => {
      const picked = card.dataset.choice === selected;
      const rect = card.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2 - rect.left - rect.width / 2;
      return card.animate(
        [
          poses[index],
          {
            opacity: 1,
            transform: picked ? "translate(0, -18px) scale(1.06)" : "translate(0, 0) scale(.96)",
            offset: 0.25,
          },
          {
            opacity: 0,
            transform: `translate(${x}px, ${picked ? window.innerHeight - rect.top : -100}px) rotate(${picked ? -6 : 8}deg) scale(.55)`,
          },
        ],
        {
          duration: reduced ? 0 : picked ? 580 : 400,
          delay: reduced ? 0 : index * 45,
          easing: "cubic-bezier(.55, 0, .8, .4)",
          fill: "both",
        },
      );
    });
    animations.current = collection;
    try {
      await Promise.all(collection.map((animation) => animation.finished));
      if (alive.current) onChange(next);
    } catch {
      /* Leaving the event cancels its pending state change. */
    }
  }

  return (
    <EventTable
      title={isCombat(currentNode(run)!.kind) ? "战利品" : NODE_NAMES[currentNode(run)!.kind]}
      busy={busy}
      onCancel={() => {
        if (selected) {
          setSelected(null);
          return true;
        }
        return false;
      }}
      onLeave={() => void collect(choosingCategory ? finishNode(run) : takeReward(run, null))}
    >
      <div className="reward-choice" ref={root} aria-busy={busy}>
        {!choosingCategory && category !== undefined && (
          <p className="choice-category">
            {typeof category === "number" ? `${category} 费` : TRIBES[category]}
          </p>
        )}
        <div
          className={"choice-cards " + (selected ? "has-selection" : "")}
          data-dealt={dealt}
          style={sceneTransitionActive && !dealt ? { visibility: "hidden" } : undefined}
        >
          {choosingCategory
            ? categoryOptions(run).map((option) => (
                <div className="choice-slot" key={option} data-choice={String(option)}>
                  <button
                    className={`category-card ${typeof option === "number" ? "cost-category-card" : ""}`}
                    disabled={busy}
                    aria-label={`选择${typeof option === "number" ? `${option} 费` : TRIBES[option]}`}
                    onClick={() => void collect(chooseCategory(run, option), String(option))}
                  >
                    <span className="category-card-corner" aria-hidden="true">
                      ✦
                    </span>
                    {typeof option === "number" ? (
                      <span className="category-cost">
                        <strong>{option}</strong>
                        <span>费</span>
                      </span>
                    ) : (
                      <TribeSilhouette tribe={option} />
                    )}
                    {typeof option !== "number" && (
                      <span className="category-card-name">{TRIBES[option]}</span>
                    )}
                    <span className="category-card-corner bottom" aria-hidden="true">
                      ✦
                    </span>
                  </button>
                </div>
              ))
            : visitRewards(run).map((card) => (
                <div
                  className={"choice-slot " + (selected === card.id ? "is-selected" : "")}
                  key={card.id}
                  data-choice={card.id}
                >
                  <button
                    className="reward-card"
                    disabled={busy}
                    aria-label={`拿取 ${card.name}`}
                    aria-pressed={selected === card.id}
                    onClick={() => {
                      if (selected === card.id) void collect(takeReward(run, card.id), card.id);
                      else setSelected(card.id);
                    }}
                  >
                    <CardFace card={card} onInspect={onInspect} />
                    <span className="reward-card-action">再次点击 · 收入牌组</span>
                  </button>
                </div>
              ))}
        </div>
      </div>
    </EventTable>
  );
}
