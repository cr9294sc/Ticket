import { ref, computed } from "vue";
import type {
  TripEntity,
  LocationEntity,
  TravelMetadata,
  TripsDataBundle,
  LocationsCatalog,
  TripType,
} from "../types/travel";

const locations = ref<LocationsCatalog>({});
const allTrips = ref<TripEntity[]>([]);
const metadata = ref<TravelMetadata>({
  totalFlightKm: 0,
  totalHsrKm: 0,
  totalKm: 0,
  flightCount: 0,
  hsrCount: 0,
  totalCount: 0,
  years: [],
  earthLaps: 0,
});

const selectedType = ref<"ALL" | TripType>("ALL");
const selectedYear = ref<"ALL" | number>("ALL");
const hoveredTrip = ref<TripEntity | null>(null);
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);

export function useTripStore() {
  const fetchData = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      const [locRes, tripRes] = await Promise.all([
        fetch("./data/locations.json"),
        fetch("./data/trips.json"),
      ]);

      if (!locRes.ok || !tripRes.ok) {
        throw new Error("Failed to load travel data");
      }

      locations.value = await locRes.json();
      const tripBundle: TripsDataBundle = await tripRes.json();
      allTrips.value = tripBundle.trips;
      metadata.value = tripBundle.metadata;
    } catch (err: any) {
      console.error(err);
      error.value = err.message || "Error loading travel traces";
    } finally {
      isLoading.value = false;
    }
  };

  const filteredTrips = computed<TripEntity[]>(() => {
    return allTrips.value.filter((trip) => {
      if (selectedType.value !== "ALL" && trip.type !== selectedType.value) {
        return false;
      }
      if (selectedYear.value !== "ALL" && trip.year !== selectedYear.value) {
        return false;
      }
      return true;
    });
  });

  const activeStats = computed(() => {
    const list = filteredTrips.value;
    let flightKm = 0;
    let hsrKm = 0;
    let flightCount = 0;
    let hsrCount = 0;

    const stationVisitCount = new Map<
      string,
      { name: string; city: string; type: string; count: number }
    >();
    const airlineCount = new Map<
      string,
      { name: string; color: string; count: number }
    >();
    const trainCodeCount = new Map<string, number>();

    for (const trip of list) {
      if (trip.type === "FLIGHT") {
        flightKm += trip.distanceKm;
        flightCount++;
        if (trip.airlineName) {
          const a = airlineCount.get(trip.airlineName) || {
            name: trip.airlineName,
            color: trip.color,
            count: 0,
          };
          a.count++;
          airlineCount.set(trip.airlineName, a);
        }
      } else {
        hsrKm += trip.distanceKm;
        hsrCount++;
        trainCodeCount.set(trip.code, (trainCodeCount.get(trip.code) || 0) + 1);
      }

      // Station visits
      const o = stationVisitCount.get(trip.originName) || {
        name: trip.originName,
        city: trip.originCity,
        type: trip.type,
        count: 0,
      };
      o.count++;
      stationVisitCount.set(trip.originName, o);

      const d = stationVisitCount.get(trip.destName) || {
        name: trip.destName,
        city: trip.destCity,
        type: trip.type,
        count: 0,
      };
      d.count++;
      stationVisitCount.set(trip.destName, d);
    }

    const totalKm = round1(flightKm + hsrKm);
    const totalCount = flightCount + hsrCount;

    const topStations = Array.from(stationVisitCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topAirlines = Array.from(airlineCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topTrains = Array.from(trainCodeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    return {
      flightKm: round1(flightKm),
      hsrKm: round1(hsrKm),
      totalKm,
      flightCount,
      hsrCount,
      totalCount,
      kmFlightPct: totalKm > 0 ? Math.round((flightKm / totalKm) * 100) : 0,
      kmHsrPct: totalKm > 0 ? Math.round((hsrKm / totalKm) * 100) : 0,
      countFlightPct:
        totalCount > 0 ? Math.round((flightCount / totalCount) * 100) : 0,
      countHsrPct:
        totalCount > 0 ? Math.round((hsrCount / totalCount) * 100) : 0,
      earthLaps: round2(totalKm / 40075.0),
      topStations,
      topAirlines,
      topTrains,
    };
  });

  return {
    locations,
    allTrips,
    filteredTrips,
    metadata,
    selectedType,
    selectedYear,
    hoveredTrip,
    isLoading,
    error,
    activeStats,
    fetchData,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
