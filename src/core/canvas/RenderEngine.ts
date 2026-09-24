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

  public setBaseMapData(geojson: any) {
    this.baseMapLayer.setData(geojson);
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

    this.transform.resetTo(fitScale, offsetX, offsetY);
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

    // Layer 1: High-Speed Rail Tracks
    this.railLayer.render(
      ctx,
      this.geometries,
      this.hoveredTrip,
      this.theme,
      scale,
    );

    // Layer 2: Flight Arcs
    this.flightLayer.render(
      ctx,
      this.geometries,
      this.hoveredTrip,
      this.theme,
      scale,
    );

    // Layer 3: Particles
    this.particleLayer.render(ctx, this.geometryMap, this.theme, scale);

    // Layer 4: Hub Nodes
    this.hubNodeLayer.render(ctx, this.nodes, this.theme, scale);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
