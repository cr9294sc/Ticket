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

    // 1. Draw normal flight arcs
    for (const item of geometries) {
      if (item.trip.type !== "FLIGHT" || !item.bezier) continue;

      const isHovered = hoveredTrip?.id === item.trip.id;
      if (isHovered) continue; // Draw hovered last

      const { p0, cp, p1 } = item.bezier;

      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo(cp[0], cp[1], p1[0], p1[1]);

      // Subtle underglow
      ctx.strokeStyle = theme.flightGlow;
      ctx.lineWidth = baseWidth * 2.2;
      ctx.globalAlpha = 0.3;
      ctx.stroke();

      // Main line with airline color or theme golden gradient
      const grad = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
      grad.addColorStop(0, item.trip.color || theme.flightPrimary);
      grad.addColorStop(0.5, theme.flightPrimary);
      grad.addColorStop(1, item.trip.color || theme.flightPrimary);

      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth;
      ctx.globalAlpha = 0.85;
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
        ctx.lineWidth = baseWidth * 4.0;
        ctx.globalAlpha = 0.5;
        ctx.stroke();

        // Bright core
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = baseWidth * 1.8;
        ctx.globalAlpha = 1.0;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
