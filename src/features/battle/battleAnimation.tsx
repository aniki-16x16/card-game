import { deployFlight } from "./deployFlight";
import { sacrificeSchedule } from "./sacrificeSchedule";
import { motionScope } from "./motion";
import { attackFlight } from "./attackFlight";
import { renderToStaticMarkup } from "react-dom/server";
import { CardFace } from "../../components/cards/Cards";
import type { BattleAction, Battle, BattleFrame } from "../../domain/game";
import { attackPower } from "../../domain/game";

// 受击调参入口：duration 单位为毫秒，越小反馈越快。
// 卡牌摇晃和伤害数字同时播放，总耗时取两者中较大的 duration。
const HIT = {
  duration: 180, // 卡牌摇晃、闪亮并恢复的总时长（原为 460）。
  shakeLeft: -9, // 第一次横向偏移（px），绝对值越大摇晃越强。
  shakeRight: 7, // 回弹的横向偏移（px）。
  impactOffset: 0.2, // 在总时长的 20% 处达到受击姿态。
  reboundOffset: 0.45, // 在总时长的 45% 处达到回弹姿态。
  flash: "brightness(1.8) sepia(.6)", // 受击时的亮度与暖色强度。
  number: {
    duration: 180, // 伤害数字出现、上浮、消失的总时长（原为 240）。
    appearOffset: 0.2, // 数字完全显现的时间比例。
    rise: 45, // 数字向上飘动的距离（px）。
    startScale: 0.7, // 数字刚出现时的缩放倍数。
    endScale: 1.15, // 数字消失时的缩放倍数。
  },
};

const find = (id?: string) =>
  id ? document.querySelector<HTMLElement>(`[data-motion="${CSS.escape(id)}"]`) : null;

