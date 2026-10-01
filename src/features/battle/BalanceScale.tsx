import { useLayoutEffect, useRef } from "react";
import { animate } from "animejs";
import "./BalanceScale.css";

const color = (value: number) => {
  const endpoint = value < 0 ? [223, 130, 116] : [152, 201, 139];
  const weight = Math.min(1, Math.abs(value) / 10);
  return `rgb(${endpoint.map((channel) => Math.round(255 + (channel - 255) * weight)).join(" ")})`;
};

export function BalanceScale({ balance }: { balance: number }) {
  const marker = useRef<HTMLSpanElement>(null);
  const position = useRef({ value: balance });
  useLayoutEffect(() => {
    const element = marker.current;
    if (!element) return;
    const render = () => {
      element.style.left = `${(Math.max(-10, Math.min(10, position.current.value)) + 10) * 5}%`;
      element.style.backgroundColor = color(position.current.value);
    };
    render();
    const animation = animate(position.current, {
      value: balance,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420,
      ease: "inOut(3)",
      onUpdate: render,
      onComplete: render,
    });
    return () => {
      animation.cancel();
    };
  }, [balance]);
  return (
    <div
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
      <span ref={marker} className="balance-pointer" aria-hidden="true" />
      <div className="balance-ticks" aria-hidden="true">
        {Array.from({ length: 21 }, (_, index) => {
          const value = index - 10;
          return (
            <span
              key={value}
              data-value={value}
              data-motion={value === -10 ? "life-player" : value === 10 ? "life-enemy" : undefined}
              className={value % 5 === 0 ? "major" : ""}
              style={{ backgroundColor: color(value) }}
            />
          );
        })}
      </div>
    </div>
  );
}
