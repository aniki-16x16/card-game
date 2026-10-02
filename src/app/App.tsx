import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useBattleController } from "../features/battle/useBattleController";
import { Creature } from "../components/creatures/Creature";
import { CardFace } from "../components/cards/Cards";
import { SigilIcon } from "../components/cards/SigilIcon";
import { BattleView } from "../features/battle/BattleView";
import { DeckSearch } from "../features/battle/DeckSearch";
import { AdventureView, MapView } from "../features/adventure/AdventureView";
import { SceneTransitionProvider } from "../components/transitions/SceneTransition";
import { useSceneTransition } from "../components/transitions/SceneTransitionContext";
import {
  newAdventure,
  enterNode,
  currentNode,
  isCombat,
  recordBattle,
  finishNode,
  battleProfile,
} from "../domain/adventure";
import type { Adventure } from "../domain/adventure";
import {
  SIGILS,
  attackPower,
  intrinsicAttack,
  load,
  sigils,
  sigilDescription,
  startBattle,
} from "../domain/game";
import type { Card, Unit } from "../domain/game";
import "./App.css";
import "./GameMenu.css";
import "../features/battle/BattleView.css";
import "../features/battle/BattleCamera.css";
import "../features/battle/BattleAnimation.css";

function Modal({
  children,
  onClose,
  label,
  wide = false,
  dismissible = true,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  wide?: boolean;
  dismissible?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "map-dialog" : ""} ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      aria-label={label}
    >
      {dismissible && (
        <button className="close" onClick={onClose} aria-label="关闭">
          <X />
        </button>
      )}
      {children}
    </dialog>
  );
}
export default function App() {
  return (
    <SceneTransitionProvider>
      <Game />
    </SceneTransitionProvider>
  );
}

