import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { SceneTransitionContext } from "./SceneTransitionContext";
import "./SceneTransition.css";

export function SceneTransitionProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const animations = useRef<Animation[]>([]);
  const [active, setActive] = useState(false);
  const [grid, setGrid] = useState({ columns: 1, rows: 1, width: 1, height: 1, size: 1 });

  useEffect(() => {
    mounted.current = true;
    const overlay = dialog.current;
    return () => {
      mounted.current = false;
      animations.current.forEach((animation) => animation.cancel());
      overlay?.close();
    };
  }, []);

  const start = useCallback((commit: () => void) => {
    if (locked.current || !mounted.current) return;
    locked.current = true;
    const width = window.innerWidth,
      height = window.innerHeight;
    const size = Math.max(72, Math.sqrt((width * height) / 320));
    const columns = Math.ceil(width / size);
    const rows = Math.ceil(height / size);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flushSync(() => {
      setGrid({ columns, rows, width, height, size });
      setActive(true);
    });
    const overlay = dialog.current!;
    // The top layer also covers battle-result dialogs and traps keyboard input.
    overlay.showModal();
    // Establish SVG geometry on its first display before starting transform-box animations.
    overlay.getBoundingClientRect();
    const circles = Array.from(overlay.querySelectorAll("circle"));

    async function wave(cover: boolean) {
      const previous = animations.current;
      animations.current = circles.map((circle, index) =>
        circle.animate(
          [{ transform: `scale(${cover ? 0 : 1})` }, { transform: `scale(${cover ? 1 : 0})` }],
          {
            duration: reduced ? 1 : 320,
            delay: reduced
              ? 0
              : (((index % columns) + Math.floor(index / columns)) /
                  Math.max(1, columns + rows - 2)) *
                460,
            easing: cover ? "cubic-bezier(.4, 0, .7, 1)" : "cubic-bezier(.3, 0, .6, 1)",
            fill: "both",
          },
        ),
      );
      previous.forEach((animation) => animation.cancel());
      await Promise.all(animations.current.map((animation) => animation.finished));
    }

    void (async () => {
      try {
        await wave(true);
        if (!mounted.current) return;
        // All circles overlap before the scene can change. Keep that cover
        // through layout effects and one complete paint of the new scene.
        flushSync(commit);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (!mounted.current) return;
        await wave(false);
      } catch (error) {
        if (mounted.current) console.error("场景过渡失败", error);
      } finally {
        animations.current.forEach((animation) => animation.cancel());
        if (mounted.current) {
          overlay.close();
          locked.current = false;
          setActive(false);
        }
      }
    })();
  }, []);

  return (
    <SceneTransitionContext.Provider value={{ active, start }}>
      {children}
      <dialog
        ref={dialog}
        className="scene-transition"
        aria-label="场景切换中"
        aria-busy={active}
        onCancel={(event) => event.preventDefault()}
      >
        <svg
          viewBox={`0 0 ${grid.width} ${grid.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: grid.columns * grid.rows }, (_, index) => (
            <circle
              key={index}
              cx={((index % grid.columns) + 0.5) * grid.size}
              cy={(Math.floor(index / grid.columns) + 0.5) * grid.size}
              r={grid.size * 0.72}
            />
          ))}
        </svg>
      </dialog>
    </SceneTransitionContext.Provider>
  );
}
