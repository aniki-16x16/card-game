import type { Species } from './types.ts'

// 每一项代表一张主牌，重复同一 species 即可放入多张。
// 独立松鼠牌堆由战斗初始化创建，不包含在这里。
export const STARTER_DECK: Species[] = [
  'wolf',       // 苔原狼
  'beetle',     // 铁背甲虫
  'owl',        // 夜巡鸮
  'deer',       // 枝角鹿
  'fox',        // 赤尾狐
  'moth',       // 归魂蛾
  'heron',      // 裂风鹭
  'bear',       // 山脊熊
  'mouse',      // 田鼠
  'beetle',     // 铁背甲虫（第二张）
  'rabbit',     // 兔
  'ant',        // 蚂蚁
  'goat',       // 黑山羊
  'experiment', // 实验生物
]
