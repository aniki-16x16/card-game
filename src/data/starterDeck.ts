import type { Species } from './types.ts'

// 每一项代表一张主牌，重复同一 species 即可放入多张。
// 独立松鼠牌堆由战斗初始化创建，不包含在这里。
export const STARTER_DECK: Species[] = [
  'ant',
  'turtle',
  'fox',
  'beetle',
  'crow',
  'lizard',
  'wolf',
  'owl',
]
