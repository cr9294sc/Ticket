import type { LocationEntity, ColorScheme } from "../../../types/travel";
import { resolve_labels } from "../../../wasm/geo_core.js";

export interface PreparedNode {
  location: LocationEntity;
  point: [number, number];
  count: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 特等枢纽阈值:到发次数 >= 该值,或位列前三 */
const SUPER_HUB_MIN = 4;

export class HubNodeLayer {
  private wasmReady = false;

  public enableWasm() {
    this.wasmReady = true;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    nodes: PreparedNode[],
    theme: ColorScheme,
    scale: number,
    relZoom: number,
    now: number,
    vp: Rect,
  ) {
    const scaleFactor = Math.sqrt(scale);
    const baseRadius = Math.max(3.8 / scaleFactor, 1.6);
    const haloRadius = baseRadius * 1.8;

    const topCounts = nodes.map((n) => n.count).sort((a, b) => b - a);
    const superMin = Math.max(SUPER_HUB_MIN, topCounts[2] ?? 0);

    ctx.save();
    const visible: { node: PreparedNode; isSuper: boolean }[] = [];

    for (const node of nodes) {
      const [x, y] = node.point;
      if (x < vp.x0 || x > vp.x1 || y < vp.y0 || y > vp.y1) continue;
      const isSuper = node.count >= superMin;
      // LOD:低缩放层级隐藏次级站点
      if (!isSuper && relZoom < 1.15) continue;
      visible.push({ node, isSuper });

      const isAirport = node.location.type === "AIRPORT";
      const color = isAirport ? theme.nodeAirport : theme.nodeTrain;

      // 特等枢纽:雷达呼吸光环(两圈错相扩散)
      if (isSuper) {
        for (let k = 0; k < 2; k++) {
          const ph = ((now / 2400 + k * 0.5) % 1);
          ctx.beginPath();
          ctx.arc(x, y, baseRadius + ph * haloRadius * 2.6, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.55 * (1 - ph);
          ctx.lineWidth = 1.2 / scaleFactor;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
      ctx.fillStyle = isAirport ? theme.nodeHalo : "rgba(255, 159, 67, 0.2)";
      ctx.globalAlpha = 0.6;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.fill();

      if (isAirport) {
        ctx.beginPath();
        ctx.arc(x, y, baseRadius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 1.0;
        ctx.fill();
      }
    }

    this.drawLabels(ctx, visible, theme, scale, relZoom, haloRadius);
    ctx.restore();
  }

  /** 三字码/地名标签:屏幕恒定字号,Rust 防碰撞,随缩放淡入 */
  private drawLabels(
    ctx: CanvasRenderingContext2D,
    items: { node: PreparedNode; isSuper: boolean }[],
    theme: ColorScheme,
    scale: number,
    relZoom: number,
    haloRadius: number,
  ) {
    const fontPx = 10;
    const cands = items.filter((i) => i.isSuper || relZoom >= 1.5);
    if (!cands.length) return;

    const labels = cands.map(({ node, isSuper }) => {
      const text = labelText(node, relZoom);
      return {
        text,
        isSuper,
        x: node.point[0] * scale - (text.length * fontPx * 0.55) / 2,
        y: node.point[1] * scale - haloRadius * scale - fontPx - 2,
        w: text.length * fontPx * (text.charCodeAt(0) > 255 ? 1.0 : 0.6) + 4,
        h: fontPx + 2,
        priority: node.count + (isSuper ? 100 : 0),
        node,
      };
    });

    let keep: number[];
    if (this.wasmReady) {
      keep = Array.from(
        resolve_labels(labels.map(({ x, y, w, h, priority }) => ({ x, y, w, h, priority }))),
      );
    } else {
      keep = labels.map((_, i) => i);
    }

    // 次级站点标签随缩放逐级淡入
    const fade = Math.min(Math.max((relZoom - 1.5) / 0.8, 0), 1);
    ctx.font = `${fontPx / scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textSecondary;
    for (const i of keep) {
      const l = labels[i];
      ctx.globalAlpha = l.isSuper ? 0.95 : 0.85 * fade;
      if (ctx.globalAlpha <= 0.02) continue;
      ctx.fillText(
        l.text,
        l.node.point[0],
        l.node.point[1] - haloRadius - 2 / scale,
      );
    }
  }
}

/** 机场显示 IATA 三字码;放大后追加城市名 */
function labelText(node: PreparedNode, relZoom: number): string {
  const loc = node.location;
  if (loc.type === "AIRPORT") {
    return relZoom >= 3 ? `${loc.id} ${loc.city}` : loc.id;
  }
  return loc.shortName || loc.city;
}
