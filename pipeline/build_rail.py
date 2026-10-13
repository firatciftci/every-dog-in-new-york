"""Step 2e: merge LIRR, Metro-North, PATH, NJ Transit, and Amtrak into static/data/rail.topo.json."""

import json
import math
import os
import subprocess
import time
import urllib.error
import urllib.request
from collections.abc import Sequence

from shapely.geometry import LineString, MultiLineString, Point, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(ROOT)
DATA_DIR = os.environ.get("NYC_DOGS_DATA", os.path.join(ROOT, "data"))
OUT_DIR = os.path.join(ROOT, "out")
WEB_DIR = os.path.join(APP_ROOT, "static", "data")

STATE_DATA = "https://data.ny.gov/resource"
MTA_BRANCHES_ID = "2vcb-zrh4"
MTA_RAIL_STATIONS_ID = "wxmd-5cpm"
OVERPASS = "https://overpass-api.de/api/interpreter"
ODBL = (
    "Route geometry from OpenStreetMap contributors, ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/"
)

# Degrees past the shoreline that track may be drawn, about 6 mi.
LINE_SLACK = 0.09

NJ_TIGHT = box(-74.23, 40.67, -73.90, 40.88)
NJ_WEST = box(-74.37, 40.67, -73.90, 40.85)
NJ_SOUTH = box(-74.37, 40.55, -73.90, 40.85)
NJ_RIVER = box(-74.20, 40.68, -73.90, 40.80)

# Overpass files some stations twice under the same name; points this close are one place.
DEDUPE_M = 400.0

# Measured: wider than any gap between two relations tracing one right-of-way, narrower than yards.
CONFLATE_M = 40.0

# Roughly 300 m, in degrees.
ON_TRACK_DEG = 0.0035
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(40.70))

LIRR_BRANCHES = {
    "PWS": ("PW", "Port Washington Branch"),
    "FRY": ("FR", "Far Rockaway Branch"),
    "HEM": ("HE", "Hempstead Branch"),
}

MNR_LINES = {
    "HUD": ("HUD", "Hudson Line"),
    "HAR": ("HAR", "Harlem Line"),
    "NHV": ("NHV", "New Haven Line"),
}

# The MTA files a shared trunk under whichever code owns it, so each branch merges in the trunk it runs over.
WEST_TRUNK = box(-74.03, 40.725, -73.88, 40.79)

PARK_AVENUE = box(-74.02, 40.73, -73.90, 40.816)

WOODLAWN_LEG = box(-73.95, 40.80, -73.85, 40.8995)

HEMPSTEAD_TRUNK = box(-74.01, 40.695, -73.74, 40.80)

MERGE_IN = {
    "PWS": [("CTZ", WEST_TRUNK)],
    "FRY": [("CTZ", None)],
    "HEM": [("CTZ", HEMPSTEAD_TRUNK)],
    "HAR": [("HUD", PARK_AVENUE)],
    "NHV": [("HAR", WOODLAWN_LEG), ("HUD", PARK_AVENUE)],
}

# FRY leaves Queens at Rosedale and re-enters at Far Rockaway, so its window is only that gap.
MTA_REACH = {
    "PWS": box(-74.05, 40.70, -73.67, 40.87),
    "HEM": box(-74.05, 40.66, -73.61, 40.78),
    "FRY": box(-73.78, 40.59, -73.68, 40.68),
    "HUD": box(-74.02, 40.70, -73.83, 41.085),
    "HAR": box(-73.95, 40.79, -73.74, 41.042),
    "NHV": box(-73.90, 40.79, -73.645, 41.01),
}

OSM_ROUTES = [
    ("path", "NWK", "Newark - World Trade Center", [1468867, 7943864], NJ_RIVER),
    ("path", "HOB", "Hoboken - World Trade Center", [1468847, 7943872], NJ_RIVER),
    ("path", "JSQ", "Journal Square - 33 Street", [1468832, 7943925], NJ_RIVER),
    ("path", "H33", "Hoboken - 33 Street", [1468831, 7943884], NJ_RIVER),
    ("njt", "MNB", "Montclair-Boonton Line", [1377999], NJ_TIGHT),
    ("njt", "MOE", "Morris & Essex Lines", [1377998], NJ_WEST),
    ("njt", "NEC", "Northeast Corridor Line", [9795464, 9795465], NJ_SOUTH),
    ("amtrak", "NEC", "Northeast Corridor", [9796293, 9796352], NJ_SOUTH),
    ("amtrak", "EMP", "Empire Service", [4234377, 4452779], NJ_RIVER),
]

# Stops the OSM relations do not carry.
EXTRA_STOPS = {
    "MNB": [("Montclair State University", (-74.19748, 40.86958))],
    "MOE": [
        ("Summit", (-74.3577, 40.71657)),
        ("Millburn", (-74.3037, 40.72573)),
    ],
}

