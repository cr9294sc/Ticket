import { describe, it, expect } from "vitest";
import {
  pointToSegmentDistance,
  pointToBezierDistance,
  pointToPolylineDistance,
  hitTestTrips,
  type PreparedTripGeometry,
} from "../../src/core/math/hitTest";
import type { TripEntity } from "../../src/types/travel";

describe("hitTest geometric functions", () => {
  describe("pointToSegmentDistance", () => {
    it("computes perpendicular distance when projection falls inside segment", () => {
      // Segment: (0, 0) -> (100, 0)
      // Point: (50, 20)
      const d = pointToSegmentDistance(50, 20, 0, 0, 100, 0);
      expect(d).toBeCloseTo(20, 5);
    });

    it("computes distance to endpoint when projection falls outside", () => {
      // Segment: (0, 0) -> (100, 0)
      // Point: (130, 40), closest to (100, 0) => hypot(30, 40) = 50
      const d = pointToSegmentDistance(130, 40, 0, 0, 100, 0);
      expect(d).toBeCloseTo(50, 5);
    });

    it("handles zero-length segments", () => {
      const d = pointToSegmentDistance(3, 4, 0, 0, 0, 0);
      expect(d).toBeCloseTo(5, 5);
    });
  });

  describe("pointToBezierDistance", () => {
    it("returns Infinity when outside AABB bounding box with padding", () => {
      const bezier = {
        p0: [0, 0] as [number, number],
        cp: [50, 50] as [number, number],
        p1: [100, 0] as [number, number],
      };
      const d = pointToBezierDistance(500, 500, bezier);
      expect(d).toBe(Infinity);
    });

    it("accurately detects points close to bezier curve", () => {
      const bezier = {
        p0: [0, 0] as [number, number],
        cp: [50, 100] as [number, number],
        p1: [100, 0] as [number, number],
      };
      // At t=0.5: x = 0.25*0 + 0.5*50 + 0.25*100 = 50
      //           y = 0.25*0 + 0.5*100 + 0.25*0 = 50
      const d = pointToBezierDistance(50, 50, bezier, 32);
      expect(d).toBeLessThan(1.0);
    });
  });

  describe("pointToPolylineDistance", () => {
    it("returns distance to closest polyline segment", () => {
      const poly: [number, number][] = [
        [0, 0],
        [100, 0],
        [100, 100],
      ];
      // Point near first segment: (30, 5) -> dist is 5
      expect(pointToPolylineDistance(30, 5, poly)).toBeCloseTo(5, 4);

      // Point near second segment: (105, 60) -> dist is 5
      expect(pointToPolylineDistance(105, 60, poly)).toBeCloseTo(5, 4);
    });

    it("returns Infinity for less than 2 points", () => {
      expect(pointToPolylineDistance(10, 10, [[0, 0]])).toBe(Infinity);
    });
  });

  describe("hitTestTrips", () => {
    const mockTrip1: TripEntity = {
      id: "trip-1",
      type: "FLIGHT",
      code: "CA1234",
      date: "2024-01-01",
      year: 2024,
      originId: "PEK",
      originName: "北京",
      originCity: "北京",
      originCoords: [116.4, 39.9],
      destId: "SHA",
      destName: "上海",
      destCity: "上海",
      destCoords: [121.4, 31.2],
      distanceKm: 1080,
      color: "#ff0000",
    };

    const mockTrip2: TripEntity = {
      id: "trip-2",
      type: "HSR",
      code: "G1",
      date: "2024-02-01",
      year: 2024,
      originId: "VNP",
      originName: "北京南",
      originCity: "北京",
      originCoords: [116.3, 39.8],
      destId: "AOH",
      destName: "上海虹桥",
      destCity: "上海",
      destCoords: [121.3, 31.1],
      distanceKm: 1318,
      color: "#00ff00",
    };

    const geometries: PreparedTripGeometry[] = [
      {
        trip: mockTrip1,
        p0: [100, 100],
        p1: [300, 100],
        bezier: {
          p0: [100, 100],
          cp: [200, 50],
          p1: [300, 100],
        },
      },
      {
        trip: mockTrip2,
        p0: [100, 200],
        p1: [300, 200],
        trackPoints: [
          [100, 200],
          [200, 210],
          [300, 200],
        ],
      },
    ];

    it("hits the closest trip within tolerance", () => {
      // Near HSR line at (200, 212)
      const hit = hitTestTrips(200, 212, geometries, 10);
      expect(hit?.id).toBe("trip-2");
    });

    it("returns null if distance exceeds tolerance", () => {
      const hit = hitTestTrips(500, 500, geometries, 10);
      expect(hit).toBeNull();
    });
  });
});
