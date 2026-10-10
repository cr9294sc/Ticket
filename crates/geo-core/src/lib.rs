//! 地理计算内核:大圆/里程、省份相交判定、标签防碰撞。编译为 WASM 供前端调用。
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const EARTH_R_KM: f64 = 6371.0088;
/// 铁路里程折算系数(站间大圆距离 -> 轨道里程)
pub const RAIL_FACTOR: f64 = 1.15;

/// 两点大圆距离(km),坐标为 [lng, lat] 度。
pub fn haversine(a: [f64; 2], b: [f64; 2]) -> f64 {
    let (la1, la2) = (a[1].to_radians(), b[1].to_radians());
    let dlat = la2 - la1;
    let dlng = (b[0] - a[0]).to_radians();
    let h = (dlat / 2.0).sin().powi(2) + la1.cos() * la2.cos() * (dlng / 2.0).sin().powi(2);
    2.0 * EARTH_R_KM * h.sqrt().asin()
}

#[wasm_bindgen]
pub fn great_circle_km(lng1: f64, lat1: f64, lng2: f64, lat2: f64) -> f64 {
    haversine([lng1, lat1], [lng2, lat2])
}

/// 折线(扁平 [lng,lat,...])的铁路折算里程。
#[wasm_bindgen]
pub fn rail_km(flat: &[f64]) -> f64 {
    let pts: Vec<[f64; 2]> = flat.chunks_exact(2).map(|c| [c[0], c[1]]).collect();
    pts.windows(2).map(|w| haversine(w[0], w[1])).sum::<f64>() * RAIL_FACTOR
}

/// 大圆插值,返回扁平 [lng,lat,...],含端点,n >= 2 段数。
#[wasm_bindgen]
pub fn great_circle_points(lng1: f64, lat1: f64, lng2: f64, lat2: f64, n: u32) -> Vec<f64> {
    let n = n.max(1);
    let (p1, l1) = (lat1.to_radians(), lng1.to_radians());
    let (p2, l2) = (lat2.to_radians(), lng2.to_radians());
    let d = haversine([lng1, lat1], [lng2, lat2]) / EARTH_R_KM;
    let mut out = Vec::with_capacity((n as usize + 1) * 2);
    for i in 0..=n {
        let f = i as f64 / n as f64;
        if d < 1e-9 {
            out.push(lng1);
            out.push(lat1);
            continue;
        }
        let a = ((1.0 - f) * d).sin() / d.sin();
        let b = (f * d).sin() / d.sin();
        let x = a * p1.cos() * l1.cos() + b * p2.cos() * l2.cos();
        let y = a * p1.cos() * l1.sin() + b * p2.cos() * l2.sin();
        let z = a * p1.sin() + b * p2.sin();
        out.push(y.atan2(x).to_degrees());
        out.push(z.atan2((x * x + y * y).sqrt()).to_degrees());
    }
    out
}

type Ring = Vec<[f64; 2]>;

/// 一个省份:多个多边形,每个多边形 = 外环 + 若干内环。
#[derive(Deserialize)]
struct Province {
    name: String,
    polys: Vec<Vec<Ring>>,
}

fn point_in_ring(p: [f64; 2], ring: &Ring) -> bool {
    let mut inside = false;
    let n = ring.len();
    let mut j = n.wrapping_sub(1);
    for i in 0..n {
        let (a, b) = (ring[i], ring[j]);
        if (a[1] > p[1]) != (b[1] > p[1])
            && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]
        {
            inside = !inside;
        }
        j = i;
    }
    inside
}

fn point_in_poly(p: [f64; 2], poly: &[Ring]) -> bool {
    match poly.split_first() {
        Some((outer, holes)) => point_in_ring(p, outer) && !holes.iter().any(|h| point_in_ring(p, h)),
        None => false,
    }
}

