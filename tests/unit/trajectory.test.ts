import { describe, it, expect } from "vitest";
import {
  calculateFlightBezier,
  sampleBezier,
  sampleBezierAngle,
  samplePolyline,
} from "../../src/core/geo/trajectory";

describe("trajectory math & sampling", () => {
  it("calculates quadratic Bezier arc bulging upwards", () => {
    const p0: [number, number] = [100, 200];
    const p1: [number, number] = [300, 200];
    const bezier = calculateFlightBezier(p0, p1, 0.2);

    expect(bezier.p0).toEqual(p0);
    expect(bezier.p1).toEqual(p1);
    // Midpoint x is 200
    expect(bezier.cp[0]).toBeCloseTo(200, 1);
    // Control point y should bulge upward (smaller Y in canvas coordinates)
    expect(bezier.cp[1]).toBeLessThan(200);
  });

  it("handles identical start and end points gracefully", () => {
    const p: [number, number] = [100, 100];
    const bezier = calculateFlightBezier(p, p);
    expect(bezier.p0).toEqual(p);
    expect(bezier.p1).toEqual(p);
    expect(bezier.cp).toEqual(p);
  });

  it("samples bezier curve at endpoints t=0 and t=1", () => {
    const bezier = {
      p0: [10, 20] as [number, number],
      cp: [50, 0] as [number, number],
      p1: [100, 40] as [number, number],
    };

    const start = sampleBezier(bezier, 0);
    const end = sampleBezier(bezier, 1);

    expect(start[0]).toBeCloseTo(10, 5);
    expect(start[1]).toBeCloseTo(20, 5);
    expect(end[0]).toBeCloseTo(100, 5);
    expect(end[1]).toBeCloseTo(40, 5);
  });

  it("samples tangent angles correctly", () => {
    // Horizontal straight line
    const flatBezier = {
      p0: [0, 0] as [number, number],
      cp: [50, 0] as [number, number],
      p1: [100, 0] as [number, number],
    };
    const angle0 = sampleBezierAngle(flatBezier, 0);
    const angleMid = sampleBezierAngle(flatBezier, 0.5);
    expect(angle0).toBeCloseTo(0, 4);
    expect(angleMid).toBeCloseTo(0, 4);
  });

  describe("samplePolyline", () => {
    it("handles boundary cases (empty, single point, t outside [0, 1])", () => {
      expect(samplePolyline([], 0.5)).toEqual([0, 0]);
      expect(samplePolyline([[10, 20]], 0.5)).toEqual([10, 20]);
      expect(samplePolyline([[0, 0], [10, 10]], -0.1)).toEqual([0, 0]);
      expect(samplePolyline([[0, 0], [10, 10]], 1.5)).toEqual([10, 10]);
    });

    it("interpolates along two points linearly", () => {
      const line: [number, number][] = [[0, 0], [100, 200]];
      const mid = samplePolyline(line, 0.5);
      expect(mid[0]).toBeCloseTo(50, 5);
      expect(mid[1]).toBeCloseTo(100, 5);
    });

    it("interpolates along multi-segment polyline proportionally", () => {
      // Segment 1: (0,0) -> (100,0), length 100
      // Segment 2: (100,0) -> (100,100), length 100
      // Total length = 200
      const poly: [number, number][] = [
        [0, 0],
        [100, 0],
        [100, 100],
      ];

      // At t = 0.25 (dist = 50), point should be (50, 0)
      const p25 = samplePolyline(poly, 0.25);
      expect(p25[0]).toBeCloseTo(50, 4);
      expect(p25[1]).toBeCloseTo(0, 4);

      // At t = 0.50 (dist = 100), point should be vertex (100, 0)
      const p50 = samplePolyline(poly, 0.5);
      expect(p50[0]).toBeCloseTo(100, 4);
      expect(p50[1]).toBeCloseTo(0, 4);

      // At t = 0.75 (dist = 150), point should be (100, 50)
      const p75 = samplePolyline(poly, 0.75);
      expect(p75[0]).toBeCloseTo(100, 4);
      expect(p75[1]).toBeCloseTo(50, 4);
    });
  });
});