export async function animateBattleAction(
  action: BattleAction,
  signal: AbortSignal,
  state: Battle,
  retained?: (() => void)[],
  resolve = find,
) {
  // 致死伤害仍保留规则快照，但跳过摇晃、闪亮和伤害数字，交给随后的 death 动作。
  // lethal 由规则层判断，包含毒杀、反伤及断尾存活，不能只检查当前快照的 hp。
  if (action.kind === "hit" && action.lethal) return;
  // 天平受击由 BalanceScale 的游标、亮起和刻度反馈统一呈现，不额外生成数字或震动。
  if (action.kind === "hit" && (action.target === "life-player" || action.target === "life-enemy"))
    return;
  const source = resolve(action.source),
    target = resolve(action.target);
  if (!target || signal.aborted) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const floating: HTMLElement[] = [];
  const motion = motionScope(signal);
  const run = (
    element: HTMLElement,
    frames: { offset?: number; transform?: string; opacity?: number; filter?: string }[],
    duration: number,
  ) =>
    motion.tween(element, {
      duration: reduced ? 100 : duration,
      ease: "out(3)",
      keyframes: Object.fromEntries(
        frames.map((frame, index) => {
          const { offset, ...values } = frame;
          return [String((offset ?? index / (frames.length - 1)) * 100) + "%", values];
        }),
      ),
    });
  try {
    const end = target.getBoundingClientRect();
    if (action.kind === "deploy" || action.kind === "advance") {
      const [side, row, col] = action.target.split("-");
      const card = state[side as "player" | "enemy"][Number(row)][Number(col)];
      if (card)
        await deployFlight(
          source,
          target,
          renderToStaticMarkup(
            <CardFace
              card={card}
              attack={attackPower(state, side as "player" | "enemy", Number(row), Number(col))}
              compact
            />,
          ),
          action.kind === "advance",
          signal,
          retained,
        );
    } else if (action.kind === "attack" && source) {
      // 普通模式的攻击节奏与姿态在 attackFlight.ts 顶部 ATTACK 中调整。
      // 系统选择减少动态效果时，只闪亮原卡牌，不播放飞行与蓄力。
      if (reduced)
        await run(source, [{ filter: "brightness(1.5)" }, { filter: "brightness(1)" }], 100);
      else await attackFlight(source, target, action.route === "air", signal);
    } else if (action.kind === "hit") {
      const number = document.createElement("div");
      number.className = "damage-number";
      number.textContent = action.amount ? `−${action.amount}` : "格挡";
      Object.assign(number.style, {
        left: `${end.left + end.width / 2}px`,
        top: `${Math.max(80, Math.min(innerHeight - 80, end.top + end.height / 2))}px`,
      });
      document.body.append(number);
      floating.push(number);
      await Promise.all([
        run(
          number,
          [
            { opacity: 0, transform: `translate(-50%,0) scale(${HIT.number.startScale})` },
            { opacity: 1, offset: HIT.number.appearOffset },
            {
              opacity: 0,
              transform: `translate(-50%,-${HIT.number.rise}px) scale(${HIT.number.endScale})`,
            },
          ],
          HIT.number.duration,
        ),
        run(
          target,
          [
            { transform: "translateX(0)", filter: "brightness(1)" },
            {
              transform: reduced ? "none" : `translateX(${HIT.shakeLeft}px)`,
              filter: HIT.flash,
              offset: HIT.impactOffset,
            },
            {
              transform: reduced ? "none" : `translateX(${HIT.shakeRight}px)`,
              offset: HIT.reboundOffset,
            },
            { transform: "translateX(0)", filter: "brightness(1)" },
          ],
          HIT.duration,
        ),
      ]);
    } else if (action.kind === "sacrifice" || action.kind === "effect") {
      await run(
        target,
        [
          { filter: "brightness(1)" },
          { filter: "brightness(1.8) sepia(.7)", offset: 0.5 },
          { filter: "brightness(1)" },
        ],
        300,
      );
    } else if (action.kind === "death") {
      // 所有死亡共用原献祭动画：翻转摇摆后缩小淡出，保留相同的暖色色调。
      // 下方各关键帧的 duration（毫秒）控制每段速度；当前合计 450 毫秒。
      if (reduced) await run(target, [{ opacity: 1 }, { opacity: 0 }], 100);
      else
        await motion.tween(target, {
          ease: "out(2)",
          keyframes: [
            {
              translateX: -14,
              translateY: -20,
              rotateZ: -20,
              rotateX: -28,
              scale: 1.13,
              opacity: 1,
              filter: "brightness(1.3)",
              duration: 75,
            },
            {
              translateX: 18,
              translateY: -10,
              rotateZ: 24,
              rotateX: 22,
              scale: 1.08,
              duration: 60,
            },
            {
              translateX: -16,
              translateY: -16,
              rotateZ: -25,
              rotateX: -24,
              scale: 1.1,
              duration: 60,
            },
            { translateX: 12, translateY: -5, rotateZ: 18, rotateX: 18, scale: 1.03, duration: 55 },
            {
              translateX: -8,
              translateY: 0,
              rotateZ: -12,
              rotateX: -12,
              scale: 0.98,
              filter: "sepia(1) saturate(2)",
              duration: 55,
            },
            {
              translateX: 0,
              translateY: 16,
              rotateZ: 8,
              rotateX: 30,
              scale: 0.55,
              opacity: 0,
              duration: 145,
            },
          ],
        });
    }
  } finally {
    const cleanup = () => {
      motion.dispose();
      floating.forEach((node) => node.remove());
    };
    if (retained && !signal.aborted) retained.push(cleanup);
    else cleanup();
  }
}

/** All marks are already rendered. Deaths overlap, starting 100ms apart. */
export async function animateSacrificeBatch(
  frames: BattleFrame[],
  signal: AbortSignal,
  retained: (() => void)[],
  resolve = find,
) {
  const motion = motionScope(signal);
  try {
    await Promise.all(
      frames.map(({ action }) => {
        const badge = resolve(action.target)?.querySelector<HTMLElement>(".sacrifice-badge");
        return badge
          ? motion.tween(badge, {
              opacity: [0.35, 1],
              scale: matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : [1.22, 1],
              duration: 180,
              ease: "out(3)",
            })
          : Promise.resolve();
      }),
    );
    if (signal.aborted) return;
    await Promise.all(
      sacrificeSchedule(frames).map(async ({ frame, delay }) => {
        if (delay)
          await motion.tween({ progress: 0 }, { progress: 1, duration: delay, ease: "linear" });
        if (!signal.aborted)
          await animateBattleAction(frame.action, signal, frame.state, retained, resolve);
      }),
    );
  } finally {
    motion.dispose();
  }
}
