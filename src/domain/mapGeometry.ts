type Point = { x: number; y: number };
const bend = 0.65;

export function mapCurvePoint(from: Point, to: Point, t: number): Point {
  const s = 1 - t,
    distance = to.y - from.y;
  return {
    x: from.x * (s * s * s + 3 * s * s * t) + to.x * (3 * s * t * t + t * t * t),
    y:
      s * s * s * from.y +
      3 * s * s * t * (from.y + distance * bend) +
      3 * s * t * t * (to.y - distance * bend) +
      t * t * t * to.y,
  };
}

export function mapCurvePath(from: Point, to: Point): string {
  const offset = (to.y - from.y) * bend;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + offset}, ${to.x} ${to.y - offset}, ${to.x} ${to.y}`;
}
