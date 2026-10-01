/**
 * 牌面横条在圆弧上的位置：position 是离牌中心的距离（px），height 是牌高。
 * bend 是整张牌的弯曲弧度，越大越弯；接近 0 时直接返回平面，避免除以 0。
 * y 为弯曲后的纵向位置，z 为离桌高度（中间拱起、两端为 0），angle 为横条旋转角（度）。
 */
export function cardBend(position: number, height: number, bend: number) {
  if (Math.abs(bend) < 0.00001) return { y: position, z: 0, angle: 0 };
  const angle = (position / height) * bend;
  const radius = height / bend;
  return {
    y: Math.sin(angle) * radius,
    z: (Math.cos(angle) - Math.cos(bend / 2)) * radius,
    angle: (-angle * 180) / Math.PI,
  };
}
