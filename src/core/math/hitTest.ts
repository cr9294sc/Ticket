import type { TripEntity, BezierPoints } from "../../types/travel";
import { sampleBezier } from "../geo/trajectory";

/**
 * Distance from point P to line segment AB
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  // Projection parameter clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Distance from point P to quadratic Bezier curve using AABB and polyline approximation
 */
export function pointToBezierDistance(
  px: number,
  py: number,
  bezier: BezierPoints,
  samples = 24,
): number {
  const { p0, cp, p1 } = bezier;

  // AABB bounding box check
  const minX = Math.min(p0[0], cp[0], p1[0]);
  const maxX = Math.max(p0[0], cp[0], p1[0]);
  const minY = Math.min(p0[1], cp[1], p1[1]);
  const maxY = Math.max(p0[1], cp[1], p1[1]);

  const pad = 40;
  if (
    px < minX - pad ||
    px > maxX + pad ||
    py < minY - pad ||
    py > maxY + pad
  ) {
    return Infinity;
  }

  let minDistance = Infinity;
  let prevPt = p0;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const currPt = sampleBezier(bezier, t);
    const d = pointToSegmentDistance(
      px,
      py,
      prevPt[0],
      prevPt[1],
      currPt[0],
      currPt[1],
    );
    if (d < minDistance) {
      minDistance = d;
    }
    prevPt = currPt;
  }

  return minDistance;
}

export interface PreparedTripGeometry {
  trip: TripEntity;
  p0: [number, number];
  p1: [number, number];
  bezier?: BezierPoints;
}

/**
 * Find the closest trip to the world mouse coordinate (wx, wy)
 */
export function hitTestTrips(
  wx: number,
  wy: number,
  geometries: PreparedTripGeometry[],
  tolerance: number,
): TripEntity | null {
  let closestTrip: TripEntity | null = null;
  let minDistance = tolerance;

  for (const item of geometries) {
    let dist = Infinity;
    if (item.trip.type === "FLIGHT" && item.bezier) {
      dist = pointToBezierDistance(wx, wy, item.bezier);
    } else {
      dist = pointToSegmentDistance(
        wx,
        wy,
        item.p0[0],
        item.p0[1],
        item.p1[0],
        item.p1[1],
      );
    }

    if (dist < minDistance) {
      minDistance = dist;
      closestTrip = item.trip;
    }
  }

  return closestTrip;
}
