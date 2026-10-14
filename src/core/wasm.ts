/**
 * ============================================================================
 * 几何与计算分层架构约定 (Architectural Boundary)
 * ============================================================================
 * 1. Rust / WebAssembly 内核 (crates/geo-core):
 *    - 纯数学、高计算密度、无状态的球面地理空间算法：
 *      * 大圆测距 (great_circle_km)
 *      * 铁路折算里程 (rail_km)
 *      * 球面大圆轨迹插值 (great_circle_points)
 *      * 省份空间相交与多边形射线法判别 (ProvinceIndex)
 *      * 密集标签贪心防碰撞算法 (resolve_labels)
 *
 * 2. TypeScript 几何与渲染层 (src/core/geo, src/core/math):
 *    - 2D Canvas 屏幕渲染空间与交互逻辑：
 *      * 投影变换 (projection.ts: d3-geo Natural Earth 1 视角旋转与画布映射)
 *      * 视口平移/缩放矩阵 (matrix.ts: ViewportTransform)
 *      * 像素空间二次贝塞尔弧线与折线采样 (trajectory.ts)
 *      * 鼠标点击拾取与碰撞判定 (hitTest.ts: 屏幕像素容差下的点到曲线/折线距离)
 * ============================================================================
 */

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
