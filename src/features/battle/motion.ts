import { animate, type AnimationParams } from "animejs";

/** One cancellable owner per effect; abort also settles pending awaits. */
export function motionScope(signal: AbortSignal) {
  const cleanup: (() => void)[] = [];
  const dispose = () =>
    cleanup
      .splice(0)
      .reverse()
      .forEach((fn) => fn());
  signal.addEventListener("abort", dispose, { once: true });
  return {
    tween(target: HTMLElement | object, params: AnimationParams) {
      if (signal.aborted) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const animation = animate(target, { ...params, onComplete: () => resolve() });
        cleanup.push(() => {
          animation.revert();
          resolve();
        });
      });
    },
    dispose() {
      signal.removeEventListener("abort", dispose);
      dispose();
    },
  };
}
