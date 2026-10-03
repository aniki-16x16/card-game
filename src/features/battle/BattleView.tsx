import { BalanceScale } from "./BalanceScale";
import { BattleHand } from "./BattleHand";
import { attackPower, requiresDraw, sacrificePoints, awaitingSearch } from "../../domain/game";
import type { Battle, Card, DrawPile, Unit } from "../../domain/game";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CardFace } from "../../components/cards/Cards";
import { ENEMIES } from "../../domain/enemyAI";
import { animate } from "animejs";
import { TABLE, boardWidth, tableWidth, tableHeight, tableBounds, tableScale } from "./tableLayout";

type Props = {
  actionLabel: string;
  battle: Battle;
  selected: string | null;
  settling: boolean;
  onSelect: (id: string | null) => void;
  onDeploy: (row: number, col: number) => void;
  onSacrifice: (id: string) => void;
  onDraw: (pile: DrawPile) => void;
  onInspect: (card: Card | Unit) => void;
  onEnd: () => void;
};

export function BattleView(props: Props) {
  const { battle, selected, onInspect } = props;
  const settling = props.settling || awaitingSearch(battle);
  const card = battle.hand.find((c) => c.id === selected);
  const choosingSacrifices = !!card && card.cost > 0 && !battle.summon?.paid;
  const choosingSlot = !!card && !choosingSacrifices;
  const availableSacrifices = sacrificePoints(battle);
  const locked = !!battle.summon?.paid;
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const screen = useRef<HTMLDivElement>(null);
  const endButton = useRef<HTMLButtonElement>(null);
  const drawWarning = useRef<ReturnType<typeof animate> | null>(null);
  const [drawRejectedFor, setDrawRejectedFor] = useState<Battle | null>(null);
  const drawRejected = drawRejectedFor === battle;
  const mustDraw = requiresDraw(battle);
  useEffect(() => {
    return () => {
      drawWarning.current?.revert();
      drawWarning.current = null;
    };
  }, [battle, settling]);
  function endTurn() {
    if (!mustDraw) {
      props.onEnd();
      return;
    }
    const button = endButton.current;
    if (!button) return;
    drawWarning.current?.revert();
    setDrawRejectedFor(battle);
    const style = getComputedStyle(button);
    const background = style.backgroundColor,
      color = style.color;
    drawWarning.current = animate(button, {
      translateX: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? [0, 0]
        : [0, -18, 18, -16, 16, -12, 12, -6, 6, 0],
      backgroundColor: [background, "#c84d3d", "#c84d3d", background],
      color: [color, "#fff2e9", "#fff2e9", color],
      duration: 700,
      ease: "linear",
      onComplete: () => {
        drawWarning.current?.revert();
        drawWarning.current = null;
        setDrawRejectedFor(null);
      },
    });
  }
  const scale = tableScale(size.width, size.height);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const cameraStyle = {
    "--world-width": `${tableWidth}px`,
    "--world-height": `${tableHeight}px`,
    "--board-width": `${boardWidth}px`,
    "--lane-width": `${TABLE.cardWidth}px`,
    "--table-angle": `${TABLE.angle}deg`,
    "--table-perspective": `${TABLE.perspective}px`,
  } as CSSProperties;
  return (
    <div className="combat-screen" ref={screen}>
      <aside className="combat-rail left-rail" aria-label="战斗状态">
        {battle.enemyAI && (
          <div className="enemy-profile" aria-label="敌人倾向">
            <strong>{ENEMIES[battle.enemyAI.profile].name}</strong>
          </div>
        )}
        <div className="combat-round">
          <span>回合</span>
          <strong>{String(battle.round).padStart(2, "0")}</strong>
          <span>
            {awaitingSearch(battle) && !props.settling
              ? "检索选牌"
              : settling
                ? "交锋结算中"
                : "你的部署阶段"}
          </span>
        </div>
      </aside>

      <section
        className={`combat-field camera-field ${settling ? "is-resolving" : ""}`}
        aria-label="战场"
        style={cameraStyle}
      >
        <div className="combat-scale" aria-label="战斗天平">
          <BalanceScale balance={battle.balance} />
        </div>
        <div className="camera-viewport" ref={viewport} aria-label="完整牌桌">
          <div
            className="camera-space"
            style={{ height: tableBounds.height * scale, width: tableBounds.width * scale }}
          >
            <div className="table-fit" style={{ transform: `scale(${scale})` }}>
              <div
                className="camera-world table-world"
                style={{ left: -tableBounds.left, top: -tableBounds.top }}
              >
                <div className="table-board">
                  {(["enemy", "player"] as const).map((side) => (
                    <div className={`combat-side ${side}`} key={side}>
                      {(side === "enemy" ? [1, 0] : [0, 1]).map((row) => (
                        <div className="combat-rank" key={row}>
                          <span className="rank-label">
                            {side === "enemy" ? "敌方" : "我方"}
                            <b>{row === 0 ? "前排" : "后排"}</b>
                          </span>
                          {battle[side][row].map((unit, col) => (
                            <button
                              key={col}
                              data-motion={`${side}-${row}-${col}`}
                              data-slot={`${side}-${row}-${col}`}
                              className={`combat-slot ${unit ? "filled" : ""} ${side === "player" && !settling ? (!unit && choosingSlot ? "deployable" : unit && choosingSacrifices ? "sacrificable" : "") : ""} ${side === "player" && unit && battle.summon?.sacrifices.includes(unit.id) ? "sacrifice-marked" : ""}`}
                              aria-label={`${side === "player" ? "我方" : "敌方"}${row === 0 ? "前排" : "后排"}第${col + 1}列${unit ? ` ${unit.name}${unit.submerged ? " 潜水中" : ""}` : " 空位"}`}
                              aria-pressed={
                                side === "player" && unit && choosingSacrifices
                                  ? battle.summon?.sacrifices.includes(unit.id)
                                  : undefined
                              }
                              disabled={settling}
                              onClick={() => {
                                if (unit && side === "player" && choosingSacrifices)
                                  props.onSacrifice(unit.id);
                                else if (unit) onInspect(unit);
                                else if (side === "player" && choosingSlot)
                                  props.onDeploy(row, col);
                              }}
                              onContextMenu={(event) => {
                                if (unit) {
                                  event.preventDefault();
                                  onInspect(unit);
                                }
                              }}
                            >
                              {unit ? (
                                <>
                                  <CardFace
                                    card={unit}
                                    attack={attackPower(battle, side, row, col)}
                                    compact
                                    onInspect={onInspect}
                                  />
                                  {side === "player" &&
                                    battle.summon?.sacrifices.includes(unit.id) && (
                                      <span className="sacrifice-badge">✕ 献祭标记</span>
                                    )}
                                </>
                              ) : (
                                <span className="vacant-mark">
                                  {side === "player" && choosingSlot ? "+" : "·"}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="table-decks" aria-label="选择抽牌牌堆">
                  {(["deck", "squirrelDeck"] as const).map((pile) => (
                    <button
                      key={pile}
                      data-motion={`pile-${pile}`}
                      className={`table-deck ${pile === "squirrelDeck" ? "squirrel-pile" : ""}`}
                      aria-label={`${pile === "deck" ? "主牌堆" : "松鼠牌堆"} ${battle[pile].length} 张，${battle.canDraw ? "可抽牌" : "本回合已抽牌"}`}
                      disabled={
                        settling ||
                        !!battle.summon ||
                        !battle.canDraw ||
                        !battle[pile].length ||
                        battle.status !== "playing"
                      }
                      onClick={() => props.onDraw(pile)}
                    >
                      <span className="deck-back">
                        <span>{pile === "deck" ? "主牌堆" : "松鼠"}</span>
                        <i aria-hidden="true">❋</i>
                        <strong>{battle[pile].length}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="combat-rail right-rail" aria-label="战斗操作">
        {(settling || card) && (
          <div className="combat-instruction" role="status">
            {settling ? (
              <p className="action-label">{props.actionLabel}</p>
            ) : (
              card && (
                <>
                  <strong>{card.name}</strong>
                  {choosingSacrifices && availableSacrifices < card.cost && <p>费用不足</p>}
                  {battle.summon?.error && <p>{battle.summon.error}</p>}
                  {!locked && (
                    <button onClick={() => props.onSelect(null)}>
                      {choosingSacrifices ? "取消献祭" : "取消选择"}
                    </button>
                  )}
                </>
              )
            )}
          </div>
        )}
        <button
          ref={endButton}
          className={`primary combat-end ${drawRejected ? "draw-rejected" : ""}`}
          disabled={settling || locked || battle.status !== "playing"}
          onClick={endTurn}
        >
          {settling ? "行动中…" : locked ? "请先完成部署" : drawRejected ? "请先抽牌" : "结束回合"}{" "}
          <span>→</span>
        </button>
      </aside>

      <BattleHand
        cards={battle.hand}
        selected={selected}
        available={availableSacrifices}
        disabled={settling || locked || battle.status !== "playing"}
        settling={settling}
        onSelect={props.onSelect}
        onInspect={onInspect}
      />
    </div>
  );
}
