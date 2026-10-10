import { ref, computed } from "vue";
import type {
  TripEntity,
  LocationEntity,
  TravelMetadata,
  TripsDataBundle,
  LocationsCatalog,
  TripType,
} from "../types/travel";
import { tripDb, type TripRecord } from "../core/db";
import { initGeoCore } from "../core/wasm";
import { airportById, buildTrip, classifyTrain, loadCatalog, type TripInput } from "../core/catalog";

const locations = ref<LocationsCatalog>({});
/** CSV 预处理产物(只读基线) */
const baseTrips = ref<TripEntity[]>([]);
/** IndexedDB 记录:用户新增/修改的行程,以及对基线行程的删除标记 */
const userRecords = ref<TripRecord[]>([]);

const selectedType = ref<"ALL" | TripType>("ALL");
const selectedYear = ref<"ALL" | number>("ALL");
const startDate = ref<string>("");
const endDate = ref<string>("");
const vehicleFilter = ref<"ALL" | "WIDE" | "HSR_CR">("ALL"); // 全部 / 宽体客机 / 高铁动车
const scopeFilter = ref<"ALL" | "DOMESTIC" | "INTL">("ALL"); // 全部 / 国内 / 跨国
const hoveredTrip = ref<TripEntity | null>(null);
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);
/** 最近一次新增/修改的行程 id,地图据此触发漫游上图 */
const lastAddedId = ref<string | null>(null);

function enrichBase(t: TripEntity): TripEntity {
  const out: TripEntity = { ...t, source: "base" };
  if (t.type === "FLIGHT") {
    out.originCountry = airportById(t.originId)?.country;
    out.destCountry = airportById(t.destId)?.country;
  } else {
    out.railClass = classifyTrain(t.code);
    out.originCountry = "中国";
    out.destCountry = "中国";
  }
  return out;
}

