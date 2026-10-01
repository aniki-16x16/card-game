import { motionScope } from "./motion";
import { cardBend } from "./cardBend";
import { flightTable, flightRect, mountFlight } from "./tableFlight";

// 攻击调参入口：所有 duration 单位都是毫秒，越大越慢。
const ATTACK = {
  charge: { duration: 100, ease: "out(2)", travel: -0.08, lift: 28, bend: 1.9, pitch: -24 },
  hold: 180, // 蓄力完成后保持姿态，停顿结束才出击。
  launch: {
    duration: 80,
    ease: "in(2)",
    travel: 0.48,
    groundLift: 85,
    airLift: 140,
    bend: 1.3,
    pitch: 20,
  },
  strike: { duration: 40, ease: "in(3)", travel: 1, lift: 0, bend: 0.2, pitch: 0 },
  recoil: { duration: 100, ease: "out(3)", travel: 0.91, lift: 14, bend: 0.8 },
  flash: 80, // 命中时目标变亮再恢复；与回弹同时开始。
  return: { duration: 200, ease: "out(3)" },
  strips: 20, // 将牌面切成横条模拟弯曲；越多越平滑，但 DOM 开销也越大。
  overlap: 0.6, // 横条之间重叠的像素数，遮住旋转后可能出现的接缝。
  liftProjection: 0.42, // 离桌高度投影到屏幕上的上移比例。
  bendShading: 0.28, // 弯曲处的变暗强度，0 表示不加明暗。
  shadow: { opacity: 0.28, scaleHeight: 400, fadeHeight: 65, blur: 4, blurHeight: 14 },
};

