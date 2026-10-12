#!/usr/bin/env python3
"""
rail_router.py
Provides rail network Dijkstra routing and real geometry extraction
using data from the rail-globe project (graph.json, stations.geojson, rail_hsr.geojson).
Includes a persistent cache (data/rail_routes_cache.json) so CI/CD and production builds
can resolve real track geometries without requiring the full rail-globe repository.
"""

import json
import math
import os
import heapq

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIL_GLOBE_DIR = os.path.join(BASE_DIR, "rail-globe.github.io-main")
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "public", "data")
CACHE_FILE = os.path.join(DATA_DIR, "rail_routes_cache.json")


def ramer_douglas_peucker(points, epsilon):
    """
    Ramer-Douglas-Peucker (RDP) polyline simplification algorithm.
    points: list of [lng, lat]
    epsilon: distance threshold in degrees
    """
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    dx = last[0] - first[0]
    dy = last[1] - first[1]
    denom = math.hypot(dx, dy)

    max_dist, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        p = points[i]
        if denom > 0:
            dist = abs(dy * p[0] - dx * p[1] + last[0] * first[1] - last[1] * first[0]) / denom
        else:
            dist = math.hypot(p[0] - first[0], p[1] - first[1])
        if dist > max_dist:
            max_dist, idx = dist, i

    if max_dist > epsilon:
        left = ramer_douglas_peucker(points[: idx + 1], epsilon)
        right = ramer_douglas_peucker(points[idx:], epsilon)
        return left[:-1] + right
    else:
        return [first, last]


def calculate_polyline_distance_km(coords):
    """
    Calculate total length along coordinates [ [lng1, lat1], [lng2, lat2], ... ] in km.
    """
    total = 0.0
    for i in range(len(coords) - 1):
        lng1, lat1 = coords[i]
        lng2, lat2 = coords[i + 1]
        mid_lat = math.radians((lat1 + lat2) / 2.0)
        dx = (lng2 - lng1) * math.cos(mid_lat) * 111.32
        dy = (lat2 - lat1) * 111.32
        total += math.hypot(dx, dy)
    return round(total, 1)


