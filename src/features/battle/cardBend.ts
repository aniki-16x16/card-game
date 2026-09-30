/** Positive Z points away from the table; the two ends stay on its plane. */
export function cardBend(position: number, height: number, bend: number) {
  if (Math.abs(bend) < .00001) return { y: position, z: 0, angle: 0 }
  const angle = position / height * bend
  const radius = height / bend
  return {
    y: Math.sin(angle) * radius,
    z: (Math.cos(angle) - Math.cos(bend / 2)) * radius,
    angle: -angle * 180 / Math.PI,
  }
}