/** 用临时牌面与阴影播放攻击，结束或中断后恢复原卡牌。 */
export async function attackFlight(
  source: HTMLElement,
  target: HTMLElement,
  air: boolean,
  signal: AbortSignal,
) {
  const face = source.querySelector<HTMLElement>(".card-face");
  if (!face || signal.aborted) return;
  const table = flightTable(source);
  const start = flightRect(source, table);
  const visibility = source.style.visibility;
  const motion = motionScope(signal);
  const stage = document.createElement("div");
  stage.className = "attack-stage";
  stage.setAttribute("aria-hidden", "true");
  const card = document.createElement("div");
  card.className = "attack-card camera-world";
  const shadow = document.createElement("div");
  shadow.className = "attack-shadow";
  for (const node of [card, shadow])
    Object.assign(node.style, {
      width: `${start.width}px`,
      height: `${start.height}px`,
      left: `${start.left}px`,
      top: `${start.top}px`,
      "--lane-width": `${start.width}px`,
    });
  // 每个横条复制完整牌面，再只露出对应的一段；各条独立旋转形成弧面。
  const count = ATTACK.strips,
    stripHeight = start.height / count;
  const strips = Array.from({ length: count }, (_, index) => {
    const strip = document.createElement("div");
    strip.className = "attack-strip";
    strip.style.height = `${stripHeight + ATTACK.overlap}px`;
    const surface = document.createElement("div");
    surface.className = "combat-slot";
    surface.style.cssText = `position:absolute;width:100%;height:${start.height}px;top:${-index * stripHeight}px`;
    surface.append(face.cloneNode(true));
    strip.append(surface);
    card.append(strip);
    return strip;
  });
  stage.append(shadow, card);
  const flight = mountFlight(stage, table);
  source.style.visibility = "hidden";
  // travel：沿攻击路径的比例，0 为原位、1 为目标、负值为向后蓄力。
  // lift：离桌高度（px）；bend：弯曲弧度，0 为平面；pitch：整张牌的俯仰角（度）。
  // pitch 根据攻击方向自动翻转，因此双方共用同一组姿态。
  const pose = { travel: 0, lift: 0, bend: 0, pitch: 0 };
  const render = () => {
    flight.sync();
    // 每帧重新读取起点和目标，镜头移动或窗口缩放后也能跟随正确位置。
    const origin = flightRect(source, table),
      end = flightRect(target, table);
    const dx = end.left + end.width / 2 - origin.left - origin.width / 2;
    const dy = end.top + end.height / 2 - origin.top - origin.height / 2;
    const direction = dy < 0 ? -1 : 1;
    const x = origin.left - start.left + dx * pose.travel;
    const y = origin.top - start.top + dy * pose.travel;
    // 桌内 Z 高度由真实桌面投影产生上移，不再叠加旧的屏幕位移模拟。
    card.style.transform = `translate3d(${x}px,${y - pose.lift * (table ? 0 : ATTACK.liftProjection)}px,${pose.lift}px) rotateX(${pose.pitch * direction}deg)`;
    strips.forEach((strip, index) => {
      const v = ((index + 0.5) / count - 0.5) * start.height;
      const curve = cardBend(v, start.height, pose.bend);
      strip.style.transform = `translate3d(0,${start.height / 2 + curve.y - stripHeight / 2}px,${curve.z}px) rotateX(${curve.angle}deg)`;
      strip.style.filter = `brightness(${1 - Math.abs(Math.sin((curve.angle * Math.PI) / 180)) * ATTACK.bendShading})`;
    });
    // 阴影贴着桌面随牌移动；牌越高，阴影越大、越淡、越模糊。
    // scaleHeight / fadeHeight / blurHeight 越小，对高度变化的反应越明显。
    shadow.style.transform = `translate(${x}px,${y}px) scale(${1 + pose.lift / ATTACK.shadow.scaleHeight})`;
    shadow.style.opacity = String(
      ATTACK.shadow.opacity / (1 + pose.lift / ATTACK.shadow.fadeHeight),
    );
    shadow.style.filter = `blur(${ATTACK.shadow.blur + pose.lift / ATTACK.shadow.blurHeight}px)`;
  };
  render();
  const phase = (values: Partial<typeof pose>, duration: number, ease: string) =>
    motion.tween(pose, { ...values, duration, ease, onUpdate: render });
  // ease：out(n) 快起慢停，in(n) 慢起快冲；n 越大，加减速越明显。
  try {
    // 1. 蓄力：向后拉、抬起、弯曲牌面，最后减速到停住。
    const { duration: chargeDuration, ease: chargeEase, ...chargePose } = ATTACK.charge;
    await phase(chargePose, chargeDuration, chargeEase);
    if (signal.aborted) return;
    // 2. 停顿：只推进计时，不改变姿态；通过 motionScope 保持可中断。
    await motion.tween(
      { progress: 0 },
      { progress: 1, duration: ATTACK.hold, ease: "linear", onUpdate: render },
    );
    if (signal.aborted) return;
    // 3. 出击前半段：向目标加速，飞行单位走更高的弧线。
    const {
      duration: launchDuration,
      ease: launchEase,
      groundLift,
      airLift,
      ...launchPose
    } = ATTACK.launch;
    await phase({ ...launchPose, lift: air ? airLift : groundLift }, launchDuration, launchEase);
    if (signal.aborted) return;
    // 4. 撞击：冲到目标中心，降低高度、展开牌面。
    const { duration: strikeDuration, ease: strikeEase, ...strikePose } = ATTACK.strike;
    await phase(strikePose, strikeDuration, strikeEase);
    if (signal.aborted) return;
    // 5. 命中回弹与闪光：略微弹离目标；等待两者结束后才返回。
    const { duration: recoilDuration, ease: recoilEase, ...recoilPose } = ATTACK.recoil;
    await Promise.all([
      phase(recoilPose, recoilDuration, recoilEase),
      // 天平反馈交给游标移动；只有受击卡牌播放命中闪光。
      target.closest(".balance-ruler")
        ? Promise.resolve()
        : motion.tween(target, {
            keyframes: [{ filter: "brightness(1.9)" }, { filter: "brightness(1)" }],
            duration: ATTACK.flash,
          }),
    ]);
    if (signal.aborted) return;
    // 6. 返回：减速回到原位，同时放平牌面；伤害反馈由后续 hit 动作播放。
    await phase(
      { travel: 0, lift: 0, bend: 0, pitch: 0 },
      ATTACK.return.duration,
      ATTACK.return.ease,
    );
  } finally {
    // 完成、重开或中断时，销毁临时节点并恢复原牌，避免残留阴影或隐藏的牌。
    motion.dispose();
    flight.dispose();
    source.style.visibility = visibility;
  }
}
