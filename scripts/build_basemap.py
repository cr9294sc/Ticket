#!/usr/bin/env python3
"""生成全球底图:
- public/data/countries.json  非中国国家外轮廓 (Natural Earth 50m, 公有领域)
- public/data/admin1.json     海外主要大国一级行政区
中国国界/省界/十段线以 public/data/china_provinces.json 为准(渲染时覆盖其上)。
用法: python3 scripts/build_basemap.py <ne_admin0.geojson> <ne_admin1.geojson>
"""
import json
import sys

OUT = "public/data"
# 海外需要一级行政区的主要大国 (ISO_A3)
ADMIN1_COUNTRIES = {"USA", "CAN", "AUS", "RUS", "BRA", "IND", "MEX", "ARG", "KAZ", "JPN"}
# 中国及其下属在 china_provinces.json 中已含,海外层不再重复
SKIP_A3 = {"CHN", "TWN", "HKG", "MAC"}


def dp(points, eps):
    """Douglas-Peucker 抽稀 (迭代实现)。"""
    if len(points) < 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = points[a], points[b]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
        idx, dmax = -1, 0.0
        for i in range(a + 1, b):
            d = abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / norm
            if d > dmax:
                idx, dmax = i, d
        if dmax > eps and idx != -1:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(points, keep) if k]


def clean_ring(ring, eps):
    raw = [(round(x, 2), round(y, 2)) for x, y in ring]
    if len(raw) > 8 and raw[0] == raw[-1]:
        m = len(raw) // 2
        pts = dp(raw[: m + 1], eps) + dp(raw[m:], eps)[1:]
    else:
        pts = dp(raw, eps)
    out = [pts[0]]
    for p in pts[1:]:
        if p != out[-1]:
            out.append(p)
    return [list(p) for p in out] if len(out) >= 4 else None


def clean_geom(geom, eps):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    res = []
    for poly in polys:
        rings = [clean_ring(r, eps) for r in poly]
        if rings[0]:
            res.append([r for r in rings if r])
    if not res:
        return None
    return {"type": "MultiPolygon", "coordinates": res}


def main(a0, a1):
    countries = []
    for f in json.load(open(a0))["features"]:
        p = f["properties"]
        a3 = p.get("ADM0_A3") or p.get("ISO_A3")
        if a3 in SKIP_A3:
            continue
        g = clean_geom(f["geometry"], 0.03)
        if g:
            countries.append({"type": "Feature", "properties": {"name": p.get("NAME_ZH") or p.get("NAME"), "iso": a3}, "geometry": g})
    admin1 = []
    for f in json.load(open(a1))["features"]:
        p = f["properties"]
        if p.get("adm0_a3") not in ADMIN1_COUNTRIES:
            continue
        g = clean_geom(f["geometry"], 0.05)
        if g:
            admin1.append({"type": "Feature", "properties": {"name": p.get("name_zh") or p.get("name"), "iso": p.get("adm0_a3")}, "geometry": g})
    for name, feats in (("countries", countries), ("admin1", admin1)):
        with open(f"{OUT}/{name}.json", "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": feats}, fh, ensure_ascii=False, separators=(",", ":"))
        print(name, len(feats))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
