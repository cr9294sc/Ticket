// 生成离线检索库: public/data/{airports,stations,airlines}.json
// 机场 = data/airports.js (国内为主) + data/airports_overseas.json (海外补充)
// 用法: node scripts/build_search_db.mjs
import fs from "node:fs";
import vm from "node:vm";
import { pinyin } from "pinyin-pro";

const read = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const src = fs.readFileSync("data/airports.js", "utf-8") + "\n;({AIRPORTS, AIRLINES});";
const { AIRPORTS, AIRLINES } = vm.runInNewContext(src);

const countries = read("public/data/countries.json").features;
const china = read("public/data/china_provinces.json").features.filter((f) => f.properties?.name);

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inFeature(x, y, f) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
}
function countryOf(lng, lat) {
  if (china.some((f) => inFeature(lng, lat, f))) return "中国";
  const hit = countries.find((f) => inFeature(lng, lat, f));
  return hit ? hit.properties.name : "";
}

const py = (s) => pinyin(s, { toneType: "none", type: "array", v: true }).join("");
const pyi = (s) => pinyin(s, { pattern: "first", toneType: "none", type: "array" }).join("");

const map = new Map();
for (const [id, a] of Object.entries(AIRPORTS)) {
  const full = a.name.startsWith(a.city) || a.name === a.city ? `${a.city}机场` : `${a.city}${a.name}机场`;
  map.set(id, { id, city: a.city, name: full, short: `${a.name}机场`, country: "", lat: a.lat, lng: a.lng, en: "" });
}
for (const [id, city, name, country, en, lat, lng] of read("data/airports_overseas.json")) {
  const full = name === city ? `${city}机场` : `${city}${name}机场`;
  map.set(id, { id, city, name: full, short: `${name}机场`, country, lat, lng, en });
}
const airports = [...map.values()].map((a) => {
  const country = a.country || countryOf(a.lng, a.lat) || "未知";
  return {
    id: a.id, city: a.city, name: a.name, short: a.short, country, en: a.en,
    lat: a.lat, lng: a.lng,
    py: py(a.name).toLowerCase(),
    pyi: pyi(a.name).toLowerCase(),
  };
});
fs.writeFileSync("public/data/airports.json", JSON.stringify(airports));

const geo = read("data/station_geo.json");
const stations = Object.entries(geo).map(([n, [x, y]]) => ({
  n, x, y, py: py(n).toLowerCase(), pyi: pyi(n).toLowerCase(),
}));
fs.writeFileSync("public/data/stations.json", JSON.stringify(stations));

fs.writeFileSync("public/data/airlines.json", JSON.stringify(AIRLINES));
console.log(`airports=${airports.length} stations=${stations.length} airlines=${Object.keys(AIRLINES).length}`);
console.log("unknown country:", airports.filter((a) => a.country === "未知").map((a) => a.id).join(","));