function Game() {
  const sceneTransition = useSceneTransition();
  const [run, setRun] = useState<Adventure>(() => newAdventure());
  const controller = useBattleController();
  const { battle, setBattle, settling, actionLabel } = controller;
  const [inspected, setInspected] = useState<Card | Unit | null>(null);
  const [reset, setReset] = useState(false),
    [showLog, setShowLog] = useState(false),
    [showMap, setShowMap] = useState(false);
  const [showMenu, setShowMenu] = useState(false),
    [showDeck, setShowDeck] = useState(false);
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  useEffect(() => {
    function openMenu(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.isComposing ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      setShowMenu(true);
    }
    window.addEventListener("keydown", openMenu);
    return () => window.removeEventListener("keydown", openMenu);
  }, []);
  const selected = battle?.summon?.cardId ?? null;
  function enter(id: string) {
    const next = enterNode(run, id);
    if (next === run) return;
    sceneTransition.start(() => {
      setRun(next);
      const node = currentNode(next)!;
      if (isCombat(node.kind))
        setBattle(
          startBattle(
            next.deck,
            node.floor,
            next.seed,
            node.kind === "boss" ? "boss" : node.kind === "elite" ? "elite" : "normal",
            battleProfile(next),
          ),
        );
      window.scrollTo({ top: 0 });
    });
  }
  function acceptRun(next: Adventure) {
    const apply = () => {
      setRun(next);
      setInspected(null);
    };
    if (next.visit?.nodeId !== run.visit?.nodeId || next.status !== run.status)
      sceneTransition.start(apply);
    else apply();
  }
  const detailHp =
    inspected && "hp" in inspected
      ? inspected.hp
      : (inspected?.returnState?.hp ?? inspected?.health);
  let detailAttack = inspected ? intrinsicAttack(inspected) : undefined;
  if (battle && inspected && "hp" in inspected)
    for (const side of ["player", "enemy"] as const)
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 5; col++)
          if (battle[side][row][col]?.id === inspected.id)
            detailAttack = attackPower(battle, side, row, col);
  return (
    <div className={`app-shell ${battle ? "battle-mode" : "adventure-mode"}`}>
      {battle ? (
        <main>
          <BattleView
            actionLabel={actionLabel}
            battle={battle}
            selected={selected}
            settling={settling}
            canForge={false}
            onSelect={controller.select}
            onSacrifice={controller.sacrifice}
            onDraw={controller.draw}
            onInspect={setInspected}
            onEnd={controller.end}
            onForge={() => setShowMap(true)}
            onReset={() => setReset(true)}
            onLog={() => setShowLog(true)}
            onDeploy={controller.deploy}
          />
        </main>
      ) : (
        <AdventureView
          run={run}
          onEnter={enter}
          onChange={acceptRun}
          onInspect={setInspected}
          onReset={() => setReset(true)}
        />
      )}
      {showMenu && (
        <Modal className="game-menu-dialog" label="游戏菜单" onClose={() => setShowMenu(false)}>
          <h2>菜单</h2>
          <nav className="game-menu-actions" aria-label="游戏菜单操作">
            <button
              onClick={() => {
                setShowMenu(false);
                setShowDeck(true);
              }}
            >
              查看牌组 · {run.deck.length}
            </button>
            <a
              href={`${import.meta.env.BASE_URL}creatures`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowMenu(false)}
            >
              图鉴 ↗
            </a>
            <button
              onClick={() => {
                setShowMenu(false);
                setReset(true);
              }}
            >
              重新开始
            </button>
          </nav>
        </Modal>
      )}
      {battle && !settling && !controller.pending && (
        <DeckSearch battle={battle} onChoose={controller.search} />
      )}
      {showDeck && (
        <Modal label="当前牌组" onClose={() => setShowDeck(false)}>
          <h2>当前牌组 · {run.deck.length}</h2>
          <div className="event-deck">
            {run.deck.map((card) => (
              <button
                key={card.id}
                onClick={() => setInspected(card)}
                aria-label={`查看 ${card.name}`}
              >
                <CardFace card={card} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {inspected && (
        <Modal label="生物印记" onClose={() => setInspected(null)}>
          <div className="sigil-detail-heading">
            <Creature species={inspected.species} art={inspected.art} />
            <div>
              <span className="eyebrow">生物印记</span>
              <h2>{inspected.name}</h2>
              <p>
                攻击 {detailAttack} · 生命 {detailHp} · 费用 {inspected.cost}
              </p>
            </div>
          </div>
          <div className="sigil-detail-capacity">
            外来印记容量{" "}
            <strong>
              {load(inspected)} / {inspected.capacity}
            </strong>
          </div>
          <div className="sigil-detail-list">
            {sigils(inspected).map((s) => (
              <div key={s}>
                <span>
                  <SigilIcon sigil={s} />
                </span>
                <div>
                  <h3>{SIGILS[s].name}</h3>
                  <p>{sigilDescription(inspected, s)}</p>
                </div>
              </div>
            ))}
            {!sigils(inspected).length && <p>无印记。</p>}
          </div>
        </Modal>
      )}
      {showLog && battle && (
        <Modal label="战斗记录" onClose={() => setShowLog(false)}>
          <h2>战斗记录</h2>
          <ol className="battle-log-dialog">
            {battle.log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </Modal>
      )}
      {showMap && (
        <Modal label="地图与牌组" wide onClose={() => setShowMap(false)}>
          <h2>当前路线与牌组</h2>
          <div className="event-deck">
            {run.deck.map((c) => (
              <CardFace key={c.id} card={c} />
            ))}
          </div>
          <MapView run={run} readOnly onEnter={() => {}} />
        </Modal>
      )}
      {reset && (
        <Modal label="重新开始冒险" onClose={() => setReset(false)}>
          <h2>重新出发？</h2>
          <p>当前旅程与牌组将被重置。</p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setReset(false)}>
              继续旅程
            </button>
            <button
              className="primary"
              onClick={() => {
                controller.abort();
                sceneTransition.start(() => {
                  setRun(newAdventure(Date.now()));
                  setBattle(null);
                  setInspected(null);
                  setShowMap(false);
                  setShowDeck(false);
                  setShowMenu(false);
                  setReset(false);

                  window.scrollTo({ top: 0 });
                });
              }}
            >
              重新开始
            </button>
          </div>
        </Modal>
      )}
      {battle && !settling && !controller.pending && battle.status !== "playing" && (
        <Modal
          dismissible={false}
          label={battle.status === "won" ? "遭遇胜利" : "遭遇失败"}
          onClose={() => {}}
        >
          <h2>{battle.status === "won" ? "天平为你倾斜。" : "契约止于此处。"}</h2>
          <p>
            {battle.status === "won"
              ? "敌方承压达到 10 点。"
              : "我方承压达到 10 点，本局冒险结束。"}
          </p>
          <button
            className="primary"
            onClick={() => {
              sceneTransition.start(() => {
                let next = recordBattle(run, battle.status as "won" | "lost");
                if (battle.status === "won" && currentNode(next)?.kind === "boss")
                  next = finishNode(next);
                setRun(next);
                setBattle(null);
                window.scrollTo({ top: 0 });
              });
            }}
          >
            {battle.status === "won"
              ? currentNode(run)?.kind === "boss"
                ? "查看通关结算"
                : "领取战利品"
              : "查看本局结算"}
          </button>
        </Modal>
      )}
    </div>
  );
}
