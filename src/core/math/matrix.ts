export class ViewportTransform {
  public scale: number = 1.0;
  public offsetX: number = 0;
  public offsetY: number = 0;
  public dpr: number = 1.0;

  private minScale = 0.5;
  private maxScale = 25.0;

  constructor(initialScale = 1.0, offsetX = 0, offsetY = 0) {
    this.scale = initialScale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.updateDpr();
  }

  public updateDpr() {
    this.dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }

  /**
   * Applies the current matrix to the CanvasRenderingContext2D
   */
  public apply(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(
      this.dpr * this.scale,
      0,
      0,
      this.dpr * this.scale,
      this.dpr * this.offsetX,
      this.dpr * this.offsetY,
    );
  }

  /**
   * Reset transformation to default identity
   */
  public resetTo(scale = 1.0, offsetX = 0, offsetY = 0) {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /**
   * Move offset by delta pixels
   */
  public pan(dx: number, dy: number) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  /**
   * Zoom centered at a screen point (e.g. mouse cursor)
   */
  public zoomAt(screenX: number, screenY: number, zoomRatio: number) {
    const prevScale = this.scale;
    const targetScale = Math.min(
      Math.max(this.scale * zoomRatio, this.minScale),
      this.maxScale,
    );
    if (targetScale === prevScale) return;

    // Fixed point equation
    this.offsetX =
      screenX - (screenX - this.offsetX) * (targetScale / prevScale);
    this.offsetY =
      screenY - (screenY - this.offsetY) * (targetScale / prevScale);
    this.scale = targetScale;
  }

  /**
   * Convert screen pointer coordinates to world canvas coordinates
   */
  public screenToWorld(screenX: number, screenY: number): [number, number] {
    const worldX = (screenX - this.offsetX) / this.scale;
    const worldY = (screenY - this.offsetY) / this.scale;
    return [worldX, worldY];
  }

  /**
   * Convert world canvas coordinates to screen pointer coordinates
   */
  public worldToScreen(worldX: number, worldY: number): [number, number] {
    const screenX = worldX * this.scale + this.offsetX;
    const screenY = worldY * this.scale + this.offsetY;
    return [screenX, screenY];
  }
}
