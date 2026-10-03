import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { X } from "lucide-react";
import "./Modal.css";

export type ModalClose = (afterClose?: () => void) => void;

export function Modal({
  children,
  onClose,
  label,
  dismissible = true,
  showCloseButton = true,
  className = "",
}: {
  children: ReactNode | ((close: ModalClose) => ReactNode);
  onClose: () => void;
  label: string;
  dismissible?: boolean;
  showCloseButton?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const motion = useRef<Animation | null>(null);
  const leaving = useRef(false);
  const backdropPressed = useRef(false);
  const [closing, setClosing] = useState(false);

  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    motion.current = element.animate(
      [
        { opacity: 0, transform: "translateY(12px) scale(.96)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      {
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200,
        easing: "cubic-bezier(.2, .8, .2, 1)",
      },
    );
    return () => {
      motion.current?.cancel();
      element.close();
    };
  }, []);

  const close = useCallback<ModalClose>(
    (afterClose) => {
      const element = dialog.current;
      if (!element || leaving.current) return;
      leaving.current = true;
      setClosing(true);
      const style = getComputedStyle(element);
      const from = { opacity: style.opacity, transform: style.transform };
      motion.current?.cancel();
      const animation = element.animate(
        [from, { opacity: 0, transform: "translateY(8px) scale(.97)" }],
        {
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160,
          easing: "ease-in",
          fill: "forwards",
        },
      );
      motion.current = animation;
      void animation.finished.then(
        () => {
          element.close();
          onClose();
          afterClose?.();
        },
        () => {},
      );
    },
    [onClose],
  );

  function outside(event: PointerEvent | MouseEvent) {
    const element = dialog.current!;
    const rect = element.getBoundingClientRect();
    return (
      event.target === element &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    );
  }

  // The render prop receives an event callback; it does not read refs during rendering.
  // oxlint-disable-next-line react/refs
  const content = typeof children === "function" ? children(close) : children;
  return (
    <dialog
      ref={dialog}
      className={`modal animated-modal ${className} ${closing ? "is-closing" : ""}`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) close();
      }}
      onPointerDown={(event) => {
        backdropPressed.current = outside(event);
      }}
      onPointerCancel={() => {
        backdropPressed.current = false;
      }}
      onClick={(event) => {
        if (dismissible && backdropPressed.current && outside(event)) close();
        backdropPressed.current = false;
      }}
    >
      <div className="modal-content" inert={closing}>
        {dismissible && showCloseButton && (
          <button className="close" onClick={() => close()} aria-label="关闭">
            <X />
          </button>
        )}
        {content}
      </div>
    </dialog>
  );
}
