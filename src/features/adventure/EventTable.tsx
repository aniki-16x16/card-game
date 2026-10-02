import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Footprints } from "lucide-react";
import "./EventTable.css";

export function EventTable({
  title,
  busy = false,
  onCancel,
  onLeave,
  children,
}: {
  title: string;
  busy?: boolean;
  onCancel: () => boolean;
  onLeave: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || document.querySelector("dialog[open]"))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy && !onCancel()) onLeave();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [busy, onCancel, onLeave]);
  return (
    <section
      className="event-table"
      aria-label={title}
      aria-busy={busy}
      onClick={(event) => {
        if (!busy && !(event.target as HTMLElement).closest("button, .card-face")) onCancel();
      }}
    >
      <div className="event-table-grain" aria-hidden="true" />
      <h1 className="event-arrival">{title}</h1>
      {children}
      <button
        className="table-leave"
        aria-label="继续前行"
        title="继续前行"
        disabled={busy}
        onClick={onLeave}
      >
        <Footprints />
        <span>继续前行</span>
      </button>
    </section>
  );
}

/** Destructive actions commit only after a continuous hold, including keyboard input. */
export function HoldSeal({
  disabled,
  label,
  onComplete,
  children,
}: {
  disabled: boolean;
  label: string;
  onComplete: () => void;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const liquid = useRef<HTMLSpanElement>(null);
  const progress = useRef<Animation | null>(null);
  const completed = useRef(false);
  const fill = (full: boolean) => {
    if (!liquid.current) return;
    const from = new DOMMatrixReadOnly(getComputedStyle(liquid.current).transform).m22;
    progress.current?.cancel();
    progress.current = liquid.current.animate(
      [{ transform: `scaleY(${from})` }, { transform: `scaleY(${full ? 1 : 0})` }],
      {
        duration: full ? 850 : 160,
        easing: full ? "linear" : "cubic-bezier(.4, 0, .8, 1)",
        fill: "forwards",
      },
    );
  };
  const cancel = () => {
    if (!timer.current || completed.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    button.current?.classList.remove("holding");
    fill(false);
  };
  useEffect(() => {
    const stop = () => cancel();
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      progress.current?.cancel();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);
  const begin = () => {
    if (disabled || timer.current || completed.current) return;
    button.current?.classList.add("holding");
    fill(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      completed.current = true;
      button.current?.classList.remove("holding");
      onComplete();
    }, 850);
  };
  return (
    <button
      ref={button}
      className="hold-seal"
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={(event) => {
        if (event.button === 0) {
          event.currentTarget.setPointerCapture(event.pointerId);
          begin();
        }
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onBlur={cancel}
      onPointerMove={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          cancel();
      }}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (!event.repeat) begin();
        }
        if (event.key === "Escape") cancel();
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          cancel();
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="seal-fill-clip" aria-hidden="true">
        <span ref={liquid} className="seal-liquid" />
      </span>
      <span className="seal-ring" aria-hidden="true" />
      {children}
      <small>{label}</small>
    </button>
  );
}
