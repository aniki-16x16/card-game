import { Heart, Swords } from "lucide-react";
import { SigilIcon } from "./SigilIcon";
import { Creature } from "../creatures/Creature";
import { SIGILS, TRIBES, sigils, sigilDescription, intrinsicAttack } from "../../domain/game";
import type { Card, Unit } from "../../domain/game";

export function CardFace({
  card,
  compact = false,
  onInspect,
  attack = intrinsicAttack(card),
}: {
  card: Card | Unit;
  compact?: boolean;
  onInspect?: (card: Card | Unit) => void;
  attack?: number;
}) {
  const submerged = "submerged" in card && card.submerged;
  const direction = "pushDirection" in card ? card.pushDirection : card.returnState?.pushDirection;
  const hp = "hp" in card ? card.hp : (card.returnState?.hp ?? card.health);
  const rushing = "rush" in card ? card.rush : card.returnState?.rush;
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
      {!!card.added.length && (
        <div className="card-added-sigils" aria-label="后天印记">
          {card.added.map((s) => (
            <span
              key={s}
              aria-label={SIGILS[s].name}
              title={SIGILS[s].name + "：" + sigilDescription(card, s)}
            >
              <SigilIcon sigil={s} />
            </span>
          ))}
        </div>
      )}
      <div className="card-sigils">
        {card.native.length ? (
          card.native.map((s) => (
            <span
              key={s}
              aria-label={SIGILS[s].name}
              title={`${SIGILS[s].name}：${sigilDescription(card, s)}`}
            >
              <SigilIcon sigil={s} />
              {!compact && card.native.length <= 2 && <small>{SIGILS[s].name}</small>}
            </span>
          ))
        ) : (
          <span className="no-sigil">—</span>
        )}
      </div>
      {(submerged || rushing || sigils(card).includes("shove") || !!card.costDiscount) && (
        <div className="card-status">
          {submerged && <span>潜水</span>}
          {rushing && <span>奔袭 +2</span>}
          {!!card.costDiscount && <span>接力 −{card.costDiscount} 费</span>}
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
          className={hp < card.health ? "hurt" : ""}
          aria-label={`生命 ${Math.max(0, hp)}`}
          title="生命"
        >
          <Heart className="stat-icon" aria-hidden="true" /> {Math.max(0, hp)}
        </span>
      </div>
    </div>
  );
}
