import type { LocationEntity, TripEntity } from "../types/travel";
import { great_circle_km, rail_km } from "./wasm";

export interface AirportRec {
  id: string;
  city: string;
  name: string;
  short: string;
  country: string;
  en: string;
  lat: number;
  lng: number;
  py: string;
  pyi: string;
}
export interface StationRec {
  n: string;
  x: number;
  y: number;
  py: string;
  pyi: string;
}
export interface AirlineRec {
  name: string;
  color: string;
}

export const AIRCRAFT_PRESETS = {
  宽体: ["A330-300", "A330-900", "A350-900", "A350-1000", "A380-800", "B747-8", "B767-300", "B777-200", "B777-300ER", "B787-8", "B787-9", "B787-10"],
  窄体: ["A319", "A320", "A320neo", "A321", "A321neo", "B737-700", "B737-800", "B737 MAX 8", "C919", "ARJ21-700", "E190"],
} as const;

export const CABINS = ["经济", "超经", "两舱"] as const;

export const TRAIN_MODELS = [
  { group: "复兴号", items: ["CR400AF", "CR400BF", "CR300AF", "CR300BF", "CR200J"] },
  { group: "和谐号", items: ["CRH380A", "CRH380B", "CRH380D", "CRH2A", "CRH3C", "CRH5A", "CRH6"] },
  { group: "普速", items: ["25T", "25G", "25K", "25B"] },
] as const;

export const SEAT_CLASSES = ["商务座", "一等座", "二等座", "软卧", "硬卧", "软座", "硬座", "无座"] as const;

const WIDE_RE = /^(A33|A34|A35|A38|B74|B76|B77|B78)/i;
export function aircraftBody(model: string): "WIDE" | "NARROW" {
  return WIDE_RE.test(model.replace(/\s+/g, "")) ? "WIDE" : "NARROW";
}

export function railFamily(model: string): "复兴号" | "和谐号" | "普速" {
  const m = model.toUpperCase();
  if (m.startsWith("CR2") || m.startsWith("CR3") || m.startsWith("CR4")) return "复兴号";
  if (m.startsWith("CRH")) return "和谐号";
  return "普速";
}

/** 车次分类:G/C/D 为高铁动车,其余为普速 */
export function classifyTrain(code: string): "HSR" | "CLASSIC" {
  return /^[GCD]/i.test(code) ? "HSR" : "CLASSIC";
}
export const TRAIN_CODE_RE = /^[GCDZTKYSLP]?\d{1,4}$/;
export const FLIGHT_CODE_RE = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
export const REG_RE = /^[A-Z]-?[A-Z0-9]{3,5}$/;

let airports: AirportRec[] = [];
let stations: StationRec[] = [];
let airlines: Record<string, AirlineRec> = {};
let loaded: Promise<void> | null = null;

export function loadCatalog(): Promise<void> {
  if (!loaded) {
    loaded = Promise.all([
      fetch("./data/airports.json").then((r) => r.json()),
      fetch("./data/stations.json").then((r) => r.json()),
      fetch("./data/airlines.json").then((r) => r.json()),
    ]).then(([a, s, l]) => {
      airports = a;
      stations = s;
      airlines = l;
    });
  }
  return loaded;
}

export const getAirports = () => airports;
export const getStations = () => stations;
export const getAirlines = () => airlines;
export const airportById = (id: string) => airports.find((a) => a.id === id);
export const stationByName = (n: string) => stations.find((s) => s.n === n);

function score(q: string, fields: { text: string; kind: "id" | "name" | "py" | "pyi" | "en" }[]): number {
  let best = 0;
  for (const f of fields) {
    const t = f.text.toLowerCase();
    if (!t) continue;
    let s = 0;
    if (f.kind === "id") s = t === q ? 100 : t.startsWith(q) ? 90 : 0;
    else if (f.kind === "name") s = t === q ? 95 : t.startsWith(q) ? 80 : t.includes(q) ? 60 : 0;
    else if (f.kind === "pyi") s = t.startsWith(q) ? 70 : t.includes(q) ? 45 : 0;
    else if (f.kind === "py") s = t.startsWith(q) ? 65 : t.includes(q) ? 40 : 0;
    else if (f.kind === "en") s = t.includes(q) ? 50 : 0;
    best = Math.max(best, s);
  }
  return best;
}

