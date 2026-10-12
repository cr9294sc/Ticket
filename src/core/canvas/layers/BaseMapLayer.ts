import { geoPath } from "d3-geo";
import { worldProjection } from "../../geo/projection";
import type { ColorScheme } from "../../../types/travel";

interface BaseMapData {
  countries?: any;
  admin1?: any;
  chinaProvinces?: any;
  railNetwork?: any;
}

function compile(features: any[]): Path2D {
  const path2d = new Path2D();
  const gen = geoPath().projection(worldProjection).context(path2d as any);
  for (const f of features) gen(f);
  return path2d;
}

/**
 * 分层底图:国家 -> 海外一级区划(虚线) -> 中国省界(虚线,覆盖其下的境外轮廓) -> 已到访省份 -> 十段线。
 * 所有 Path2D 仅在数据加载时编译一次,渲染阶段不再做投影计算。
 */
export class BaseMapLayer {
  private countriesPath: Path2D | null = null;
  private admin1Path: Path2D | null = null;
  private chinaPath: Path2D | null = null;
  private chinaOutlinePath: Path2D | null = null;
  private nineDashPath: Path2D | null = null;
  private railNetworkPath: Path2D | null = null;
  private provincePaths = new Map<string, Path2D>();
  private visited = new Set<string>();
  /** 省份呼吸光环动画:名称 -> 起始毫秒 */
  private pulses = new Map<string, number>();

  public setData(data: BaseMapData) {
    if (data.countries) this.countriesPath = compile(data.countries.features);
    if (data.admin1) this.admin1Path = compile(data.admin1.features);
    if (data.railNetwork) this.railNetworkPath = compile(data.railNetwork.features);
    if (data.chinaProvinces) {
      const all: any[] = data.chinaProvinces.features;
      const provinces = all.filter((f) => f.properties?.name);
      const nine = all.filter((f) => !f.properties?.name);
      this.chinaPath = compile(provinces);
      this.nineDashPath = compile(nine);
      this.provincePaths.clear();
      for (const f of provinces) this.provincePaths.set(f.properties.name, compile([f]));
    }
  }

  /** 设置已到访省份;新增的省份触发一次呼吸轮廓光 */
  public setVisited(names: Iterable<string>, animateNew = false, delayMs = 0) {
    const next = new Set(names);
    if (animateNew) {
      const now = performance.now();
      for (const n of next) if (!this.visited.has(n)) this.pulses.set(n, now + delayMs);
    }
    this.visited = next;
  }

  public hasActivePulse(): boolean {
    return this.pulses.size > 0;
  }

  public render(ctx: CanvasRenderingContext2D, theme: ColorScheme, scale: number) {
    const lw = Math.max(0.6 / Math.sqrt(scale), 0.2);
    ctx.save();
    ctx.lineJoin = "round";

    // 1. 国家底板 + 低透明主权国界实线
    if (this.countriesPath) {
      ctx.fillStyle = theme.landFill;
      ctx.fill(this.countriesPath);
      ctx.strokeStyle = theme.landStroke;
      ctx.lineWidth = lw;
      ctx.stroke(this.countriesPath);
    }

    // 2. 海外一级行政区 微弱虚线
    if (this.admin1Path) {
      ctx.setLineDash([3 / Math.sqrt(scale), 3 / Math.sqrt(scale)]);
      ctx.strokeStyle = theme.provinceStroke;
      ctx.lineWidth = lw * 0.8;
      ctx.stroke(this.admin1Path);
      ctx.setLineDash([]);
    }

    // 3. 中国:先以不透明底色覆盖其下的外国轮廓(保证藏南/阿克赛钦归属),再画省界虚线
    if (this.chinaPath) {
      ctx.fillStyle = theme.landFill;
      ctx.fill(this.chinaPath);
      ctx.strokeStyle = theme.landStroke;
      ctx.lineWidth = lw;
      ctx.stroke(this.chinaPath);
      ctx.setLineDash([3 / Math.sqrt(scale), 3 / Math.sqrt(scale)]);
      ctx.strokeStyle = theme.provinceStroke;
      ctx.lineWidth = lw * 0.9;
      ctx.stroke(this.chinaPath);
      ctx.setLineDash([]);
    }

    // 3.5. 全国高速铁路网络骨架底图 (微弱半透明参考线)
    if (this.railNetworkPath) {
      ctx.strokeStyle = theme.railNetworkStroke || "rgba(64, 187, 223, 0.16)";
      ctx.lineWidth = Math.max(0.7 / Math.sqrt(scale), 0.25);
      ctx.stroke(this.railNetworkPath);
    }

    // 4. 足迹点亮:微发光填充
    if (this.visited.size) {
      ctx.shadowColor = theme.visitedGlow;
      ctx.shadowBlur = 8;
      for (const name of this.visited) {
        const p = this.provincePaths.get(name);
        if (!p) continue;
        ctx.fillStyle = theme.visitedFill;
        ctx.fill(p);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = theme.visitedStroke;
        ctx.lineWidth = lw * 1.1;
        ctx.stroke(p);
        ctx.shadowBlur = 8;
      }
      ctx.shadowBlur = 0;
    }

    // 5. 新点亮省份呼吸轮廓光(约 2 秒)
    if (this.pulses.size) {
      const now = performance.now();
      for (const [name, t0] of this.pulses) {
        const k = (now - t0) / 2000;
        const p = this.provincePaths.get(name);
        if (k < 0 && p) continue; // 延迟启动
        if (k >= 1 || !p) {
          this.pulses.delete(name);
          continue;
        }
        ctx.strokeStyle = theme.visitedStroke;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.lineWidth = lw * (2 + 4 * Math.sin(k * Math.PI));
        ctx.shadowColor = theme.visitedGlow;
        ctx.shadowBlur = 14;
        ctx.stroke(p);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // 6. 十段线(南海断续线)
    if (this.nineDashPath) {
      ctx.strokeStyle = theme.landStroke;
      ctx.lineWidth = lw * 1.4;
      ctx.stroke(this.nineDashPath);
    }

    ctx.restore();
  }
}
