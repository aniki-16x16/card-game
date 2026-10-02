import { useEffect, useRef, useState } from "react";
import {
  Swords,
  Skull,
  Crown,
  Dices,
  PawPrint,
  Scissors,
  Flame,
  GitMerge,
  Gift,
  Check,
  ArrowRight,
} from "lucide-react";
import { CardFace } from "../../components/cards/Cards";
import { SIGILS, sigils, transfer } from "../../domain/game";
import type { Card } from "../../domain/game";
import {
  availableNodes,
  getMapReachability,
  currentNode,
  NODE_NAMES,
  removeCard,
  upgradeCard,
  upgradeRisk,
  transferAtNode,
  finishNode,
  isCombat,
} from "../../domain/adventure";
import type { Adventure } from "../../domain/adventure";
import { mapCurvePath } from "../../domain/mapGeometry";
import "./Adventure.css";
import { RewardChoice } from "./RewardChoice";

const icons = {
  cost: Dices,
  tribe: PawPrint,
  remove: Scissors,
  upgrade: Flame,
  transfer: GitMerge,
  item: Gift,
  battle: Swords,
  elite: Skull,
  boss: Crown,
};
export function MapView({
  run,
  onEnter,
  readOnly = false,
}: {
  run: Adventure;
  onEnter: (id: string) => void;
  readOnly?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target =
      root.current?.querySelector(".current") ?? root.current?.querySelector(".available");
    target?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [run.seed, run.path.length, run.visit?.nodeId, readOnly]);
  const available = availableNodes(run);
  const nodes = new Map(run.nodes.map((node) => [node.id, node]));
  const frontier = run.visit?.nodeId ?? run.path.at(-1);
  const { upcoming, reachable } = getMapReachability(run);
  const depth = (node: Adventure["nodes"][number]) => node.y ?? (node.floor - 1) * 150 + 62;
  const height = Math.max(...run.nodes.map(depth)) + 100;
  const y = (node: Adventure["nodes"][number]) => height - depth(node);
  return (
    <div ref={root} className="journey-map" aria-label="冒险地图">
      <svg
        className="map-routes"
        viewBox={`0 0 800 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {run.nodes.flatMap((node) =>
          node.next.map((id) => {
            const next = nodes.get(id)!;
            const state =
              node.id === frontier && upcoming.has(id)
                ? "upcoming"
                : reachable.has(node.id) && reachable.has(id)
                  ? "reachable"
                  : "unreachable";
            const x1 = node.x * 800,
              x2 = next.x * 800,
              y1 = y(node),
              y2 = y(next);
            return (
              <path
                key={`${node.id}-${id}`}
                d={mapCurvePath({ x: x1, y: y1 }, { x: x2, y: y2 })}
                className={state}
              />
            );
          }),
        )}
      </svg>
      <div style={{ height }}>
        {run.nodes.map((node) => {
          const Icon = icons[node.kind],
            visited = run.path.includes(node.id),
            active = run.visit?.nodeId === node.id;
          const state = upcoming.has(node.id)
            ? "available"
            : reachable.has(node.id)
              ? "reachable"
              : "unreachable";
          return (
            <div
              key={node.id}
              style={{ left: `${node.x * 100}%`, top: y(node) }}
              className={`map-node ${node.kind} ${state} ${active ? "current" : ""}`}
            >
              <button
                className="node-ring"
                disabled={readOnly || !available.includes(node.id)}
                onClick={() => onEnter(node.id)}
                aria-current={active ? "step" : undefined}
                aria-label={`${node.bonus ? "" : `第${node.floor}层 `}${NODE_NAMES[node.kind]}${visited ? " 已完成" : ""}${active ? " 当前节点" : ""}`}
              >
                {visited ? <Check /> : <Icon />}
              </button>
              <span className="node-caption">
                <strong>{NODE_NAMES[node.kind]}</strong>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForgeEvent({
  run,
  onChange,
  onInspect,
}: {
  run: Adventure;
  onChange: (r: Adventure) => void;
  onInspect: (c: Card) => void;
}) {
  const [donor, setDonor] = useState("");
  const [target, setTarget] = useState("");
  const [picking, setPicking] = useState<"donor" | "target" | null>(null);
  const a = run.deck.find((c) => c.id === donor);
  const b = run.deck.find((c) => c.id === target);
  const preview = a && b ? transfer(run.deck, donor, target) : null;
  const result = preview && !preview.error ? preview.deck.find((c) => c.id === target) : b;
  const choices = run.deck.filter((c) =>
    picking === "donor" ? c.id !== target && sigils(c).length > 0 : c.id !== donor,
  );
  return (
    <div className={picking ? "transfer-event picking" : "transfer-event"}>
      <div className="transfer-slots">
        <button
          className={"transfer-slot " + (picking === "donor" ? "active" : "")}
          aria-label="选择贡品"
          aria-pressed={picking === "donor"}
          onClick={() => setPicking(picking === "donor" ? null : "donor")}
        >
          <strong>贡品</strong>
          {a ? (
            <CardFace card={a} onInspect={onInspect} />
          ) : (
            <span className="transfer-empty">＋</span>
          )}
        </button>
        <ArrowRight className="transfer-arrow" aria-label="转移至" />
        <button
          className={"transfer-slot " + (picking === "target" ? "active" : "")}
          aria-label="选择接受方"
          aria-pressed={picking === "target"}
          onClick={() => setPicking(picking === "target" ? null : "target")}
        >
          <strong>接受方</strong>
          {result ? (
            <CardFace card={result} onInspect={onInspect} />
          ) : (
            <span className="transfer-empty">＋</span>
          )}
        </button>
      </div>
      {preview?.error && (
        <p className="error-text" role="status">
          {preview.error}
        </p>
      )}
      {!!preview?.discarded?.length && (
        <p className="transfer-discard" role="status">
          容量不足，将舍弃：{preview.discarded.map((s) => SIGILS[s].name).join("、")}
        </p>
      )}
      <button
        className="primary"
        disabled={!preview || !!preview.error}
        onClick={() => onChange(transferAtNode(run, donor, target).run)}
      >
        {a ? "消耗" + a.name + "并转移" : "确认转移"}
      </button>
      {picking && (
        <section
          className="transfer-hand"
          aria-label={picking === "donor" ? "选择贡品手牌" : "选择接受方手牌"}
        >
          <div className="transfer-hand-heading">
            <strong>{picking === "donor" ? "选择贡品" : "选择接受方"}</strong>
            <button onClick={() => setPicking(null)}>收起</button>
          </div>
          <div className="transfer-hand-cards">
            {choices.map((c) => (
              <button
                key={c.id}
                aria-label={"选择" + c.name}
                onClick={() => {
                  if (picking === "donor") setDonor(c.id);
                  else setTarget(c.id);
                  setPicking(null);
                }}
              >
                <CardFace card={c} onInspect={onInspect} />
              </button>
            ))}
          </div>
          {!choices.length && <p>没有可选的卡牌</p>}
        </section>
      )}
    </div>
  );
}

export function NodeEvent({
  run,
  onChange,
  onInspect,
}: {
  run: Adventure;
  onChange: (r: Adventure) => void;
  onInspect: (c: Card) => void;
}) {
  const node = currentNode(run)!,
    visit = run.visit!;
  const [selected, setSelected] = useState("");
  const reward = ["cost", "tribe"].includes(node.kind) || isCombat(node.kind);
  return (
    <section className="node-event">
      {!node.bonus && <span className="eyebrow">雾林之路 / 第 {node.floor} 层</span>}
      <h1>{isCombat(node.kind) ? "战利品" : NODE_NAMES[node.kind]}</h1>
      {visit.message && (
        <p className="event-message" role="status">
          {visit.message}
        </p>
      )}
      {reward ? (
        <RewardChoice run={run} onChange={onChange} onInspect={onInspect} />
      ) : (
        <>
          {!visit.done && node.kind === "transfer" && (
            <ForgeEvent run={run} onChange={onChange} onInspect={onInspect} />
          )}
          {!visit.done && ["remove", "upgrade"].includes(node.kind) && (
            <>
              {node.kind === "remove" ? (
                run.deck.length <= 6 && <p role="status">牌组至少保留 6 张。</p>
              ) : (
                <p>每次{visit.stat === "attack" ? "攻击 +1" : "生命 +2"}</p>
              )}
              {node.kind === "upgrade" && (
                <p className="risk-note">
                  已强化 {visit.attempts} / 3 次 ·{" "}
                  {run.safeUpgrades
                    ? "本局强化已永久安全"
                    : `下一轮被吃掉概率：${visit.attempts === 0 ? "0" : visit.attempts === 1 ? "1/6" : "1/3"}`}
                </p>
              )}
              <div className="event-deck">
                {run.deck.map((card) => (
                  <button
                    key={card.id}
                    aria-label={`选择 ${card.name}`}
                    aria-pressed={(visit.targetId || selected) === card.id}
                    disabled={!!visit.targetId && visit.targetId !== card.id}
                    onClick={() => setSelected(card.id)}
                  >
                    <CardFace card={card} onInspect={onInspect} />
                  </button>
                ))}
              </div>
              <button
                className="primary"
                disabled={
                  !(visit.targetId || selected) || (node.kind === "remove" && run.deck.length <= 6)
                }
                onClick={() =>
                  onChange(
                    node.kind === "remove"
                      ? removeCard(run, selected)
                      : upgradeCard(run, visit.targetId || selected),
                  )
                }
              >
                {node.kind === "remove"
                  ? "确认移除"
                  : upgradeRisk(run)
                    ? "承担风险，继续强化"
                    : "安全强化"}
              </button>
            </>
          )}
          <button className="secondary" onClick={() => onChange(finishNode(run))}>
            {visit.done
              ? "返回地图"
              : visit.attempts
                ? "带走卡牌，返回地图"
                : "放弃此节点，返回地图"}
          </button>
        </>
      )}
    </section>
  );
}

export function AdventureView({
  run,
  onEnter,
  onChange,
  onInspect,
  onReset,
}: {
  run: Adventure;
  onEnter: (id: string) => void;
  onChange: (r: Adventure) => void;
  onInspect: (c: Card) => void;
  onReset: () => void;
}) {
  return (
    <main className="adventure">
      {run.status !== "playing" ? (
        <section className="journey-result">
          {run.status === "won" ? <Crown size={60} /> : <Skull size={60} />}
          <h1>{run.status === "won" ? "你穿过了雾林。" : "契约止于此处。"}</h1>
          <p>
            {run.status === "won"
              ? "荒野之王已败，旅程完成。"
              : "天平向我方倾斜达到 10 点，本局冒险结束。"}
          </p>
          <p>
            完成 {run.path.length} 个节点 · 牌组 {run.deck.length} 张
          </p>
          <button className="primary" onClick={onReset}>
            开始新的旅程
          </button>
        </section>
      ) : run.visit ? (
        <NodeEvent key={run.visit.nodeId} run={run} onChange={onChange} onInspect={onInspect} />
      ) : (
        <div className="map-layout" tabIndex={0} role="region" aria-label="冒险路线">
          <MapView run={run} onEnter={onEnter} />
        </div>
      )}
    </main>
  );
}
