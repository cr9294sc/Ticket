import type { Particle, ColorScheme } from "../../../types/travel";
import type { PreparedTripGeometry } from "../../math/hitTest";
import { sampleBezier } from "../../geo/trajectory";

/** 活跃流光总数硬上限(10~20 条) */
export const MAX_PARTICLES = 16;

export class ParticleLayer {
  private particles: Particle[] = [];

  /**
   * Sync particles with currently active geometries
   */
  public sync(geometries: PreparedTripGeometry[]) {
    // 主干聚焦:按航段重复次数排序,活跃流光硬上限 MAX_PARTICLES
    const routeCount = new Map<string, number>();
    const routeKey = (g: PreparedTripGeometry) =>
      [g.trip.originId, g.trip.destId].sort().join("-");
    for (const g of geometries) {
      if (g.trip.type === "FLIGHT") routeCount.set(routeKey(g), (routeCount.get(routeKey(g)) || 0) + 1);
    }
    const seen = new Set<string>();
    const flightItems = geometries
      .filter((g) => g.trip.type === "FLIGHT" && g.bezier)
      .sort((a, b) => routeCount.get(routeKey(b))! - routeCount.get(routeKey(a))!)
      .filter((g) => {
        const k = routeKey(g);
        if (seen.has(k)) return false; // 同一走廊只保留一颗
        seen.add(k);
        return true;
      })
      .slice(0, MAX_PARTICLES);
    const existingMap = new Map<string, Particle>();
    for (const p of this.particles) {
      existingMap.set(p.tripId, p);
    }

    const nextParticles: Particle[] = [];
    for (const item of flightItems) {
      const existing = existingMap.get(item.trip.id);
      if (existing) {
        nextParticles.push(existing);
      } else {
        // Balanced speed and phase
        nextParticles.push({
          tripId: item.trip.id,
          t: Math.random(),
          speed: 0.1 + Math.random() * 0.06,
          color: item.trip.color || "#FFD700",
          size: 3.0,
        });
      }
    }

    this.particles = nextParticles;
  }

  /**
   * Update particle positions based on delta time (seconds)
   */
  public update(dt: number) {
    for (const p of this.particles) {
      p.t = (p.t + p.speed * dt) % 1.0;
    }
  }

  /**
   * High-performance batched particle rendering
   */
  public render(
    ctx: CanvasRenderingContext2D,
    geometryMap: Map<string, PreparedTripGeometry>,
    visibleIds: Set<string>,
    theme: ColorScheme,
    scale: number,
  ) {
    if (this.particles.length === 0) return;

    const scaleFactor = Math.sqrt(scale);
    const radius = Math.max(2.8 / scaleFactor, 1.2);
    const haloRadius = radius * 1.8;

    const positions: [number, number][] = [];
    for (const p of this.particles) {
      const geom = geometryMap.get(p.tripId);
      // 视口外 / 被 LOD 剔除的航段不参与计算
      if (!geom || !geom.bezier || !visibleIds.has(p.tripId)) continue;
      positions.push(sampleBezier(geom.bezier, p.t));
    }

    if (positions.length === 0) return;

    ctx.save();

    // 1. Batched Outer Halos
    ctx.beginPath();
    for (const [x, y] of positions) {
      ctx.moveTo(x + haloRadius, y);
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
    }
    ctx.fillStyle = theme.flightGlow;
    ctx.globalAlpha = 0.45;
    ctx.fill();

    // 2. Batched Core Dots
    ctx.beginPath();
    for (const [x, y] of positions) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.globalAlpha = 0.9;
    ctx.fill();

    ctx.restore();
  }
}