/** IATA / 中文名 / 拼音全拼 / 首字母 / 英文名 模糊匹配机场 */
export function searchAirports(query: string, limit = 8): AirportRec[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return airports
    .map((a) => ({
      a,
      s: score(q, [
        { text: a.id, kind: "id" },
        { text: a.name, kind: "name" },
        { text: a.city, kind: "name" },
        { text: a.py, kind: "py" },
        { text: a.pyi, kind: "pyi" },
        { text: a.en, kind: "en" },
      ]),
    }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a);
}

export function searchStations(query: string, limit = 8): StationRec[] {
  const q = query.trim().toLowerCase().replace(/站$/, "");
  if (!q) return [];
  return stations
    .map((s) => ({
      s,
      sc: score(q, [
        { text: s.n, kind: "name" },
        { text: s.py, kind: "py" },
        { text: s.pyi, kind: "pyi" },
      ]),
    }))
    .filter((x) => x.sc > 0)
    .sort((x, y) => y.sc - x.sc || x.s.n.length - y.s.n.length)
    .slice(0, limit)
    .map((x) => x.s);
}

/** 取最佳匹配(用于 CSV 导入等) */
export function resolveAirport(text: string): AirportRec | undefined {
  const t = text.trim();
  return airportById(t.toUpperCase()) || searchAirports(t, 1)[0];
}
export function resolveStation(text: string): StationRec | undefined {
  const t = text.trim().replace(/站$/, "");
  return stationByName(t) || searchStations(t, 1)[0];
}

export const km1 = (n: number) => Math.round(n * 10) / 10;

export function flightKm(a: AirportRec, b: AirportRec): number {
  return km1(great_circle_km(a.lng, a.lat, b.lng, b.lat));
}
export function railKm(a: StationRec, b: StationRec): number {
  return km1(rail_km(new Float64Array([a.x, a.y, b.x, b.y])));
}

export function estimateDuration(type: "FLIGHT" | "HSR", km: number, railClass?: "HSR" | "CLASSIC"): number {
  if (type === "FLIGHT") return Math.round((km / 800) * 60 + 35);
  return Math.round((km / (railClass === "CLASSIC" ? 100 : 230)) * 60 + 10);
}

export interface TripInput {
  id?: string;
  type: "FLIGHT" | "HSR";
  date: string;
  code: string;
  from: string; // airport id | station name
  to: string;
  notes?: string;
  aircraft?: string;
  registration?: string;
  cabin?: string;
  seat?: string;
  trainModel?: string;
  seatClass?: string;
  departTime?: string;
  durationMin?: number;
}

export function airlineOf(code: string): { name: string; color: string } {
  const a = airlines[code.slice(0, 2).toUpperCase()];
  return a || { name: "", color: "#4DFFB4" };
}

/** 由表单输入构造完整行程实体,失败返回错误文案 */
export function buildTrip(input: TripInput): { trip?: TripEntity; locations?: LocationEntity[]; error?: string } {
  const code = input.code.trim().toUpperCase();
  const date = input.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "日期格式应为 YYYY-MM-DD" };
  const id = input.id || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const year = Number(date.slice(0, 4));

  if (input.type === "FLIGHT") {
    if (!FLIGHT_CODE_RE.test(code)) return { error: "航班号格式不正确(如 CA1501)" };
    const a = airportById(input.from);
    const b = airportById(input.to);
    if (!a || !b) return { error: "请从联想列表中选择有效的起降机场" };
    if (a.id === b.id) return { error: "出发与到达机场不能相同" };
    if (input.registration && !REG_RE.test(input.registration.toUpperCase())) return { error: "注册号格式不正确(如 B-1234)" };
    const km = flightKm(a, b);
    const al = airlineOf(code);
    const aircraft = (input.aircraft || "").trim();
    const trip: TripEntity = {
      id, type: "FLIGHT", code, date, year,
      originId: a.id, originName: a.name, originCity: a.city, originCoords: [a.lng, a.lat],
      destId: b.id, destName: b.name, destCity: b.city, destCoords: [b.lng, b.lat],
      distanceKm: km, color: al.color, airlineName: al.name, notes: input.notes || "",
      aircraft: aircraft || undefined,
      aircraftBody: aircraft ? aircraftBody(aircraft) : undefined,
      registration: input.registration ? input.registration.toUpperCase() : undefined,
      cabin: input.cabin || undefined, seat: input.seat ? input.seat.toUpperCase() : undefined,
      departTime: input.departTime || undefined,
      durationMin: input.durationMin || estimateDuration("FLIGHT", km),
      durationEstimated: !input.durationMin,
      originCountry: a.country, destCountry: b.country,
      source: "user",
    };
    const loc = (r: AirportRec): LocationEntity => ({ id: r.id, name: r.name, shortName: r.short, city: r.city, type: "AIRPORT", coordinates: [r.lng, r.lat] });
    return { trip, locations: [loc(a), loc(b)] };
  }

  if (!TRAIN_CODE_RE.test(code)) return { error: "车次格式不正确(如 G1、D301、K1234)" };
  const a = stationByName(input.from);
  const b = stationByName(input.to);
  if (!a || !b) return { error: "请从联想列表中选择有效的起止车站" };
  if (a.n === b.n) return { error: "出发与到达车站不能相同" };
  const railClass = classifyTrain(code);
  const km = railKm(a, b);
  const trip: TripEntity = {
    id, type: "HSR", code, date, year, railClass,
    originId: a.n, originName: `${a.n}站`, originCity: a.n, originCoords: [a.x, a.y],
    destId: b.n, destName: `${b.n}站`, destCity: b.n, destCoords: [b.x, b.y],
    distanceKm: km, color: "#FF9F43", airlineName: "", notes: input.notes || "",
    trainModel: input.trainModel || undefined, seatClass: input.seatClass || undefined,
    departTime: input.departTime || undefined,
    durationMin: input.durationMin || estimateDuration("HSR", km, railClass),
    durationEstimated: !input.durationMin,
    originCountry: "中国", destCountry: "中国",
    source: "user",
  };
  const loc = (r: StationRec): LocationEntity => ({ id: r.n, name: `${r.n}站`, shortName: `${r.n}站`, city: r.n, type: "TRAIN_STATION", coordinates: [r.x, r.y] });
  return { trip, locations: [loc(a), loc(b)] };
}
