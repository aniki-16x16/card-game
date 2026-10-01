import { creature } from "../../src/domain/cards.ts";

// 固定规则测试所需的生物和实例 ID，避免手动调整初始卡组影响规则测试。
export const rulesDeck = () =>
  [
    "wolf",
    "beetle",
    "owl",
    "deer",
    "fox",
    "moth",
    "heron",
    "bear",
    "mouse",
    "beetle",
    "rabbit",
    "ant",
    "goat",
    "experiment",
  ].map((species, index) => {
    const card = creature(species, `starter-${index}`);
    // These fixtures exercise support/transfer independently of the authored deer card.
    return species === "deer" ? { ...card, native: ["support"] } : card;
  });
