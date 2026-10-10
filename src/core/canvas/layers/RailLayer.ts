import type { TripEntity, ColorScheme } from "../../../types/travel";
import type { PreparedTripGeometry } from "../../math/hitTest";

export class RailLayer {
  public render(
    ctx: CanvasRenderingContext2D,
    geometries: PreparedTripGeometry[],
    hoveredTrip: TripEntity | null,
    theme: ColorScheme,
    scale: number,
  ) {
    const scaleFactor = Math.sqrt(scale);
    const baseWidth = Math.max(1.8 / scaleFactor, 0.8);
    const dashLength = 6 / scaleFactor;
    const gapLength = 4 / scaleFactor;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Draw regular tracks
    for (const item of geometries) {
      if (item.trip.type !== "HSR") continue;

      const isHovered = hoveredTrip?.id === item.trip.id;
      if (isHovered) continue; // Draw hovered later on top

      // 暖色双线轨道:宽底线 + 细虚线枕木
      ctx.beginPath();
      ctx.moveTo(item.p0[0], item.p0[1]);
      ctx.lineTo(item.p1[0], item.p1[1]);
      ctx.setLineDash([]);
      ctx.strokeStyle = theme.hsrPrimary;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = baseWidth * 2.4;
      ctx.stroke();
      ctx.setLineDash([dashLength, gapLength]);
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = baseWidth * 0.8;
      ctx.stroke();
    }

    // 2. Draw hovered track with glow effect on top
    if (hoveredTrip && hoveredTrip.type === "HSR") {
      const activeItem = geometries.find((g) => g.trip.id === hoveredTrip.id);
      if (activeItem) {
        ctx.setLineDash([]);
        // Glow back
        ctx.beginPath();
        ctx.moveTo(activeItem.p0[0], activeItem.p0[1]);
        ctx.lineTo(activeItem.p1[0], activeItem.p1[1]);
        ctx.strokeStyle = theme.hoverHighlight;
        ctx.lineWidth = baseWidth * 3.5;
        ctx.globalAlpha = 0.4;
        ctx.stroke();

        // Main line
        ctx.beginPath();
        ctx.moveTo(activeItem.p0[0], activeItem.p0[1]);
        ctx.lineTo(activeItem.p1[0], activeItem.p1[1]);
        ctx.setLineDash([dashLength * 1.2, gapLength * 0.8]);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = baseWidth * 1.5;
        ctx.globalAlpha = 1.0;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
