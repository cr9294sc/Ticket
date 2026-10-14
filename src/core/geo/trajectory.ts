import type { BezierPoints } from "../../types/travel";

/**
 * Calculates Quadratic Bezier control points for flight arcs.
 * The curve always bulges upward (towards northern latitude) for natural aesthetic.
 */
export function calculateFlightBezier(
  p0: [number, number],
  p1: [number, number],
  curvatureFactor = 0.2,
): BezierPoints {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Midpoint
  const mx = (p0[0] + p1[0]) / 2;
  const my = (p0[1] + p1[1]) / 2;

  if (dist < 1e-4) {
    return { p0, cp: [mx, my], p1 };
  }

  // Normal vector: (-dy, dx)
  let nx = -dy / dist;
  let ny = dx / dist;

  // Prefer upward arc (smaller screen Y)
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  // Calculate arched height
  const height = Math.min(dist * curvatureFactor, 160);
  const cp: [number, number] = [mx + nx * height, my + ny * height];

  return { p0, cp, p1 };
}

/**
 * Sample point along quadratic Bezier curve at t in [0, 1]
 */
export function sampleBezier(
  bezier: BezierPoints,
  t: number,
): [number, number] {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const ut2 = 2 * u * t;

  const x = uu * bezier.p0[0] + ut2 * bezier.cp[0] + tt * bezier.p1[0];
  const y = uu * bezier.p0[1] + ut2 * bezier.cp[1] + tt * bezier.p1[1];
  return [x, y];
}

/**
 * Sample tangent angle in radians along quadratic Bezier curve at t
 */
export function sampleBezierAngle(bezier: BezierPoints, t: number): number {
  const u = 1 - t;
  // B'(t) = 2*(1-t)*(cp - p0) + 2*t*(p1 - cp)
  const dx =
    2 * u * (bezier.cp[0] - bezier.p0[0]) +
    2 * t * (bezier.p1[0] - bezier.cp[0]);
  const dy =
    2 * u * (bezier.cp[1] - bezier.p0[1]) +
    2 * t * (bezier.p1[1] - bezier.cp[1]);
  return Math.atan2(dy, dx);
}

/**
 * Sample point along a multi-vertex polyline at t in [0, 1]
 */
export function samplePolyline(
  pts: [number, number][],
  t: number,
): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1 || t <= 0) return pts[0];
  if (t >= 1) return pts[pts.length - 1];

  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    totalLen += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  const target = t * totalLen;
  let accumulated = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (accumulated + segLen >= target) {
      const frac = segLen > 0 ? (target - accumulated) / segLen : 0;
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * frac,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * frac,
      ];
    }
    accumulated += segLen;
  }
  return pts[pts.length - 1];
}

