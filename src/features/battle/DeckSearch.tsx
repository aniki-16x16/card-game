import { Modal } from "../../components/Modal";
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
  const pending = awaitingSearch(battle);
  if (!pending) return null;
  return (
    <Modal
      key={`${battle.searches[0].sourceId}:${battle.deck.length}:${battle.continuation?.answers.length ?? 0}`}
      className="deck-search-dialog"
      label="检索选牌"
      dismissible={false}
      onClose={() => {}}
    >
      {(close) => (
        <>
          <span className="eyebrow">{battle.searches[0].name} · 检索</span>
          <h2>选择一张牌加入手牌</h2>
          <div className="deck-search-grid">
            {battle.deck.map((card) => (
              <button
                key={card.id}
                onClick={() => close(() => onChoose(card.id))}
                aria-label={`检索 ${card.name}`}
              >
                <CardFace card={card} />
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
