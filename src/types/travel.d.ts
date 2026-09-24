export type TripType = "FLIGHT" | "HSR";

export interface LocationEntity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  type: "AIRPORT" | "TRAIN_STATION";
  coordinates: [number, number]; // [lng, lat]
}

export type LocationsCatalog = Record<string, LocationEntity>;

export interface TripEntity {
  id: string;
  type: TripType;
  code: string;
  date: string;
  year: number;
  originId: string;
  originName: string;
  originCity: string;
  originCoords: [number, number];
  destId: string;
  destName: string;
  destCity: string;
  destCoords: [number, number];
  distanceKm: number;
  color: string;
  airlineName?: string;
  notes?: string;
}

export interface TravelMetadata {
  totalFlightKm: number;
  totalHsrKm: number;
  totalKm: number;
  flightCount: number;
  hsrCount: number;
  totalCount: number;
  years: number[];
  earthLaps: number;
}

export interface TripsDataBundle {
  metadata: TravelMetadata;
  trips: TripEntity[];
}

export interface ColorScheme {
  bg: string;
  landFill: string;
  landStroke: string;
  flightPrimary: string;
  flightGlow: string;
  hsrPrimary: string;
  nodeAirport: string;
  nodeTrain: string;
  nodeHalo: string;
  hoverHighlight: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
}

export interface Particle {
  tripId: string;
  t: number; // 0.0 to 1.0 along Bezier
  speed: number; // step per second
  color: string;
  size: number;
}

export interface BezierPoints {
  p0: [number, number];
  cp: [number, number];
  p1: [number, number];
}
