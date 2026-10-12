import type {
  TripEntity,
  LocationEntity,
  ColorScheme,
} from "../../types/travel";
import { ViewportTransform } from "../math/matrix";
import {
  projectCoordinates,
  BASE_CANVAS_WIDTH,
  BASE_CANVAS_HEIGHT,
} from "../geo/projection";
import { calculateFlightBezier, sampleBezier } from "../geo/trajectory";
import { hitTestTrips, type PreparedTripGeometry } from "../math/hitTest";
import { BaseMapLayer } from "./layers/BaseMapLayer";
import { RailLayer } from "./layers/RailLayer";
import { FlightLayer } from "./layers/FlightLayer";
import { ParticleLayer } from "./layers/ParticleLayer";
import { HubNodeLayer, type PreparedNode } from "./layers/HubNodeLayer";

export class RenderEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public transform: ViewportTransform;

  // Layers
  private baseMapLayer = new BaseMapLayer();
  private railLayer = new RailLayer();
  private flightLayer = new FlightLayer();
  private particleLayer = new ParticleLayer();
  private hubNodeLayer = new HubNodeLayer();

  // Cached Geometries
  private geometries: PreparedTripGeometry[] = [];
  private geometryMap = new Map<string, PreparedTripGeometry>();
  private nodes: PreparedNode[] = [];

  // Active state
  private hoveredTrip: TripEntity | null = null;
  private theme: ColorScheme;

  // Animation loop
  private rafId: number | null = null;
  private lastTime = 0;
  private isDestroyed = false;
  private fitScale = 1;
  private visibleIds = new Set<string>();

  constructor(canvas: HTMLCanvasElement, initialTheme: ColorScheme) {
    this.canvas = canvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Failed to get 2D context");
    this.ctx = context;
    this.theme = initialTheme;
    this.transform = new ViewportTransform();

    this.fitToScreen();
    this.startLoop();
  }

  public setTheme(theme: ColorScheme) {
    this.theme = theme;
  }

  public setBaseMapData(data: {
    countries?: any;
    admin1?: any;
    chinaProvinces?: any;
  }) {
    this.baseMapLayer.setData(data);
  }

  public enableWasm() {
    this.hubNodeLayer.enableWasm();
  }

  public setVisitedProvinces(names: Iterable<string>, animateNew = false, delayMs = 0) {
    this.baseMapLayer.setVisited(names, animateNew, delayMs);
  }

  // ---------- 视口漫游 / 上图动画 ----------
  private tween: {
    t0: number; dur: number;
    from: [number, number, number]; to: [number, number, number];
  } | null = null;
  private reveal: { id: string; t0: number; dur: number } | null = null;
  private pendingFocus: { id: string; reveal: boolean } | null = null;

  private ease(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /** 平滑过渡到目标视口变换 */
  public animateTo(scale: number, offsetX: number, offsetY: number, dur = 900) {
    const tr = this.transform;
    this.tween = {
      t0: performance.now(), dur,
      from: [tr.scale, tr.offsetX, tr.offsetY], to: [scale, offsetX, offsetY],
    };
  }

  /** 平滑居中到世界坐标包围盒 */
  public flyToBounds(minX: number, minY: number, maxX: number, maxY: number, padding = 0.35, dur = 900) {
    const rect = this.canvas.getBoundingClientRect();
    const bw = Math.max(maxX - minX, 20);
    const bh = Math.max(maxY - minY, 20);
    const scale = Math.min(
      Math.max(Math.min(rect.width / (bw * (1 + padding * 2)), rect.height / (bh * (1 + padding * 2))), this.fitScale * 0.9),
      this.transform.maxScaleValue,
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.animateTo(scale, rect.width / 2 - cx * scale, rect.height / 2 - cy * scale, dur);
  }

  private tripBounds(g: PreparedTripGeometry) {
    const pts = g.bezier
      ? [g.p0, g.bezier.cp, g.p1]
      : g.trackPoints && g.trackPoints.length >= 2
      ? g.trackPoints
      : [g.p0, g.p1];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  }

  /** 视口飞向行程;reveal=true 时同时由起点向终点绘制高亮动画 */
  public focusTrip(id: string, reveal = false) {
    const g = this.geometryMap.get(id);
    if (!g) {
      this.pendingFocus = { id, reveal }; // 几何尚未构建,待 setTripsAndLocations 后执行
      return;
    }
    const [a, b, c, d] = this.tripBounds(g);
    this.flyToBounds(a, b, c, d);
    if (reveal) this.reveal = { id, t0: performance.now() + 700, dur: 1600 };
  }

  /** 回到全球全景 */
  public resetView(dur = 900) {
    const rect = this.canvas.getBoundingClientRect();
    const f = this.fitScale;
    this.animateTo(f, (rect.width - BASE_CANVAS_WIDTH * f) / 2, (rect.height - BASE_CANVAS_HEIGHT * f) / 2, dur);
  }

  /** 世界坐标包围盒(区域钻取) */
  public flyToGeoBounds(lngLatBounds: [[number, number], [number, number]]) {
    const p0 = projectCoordinates(lngLatBounds[0]);
    const p1 = projectCoordinates(lngLatBounds[1]);
    if (!p0 || !p1) return;
    this.flyToBounds(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), 0.15);
  }

  // ---------- 站点拾取(右键菜单) ----------
  private places: { kind: "airport" | "station"; id: string; label: string; x: number; y: number }[] = [];

  public setCatalogPlaces(
    airports: { id: string; name: string; lng: number; lat: number }[],
    stations: { n: string; x: number; y: number }[],
  ) {
    const out: typeof this.places = [];
    for (const a of airports) {
      const p = projectCoordinates([a.lng, a.lat]);
      if (p) out.push({ kind: "airport", id: a.id, label: `${a.id} ${a.name}`, x: p[0], y: p[1] });
    }
    for (const s of stations) {
      const p = projectCoordinates([s.x, s.y]);
      if (p) out.push({ kind: "station", id: s.n, label: `${s.n}站`, x: p[0], y: p[1] });
    }
    this.places = out;
  }

  public pickPlace(screenX: number, screenY: number) {
    const [wx, wy] = this.transform.screenToWorld(screenX, screenY);
    const relZoom = this.transform.scale / this.fitScale;
    const tol = 16 / this.transform.scale;
    let best: (typeof this.places)[number] | null = null;
    let bd = tol;
    for (const p of this.places) {
      if (p.kind === "station" && relZoom < 2) continue;
      const d = Math.hypot(p.x - wx, p.y - wy) * (p.kind === "station" ? 1.15 : 1);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  public cancelTween() {
    this.tween = null;
  }

  public getZoom() {
    return this.transform.scale / this.fitScale;
  }

  public setTripsAndLocations(
    trips: TripEntity[],
    locations: Record<string, LocationEntity>,
  ) {
    const geometries: PreparedTripGeometry[] = [];
    const geomMap = new Map<string, PreparedTripGeometry>();
    const nodeUsageMap = new Map<
      string,
      { loc: LocationEntity; count: number; pt: [number, number] }
    >();

    for (const trip of trips) {
      const p0 = projectCoordinates(trip.originCoords);
      const p1 = projectCoordinates(trip.destCoords);

      if (!p0 || !p1) continue;

      let bezier;
      let trackPoints: [number, number][] | undefined;
      if (trip.type === "FLIGHT") {
        bezier = calculateFlightBezier(p0, p1);
      } else if (trip.trackCoords && trip.trackCoords.length >= 2) {
        trackPoints = trip.trackCoords
          .map((coord) => projectCoordinates(coord))
          .filter((pt): pt is [number, number] => pt !== null);
      }

      const geom: PreparedTripGeometry = { trip, p0, p1, bezier, trackPoints };
      geometries.push(geom);
      geomMap.set(trip.id, geom);

      // Track node stats
      const oLoc = locations[trip.originId];
      if (oLoc) {
        const item = nodeUsageMap.get(trip.originId) || {
          loc: oLoc,
          count: 0,
          pt: p0,
        };
        item.count++;
        nodeUsageMap.set(trip.originId, item);
      }

      const dLoc = locations[trip.destId];
      if (dLoc) {
        const item = nodeUsageMap.get(trip.destId) || {
          loc: dLoc,
          count: 0,
          pt: p1,
        };
        item.count++;
        nodeUsageMap.set(trip.destId, item);
      }
    }

    this.geometries = geometries;
    this.geometryMap = geomMap;
    this.nodes = Array.from(nodeUsageMap.values()).map((v) => ({
      location: v.loc,
      point: v.pt,
      count: v.count,
    }));

    this.particleLayer.sync(geometries);

    if (this.pendingFocus && this.geometryMap.has(this.pendingFocus.id)) {
      const { id, reveal } = this.pendingFocus;
      this.pendingFocus = null;
      this.focusTrip(id, reveal);
    }
  }

  public setHoveredTrip(trip: TripEntity | null) {
    this.hoveredTrip = trip;
  }

  public hitTest(screenX: number, screenY: number): TripEntity | null {
    const [wx, wy] = this.transform.screenToWorld(screenX, screenY);
    // Dynamic screen tolerance threshold: ~14 screen pixels
    const tolerance = 14 / this.transform.scale;
    return hitTestTrips(wx, wy, this.geometries, tolerance);
  }

  public fitToScreen() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.transform.updateDpr();
    this.canvas.width = w * this.transform.dpr;
    this.canvas.height = h * this.transform.dpr;

    // Scale so that BASE_CANVAS (1400 x 950) fits comfortably with margin
    const scaleX = w / BASE_CANVAS_WIDTH;
    const scaleY = h / BASE_CANVAS_HEIGHT;
    const fitScale = Math.min(scaleX, scaleY) * 0.95;

    const offsetX = (w - BASE_CANVAS_WIDTH * fitScale) / 2;
    const offsetY = (h - BASE_CANVAS_HEIGHT * fitScale) / 2;

    this.fitScale = fitScale;
    this.transform.resetTo(fitScale, offsetX, offsetY);
  }

  /** 视口(世界坐标)矩形 */
  private viewportRect(margin = 0) {
    const w = this.canvas.width / this.transform.dpr;
    const h = this.canvas.height / this.transform.dpr;
    const [x0, y0] = this.transform.screenToWorld(0, 0);
    const [x1, y1] = this.transform.screenToWorld(w, h);
    const m = margin / this.transform.scale;
    return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
  }

function samplePolyline(pts: [number, number][], t: number): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1 || t <= 0) return pts[0];
  if (t >= 1) return pts[pts.length - 1];

  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    totalLen += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  const target = t * totalLen;
  let accumulated = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (accumulated + segLen >= target) {
      const frac = segLen > 0 ? (target - accumulated) / segLen : 0;
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * frac,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * frac,
      ];
    }
    accumulated += segLen;
  }
  return pts[pts.length - 1];
}

  /** 视口剔除 + LOD:视口外不渲染;全景视角下碎线(短于约 60 屏幕像素)不渲染 */
  private cullGeometries(): PreparedTripGeometry[] {
    const vp = this.viewportRect(20);
    const relZoom = this.transform.scale / this.fitScale;
    const minLen = relZoom < 1.6 ? 60 / this.transform.scale : 0;
    return this.geometries.filter((g) => {
      const pts = g.bezier
        ? [g.p0, g.bezier.cp, g.p1]
        : g.trackPoints && g.trackPoints.length >= 2
        ? g.trackPoints
        : [g.p0, g.p1];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      if (maxX < vp.x0 || minX > vp.x1 || maxY < vp.y0 || minY > vp.y1) return false;
      if (minLen && Math.hypot(g.p1[0] - g.p0[0], g.p1[1] - g.p0[1]) < minLen) return false;
      return true;
    });
  }

  private startLoop() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (this.isDestroyed) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number) {
    if (this.tween) {
      const k = Math.min((performance.now() - this.tween.t0) / this.tween.dur, 1);
      const e = this.ease(k);
      const { from, to } = this.tween;
      this.transform.resetTo(
        from[0] + (to[0] - from[0]) * e,
        from[1] + (to[1] - from[1]) * e,
        from[2] + (to[2] - from[2]) * e,
      );
      if (k >= 1) this.tween = null;
    }
    this.particleLayer.update(dt);
  }

  private render() {
    const ctx = this.ctx;
    const dpr = this.transform.dpr;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const scale = this.transform.scale;

    // Clear background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Apply viewport transform
    this.transform.apply(ctx);

    // Layer 0: China BaseMap
    this.baseMapLayer.render(ctx, this.theme, scale);

    const revealId = this.reveal ? this.reveal.id : null;
    const visible = this.cullGeometries().filter((g) => g.trip.id !== revealId);
    this.visibleIds = new Set(visible.map((g) => g.trip.id));

    // Layer 1: High-Speed Rail Tracks
    this.railLayer.render(
      ctx,
      visible,
      this.hoveredTrip,
      this.theme,
      scale,
    );

    // Layer 2: Flight Arcs
    this.flightLayer.render(
      ctx,
      visible,
      this.hoveredTrip,
      this.theme,
      scale,
    );

    this.renderReveal(ctx, scale);

    // Layer 3: Particles
    this.particleLayer.render(ctx, this.geometryMap, this.visibleIds, this.theme, scale);

    // Layer 4: Hub Nodes
    this.hubNodeLayer.render(
      ctx,
      this.nodes,
      this.theme,
      scale,
      this.transform.scale / this.fitScale,
      performance.now(),
      this.viewportRect(30),
    );
  }

  /** 新航线由起点向终点逐段点亮 */
  private renderReveal(ctx: CanvasRenderingContext2D, scale: number) {
    const r = this.reveal;
    if (!r) return;
    const g = this.geometryMap.get(r.id);
    const k = (performance.now() - r.t0) / r.dur;
    if (!g) { this.reveal = null; return; }
    if (k < 0) return; // 等待视口飞抵
    const prog = Math.min(k, 1);
    const e = this.ease(prog);
    const N = 64;
    const n = Math.max(2, Math.floor(N * e));
    const pt = (t: number): [number, number] =>
      g.bezier
        ? sampleBezier(g.bezier, t)
        : g.trackPoints && g.trackPoints.length >= 2
        ? samplePolyline(g.trackPoints, t)
        : [g.p0[0] + (g.p1[0] - g.p0[0]) * t, g.p0[1] + (g.p1[1] - g.p0[1]) * t];
    const sf = Math.sqrt(scale);
    const color = g.trip.type === "FLIGHT" ? this.theme.flightPrimary : this.theme.hsrPrimary;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt((i / n) * e);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 7 / sf;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.4 / sf;
    ctx.stroke();
    const [hx, hy] = pt(e);
    ctx.beginPath();
    ctx.arc(hx, hy, 4 / sf, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    if (prog >= 1 && k > 1.2) this.reveal = null;
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