# Belmont Park is in Nassau County, but the city outline includes a sliver of the racetrack.
SKIP_STATIONS = {"Belmont Park"}


def cached(name, build):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        with open(path) as fh:
            return json.load(fh)
    value = build()
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(value, fh)
    return value


def fetch_mta():
    print("  MTA rail branches and stations")
    out = {}
    for key, dataset in (
        ("branches", MTA_BRANCHES_ID),
        ("stations", MTA_RAIL_STATIONS_ID),
    ):
        url = f"{STATE_DATA}/{dataset}.json?$limit=2000"
        with urllib.request.urlopen(url, timeout=300) as fh:
            out[key] = json.load(fh)
        print(f"    {len(out[key])} {key}")

    return out


def fetch_relations(ids):
    """`out body geom` keeps the coordinates on the relation members in the mappers' way order."""
    query = "".join(f"rel({rel});out body geom;node(r);out;" for rel in ids)
    body = f"[out:json][timeout:300];{query}".encode()

    for attempt in range(6):
        request = urllib.request.Request(
            OVERPASS, data=body, headers={"User-Agent": "everydog.nyc rail build"}
        )
        try:
            with urllib.request.urlopen(request, timeout=300) as fh:
                return json.load(fh)["elements"]
        except urllib.error.HTTPError as err:
            if err.code not in (429, 504) or attempt == 5:
                raise
            wait = 20 * (attempt + 1)
            print(f"    overpass said {err.code}, waiting {wait}s")
            time.sleep(wait)

    return []


def osm_parts(elements):
    parts = []
    for element in elements:
        if element.get("type") != "relation":
            continue
        for member in element.get("members", []):
            # Platform ways are members too; drawn as track they kink the line.
            if member.get("type") != "way" or member.get("role") not in ("", None):
                continue
            line = [(p["lon"], p["lat"]) for p in member.get("geometry") or []]
            if len(line) > 1:
                parts.append(line)

    return parts


def osm_stops(elements, extra: Sequence[tuple[str, tuple[float, float]]] = ()):
    stops: list[tuple[str, tuple[float, float]]] = list(extra)
    for element in elements:
        if element.get("type") != "node":
            continue
        tags = element.get("tags") or {}
        name = tags.get("name")
        # Terminals are filed as buffer_stop, not stop.
        if name is None or tags.get("railway") not in (
            "stop",
            "station",
            "halt",
            "buffer_stop",
        ):
            continue

        spot = (element["lon"], element["lat"])
        if any(
            other[0] == name
            and math.hypot(
                (other[1][0] - spot[0]) * M_PER_DEG_LON,
                (other[1][1] - spot[1]) * M_PER_DEG_LAT,
            )
            < DEDUPE_M
            for other in stops
        ):
            continue

        stops.append((name, spot))

    return stops


def cut(geom, region):
    clipped = geom.intersection(region)

    return None if clipped.is_empty else clipped


def strands(geom):
    return list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]


