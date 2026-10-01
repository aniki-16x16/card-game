import { unprojectTable, tableBounds, tableHeight, TABLE } from "./tableLayout";

export function flightTable(element: HTMLElement) {
  return element.closest<HTMLElement>(".table-world");
}

export function flightScale(table: HTMLElement | null, point: { x: number; y: number }) {
  if (!table) return 1;
  const scale = table.getBoundingClientRect().width / tableBounds.width;
  return (
    scale /
    (1 -
      ((point.y - tableHeight / 2) * Math.sin((TABLE.angle * Math.PI) / 180)) / TABLE.perspective)
  );
}

/** 桌内元素直接读取布局坐标，不能用倾斜后包围盒作为牌面尺寸。 */
export function flightRect(element: HTMLElement, table: HTMLElement | null) {
  if (!table) return element.getBoundingClientRect();
  if (table.contains(element)) {
    let x = 0,
      y = 0,
      node: HTMLElement | null = element;
    while (node && node !== table) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return { left: x, top: y, width: element.offsetWidth, height: element.offsetHeight };
  }
  // 手牌与天平在桌外：将其屏幕中心投到同一桌面坐标系。
  const rect = element.getBoundingClientRect(),
    bounds = table.getBoundingClientRect();
  const scale = bounds.width / tableBounds.width;
  const point = unprojectTable({
    x: (rect.left + rect.width / 2 - bounds.left) / scale + tableBounds.left,
    y: (rect.top + rect.height / 2 - bounds.top) / scale + tableBounds.top,
  });
  const atPoint = flightScale(table, point);
  return {
    left: point.x - rect.width / atPoint / 2,
    top: point.y - rect.height / atPoint / 2,
    width: rect.width / atPoint,
    height: rect.height / atPoint,
  };
}

export function mountFlight(stage: HTMLElement, table: HTMLElement | null) {
  if (!table) {
    document.body.append(stage);
    return {
      sync() {},
      dispose() {
        stage.remove();
      },
    };
  }
  // 只把飞行卡牌与阴影放到前景，不能提升整张牌桌，否则会遮住剩余手牌。
  // 复制空的桌面投影容器，沿用相同尺寸、倾角和卡面样式，不复制桌面内容。
  const overlay = document.createElement("div");
  overlay.className = "flight-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const fit = document.createElement("div");
  fit.className = "flight-fit";
  const world = table.cloneNode(false) as HTMLElement;
  world.classList.add("flight-world");
  const style = getComputedStyle(table);
  Object.assign(world.style, {
    width: style.width,
    height: style.height,
    transform: style.transform,
    transformOrigin: style.transformOrigin,
  });
  stage.classList.add("table-flight");
  world.append(stage);
  fit.append(world);
  overlay.append(fit);
  document.body.append(overlay);
  const sync = () => {
    // 动画中缩放窗口时同步屏幕位置与倍率；飞行路径仍使用原桌面的布局坐标。
    const bounds = table.getBoundingClientRect();
    fit.style.left = `${bounds.left}px`;
    fit.style.top = `${bounds.top}px`;
    fit.style.transform = `scale(${bounds.width / tableBounds.width})`;
  };
  sync();
  // 蓄力停顿时姿态不更新，但状态文字换行仍可能改变可用空间和桌面位置。
  const observer = new ResizeObserver(sync);
  for (const container of [table.closest(".camera-viewport"), table.closest(".camera-space")]) {
    if (container) observer.observe(container);
  }
  // React 在尺寸观察后更新适配倍率；即使动画暂停，也要跟随这次样式提交。
  const updates = new MutationObserver(sync);
  for (const container of [table.closest(".camera-space"), table.closest(".table-fit")]) {
    if (container) updates.observe(container, { attributes: true, attributeFilter: ["style"] });
  }
  return {
    sync,
    dispose() {
      observer.disconnect();
      updates.disconnect();
      overlay.remove();
    },
  };
}
