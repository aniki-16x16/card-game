import { useLayoutEffect, useRef } from "react";
import { CardFace } from "../../components/cards/Cards";
import { awaitingSearch } from "../../domain/game";
import type { Battle } from "../../domain/game";
import "./DeckSearch.css";

export function DeckSearch({
  battle,
  onChoose,
}: {
  battle: Battle;
  onChoose: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = awaitingSearch(battle);
  useLayoutEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
  }, [pending]);
  if (!pending) return null;
  return (
    <dialog
      ref={dialog}
      className="modal deck-search-dialog"
      aria-label="检索选牌"
      onCancel={(event) => event.preventDefault()}
    >
      <span className="eyebrow">{battle.searches[0].name} · 检索</span>
      <h2>选择一张牌加入手牌</h2>
      <div className="deck-search-grid">
        {battle.deck.map((card) => (
          <button key={card.id} onClick={() => onChoose(card.id)} aria-label={`检索 ${card.name}`}>
            <CardFace card={card} />
          </button>
        ))}
      </div>
    </dialog>
  );
}
