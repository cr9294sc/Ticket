import init, { ProvinceIndex } from "../wasm/geo_core.js";
import wasmUrl from "../wasm/geo_core_bg.wasm?url";

export * from "../wasm/geo_core.js";

let ready: Promise<void> | null = null;

/** 初始化 Rust WASM 内核(幂等)。 */
export function initGeoCore(): Promise<void> {
  if (!ready) ready = init({ module_or_path: wasmUrl }).then(() => undefined);
  return ready;
}

/** 由中国省界 GeoJSON 构建 Rust 省份索引。 */
export function buildProvinceIndex(chinaGeojson: any): ProvinceIndex {
  const provinces = chinaGeojson.features
    .filter((f: any) => f.properties?.name)
    .map((f: any) => ({
      name: f.properties.name,
      polys: f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
    }));
  return new ProvinceIndex(JSON.stringify(provinces));
}
