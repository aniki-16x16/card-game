import { useEffect, useRef } from "react";
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
} from "lucide-react";
import type { Card } from "../../domain/game";
import {
  availableNodes,
  getMapReachability,
  currentNode,
  NODE_NAMES,
  isCombat,
  finishNode,
} from "../../domain/adventure";
import type { Adventure } from "../../domain/adventure";
import { mapCurvePath } from "../../domain/mapGeometry";
import "./Adventure.css";
import { RewardChoice } from "./RewardChoice";
import { RitualEvent } from "./RitualEvent";
import { EventTable } from "./EventTable";

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

export function NodeEvent(props: {
  run: Adventure;
  onChange: (r: Adventure) => void;
  onInspect: (c: Card) => void;
}) {
  const node = currentNode(props.run)!;
  if (node.kind === "item")
    return (
      <EventTable
        title={NODE_NAMES.item}
        onCancel={() => false}
        onLeave={() => props.onChange(finishNode(props.run))}
      >
        <Gift className="table-item" />
      </EventTable>
    );
  return ["cost", "tribe"].includes(node.kind) || isCombat(node.kind) ? (
    <RewardChoice {...props} />
  ) : (
    <RitualEvent {...props} />
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
