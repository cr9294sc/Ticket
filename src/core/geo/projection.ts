import { geoConicEqualArea, type GeoProjection } from "d3-geo";

// Base canvas coordinate reference space (1400 x 950)
export const BASE_CANVAS_WIDTH = 1400;
export const BASE_CANVAS_HEIGHT = 950;

/**
 * Standard Albers China Projection (geoConicEqualArea):
 * Standard parallels [25°N, 47°N], central meridian 105°E, center [0, 36°N].
 * Centered and scaled to fit China cleanly without elliptical distortion.
 */
export const worldProjection: GeoProjection = geoConicEqualArea()
  .parallels([25, 47])
  .rotate([-105, 0])
  .center([0, 36])
  .scale(1050)
  .translate([BASE_CANVAS_WIDTH / 2, 390]);

// Export chinaProjection as alias for backward compatibility
export const chinaProjection = worldProjection;

/**
 * Convert [lng, lat] to base coordinate [x, y]
 */
export function projectCoordinates(
  coords: [number, number],
): [number, number] | null {
  const pt = worldProjection(coords);
  if (!pt || isNaN(pt[0]) || isNaN(pt[1])) return null;
  return [pt[0], pt[1]];
}

/**
 * Convert base coordinate [x, y] back to [lng, lat]
 */
export function invertCoordinates(
  point: [number, number],
): [number, number] | null {
  const coords = worldProjection.invert?.(point);
  if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return null;
  return [coords[0], coords[1]];
}
