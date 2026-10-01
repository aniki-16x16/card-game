export function handLayout(count: number, width: number, active: number) {
  const cardWidth = Math.max(86, Math.min(132, (width - 32) / 2));
  const step = count > 1 ? Math.min(94, Math.max(0, width - cardWidth - 104) / (count - 1)) : 0;
  return Array.from({ length: count }, (_, index) => {
    const position = index - (count - 1) / 2;
    const normalized = count > 1 ? position / ((count - 1) / 2) : 0;
    const selected = index === active;
    const distance = Math.abs(index - active);
    const spread =
      active < 0 || selected
        ? 0
        : (Math.sign(index - active) * Math.min(36, cardWidth * 0.25, step * 2)) /
          Math.sqrt(distance);
    return {
      width: cardWidth,
      x: position * step + spread,
      y: selected ? -44 : normalized * normalized * 16,
      angle: normalized * 12,
      scale: selected ? 1.07 : 1,
      z: selected ? 100 : index + 1,
    };
  });
}
