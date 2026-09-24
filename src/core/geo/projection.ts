import { geoNaturalEarth1, type GeoProjection } from "d3-geo";

// Base canvas coordinate reference space (1400 x 950)
export const BASE_CANVAS_WIDTH = 1400;
export const BASE_CANVAS_HEIGHT = 950;

/**
 * Natural Earth 1 World Projection:
 * Rotated with central meridian 105°E so China and Asia-Pacific are in central focus,
 * while seamlessly rendering the entire globe.
 */
export const worldProjection: GeoProjection = geoNaturalEarth1()
  .rotate([-105, 0])
  .scale(230)
  .translate([BASE_CANVAS_WIDTH / 2, BASE_CANVAS_HEIGHT / 2]);

// Export chinaProjection as alias for backward compatibility
export const chinaProjection = worldProjection;

/**
 * Convert [lng, lat] to base coordinate [x, y]
 */
export function projectCoordinates(
  coords: [number, number],
): [number, number] | null {
  const pt = worldProjection(coords);
  if (!pt) return null;
  return [pt[0], pt[1]];
}

/**
 * Convert base coordinate [x, y] back to [lng, lat]
 */
export function invertCoordinates(
  point: [number, number],
): [number, number] | null {
  const coords = worldProjection.invert?.(point);
  if (!coords) return null;
  return [coords[0], coords[1]];
}
