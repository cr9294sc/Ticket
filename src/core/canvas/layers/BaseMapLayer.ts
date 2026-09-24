import { geoPath } from "d3-geo";
import { worldProjection } from "../../geo/projection";
import type { ColorScheme } from "../../../types/travel";

export class BaseMapLayer {
  private geoData: any = null;
  private cachedPath: Path2D | null = null;

  public setData(geojson: any) {
    this.geoData = geojson;
    this.precompile();
  }

  private precompile() {
    if (!this.geoData) {
      this.cachedPath = null;
      return;
    }
    try {
      const path2d = new Path2D();
      // Use Path2D as canvas-like context for d3-geo path generator
      const pathGenerator = geoPath()
        .projection(worldProjection)
        .context(path2d as any);
      pathGenerator(this.geoData);
      this.cachedPath = path2d;
    } catch (err) {
      console.warn(
        "Failed to precompile Path2D for basemap, fallback will be used",
        err,
      );
      this.cachedPath = null;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    theme: ColorScheme,
    scale: number,
  ) {
    if (!this.cachedPath && this.geoData) {
      this.precompile();
    }
    if (!this.cachedPath) return;

    // Line width inversely scaled with gentle dampening
    const strokeWidth = Math.max(0.5 / Math.sqrt(scale), 0.25);

    ctx.save();
    // 1. Draw land fill
    ctx.fillStyle = theme.landFill;
    ctx.fill(this.cachedPath);

    // 2. Draw country/province boundary stroke
    ctx.strokeStyle = theme.landStroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke(this.cachedPath);

    ctx.restore();
  }
}
