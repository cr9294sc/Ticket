export interface SummaryKPI {
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  flightTrips: number;
  flightDistanceKm: number;
  trainTrips: number;
  trainDistanceKm: number;
  visitedCitiesCount: number;
  visitedCountriesCount: number;
  activeRoutesCount: number;
}

export interface YearData {
  totalTrips: number;
  totalDistanceKm: number;
  flightTrips: number;
  flightDistanceKm: number;
  trainTrips: number;
  trainDistanceKm: number;
}

export interface CityVisit {
  city: string;
  count: number;
}

export interface TripItem {
  id: string;
  type: 'flight' | 'train';
  date: string;
  departure: string;
  departureName: string;
  departureCity: string;
  arrival: string;
  arrivalName: string;
  arrivalCity: string;
  depTime?: string;
  arrTime?: string;
  distanceKm: number;
  durationMinutes: number;
  remarks?: string;
  
  // Flight fields
  flightNumber?: string;
  airline?: string;
  aircraft?: string;
  registration?: string;
  cabinClass?: string;
  seat?: string;

  // Train fields
  trainNumber?: string;
  trainType?: string;
  seatClass?: string;
  carriage?: string;
}

export interface StatsPayload {
  summary: SummaryKPI;
  yearly: Record<string, YearData>;
  topCities: CityVisit[];
  aircraftDistribution: Record<string, number>;
  airlineDistribution: Record<string, number>;
  cabinClassDistribution: Record<string, number>;
  trainSeatDistribution: Record<string, number>;
  trips: TripItem[];
}

