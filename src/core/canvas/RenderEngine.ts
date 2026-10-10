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
import { calculateFlightBezier } from "../geo/trajectory";
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

  public setVisitedProvinces(names: Iterable<string>, animateNew = false) {
    this.baseMapLayer.setVisited(names, animateNew);
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
      if (trip.type === "FLIGHT") {
        bezier = calculateFlightBezier(p0, p1);
      }

      const geom: PreparedTripGeometry = { trip, p0, p1, bezier };
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

  /** 视口剔除 + LOD:视口外不渲染;全景视角下碎线(短于约 60 屏幕像素)不渲染 */
  private cullGeometries(): PreparedTripGeometry[] {
    const vp = this.viewportRect(20);
    const relZoom = this.transform.scale / this.fitScale;
    const minLen = relZoom < 1.6 ? 60 / this.transform.scale : 0;
    return this.geometries.filter((g) => {
      const pts = g.bezier ? [g.p0, g.bezier.cp, g.p1] : [g.p0, g.p1];
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

    const visible = this.cullGeometries();
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

  public destroy() {
    this.isDestroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