/** 基线 + 用户记录合并:同 id 以用户记录覆盖,删除标记剔除 */
const allTrips = computed<TripEntity[]>(() => {
  const over = new Map(userRecords.value.map((r) => [r.id, r]));
  const out: TripEntity[] = [];
  for (const t of baseTrips.value) {
    const r = over.get(t.id);
    if (!r) out.push(t);
    else if (!r.deleted && r.trip) out.push(r.trip);
  }
  const baseIds = new Set(baseTrips.value.map((t) => t.id));
  for (const r of userRecords.value) {
    if (!r.deleted && r.trip && !baseIds.has(r.id)) out.push(r.trip);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
});

const metadata = computed<TravelMetadata>(() => {
  const list = allTrips.value;
  let f = 0, h = 0, fc = 0, hc = 0;
  for (const t of list) {
    if (t.type === "FLIGHT") { f += t.distanceKm; fc++; } else { h += t.distanceKm; hc++; }
  }
  const total = f + h;
  return {
    totalFlightKm: round1(f), totalHsrKm: round1(h), totalKm: round1(total),
    flightCount: fc, hsrCount: hc, totalCount: fc + hc,
    years: Array.from(new Set(list.map((t) => t.year))).sort(),
    earthLaps: round2(total / 40075.0),
  };
});

export function useTripStore() {
  const fetchData = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      const [locRes, tripRes] = await Promise.all([
        fetch("./data/locations.json"),
        fetch("./data/trips.json"),
        initGeoCore(),
        loadCatalog(),
      ]);

      if (!locRes.ok || !tripRes.ok) {
        throw new Error("Failed to load travel data");
      }

      locations.value = await locRes.json();
      const tripBundle: TripsDataBundle = await tripRes.json();
      baseTrips.value = tripBundle.trips.map(enrichBase);
      userRecords.value = await tripDb.getAll();
      // 用户记录涉及的站点并入站点字典
      for (const r of userRecords.value) if (r.trip) ensureLocations(r.trip);
    } catch (err: any) {
      console.error(err);
      error.value = err.message || "Error loading travel traces";
    } finally {
      isLoading.value = false;
    }
  };

  const ensureLocations = (t: TripEntity) => {
    const mk = (id: string, name: string, city: string, c: [number, number]): LocationEntity => ({
      id, name, shortName: name, city, type: t.type === "FLIGHT" ? "AIRPORT" : "TRAIN_STATION", coordinates: c,
    });
    if (!locations.value[t.originId]) locations.value[t.originId] = mk(t.originId, t.originName, t.originCity, t.originCoords);
    if (!locations.value[t.destId]) locations.value[t.destId] = mk(t.destId, t.destName, t.destCity, t.destCoords);
  };

  /** 新增或修改一条行程(input 带 id 即为修改) */
  const saveTrip = async (input: TripInput): Promise<{ ok: boolean; error?: string; id?: string }> => {
    const r = buildTrip(input);
    if (!r.trip) return { ok: false, error: r.error };
    await putTrip(r.trip);
    return { ok: true, id: r.trip.id };
  };

  const putTrip = async (trip: TripEntity) => {
    trip.source = "user";
    const rec: TripRecord = { id: trip.id, trip };
    await tripDb.put(rec);
    userRecords.value = [...userRecords.value.filter((x) => x.id !== rec.id), rec];
    ensureLocations(trip);
    lastAddedId.value = trip.id;
  };

  const importTrips = async (trips: TripEntity[]) => {
    const recs = trips.map((t) => ({ id: t.id, trip: { ...t, source: "user" as const } }));
    await tripDb.putMany(recs);
    const ids = new Set(recs.map((r) => r.id));
    userRecords.value = [...userRecords.value.filter((x) => !ids.has(x.id)), ...recs];
    for (const t of trips) ensureLocations(t);
  };

  const deleteTrip = async (id: string) => {
    const isBase = baseTrips.value.some((t) => t.id === id);
    if (isBase) {
      const rec: TripRecord = { id, deleted: true };
      await tripDb.put(rec);
      userRecords.value = [...userRecords.value.filter((x) => x.id !== id), rec];
    } else {
      await tripDb.remove(id);
      userRecords.value = userRecords.value.filter((x) => x.id !== id);
    }
  };

  /** 清除所有本地改动,恢复到 CSV 基线 */
  const resetLocal = async () => {
    await tripDb.clear();
    userRecords.value = [];
  };

  const filteredTrips = computed<TripEntity[]>(() => {
    return allTrips.value.filter((trip) => {
      if (selectedType.value !== "ALL" && trip.type !== selectedType.value) {
        return false;
      }
      if (selectedYear.value !== "ALL" && trip.year !== selectedYear.value) {
        return false;
      }
      if (startDate.value && trip.date < startDate.value) {
        return false;
      }
      if (endDate.value && trip.date > endDate.value) {
        return false;
      }
      if (vehicleFilter.value === "WIDE") {
        if (trip.type !== "FLIGHT" || trip.aircraftBody !== "WIDE") return false;
      } else if (vehicleFilter.value === "HSR_CR") {
        if (trip.type !== "HSR" || trip.railClass === "CLASSIC") return false;
      }
      if (scopeFilter.value === "DOMESTIC") {
        const isDom =
          (!trip.originCountry || trip.originCountry === "中国") &&
          (!trip.destCountry || trip.destCountry === "中国");
        if (!isDom) return false;
      } else if (scopeFilter.value === "INTL") {
        const isIntl =
          (trip.originCountry && trip.originCountry !== "中国") ||
          (trip.destCountry && trip.destCountry !== "中国");
        if (!isIntl) return false;
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

    // Geographic footprint & duration assets
    const visitedCities = new Set<string>();
    const visitedCountries = new Set<string>();
    let totalMinutes = 0;

    // Aircraft body distribution & leaderboard
    let wideCount = 0;
    let narrowCount = 0;
    const aircraftModelCount = new Map<string, number>();

    // Rail lineage distribution
    let fuxingKm = 0, fuxingCount = 0;
    let hexieKm = 0, hexieCount = 0;
    let classicKm = 0, classicCount = 0;

    // Time-of-day & Day-of-week preference
    let redEyeCount = 0; // 22:00 ~ 06:00
    let daytimeCount = 0;
    let weekdayCount = 0; // Monday - Friday
    let weekendCount = 0; // Saturday - Sunday

    for (const trip of list) {
      if (trip.originCity) visitedCities.add(trip.originCity);
      if (trip.destCity) visitedCities.add(trip.destCity);
      if (trip.originCountry) visitedCountries.add(trip.originCountry);
      if (trip.destCountry) visitedCountries.add(trip.destCountry);

      totalMinutes += trip.durationMin || 0;

      // Departure time analysis
      if (trip.departTime) {
        const hour = parseInt(trip.departTime.split(":")[0], 10);
        if (hour >= 22 || hour < 6) redEyeCount++;
        else daytimeCount++;
      } else {
        daytimeCount++;
      }

      // Day of week analysis
      const d = new Date(trip.date).getDay();
      if (d === 0 || d === 6) weekendCount++;
      else weekdayCount++;

      if (trip.type === "FLIGHT") {
        flightKm += trip.distanceKm;
        flightCount++;

        if (trip.aircraftBody === "WIDE") wideCount++;
        else if (trip.aircraftBody === "NARROW") narrowCount++;
        if (trip.aircraft) {
          aircraftModelCount.set(
            trip.aircraft,
            (aircraftModelCount.get(trip.aircraft) || 0) + 1
          );
        }

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

        const m = (trip.trainModel || "").toUpperCase();
        if (m.startsWith("CR2") || m.startsWith("CR3") || m.startsWith("CR4")) {
          fuxingKm += trip.distanceKm;
          fuxingCount++;
        } else if (m.startsWith("CRH")) {
          hexieKm += trip.distanceKm;
          hexieCount++;
        } else {
          classicKm += trip.distanceKm;
          classicCount++;
        }
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

      const dLoc = stationVisitCount.get(trip.destName) || {
        name: trip.destName,
        city: trip.destCity,
        type: trip.type,
        count: 0,
      };
      dLoc.count++;
      stationVisitCount.set(trip.destName, dLoc);
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

    const topAircraftModels = Array.from(aircraftModelCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));

    // Travel time assets: days and hours
    const totalDurationHours = Math.floor(totalMinutes / 60);
    const durationDays = (totalMinutes / 1440).toFixed(1);

    // Moon distance comparison (Earth-Moon ~ 384,400 km)
    const moonPercent = ((totalKm / 384400) * 100).toFixed(2);

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
      moonPercent,
      totalDurationHours,
      durationDays,
      visitedCitiesCount: visitedCities.size,
      visitedCountriesCount: Math.max(visitedCountries.size, 1),
      wideCount,
      narrowCount,
      widePct: (wideCount + narrowCount) > 0 ? Math.round((wideCount / (wideCount + narrowCount)) * 100) : 0,
      narrowPct: (wideCount + narrowCount) > 0 ? Math.round((narrowCount / (wideCount + narrowCount)) * 100) : 0,
      topAircraftModels,
      fuxingKm: round1(fuxingKm),
      fuxingCount,
      hexieKm: round1(hexieKm),
      hexieCount,
      classicKm: round1(classicKm),
      classicCount,
      redEyeCount,
      daytimeCount,
      weekdayCount,
      weekendCount,
      topStations,
      topAirlines,
      topTrains,
    };
  });

  return {
    locations,
    allTrips,
    baseTrips,
    lastAddedId,
    saveTrip,
    putTrip,
    importTrips,
    deleteTrip,
    resetLocal,
    filteredTrips,
    metadata,
    selectedType,
    selectedYear,
    startDate,
    endDate,
    vehicleFilter,
    scopeFilter,
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
