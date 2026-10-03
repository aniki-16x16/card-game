import { useLayoutEffect, useRef } from "react";
import { animate } from "animejs";
import "./BalanceScale.css";

const color = (value: number) => {
  const endpoint = value < 0 ? [223, 130, 116] : [152, 201, 139];
  const weight = Math.min(1, Math.abs(value) / 10);
  return `rgb(${endpoint.map((channel) => Math.round(255 + (channel - 255) * weight)).join(" ")})`;
};

export function BalanceScale({ balance }: { balance: number }) {
  const ruler = useRef<HTMLDivElement>(null);
  const position = useRef({ value: balance, emphasis: 0 });
  useLayoutEffect(() => {
    const element = ruler.current;
    if (!element) return;
    const marker = element.querySelector<HTMLElement>(".balance-pointer")!;
    const ticks = Array.from(element.querySelectorAll<HTMLElement>(".balance-ticks > span"));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const changed = position.current.value !== balance;
    const render = () => {
      const value = Math.max(-10, Math.min(10, position.current.value));
      const pressure = Math.abs(value);
      marker.style.left = `${(value + 10) * 5}%`;
      element.style.setProperty("--balance-color", color(value));
      element.style.setProperty("--balance-emphasis", String(position.current.emphasis));
      for (const tick of ticks) {
        const mark = Number(tick.dataset.value);
        // 从中点到游标逐格点亮；最后四格渐强，呈现接近胜负的方向。
        const sameSide = mark * value > 0;
        const active = sameSide ? Math.max(0, Math.min(1, pressure - Math.abs(mark) + 1)) : 0;
        const danger = sameSide && Math.abs(mark) >= 7 ? Math.max(0, (pressure - 6) / 4) : 0;
        tick.style.setProperty("--tick-active", String(active));
        tick.style.setProperty("--tick-danger", String(danger));
      }
    };
    if (reduced) position.current.emphasis = 0;
    render();
    const animation = animate(position.current, {
      value: balance,
      duration: reduced ? 0 : 460,
      ease: "out(3)",
      onUpdate: render,
      onComplete: render,
    });
    // 仅在承压变化时吸引视线；新受击从当前姿态衔接，不重置游标。
    const emphasis =
      changed && !reduced
        ? animate(position.current, {
            emphasis: [position.current.emphasis, 1, 0],
            duration: 680,
            ease: "out(3)",
            onUpdate: render,
            onComplete: render,
          })
        : null;
    return () => {
      animation.cancel();
      emphasis?.cancel();
    };
  }, [balance]);
  return (
    <div
      ref={ruler}
      className="balance-ruler"
      role="meter"
      aria-label="战斗天平位置"
      aria-valuemin={-10}
      aria-valuemax={10}
      aria-valuenow={balance}
      aria-valuetext={
        balance === 0 ? "平衡" : `${balance > 0 ? "敌方" : "我方"}承压 ${Math.abs(balance)}`
      }
    >
      <span className="balance-pointer" aria-hidden="true" />
      <div className="balance-ticks" aria-hidden="true">
        {Array.from({ length: 21 }, (_, index) => {
          const value = index - 10;
          return (
            <span
              key={value}
              data-value={value}
              data-motion={value === -10 ? "life-player" : value === 10 ? "life-enemy" : undefined}
              className={`${value % 5 === 0 ? "major" : ""} ${value === 0 ? "center" : ""} ${Math.abs(value) === 10 ? "endpoint" : ""}`}
              style={{ backgroundColor: color(value) }}
            />
          );
        })}
      </div>
    </div>
  );
}
