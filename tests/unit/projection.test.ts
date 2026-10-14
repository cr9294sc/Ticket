import { describe, it, expect } from "vitest";
import {
  projectCoordinates,
  invertCoordinates,
  worldProjection,
  BASE_CANVAS_WIDTH,
  BASE_CANVAS_HEIGHT,
} from "../../src/core/geo/projection";

describe("projection", () => {
  it("projects valid coordinates within canvas bounds", () => {
    // Beijing ~ [116.4, 39.9]
    const pt = projectCoordinates([116.4, 39.9]);
    expect(pt).not.toBeNull();
    if (pt) {
      expect(pt[0]).toBeGreaterThan(0);
      expect(pt[0]).toBeLessThan(BASE_CANVAS_WIDTH);
      expect(pt[1]).toBeGreaterThan(0);
      expect(pt[1]).toBeLessThan(BASE_CANVAS_HEIGHT);
    }
  });

  it("inverts coordinates back to original longitude/latitude", () => {
    const coords: [number, number] = [116.4074, 39.9042];
    const pt = projectCoordinates(coords);
    expect(pt).not.toBeNull();

    if (pt) {
      const inverted = invertCoordinates(pt);
      expect(inverted).not.toBeNull();
      if (inverted) {
        expect(inverted[0]).toBeCloseTo(coords[0], 2);
        expect(inverted[1]).toBeCloseTo(coords[1], 2);
      }
    }
  });

  it("places East Asia roughly centered due to 105°E central meridian rotation", () => {
    // 105°E, 0°N should be near the center of the canvas
    const centerPt = worldProjection([105, 0]);
    expect(centerPt).not.toBeNull();
    if (centerPt) {
      expect(centerPt[0]).toBeCloseTo(BASE_CANVAS_WIDTH / 2, 0);
      expect(centerPt[1]).toBeCloseTo(BASE_CANVAS_HEIGHT / 2, 0);
    }
  });
});