class RailRouter:
    def __init__(self, graph_path=None, stations_path=None, cache_path=None):
        if not graph_path:
            graph_path = os.path.join(RAIL_GLOBE_DIR, "data", "graph.json")
        if not stations_path:
            stations_path = os.path.join(RAIL_GLOBE_DIR, "data", "stations.geojson")
        if not cache_path:
            cache_path = CACHE_FILE

        self.graph_path = graph_path
        self.stations_path = stations_path
        self.cache_path = cache_path
        self.graph = None
        self.station_to_hub = {}
        self.adj = None
        self.shape_at = None
        self._loaded = False
        self.cache = {}
        self.cache_dirty = False
        self._load_cache()

    def _load_cache(self):
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    self.cache = json.load(f)
            except Exception as e:
                print(f"Notice: Failed to load rail routes cache: {e}")
                self.cache = {}

    def _save_cache(self):
        if not self.cache_dirty:
            return
        try:
            os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
            with open(self.cache_path, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
            self.cache_dirty = False
        except Exception as e:
            print(f"Warning: Failed to save rail routes cache: {e}")

    def load(self):
        if self._loaded:
            return True

        if not os.path.exists(self.graph_path) or not os.path.exists(self.stations_path):
            return False

        print(">>> [RailRouter] Initializing graph and stations topology...")
        # 1. Load stations
        with open(self.stations_path, "r", encoding="utf-8") as f:
            st_data = json.load(f)

        for feat in st_data.get("features", []):
            name = feat.get("properties", {}).get("n", "")
            gid = feat.get("properties", {}).get("g")
            if name and gid is not None:
                self.station_to_hub[name] = gid
                clean_name = name.rstrip("站")
                if clean_name not in self.station_to_hub:
                    self.station_to_hub[clean_name] = gid

        # 2. Load graph
        with open(self.graph_path, "r", encoding="utf-8") as f:
            self.graph = json.load(f)

        g = self.graph
        nodes_len = len(g["nodes"]) // 2
        edges_len = len(g["edges"]) // 5
        self.adj = [[] for _ in range(nodes_len)]
        speed = g["speed"]

        for i in range(edges_len):
            u = g["edges"][i * 5]
            v = g["edges"][i * 5 + 1]
            cls = g["lines"][g["edges"][i * 5 + 2]][1]
            dist_m = g["edges"][i * 5 + 3]
            if cls == "x":
                cost = g.get("transferMin", 12)
            elif cls == "y":
                cost = g.get("metroMin", 3)
            else:
                spd = speed.get(cls, 100)
                cost = (dist_m / 1000.0 / spd) * 60.0  # minutes

            self.adj[u].append((v, cost, i))
            self.adj[v].append((u, cost, i))

        self.shape_at = [0] * (edges_len + 1)
        for i in range(edges_len):
            self.shape_at[i + 1] = self.shape_at[i] + g["edges"][i * 5 + 4]

        self._loaded = True
        return True

    def get_edge_coords(self, edge_idx, start_node):
        g = self.graph
        u = g["edges"][edge_idx * 5]
        v = g["edges"][edge_idx * 5 + 1]
        x = g["nodes"][u * 2]
        y = g["nodes"][u * 2 + 1]
        pts = [[round(x / 1e5, 5), round(y / 1e5, 5)]]

        for k in range(self.shape_at[edge_idx], self.shape_at[edge_idx + 1]):
            x += g["shapes"][k * 2]
            y += g["shapes"][k * 2 + 1]
            pts.append([round(x / 1e5, 5), round(y / 1e5, 5)])

        pts.append([round(g["nodes"][v * 2] / 1e5, 5), round(g["nodes"][v * 2 + 1] / 1e5, 5)])
        return pts if start_node == u else pts[::-1]

    def resolve_hub(self, station_name):
        clean = station_name.strip().rstrip("站")
        if clean in self.station_to_hub:
            return self.station_to_hub[clean]
        if station_name in self.station_to_hub:
            return self.station_to_hub[station_name]
        # Partial match
        for name, hub in self.station_to_hub.items():
            if clean in name or name in clean:
                return hub
        return None

    def find_rail_path(self, from_station, to_station, epsilon=0.0004):
        """
        Search for fastest path between two stations.
        Checks cache first. If not cached, runs Dijkstra if graph source is available.
        Returns:
            (coords, distance_km) or (None, None)
        """
        fn = from_station.strip().rstrip("站")
        tn = to_station.strip().rstrip("站")
        cache_key = f"{fn}-{tn}"

        # 1. Check precomputed cache
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            return entry.get("coords"), entry.get("distanceKm")

        # Reverse check if symmetric
        rev_key = f"{tn}-{fn}"
        if rev_key in self.cache:
            entry = self.cache[rev_key]
            coords = entry.get("coords")
            if coords:
                rev_coords = [c for c in reversed(coords)]
                return rev_coords, entry.get("distanceKm")

        # 2. Try loading graph source
        if not self.load():
            # Graph not available (e.g. CI/CD environment where rail-globe is not checked out)
            return None, None

        u = self.resolve_hub(from_station)
        v = self.resolve_hub(to_station)
        if u is None or v is None or u == v:
            return None, None

        # Dijkstra
        pq = [(0.0, u)]
        dist = {u: 0.0}
        prev = {}
        edge_used = {}

        while pq:
            d, curr = heapq.heappop(pq)
            if curr == v:
                break
            if d > dist[curr]:
                continue
            for nxt, cost, edge_idx in self.adj[curr]:
                nd = d + cost
                if nxt not in dist or nd < dist[nxt]:
                    dist[nxt] = nd
                    prev[nxt] = curr
                    edge_used[nxt] = edge_idx
                    heapq.heappush(pq, (nd, nxt))

        if v not in dist:
            return None, None

        # Backtrack
        edges = []
        curr = v
        while curr in prev:
            edges.append((prev[curr], curr, edge_used[curr]))
            curr = prev[curr]
        edges.reverse()

        # Extract coordinates
        coords = []
        for a, b, edge_idx in edges:
            cls = self.graph["lines"][self.graph["edges"][edge_idx * 5 + 2]][1]
            if cls not in ("x", "y", "w"):  # Skip station walk/metro links
                edge_pts = self.get_edge_coords(edge_idx, a)
                if coords and coords[-1] == edge_pts[0]:
                    coords.extend(edge_pts[1:])
                else:
                    coords.extend(edge_pts)

        if not coords or len(coords) < 2:
            return None, None

        # Simplify with RDP for compact payload while keeping curvature
        simplified = ramer_douglas_peucker(coords, epsilon)
        real_dist_km = calculate_polyline_distance_km(simplified)

        # Update cache
        self.cache[cache_key] = {
            "coords": simplified,
            "distanceKm": real_dist_km,
        }
        self.cache_dirty = True
        self._save_cache()

        return simplified, real_dist_km


def generate_hsr_network_geojson(output_path=None, epsilon=0.005):
    """
    Extract national high-speed rail lines from rail_hsr.geojson,
    simplify geometries with RDP, and output a compact GeoJSON for base map.
    If source is not present, preserves existing output_path if available.
    """
    if not output_path:
        output_path = os.path.join(PUBLIC_DATA_DIR, "rail_network.json")

    source_path = os.path.join(RAIL_GLOBE_DIR, "data", "rail_hsr.geojson")
    if not os.path.exists(source_path):
        if os.path.exists(output_path):
            print(f"Notice: Source rail_hsr.geojson not found; using existing {output_path}")
            return output_path
        print(f"Warning: Neither {source_path} nor {output_path} exists.")
        return None

    with open(source_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    simplified_features = []
    for f in data.get("features", []):
        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [])
        geom_type = geom.get("type")

        if geom_type == "MultiLineString":
            new_lines = []
            for line in coords:
                s_line = ramer_douglas_peucker(line, epsilon)
                if len(s_line) >= 2:
                    new_lines.append([[round(pt[0], 4), round(pt[1], 4)] for pt in s_line])
            if new_lines:
                simplified_features.append({
                    "type": "Feature",
                    "properties": {
                        "c": f.get("properties", {}).get("c"),
                        "n": f.get("properties", {}).get("n"),
                    },
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": new_lines,
                    },
                })
        elif geom_type == "LineString":
            s_line = ramer_douglas_peucker(coords, epsilon)
            if len(s_line) >= 2:
                simplified_features.append({
                    "type": "Feature",
                    "properties": {
                        "c": f.get("properties", {}).get("c"),
                        "n": f.get("properties", {}).get("n"),
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[round(pt[0], 4), round(pt[1], 4)] for pt in s_line],
                    },
                })

    out_bundle = {
        "type": "FeatureCollection",
        "features": simplified_features,
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_bundle, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(output_path) / 1024.0
    print(f"Generated national HSR network GeoJSON: {output_path} ({size_kb:.1f} KB, {len(simplified_features)} features)")
    return output_path


# Global router singleton
_router = None


def get_router():
    global _router
    if _router is None:
        _router = RailRouter()
    return _router


def find_rail_path(from_station, to_station):
    return get_router().find_rail_path(from_station, to_station)