def conflate(features, tol=CONFLATE_M / M_PER_DEG_LAT):
    """Snap routes that share track onto one centerline; longest first, since it has the fewest joins."""
    ordered = sorted(features, key=lambda f: -shape(f["geometry"]).length)
    spine: list = []
    tree = None
    out = []

    for feature in ordered:
        geom = shape(feature["geometry"])
        if tree is not None:
            moved = []
            for line in strands(geom):
                coords = []
                for x, y in line.coords:
                    spot = Point(x, y)
                    best, gap = None, tol
                    for i in tree.query(spot.buffer(tol)):
                        near = spine[i]
                        span = spot.distance(near)
                        if span < gap:
                            gap, best = span, near
                    coords.append(
                        best.interpolate(best.project(spot)).coords[0] if best is not None else (x, y)
                    )
                moved.append(LineString(coords))
            geom = moved[0] if len(moved) == 1 else MultiLineString(moved)
            feature = {**feature, "geometry": mapping(geom)}

        out.append(feature)
        spine.extend(strands(geom))
        tree = STRtree(spine)

    order = {id(f): i for i, f in enumerate(features)}
    return sorted(out, key=lambda f: order.get(id(f), len(features)))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WEB_DIR, exist_ok=True)

    print("step 2e: commuter rail")
    with open(os.path.join(OUT_DIR, "_nyc_land.geojson")) as fh:
        land = shape(json.load(fh)["features"][0]["geometry"]).buffer(0)

    wide = land.buffer(LINE_SLACK)
    reachable = unary_union(list(MTA_REACH.values()))

    mta = cached("rail_mta.json", fetch_mta)

    print("  OpenStreetMap route relations")
    osm = {}
    for system, code, _name, ids, _window in OSM_ROUTES:
        key = f"{system}:{code}"
        osm[key] = cached(f"rail_osm_{system}_{code}.json", lambda ids=ids: fetch_relations(ids))
        print(f"    {system} {code}: {len(osm[key])} elements")

    lines: list[dict] = []
    stations: list[dict] = []
    placed = set()

    def put(system, name, point, in_city):
        if (system, name) in placed:
            return

        placed.add((system, name))
        stations.append(
            {
                "type": "Feature",
                "properties": {
                    "system": system,
                    "name": name,
                    "city": 1 if in_city else 0,
                },
                "geometry": mapping(point),
            }
        )

    filed = {
        row["route_code"]: shape(row["geometry"])
        for row in mta["branches"]
        if row.get("geometry") is not None and row.get("route_code")
    }

    for code, listed in {**LIRR_BRANCHES, **MNR_LINES}.items():
        own = filed.get(code)
        if own is None:
            continue

        system = "lirr" if code in LIRR_BRANCHES else "mnr"
        pieces = [own]
        for partner, window in MERGE_IN.get(code, []):
            trunk = filed.get(partner)
            if trunk is None:
                continue
            pieces.append(trunk if window is None else trunk.intersection(window))

        reach = MTA_REACH.get(code)
        clipped = cut(
            unary_union([piece for piece in pieces if not piece.is_empty]),
            wide if reach is None else unary_union([wide, reach]),
        )
        if clipped is None:
            continue

        bullet, name = listed
        lines.append(
            {
                "type": "Feature",
                "properties": {
                    "system": system,
                    "route": code,
                    "bullet": bullet,
                    "name": name,
                },
                "geometry": mapping(clipped),
            }
        )

    for row in mta["stations"]:
        railroad = row.get("railroad")
        if railroad not in ("LIRR", "MNR") or not row.get("georeference"):
            continue

        point = shape(row["georeference"])
        if row["station_name"] in SKIP_STATIONS or not (land.contains(point) or reachable.contains(point)):
            continue

        put(
            "lirr" if railroad == "LIRR" else "mnr",
            row["station_name"],
            point,
            land.contains(point),
        )

    for system, code, name, _ids, window in OSM_ROUTES:
        elements = osm[f"{system}:{code}"]
        allowed = unary_union([wide, window])
        parts = [
            cut(shape({"type": "LineString", "coordinates": part}), allowed) for part in osm_parts(elements)
        ]
        kept = [part for part in parts if part is not None]
        if not kept:
            continue

        lines.append(
            {
                "type": "Feature",
                "properties": {
                    "system": system,
                    "route": code,
                    "bullet": code,
                    "name": name,
                },
                "geometry": mapping(unary_union(kept)),
            }
        )

        for stop, spot in osm_stops(elements, EXTRA_STOPS.get(code, ())):
            point = shape({"type": "Point", "coordinates": list(spot)})
            if not allowed.contains(point):
                continue

            put(system, stop, point, land.contains(point))

    track = {}
    for feature in lines:
        key = feature["properties"]["system"]
        track[key] = unary_union(
            [track[key], shape(feature["geometry"])] if key in track else [shape(feature["geometry"])]
        )

    stations = [
        stop
        for stop in stations
        if shape(stop["geometry"]).distance(track[stop["properties"]["system"]]) < ON_TRACK_DEG
    ]

    lines = conflate(lines)

    line_path = os.path.join(OUT_DIR, "rail_lines.geojson")
    stop_path = os.path.join(OUT_DIR, "rail_stations.geojson")
    with open(line_path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": lines}, fh, separators=(",", ":"))
    with open(stop_path, "w") as fh:
        json.dump(
            {"type": "FeatureCollection", "features": stations},
            fh,
            separators=(",", ":"),
        )

    topo_path = os.path.join(WEB_DIR, "rail.topo.json")
    proc = subprocess.run(
        [
            "nlx",
            "mapshaper",
            "-i",
            line_path,
            stop_path,
            "combine-files",
            "-simplify",
            "visvalingam",
            "6%",
            "keep-shapes",
            "-o",
            "precision=0.00001",
            "format=topojson",
            topo_path,
            "force",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 or not os.path.exists(topo_path):
        raise RuntimeError(f"rail conversion failed:\n{proc.stdout}\n{proc.stderr}")

    with open(topo_path) as fh:
        topo = json.load(fh)
    topo["license"] = ODBL
    with open(topo_path, "w") as fh:
        json.dump(topo, fh, separators=(",", ":"))

    tally = {}
    for feature in lines:
        key = feature["properties"]["system"]
        tally[key] = tally.get(key, 0) + 1
    print(f"  {len(lines)} routes {tally}, {len(stations)} stations")
    print(f"  wrote {topo_path}")


if __name__ == "__main__":
    main()
