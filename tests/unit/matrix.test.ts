import { describe, it, expect } from "vitest";
import { ViewportTransform } from "../../src/core/math/matrix";

describe("ViewportTransform", () => {
  it("initializes with default values", () => {
    const vt = new ViewportTransform();
    expect(vt.scale).toBe(1.0);
    expect(vt.offsetX).toBe(0);
    expect(vt.offsetY).toBe(0);
  });

  it("handles pan operations accurately", () => {
    const vt = new ViewportTransform(1.0, 10, 20);
    vt.pan(50, -30);
    expect(vt.offsetX).toBe(60);
    expect(vt.offsetY).toBe(-10);
  });

  it("converts screen to world coordinates and back inversely", () => {
    const vt = new ViewportTransform(2.5, 100, -50);
    const screenX = 350;
    const screenY = 200;

    const [wx, wy] = vt.screenToWorld(screenX, screenY);
    const [sx, sy] = vt.worldToScreen(wx, wy);

    expect(sx).toBeCloseTo(screenX, 5);
    expect(sy).toBeCloseTo(screenY, 5);
  });

  it("zooms centered at pointer position maintaining fixed point", () => {
    const vt = new ViewportTransform(1.0, 0, 0);
    const centerX = 200;
    const centerY = 150;

    // World coordinate before zoom
    const [wBeforeX, wBeforeY] = vt.screenToWorld(centerX, centerY);

    // Zoom in by 2x
    vt.zoomAt(centerX, centerY, 2.0);
    expect(vt.scale).toBe(2.0);

    // Screen coordinate of that world point should remain at pointer
    const [sAfterX, sAfterY] = vt.worldToScreen(wBeforeX, wBeforeY);
    expect(sAfterX).toBeCloseTo(centerX, 5);
    expect(sAfterY).toBeCloseTo(centerY, 5);
  });

  it("clamps zoom within [minScale, maxScale]", () => {
    const vt = new ViewportTransform();
    // Try to zoom way out
    vt.zoomAt(100, 100, 0.001);
    expect(vt.scale).toBeGreaterThanOrEqual(0.5);

    // Try to zoom way in
    vt.zoomAt(100, 100, 100.0);
    expect(vt.scale).toBeLessThanOrEqual(vt.maxScaleValue);
  });

  it("resets to given parameters", () => {
    const vt = new ViewportTransform(3.0, 120, 80);
    vt.resetTo(1.5, 10, 20);
    expect(vt.scale).toBe(1.5);
    expect(vt.offsetX).toBe(10);
    expect(vt.offsetY).toBe(20);
  });
});
