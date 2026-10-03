import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { SceneTransitionContext } from "./SceneTransitionContext";
import { randomTransition, transitionPath } from "./transitionGeometry";
import "./SceneTransition.css";

export function SceneTransitionProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const path = useRef<SVGPathElement>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const cancelFrame = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const overlay = dialog.current;
    return () => {
      mounted.current = false;
      cancelFrame.current?.();
      overlay?.close();
    };
  }, []);

  const start = useCallback((commit: () => void) => {
    if (locked.current || !mounted.current) return;
    locked.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flushSync(() => setActive(true));
    const overlay = dialog.current!;
    const coverEffect = randomTransition();
    const revealEffect = randomTransition();

    function draw(effect: ReturnType<typeof randomTransition>, coverage: number) {
      const width = window.innerWidth,
        height = window.innerHeight;
      svg.current!.setAttribute("viewBox", `0 0 ${width} ${height}`);
      path.current!.setAttribute("d", transitionPath(effect, coverage, width, height));
    }

    async function wave(cover: boolean) {
      const effect = cover ? coverEffect : revealEffect;
      draw(effect, cover ? 0 : 1);
      await new Promise<void>((resolve) => {
        let frame = 0;
        const started = performance.now();
        cancelFrame.current = () => {
          cancelAnimationFrame(frame);
          resolve();
        };
        const tick = (now: number) => {
          if (!mounted.current) {
            resolve();
            return;
          }
          const progress = reduced ? 1 : Math.min(1, (now - started) / 780);
          draw(effect, cover ? progress : 1 - progress);
          if (progress < 1) frame = requestAnimationFrame(tick);
          else {
            cancelFrame.current = null;
            resolve();
          }
        };
        frame = requestAnimationFrame(tick);
      });
    }

    void (async () => {
      try {
        draw(coverEffect, 0);
        // The top layer covers result dialogs and traps keyboard input.
        overlay.showModal();
        await wave(true);
        if (!mounted.current) return;
        flushSync(commit);
        // Keep a complete cover through the new scene's first paint.
        await new Promise<void>((resolve) => {
          let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              cancelFrame.current = null;
              resolve();
            });
          });
          cancelFrame.current = () => {
            cancelAnimationFrame(frame);
            resolve();
          };
        });
        if (!mounted.current) return;
        await wave(false);
      } catch (error) {
        if (mounted.current) console.error("场景过渡失败", error);
      } finally {
        cancelFrame.current?.();
        cancelFrame.current = null;
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
        <svg ref={svg} preserveAspectRatio="none" aria-hidden="true">
          <path ref={path} />
        </svg>
      </dialog>
    </SceneTransitionContext.Provider>
  );
}