fn seg_intersect(p1: [f64; 2], p2: [f64; 2], q1: [f64; 2], q2: [f64; 2]) -> bool {
    let cross = |o: [f64; 2], a: [f64; 2], b: [f64; 2]| (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    let (d1, d2) = (cross(q1, q2, p1), cross(q1, q2, p2));
    let (d3, d4) = (cross(p1, p2, q1), cross(p1, p2, q2));
    (d1 > 0.0) != (d2 > 0.0) && (d3 > 0.0) != (d4 > 0.0)
}

fn poly_bbox(poly: &[Ring]) -> [f64; 4] {
    let mut b = [f64::MAX, f64::MAX, f64::MIN, f64::MIN];
    if let Some(o) = poly.first() {
        for p in o {
            b[0] = b[0].min(p[0]);
            b[1] = b[1].min(p[1]);
            b[2] = b[2].max(p[0]);
            b[3] = b[3].max(p[1]);
        }
    }
    b
}

/// 折线是否与多边形外环相交或有顶点落入其内。
fn polyline_hits_poly(line: &[[f64; 2]], poly: &[Ring]) -> bool {
    let bb = poly_bbox(poly);
    let (mut lx0, mut ly0, mut lx1, mut ly1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    for p in line {
        lx0 = lx0.min(p[0]);
        ly0 = ly0.min(p[1]);
        lx1 = lx1.max(p[0]);
        ly1 = ly1.max(p[1]);
    }
    if lx1 < bb[0] || lx0 > bb[2] || ly1 < bb[1] || ly0 > bb[3] {
        return false;
    }
    if line.iter().any(|&p| point_in_poly(p, poly)) {
        return true;
    }
    let Some(outer) = poly.first() else { return false };
    for w in line.windows(2) {
        for k in 0..outer.len() {
            let (q1, q2) = (outer[k], outer[(k + 1) % outer.len()]);
            if seg_intersect(w[0], w[1], q1, q2) {
                return true;
            }
        }
    }
    false
}

/// 省份索引:加载一次 JSON(`[{name, polys}]`),多次查询。
#[wasm_bindgen]
pub struct ProvinceIndex {
    provinces: Vec<Province>,
}

#[wasm_bindgen]
impl ProvinceIndex {
    #[wasm_bindgen(constructor)]
    pub fn new(json: &str) -> Result<ProvinceIndex, JsError> {
        let provinces: Vec<Province> = serde_json::from_str(json).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(ProvinceIndex { provinces })
    }

    /// 点所在省份名,不在任何省返回空串。
    pub fn locate(&self, lng: f64, lat: f64) -> String {
        self.provinces
            .iter()
            .find(|p| p.polys.iter().any(|poly| point_in_poly([lng, lat], poly)))
            .map(|p| p.name.clone())
            .unwrap_or_default()
    }

    /// 折线(扁平 [lng,lat,...])穿行的省份名列表。
    pub fn crossed(&self, flat: &[f64]) -> Vec<String> {
        let line: Vec<[f64; 2]> = flat.chunks_exact(2).map(|c| [c[0], c[1]]).collect();
        self.provinces
            .iter()
            .filter(|p| p.polys.iter().any(|poly| polyline_hits_poly(&line, poly)))
            .map(|p| p.name.clone())
            .collect()
    }
}

#[derive(Deserialize, Serialize)]
pub struct Label {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// 优先级,越大越先保留
    pub priority: f64,
}

/// 标签防碰撞:输入 [{x,y,w,h,priority}],返回被保留项的下标(按优先级贪心)。
#[wasm_bindgen]
pub fn resolve_labels(labels: JsValue) -> Result<Vec<u32>, JsError> {
    let labels: Vec<Label> = serde_wasm_bindgen::from_value(labels).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(resolve_labels_inner(&labels))
}

pub fn resolve_labels_inner(labels: &[Label]) -> Vec<u32> {
    let mut order: Vec<usize> = (0..labels.len()).collect();
    order.sort_by(|&a, &b| labels[b].priority.partial_cmp(&labels[a].priority).unwrap_or(std::cmp::Ordering::Equal));
    let mut kept: Vec<usize> = Vec::new();
    for i in order {
        let a = &labels[i];
        let clash = kept.iter().any(|&k| {
            let b = &labels[k];
            a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
        });
        if !clash {
            kept.push(i);
        }
    }
    kept.sort();
    kept.into_iter().map(|i| i as u32).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pek_sha_distance() {
        let d = haversine([116.6031, 40.0799], [121.3363, 31.1979]);
        assert!((d - 1082.0).abs() < 20.0, "{d}");
    }

    #[test]
    fn gc_endpoints() {
        let p = great_circle_points(0.0, 0.0, 90.0, 0.0, 4);
        assert_eq!(p.len(), 10);
        assert!((p[8] - 90.0).abs() < 1e-6);
    }

    #[test]
    fn crossing_square() {
        let json = r#"[{"name":"A","polys":[[[[0,0],[10,0],[10,10],[0,10]]]]}]"#;
        let idx = ProvinceIndex::new(json).ok().unwrap();
        assert_eq!(idx.locate(5.0, 5.0), "A");
        assert_eq!(idx.crossed(&[-5.0, 5.0, 15.0, 5.0]), vec!["A".to_string()]);
        assert!(idx.crossed(&[-5.0, 20.0, 15.0, 20.0]).is_empty());
    }

    #[test]
    fn label_collision() {
        let l = vec![
            Label { x: 0.0, y: 0.0, w: 10.0, h: 10.0, priority: 1.0 },
            Label { x: 5.0, y: 5.0, w: 10.0, h: 10.0, priority: 2.0 },
            Label { x: 50.0, y: 50.0, w: 5.0, h: 5.0, priority: 0.0 },
        ];
        assert_eq!(resolve_labels_inner(&l), vec![1, 2]);
    }
}
