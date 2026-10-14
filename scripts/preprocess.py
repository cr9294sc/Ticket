#!/usr/bin/env python3
"""
preprocess.py
Preprocesses flight and high-speed rail trips:
- Loads airports & airlines from data/airports.js
- Loads railway station coordinates from data/station_geo.json
- Reads user travel records from data/my_trips.csv
- Calculates WGS-84 great-circle geodesic distance
- Associates airline brand colors
- Outputs public/data/locations.json and public/data/trips.json
"""

import csv
from datetime import datetime, timezone
import hashlib
import json
import math
import os
import re
import sys

from rail_router import find_rail_path, generate_hsr_network_geojson

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "public", "data")


def haversine_distance(coord1, coord2):
    """
    Calculate spherical distance in kilometers between two coordinates [lng, lat].
    """
    lng1, lat1 = coord1
    lng2, lat2 = coord2

    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(R * c, 1)


def parse_airports_and_airlines():
    airports_path = os.path.join(DATA_DIR, "airports.js")
    with open(airports_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse AIRPORTS
    airports = {}
    m_air = re.search(r"const\s+AIRPORTS\s*=\s*\{([\s\S]*?)\};", content)
    if m_air:
        block = m_air.group(1)
        for line in block.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            entry = re.match(
                r'([A-Z0-9]{3}):\s*\{\s*city:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*lat:\s*([0-9.]+),\s*lng:\s*([0-9.]+)\s*\}',
                line,
            )
            if entry:
                code, city, name, lat, lng = entry.groups()
                airports[code] = {
                    "id": code,
                    "city": city,
                    "name": f"{city}{name}机场",
                    "shortName": f"{name}机场",
                    "type": "AIRPORT",
                    "coordinates": [float(lng), float(lat)],
                }

    # Parse AIRLINES
    airlines = {}
    m_line = re.search(r"const\s+AIRLINES\s*=\s*\{([\s\S]*?)\};", content)
    if m_line:
        block = m_line.group(1)
        for line in block.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            entry = re.match(
                r'["\']?([A-Z0-9]{2})["\']?:\s*\{\s*name:\s*"([^"]+)",\s*color:\s*"([^"]+)"\s*\}',
                line,
            )
            if entry:
                code, name, color = entry.groups()
                airlines[code] = {"name": name, "color": color}

    return airports, airlines


def parse_railway_stations():
    stations_path = os.path.join(DATA_DIR, "station_geo.json")
    with open(stations_path, "r", encoding="utf-8") as f:
        station_geo = json.load(f)
    return station_geo


# Modern or newly added stations fallback
KNOWN_STATION_COORDS = {
    "北京朝阳": [116.513, 39.957],
    "雄安": [116.033, 39.043],
    "郑州航空港": [113.882, 34.526],
    "天府": [104.441, 30.320],
}


def resolve_location(name_or_code, loc_type, airports, stations, custom_locations=None):
    """
    Resolve name or code to standardized LocationEntity.
    """
    key = name_or_code.strip()
    if not key:
        raise ValueError("Empty location name or code")

    # Check custom locations if provided
    if custom_locations and key in custom_locations:
        loc = custom_locations[key]
        return {
            "id": key,
            "city": loc.get("city", key),
            "name": loc.get("name", key),
            "shortName": loc.get("shortName", key),
            "type": "AIRPORT" if loc_type == "FLIGHT" else "TRAIN_STATION",
            "coordinates": loc["coordinates"],
        }

    # Check for direct coordinates format: e.g. "Tokyo[139.69,35.68]" or "Tokyo:139.69,35.68"
    coord_match = re.match(r"^([^:\[\]]+)[\[:]([-0-9.]+)[, ]+([-0-9.]+)[\]]?$", key)
    if coord_match:
        loc_name, lng_s, lat_s = coord_match.groups()
        loc_name = loc_name.strip()
        lng, lat = float(lng_s), float(lat_s)
        return {
            "id": loc_name,
            "city": loc_name,
            "name": loc_name,
            "shortName": loc_name,
            "type": "AIRPORT" if loc_type == "FLIGHT" else "TRAIN_STATION",
            "coordinates": [lng, lat],
        }

    if loc_type == "FLIGHT":
        # 1. Direct IATA code match
        if key.upper() in airports:
            return airports[key.upper()]
        # 2. Match by city or airport name
        for code, apt in airports.items():
            if key in apt["name"] or key in apt["shortName"] or key == apt["city"]:
                return apt
        # 3. Fuzzy search in airports
        for code, apt in airports.items():
            if key.lower() in apt["name"].lower() or key.lower() in apt["city"].lower():
                return apt
        # Fallback to station if dual-use (e.g. railway/airport transfer hub)
        if key in stations:
            coord = stations[key]
            return {
                "id": key,
                "city": key.replace("东", "")
                .replace("南", "")
                .replace("西", "")
                .replace("北", ""),
                "name": key,
                "shortName": key,
                "type": "AIRPORT",
                "coordinates": coord,
            }
        raise ValueError(f"Unable to find airport coordinates for '{name_or_code}'")

    else:  # HSR
        # 0. Check known new stations
        clean_key = key.rstrip("站")
        if clean_key in KNOWN_STATION_COORDS:
            coord = KNOWN_STATION_COORDS[clean_key]
            return {
                "id": clean_key,
                "city": clean_key.replace("东", "")
                .replace("南", "")
                .replace("西", "")
                .replace("北", "")
                .replace("朝阳", "北京"),
                "name": clean_key + "站",
                "shortName": clean_key,
                "type": "TRAIN_STATION",
                "coordinates": coord,
            }
        # 1. Exact match in station_geo
        if key in stations:
            coord = stations[key]
            return {
                "id": key,
                "city": key.replace("东", "")
                .replace("南", "")
                .replace("西", "")
                .replace("北", ""),
                "name": key + ("站" if not key.endswith("站") else ""),
                "shortName": key,
                "type": "TRAIN_STATION",
                "coordinates": coord,
            }
        # 2. Try strip '站'
        if clean_key in stations:
            coord = stations[clean_key]
            return {
                "id": clean_key,
                "city": clean_key.replace("东", "")
                .replace("南", "")
                .replace("西", "")
                .replace("北", ""),
                "name": clean_key + "站",
                "shortName": clean_key,
                "type": "TRAIN_STATION",
                "coordinates": coord,
            }
        # 3. Fuzzy search
        for st_name, coord in stations.items():
            if clean_key in st_name or st_name in clean_key:
                return {
                    "id": clean_key,
                    "city": clean_key.replace("东", "")
                    .replace("南", "")
                    .replace("西", "")
                    .replace("北", ""),
                    "name": st_name + ("站" if not st_name.endswith("站") else ""),
                    "shortName": clean_key,
                    "type": "TRAIN_STATION",
                    "coordinates": coord,
                }
        raise ValueError(
            f"Unable to find railway station coordinates for '{name_or_code}'"
        )


def main():
    print(">>> [Pipeline] Starting travel data preprocessing...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    airports, airlines = parse_airports_and_airlines()
    stations = parse_railway_stations()
    print(
        f"Loaded {len(airports)} airports, {len(airlines)} airlines, and {len(stations)} railway stations."
    )

    csv_path = os.path.join(DATA_DIR, "my_trips.csv")
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} does not exist!")
        sys.exit(1)

    locations_catalog = {}
    trips_list = []

    total_flight_km = 0.0
    total_hsr_km = 0.0
    flight_count = 0
    hsr_count = 0
    years_set = set()

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        idx = 1
        for row in reader:
            date = row.get("date", "").strip()
            trip_type = row.get("type", "").strip().upper()
            code = row.get("code", "").strip().upper()
            from_loc_raw = row.get("from", "").strip()
            to_loc_raw = row.get("to", "").strip()
            notes = row.get("notes", "").strip()

            if not date or not from_loc_raw or not to_loc_raw:
                continue

            year = int(date.split("-")[0]) if "-" in date else 2024
            years_set.add(year)

            # Resolve endpoints
            origin = resolve_location(from_loc_raw, trip_type, airports, stations)
            destination = resolve_location(to_loc_raw, trip_type, airports, stations)

            # Save into locations catalog
            locations_catalog[origin["id"]] = origin
            locations_catalog[destination["id"]] = destination

            # Distance & Real Track Geometry
            track_coords = None
            airline_name = ""
            color = "#10B981"  # Default Emerald for HSR

            if trip_type == "FLIGHT":
                dist_km = haversine_distance(
                    origin["coordinates"], destination["coordinates"]
                )
                flight_count += 1
                total_flight_km += dist_km
                # Extract 2-letter airline prefix (e.g., CA from CA1501, 3U from 3U8881)
                air_prefix = code[:2]
                if air_prefix in airlines:
                    color = airlines[air_prefix]["color"]
                    airline_name = airlines[air_prefix]["name"]
                else:
                    color = "#F59E0B"  # Default Gold/Amber
            else:
                hsr_count += 1
                # Try finding real rail path using rail_router
                rail_coords, real_km = find_rail_path(from_loc_raw, to_loc_raw)
                if rail_coords and len(rail_coords) >= 2:
                    track_coords = rail_coords
                    dist_km = real_km
                else:
                    dist_km = haversine_distance(
                        origin["coordinates"], destination["coordinates"]
                    )
                total_hsr_km += dist_km

            trip_item = {
                "id": f"trip_{idx}_{code}_{date}",
                "type": trip_type,
                "code": code,
                "date": date,
                "year": year,
                "originId": origin["id"],
                "originName": origin["name"],
                "originCity": origin["city"],
                "originCoords": origin["coordinates"],
                "destId": destination["id"],
                "destName": destination["name"],
                "destCity": destination["city"],
                "destCoords": destination["coordinates"],
                "distanceKm": dist_km,
                "color": color,
                "airlineName": airline_name,
                "notes": notes,
            }
            if track_coords:
                trip_item["trackCoords"] = track_coords

            trips_list.append(trip_item)
            idx += 1

    # Sort trips chronologically
    trips_list.sort(key=lambda t: t["date"])

    # Compute build hash from my_trips.csv for version synchronization
    try:
        with open(csv_path, "rb") as f:
            build_hash = hashlib.sha256(f.read()).hexdigest()[:12]
    except Exception:
        build_hash = "manual"
    build_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    metadata = {
        "totalFlightKm": round(total_flight_km, 1),
        "totalHsrKm": round(total_hsr_km, 1),
        "totalKm": round(total_flight_km + total_hsr_km, 1),
        "flightCount": flight_count,
        "hsrCount": hsr_count,
        "totalCount": flight_count + hsr_count,
        "years": sorted(list(years_set)),
        "earthLaps": round((total_flight_km + total_hsr_km) / 40075.0, 2),
        "buildHash": build_hash,
        "buildTime": build_time,
    }

    # Write locations.json
    loc_output_path = os.path.join(OUTPUT_DIR, "locations.json")
    with open(loc_output_path, "w", encoding="utf-8") as f:
        json.dump(locations_catalog, f, ensure_ascii=False, indent=2)

    # Write trips.json
    trips_output_path = os.path.join(OUTPUT_DIR, "trips.json")
    with open(trips_output_path, "w", encoding="utf-8") as f:
        json.dump(
            {"metadata": metadata, "trips": trips_list}, f, ensure_ascii=False, indent=2
        )

    # Generate national HSR network GeoJSON for background map
    try:
        rail_network_path = os.path.join(OUTPUT_DIR, "rail_network.json")
        generate_hsr_network_geojson(rail_network_path)
    except Exception as e:
        print(f"Warning: Failed to generate rail_network.json: {e}")

    print(
        f"SUCCESS: Preprocessed {len(trips_list)} trips across {len(locations_catalog)} locations."
    )
    print(
        f"Stats: Total Km={metadata['totalKm']} (Flight: {metadata['totalFlightKm']} km, HSR: {metadata['totalHsrKm']} km)"
    )
    print(f"Locations saved to: {loc_output_path}")
    print(f"Trips saved to: {trips_output_path}")


if __name__ == "__main__":
    main()
