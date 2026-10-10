import type { TripEntity, ColorScheme } from "../../../types/travel";
import type { PreparedTripGeometry } from "../../math/hitTest";

export class FlightLayer {
  public render(
    ctx: CanvasRenderingContext2D,
    geometries: PreparedTripGeometry[],
    hoveredTrip: TripEntity | null,
    theme: ColorScheme,
    scale: number,
  ) {
    const scaleFactor = Math.sqrt(scale);
    const baseWidth = Math.max(2.0 / scaleFactor, 0.9);

    ctx.save();
    ctx.lineCap = "round";
    ctx.setLineDash([]);

    // Calculate corridor frequency
    const corridorCount = new Map<string, number>();
    for (const item of geometries) {
      if (item.trip.type === "FLIGHT") {
        const key = [item.trip.originId, item.trip.destId].sort().join("-");
        corridorCount.set(key, (corridorCount.get(key) || 0) + 1);
      }
    }

    // 1. Draw normal flight arcs
    for (const item of geometries) {
      if (item.trip.type !== "FLIGHT" || !item.bezier) continue;

      const isHovered = hoveredTrip?.id === item.trip.id;
      if (isHovered) continue; // Draw hovered last

      const { p0, cp, p1 } = item.bezier;
      const key = [item.trip.originId, item.trip.destId].sort().join("-");
      const freq = corridorCount.get(key) || 1;
      // 重复走廊热度叠加: 线宽与亮度随频次阶梯递增
      const corridorBoost = Math.min((freq - 1) * 0.45, 2.0);
      const effectiveWidth = baseWidth + corridorBoost / scaleFactor;

      // 航段追光聚焦: 当选中/悬浮单条航线时，非相关航线透明度自动衰减
      let alpha = 0.85;
      let underglowAlpha = 0.3;
      if (hoveredTrip) {
        const isRelated =
          item.trip.originId === hoveredTrip.originId ||
          item.trip.destId === hoveredTrip.destId ||
          item.trip.originId === hoveredTrip.destId ||
          item.trip.destId === hoveredTrip.originId;
        if (!isRelated) {
          alpha = 0.15;
          underglowAlpha = 0.05;
        }
      }

      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo(cp[0], cp[1], p1[0], p1[1]);

      // Subtle underglow
      ctx.strokeStyle = theme.flightGlow;
      ctx.lineWidth = effectiveWidth * (2.2 + Math.min(freq * 0.2, 1.0));
      ctx.globalAlpha = underglowAlpha;
      ctx.stroke();

      // Main line with airline color or theme golden gradient
      const grad = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
      grad.addColorStop(0, item.trip.color || theme.flightPrimary);
      grad.addColorStop(0.5, theme.flightPrimary);
      grad.addColorStop(1, item.trip.color || theme.flightPrimary);

      ctx.strokeStyle = grad;
      ctx.lineWidth = effectiveWidth;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    // 2. Draw hovered flight arc on top with vivid highlight
    if (hoveredTrip && hoveredTrip.type === "FLIGHT") {
      const activeItem = geometries.find((g) => g.trip.id === hoveredTrip.id);
      if (activeItem && activeItem.bezier) {
        const { p0, cp, p1 } = activeItem.bezier;

        // Big outer glow
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(cp[0], cp[1], p1[0], p1[1]);
        ctx.strokeStyle = theme.hoverHighlight;
        ctx.lineWidth = baseWidth * 4.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();

        // Bright core
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = baseWidth * 2.0;
        ctx.globalAlpha = 1.0;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
