export const TRANSITION_EFFECTS = [
  "circles",
  "squares",
  "diamonds",
  "horizontal",
  "vertical",
  "diagonal",
] as const;
export type TransitionEffect = (typeof TRANSITION_EFFECTS)[number];

export function randomTransition(): TransitionEffect {
  return TRANSITION_EFFECTS[Math.floor(Math.random() * TRANSITION_EFFECTS.length)];
}

// Geometry is redrawn at the current viewport resolution, never scaled as a bitmap.
export function transitionPath(
  effect: TransitionEffect,
  coverage: number,
  width: number,
  height: number,
): string {
  if (coverage <= 0) return "";
  if (coverage >= 1) return `M0 0H${width}V${height}H0Z`;
  const size = Math.max(72, Math.sqrt((width * height) / 320));
  const columns = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const local = (delay: number) => {
    const t = Math.max(0, Math.min(1, (coverage - delay * 0.55) / 0.45));
    return t * t * (3 - 2 * t);
  };
  const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  if (effect === "diagonal") {
    const edge = (width + height) * coverage;
    return `M0 0H${edge}L0 ${edge}Z`;
  }
  if (effect === "horizontal" || effect === "vertical") {
    const horizontal = effect === "horizontal";
    const count = horizontal ? rows : columns;
    return Array.from({ length: count }, (_, i) => {
      const p = local(i / Math.max(1, count - 1));
      return horizontal
        ? rect(i % 2 ? width * (1 - p) : 0, i * size, width * p, size + 1)
        : rect(i * size, i % 2 ? height * (1 - p) : 0, size + 1, height * p);
    }).join("");
  }
  return Array.from({ length: columns * rows }, (_, i) => {
    const col = i % columns,
      row = Math.floor(i / columns);
    const p = local((col + row) / Math.max(1, columns + rows - 2));
    const x = (col + 0.5) * size,
      y = (row + 0.5) * size;
    if (p === 0) return "";
    if (effect === "circles") {
      const r = size * 0.72 * p;
      return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    }
    if (effect === "squares") {
      const half = ((size + 1) * p) / 2;
      return rect(x - half, y - half, half * 2, half * 2);
    }
    const r = (size + 1) * p;
    return `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;
  }).join("");
}
