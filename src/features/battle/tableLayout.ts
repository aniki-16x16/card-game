// 牌桌调参入口：卡牌保持 110px 的桌面尺寸，视口不足时整体缩小。
export const TABLE = {
  cardWidth: 110,
  angle: 30,
  perspective: 1200,
  gap: 12,
  labelWidth: 38,
  sideSpace: 33,
  deckSpace: 128,
  padding: 24,
}

export type Point = { x: number; y: number }
const radians = TABLE.angle * Math.PI / 180
export const boardWidth = TABLE.labelWidth + 5 * (TABLE.cardWidth + TABLE.gap)
export const tableWidth = boardWidth + TABLE.deckSpace
export const tableHeight = 4 * TABLE.cardWidth * 4 / 3 + 2 * TABLE.gap + TABLE.sideSpace

/** 与 CSS perspective() rotateX() 一致：桌面中心为旋转中心，近端更大。 */
export function projectTable(point: Point, width = tableWidth, height = tableHeight): Point {
  const x = point.x - width / 2, y = point.y - height / 2
  const depth = 1 - y * Math.sin(radians) / TABLE.perspective
  return { x: width / 2 + x / depth, y: height / 2 + y * Math.cos(radians) / depth }
}

/** 把屏幕投影位置还原到桌面，供桌外手牌、天平与桌内动画衔接。 */
export function unprojectTable(point: Point, width = tableWidth, height = tableHeight): Point {
  const y = (point.y - height / 2) / (Math.cos(radians) + (point.y - height / 2) * Math.sin(radians) / TABLE.perspective)
  const depth = 1 - y * Math.sin(radians) / TABLE.perspective
  return { x: width / 2 + (point.x - width / 2) * depth, y: height / 2 + y }
}

const corners = [{ x: 0, y: 0 }, { x: tableWidth, y: 0 }, { x: 0, y: tableHeight }, { x: tableWidth, y: tableHeight }].map(point => projectTable(point))
export const tableBounds = {
  left: Math.min(...corners.map(point => point.x)),
  top: Math.min(...corners.map(point => point.y)),
  width: Math.max(...corners.map(point => point.x)) - Math.min(...corners.map(point => point.x)),
  height: Math.max(...corners.map(point => point.y)) - Math.min(...corners.map(point => point.y)),
}

/** 宽和高同时约束缩放，四排与两个实体牌堆始终一起入镜。 */
export function tableScale(width: number, height: number) {
  return Math.max(.01, Math.min(1, (width - TABLE.padding * 2) / tableBounds.width, (height - TABLE.padding * 2) / tableBounds.height))
}
