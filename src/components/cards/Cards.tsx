import { Heart, Swords } from "lucide-react";
import { SigilIcon } from "./SigilIcon";
import { Creature } from "../creatures/Creature";
import { SIGILS, TRIBES, sigils, sigilDescription } from "../../domain/game";
import type { Card, Unit } from "../../domain/game";

export function CardFace({
  card,
  compact = false,
  onInspect,
  attack = card.attack,
}: {
  card: Card | Unit;
  compact?: boolean;
  onInspect?: (card: Card | Unit) => void;
  attack?: number;
}) {
  const submerged = "submerged" in card && card.submerged;
  const direction = "pushDirection" in card ? card.pushDirection : undefined;
  return (
    <div
      onContextMenu={(event) => {
        if (onInspect) {
          event.preventDefault();
          event.stopPropagation();
          onInspect(card);
        }
      }}
      className={`card-face ${compact ? "compact" : ""} ${submerged ? "is-submerged" : ""} tone-${card.species}`}
    >
      <div className="card-top">
        <span>{card.name}</span>
        <span className="cost" title={card.cost ? `需要 ${card.cost} 费` : "免费召唤"}>
          {card.cost}
          <small>费</small>
        </span>
      </div>
      <span className="card-tribe">{TRIBES[card.tribe]}</span>
      <Creature species={card.species} art={card.art} />
      <div className="card-sigils">
        {sigils(card).length ? (
          sigils(card).map((s) => (
            <span
              key={s}
              aria-label={SIGILS[s].name}
              className={card.added.includes(s) ? "inherited" : ""}
              title={`${SIGILS[s].name}：${sigilDescription(card, s)}`}
            >
              <SigilIcon sigil={s} />
              {!compact && sigils(card).length <= 2 && <small>{SIGILS[s].name}</small>}
            </span>
          ))
        ) : (
          <span className="no-sigil">—</span>
        )}
      </div>
      {"hp" in card && (submerged || sigils(card).includes("shove")) && (
        <div className="card-status">
          {submerged && <span>潜水</span>}
          {sigils(card).includes("shove") && (
            <span aria-label={`推搡方向${direction === -1 ? "左" : "右"}`}>
              {direction === -1 ? "←" : "→"}
            </span>
          )}
        </div>
      )}
      <div className="card-stats">
        <span
          className={attack < card.attack ? "weakened" : attack > card.attack ? "boosted" : ""}
          aria-label={`攻击 ${attack}`}
          title="攻击"
        >
          <Swords className="stat-icon" aria-hidden="true" /> {attack}
        </span>
        <span
          className={"hp" in card && card.hp < card.health ? "hurt" : ""}
          aria-label={`生命 ${"hp" in card ? Math.max(0, card.hp) : card.health}`}
          title="生命"
        >
          <Heart className="stat-icon" aria-hidden="true" />{" "}
          {"hp" in card ? Math.max(0, card.hp) : card.health}
        </span>
      </div>
    </div>
  );
}
