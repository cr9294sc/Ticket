import type { LocationEntity, ColorScheme } from "../../../types/travel";
import { projectCoordinates } from "../../geo/projection";

export interface PreparedNode {
  location: LocationEntity;
  point: [number, number];
  count: number;
}

export class HubNodeLayer {
  public render(
    ctx: CanvasRenderingContext2D,
    nodes: PreparedNode[],
    theme: ColorScheme,
    scale: number,
  ) {
    const scaleFactor = Math.sqrt(scale);
    const baseRadius = Math.max(3.8 / scaleFactor, 1.6);
    const haloRadius = baseRadius * 1.8;

    ctx.save();

    for (const node of nodes) {
      const [x, y] = node.point;
      const isAirport = node.location.type === "AIRPORT";
      const color = isAirport ? theme.nodeAirport : theme.nodeTrain;

      // Outer gentle halo
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
      ctx.fillStyle = isAirport ? theme.nodeHalo : "rgba(16, 185, 129, 0.2)";
      ctx.globalAlpha = 0.6;
      ctx.fill();

      // Inner solid point
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.fill();

      // White dot center for airport hubs
      if (isAirport) {
        ctx.beginPath();
        ctx.arc(x, y, baseRadius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 1.0;
        ctx.fill();
      }

      // City label when zoomed in or for top hubs
      if (scale > 1.8 || node.count >= 4) {
        ctx.font = `${Math.max(9 / scaleFactor, 6.5)}px sans-serif`;
        ctx.fillStyle = theme.textSecondary;
        ctx.globalAlpha = 0.85;
        ctx.textAlign = "center";
        ctx.fillText(
          node.location.shortName || node.location.city,
          x,
          y - haloRadius - 2 / scaleFactor,
        );
      }
    }

    ctx.restore();
  }
}
