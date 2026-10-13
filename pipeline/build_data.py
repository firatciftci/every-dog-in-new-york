"""Steps 1-3: pull the 2026 dog licenses, build the ZIP->neighborhood crosswalk, aggregate."""

import collections
import csv
import io
import json
import math
import os
import random
import subprocess
import urllib.parse
import urllib.request

import numpy as np
import shapely
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from step0_neighborhoods import read_census

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(ROOT)
DATA_DIR = os.environ.get("NYC_DOGS_DATA", os.path.join(ROOT, "data"))
OUT_DIR = os.path.join(ROOT, "out")
WEB_DIR = os.path.join(APP_ROOT, "static", "data")

LICENSES_ID = "nu7n-tubp"
PLUTO_ID = "64uk-42ks"
NTA_ID = "9nt8-h7nd"
SOCRATA = "https://data.cityofnewyork.us/resource"
MTA_LINES_ID = "s692-irgq"
MTA_STATIONS_ID = "39hk-dx4f"
STATE_DATA = "https://data.ny.gov/resource"
COMPLAINTS_ID = "erm2-nwe9"
COMPLAINT_WINDOW = ("2025-09-01", "2026-09-01")
COMPLAINT_THROUGH = "August 2026"
COMPLAINT_KINDS = {
    ("Noise", "Noise, Barking Dog (NR5)"): "barking",
    ("Noise", "Dog"): "barking",
    ("Dirty Condition", "Dog Waste"): "waste",
    ("Unsanitary Animal Pvt Property", "Dog"): "waste",
    ("Animal in a Park", "Dog Off Leash"): "leash",
    ("Unleashed Dog", "Unleashed Dog in Public"): "leash",
}
DOGS_PER_GLYPH = 75
PAGE = 50_000

EXTRACT_YEAR = "2026"
TOP_N = 30
DISTINCT_N = 12

LAPSE_OCCASIONS = ("2023", "2024", EXTRACT_YEAR)
# Tied to LAPSE_OCCASIONS: born by the first occasion, no more than twelve years before the last.
LAPSE_COHORT = (2014, 2021)
MIN_PARK_KM2 = 0.12
MIN_FRAGMENT_KM2 = 0.02

LAT0 = 40.70
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT0))
M2_PER_MI2 = 2_589_988.11
TOP_LABELS = 80

NAME_FLOOR = 50
RARE_FLOOR = 2
NAME_MIN_COUNT, NAME_PRIOR = 4.0, 4.0
BREED_MIN_COUNT, BREED_PRIOR = 8.0, 8.0
LEADER_MIN_TOTAL = 20.0

SPLIT_FEATURES = {
    "renter_share": "ROcHU_1P",
    "one_person": "HH1personP",
    "with_children": "HHwU18P",
    "with_seniors": "HHw65plP",
    "owner_alone": "OOcHH1P",
    "renter_alone": "ROcHH1P",
    "big_households": "HH5plPplP",
    "age_25_29": "Pop25t29P",
    "age_30_34": "Pop30t34P",
    "age_65_69": "Pop65t69P",
    "vacant": "VacHUsP",
    "people": "Pop1",
    "households": "HH_1",
}
SPLIT_RIDGE = 10.0
SPLIT_MIN_UNITS, SPLIT_MIN_DOGS = 500.0, 30
SPLIT_CLEAN_SHARE = 0.90

BAD_NAMES = {
    "",
    "UNKNOWN",
    "NAME NOT PROVIDED",
    "NAME",
    "NONE",
    "N/A",
    "NA",
    "NO NAME",
    ".",
    "-",
    "UNKNOWN NAME",
    "NOT PROVIDED",
    "UNNAMED",
    "NULL",
}
BAD_BREEDS = {"", "Unknown", "ERROR: #VALUE!", "Not Provided"}

BREED_RECODE = {
    "Jindo Dog, Korea": "Jindo",
    "Poodle, Standard": "Poodle",
    "Poodle, Miniature": "Poodle (Miniature)",
    "Poodle, Toy": "Poodle (Toy)",
    "American Pit Bull Terrier/Pit Bull": "Pit Bull (or Mix)",
    "American Pit Bull Mix / Pit Bull Mix": "Pit Bull (or Mix)",
    "Labrador Retriever": "Labrador (or Crossbreed)",
    "Labrador Retriever Crossbreed": "Labrador (or Crossbreed)",
    "Welsh Corgi, Pembroke": "Pembroke Welsh Corgi",
    "Schnauzer, Miniature": "Miniature Schnauzer",
    "Terrier mix": "Terrier Crossbreed",
    "Dalmatian Mix": "Dalmatian Crossbreed",
    "St. Bernard": "Saint Bernard",
    "Australian Cattledog": "Australian Cattle Dog",
}


def socrata(dataset, select, where=None, order=":id"):
    offset = 0
    while True:
        params = {"$select": select, "$order": order, "$limit": PAGE, "$offset": offset}
        if where:
            params["$where"] = where
        url = f"{SOCRATA}/{dataset}.csv?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url, timeout=300) as fh:
            rows = list(csv.DictReader(io.StringIO(fh.read().decode("utf-8"))))
        if not rows:
            return
        yield from rows
        if len(rows) < PAGE:
            return
        offset += PAGE
        print(f"    ...{offset:,}")


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


def clean_name(raw):
    upper = (raw or "").strip().upper()
    if upper in BAD_NAMES or len(upper) < 2 or not any(c.isalpha() for c in upper):
        return None
    return upper[:1] + upper[1:].lower()


def clean_breed(raw):
    breed = (raw or "").strip()
    if breed in BAD_BREEDS:
        return None
    return BREED_RECODE.get(breed, breed)


def fetch_licenses():
    print(f"step 1: dog licenses, extract year {EXTRACT_YEAR}")
    rows = list(
        socrata(
            LICENSES_ID,
            "animalname,animalgender,animalbirth,breedname,zipcode,licenseissueddate",
            where=f"extract_year='{EXTRACT_YEAR}'",
        )
    )
    print(f"  {len(rows):,} licenses")
    return rows


def fetch_lapse_snapshots():
    years = [y for y in LAPSE_OCCASIONS if y != EXTRACT_YEAR]
    print(f"step 1b: earlier snapshots, extract years {', '.join(years)}")
    rows = list(
        socrata(
            LICENSES_ID,
            "animalname,animalbirth,breedname,zipcode,extract_year",
            where=" OR ".join(f"extract_year='{y}'" for y in years),
        )
    )
    print(f"  {len(rows):,} licenses")
    return rows


def lapse_estimate(licenses, earlier):
    lo, hi = LAPSE_COHORT
    seen = collections.defaultdict(set)
    name_freq = collections.Counter()
    for r in (*licenses, *earlier):
        year = r.get("extract_year") or EXTRACT_YEAR
        if year not in LAPSE_OCCASIONS:
            continue
        name = clean_name(r["animalname"])
        birth = (r["animalbirth"] or "").strip()
        z = (r["zipcode"] or "").strip().split(".")[0].zfill(5)
        if not name or not birth.isdigit() or not (lo <= int(birth) <= hi):
            continue
        if len(z) != 5 or not z.isdigit():
            continue
        seen[(name, birth, clean_breed(r["breedname"]), z)].add(year)
        name_freq[name] += 1

    def ratio(keys):
        hist = collections.Counter(len(seen[k]) for k in keys)
        f1, f2 = hist.get(1, 0), hist.get(2, 0)
        total = len(keys) + (f1 * f1 / (2 * f2) if f2 else 0.0)
        holding = sum(1 for k in keys if EXTRACT_YEAR in seen[k])
        return total / holding if holding else 0.0

    keys = list(seen)
    holding = sum(1 for k in keys if EXTRACT_YEAR in seen[k])
    print(f"step 1c: lapse, {len(keys):,} dogs across {len(LAPSE_OCCASIONS)} snapshots")
    return {
        "lapse_occasions": list(LAPSE_OCCASIONS),
        "lapse_cohort_births": list(LAPSE_COHORT),
        "lapse_dogs_seen": len(keys),
        "lapse_holding_now": holding,
        "lapse_ratio": round(ratio(keys), 2),
        "lapse_ratio_common_names": round(ratio([k for k in keys if name_freq[k[0]] >= 500]), 2),
        "lapse_ratio_rare_names": round(ratio([k for k in keys if name_freq[k[0]] < 10]), 2),
    }


def fetch_pluto():
    print("step 2a: PLUTO residential lots")
    rows = list(
        socrata(
            PLUTO_ID,
            "zipcode,unitsres,latitude,longitude",
            where="unitsres > 0 AND latitude IS NOT NULL AND zipcode IS NOT NULL",
        )
    )
    print(f"  {len(rows):,} residential lots")
    return rows


def build_crosswalk(pluto, hoods):
    """w[zip][hood] = residential units in that ZIP that fall inside that neighborhood."""
    print("step 2b: point-in-polygon crosswalk")
    geoms = [shape(f["geometry"]).buffer(0) for f in hoods]
    slugs = [f["properties"]["slug"] for f in hoods]
    tree = STRtree(geoms)

    lons, lats, zips, units = [], [], [], []
    for r in pluto:
        try:
            lon, lat, u = float(r["longitude"]), float(r["latitude"]), float(r["unitsres"])
        except (TypeError, ValueError):
            continue
        z = (r["zipcode"] or "").strip().split(".")[0].zfill(5)
        if len(z) != 5 or not z.isdigit() or u <= 0:
            continue
        lons.append(lon)
        lats.append(lat)
        zips.append(z)
        units.append(u)

    pts = shapely.points(np.array(lons), np.array(lats))
    hood_idx = np.full(len(pts), -1, dtype=np.int32)
    src, tgt = tree.query(pts, predicate="within")
    hood_idx[src] = tgt

    weights = collections.defaultdict(lambda: collections.defaultdict(float))
    unmatched = 0
    for i, h in enumerate(hood_idx):
        if h < 0:
            unmatched += 1
            continue
        weights[zips[i]][slugs[h]] += units[i]

    print(f"  {len(pts) - unmatched:,} lots matched, {unmatched:,} outside every neighborhood")
    print(f"  {len(weights)} ZIPs map onto {len({h for w in weights.values() for h in w})} neighborhoods")
    return {z: dict(w) for z, w in weights.items()}


def ridge(x, y, lam):
    mu, sd = x.mean(0), x.std(0)
    sd[sd == 0] = 1.0
    z = np.hstack([np.ones((len(x), 1)), (x - mu) / sd])
    a = z.T @ z + lam * np.eye(z.shape[1])
    a[0, 0] -= lam
    beta = np.linalg.solve(a, z.T @ y)
    return lambda q: np.hstack([np.ones((len(q), 1)), (q - mu) / sd]) @ beta


def split_weights(units, dogs_by_zip, hoods, census):
    """w[zip][hood] = residential units weighted by the fitted dogs-per-home rate of that neighborhood."""
    print("step 3b: fit dogs per home on household composition")
    nta = {f["properties"]["slug"]: f["properties"]["nta"] for f in hoods}
    keys = [k for k in SPLIT_FEATURES if k not in ("people", "households")]

    def design(slug):
        row = census[nta[slug]]
        size = row["people"] / row["households"] if row["households"] else 0.0
        return [row[k] for k in keys] + [size]

    usable = {s: design(s) for s, code in nta.items() if code in census}
    zips = [
        z
        for z, w in units.items()
        if sum(w.values()) >= SPLIT_MIN_UNITS
        and dogs_by_zip.get(z, 0) >= SPLIT_MIN_DOGS
        and any(s in usable for s in w)
    ]

    def rows(zs):
        x, y, weight = [], [], []
        for z in zs:
            w = {s: u for s, u in units[z].items() if s in usable and u > 0}
            total = sum(w.values())
            x.append(np.average([usable[s] for s in w], axis=0, weights=list(w.values())))
            y.append(math.log(dogs_by_zip[z] / total))
            weight.append(float(dogs_by_zip[z]))
        return np.array(x), np.array(y), np.array(weight)

    clean = [z for z in zips if max(units[z].values()) / sum(units[z].values()) >= SPLIT_CLEAN_SHARE]
    held_out = set(clean)
    messy = [z for z in zips if z not in held_out]
    xtr, ytr, wtr = rows(messy)
    xte, yte, wte = rows(clean)
    fitted = ridge(xtr, ytr, SPLIT_RIDGE)(xte)
    flat = np.average(ytr, weights=wtr)
    model_err = float(np.average(np.abs(yte - fitted), weights=wte))
    flat_err = float(np.average(np.abs(yte - flat), weights=wte))
    print(f"  {len(messy)} ZIPs fitted, {len(clean)} held out")
    print(f"  held-out error {model_err:.4f} against {flat_err:.4f} flat, {1 - model_err / flat_err:+.1%}")

    x, y, _ = rows(zips)
    rate = dict(zip(usable, np.exp(ridge(x, y, SPLIT_RIDGE)(np.array(list(usable.values())))), strict=True))
    # No fallback rate on purpose: any default is an order of magnitude off and must stop the build.
    orphans = sorted({s for w in units.values() for s in w} - set(rate))
    assert not orphans, f"no fitted rate for {len(orphans)} neighborhoods: {orphans[:5]}"

    out = {z: {s: u * rate[s] for s, u in w.items()} for z, w in units.items()}
    spread = [
        max(r) / min(r) for r in ([rate[s] for s in w] for w in units.values()) if len(r) > 1 and min(r) > 0
    ]
    print(f"  rate spread inside a ZIP: median {np.median(spread):.2f}x, widest {max(spread):.2f}x")
    return out, {"model": model_err, "flat": flat_err}


PARK_KIND = {
    "5": "island",
    "6": "institution",
    "7": "cemetery",
    "8": "airport",
    "9": "park",
}


def fetch_parks():
    print("step 2c: non-residential areas (parks, cemeteries, airports)")
    url = f"https://data.cityofnewyork.us/api/geospatial/{NTA_ID}?method=export&format=GeoJSON"
    with urllib.request.urlopen(url, timeout=300) as fh:
        payload = json.load(fh)

    features = [
        f
        for f in payload["features"]
        if f.get("geometry") is not None and f["properties"].get("ntatype") in PARK_KIND
    ]
    print(f"  {len(features)} non-residential areas")

    return features


def fetch_complaints():
    print("step 2d: 311 complaints about dogs")
    pairs = " OR ".join(f"(complaint_type='{t}' AND descriptor='{d}')" for t, d in COMPLAINT_KINDS)
    start, end = COMPLAINT_WINDOW
    where = f"created_date >= '{start}T00:00:00' AND created_date < '{end}T00:00:00' AND ({pairs})"
    rows = []
    for r in socrata(COMPLAINTS_ID, "latitude,longitude,complaint_type,descriptor", where):
        try:
            lon, lat = float(r["longitude"]), float(r["latitude"])
        except (TypeError, ValueError):
            continue
        rows.append([lon, lat, COMPLAINT_KINDS[(r["complaint_type"], r["descriptor"])]])
    print(f"  {len(rows):,} complaints with coordinates")

    return rows


def count_complaints(rows, hoods):
    tree = STRtree([shape(f["geometry"]).buffer(0) for f in hoods])
    slugs = [f["properties"]["slug"] for f in hoods]
    pts = shapely.points(np.array([r[0] for r in rows]), np.array([r[1] for r in rows]))
    src, tgt = tree.query(pts, predicate="within")

    by_hood = collections.defaultdict(collections.Counter)
    for i, h in zip(src, tgt, strict=True):
        by_hood[slugs[h]][rows[i][2]] += 1
    print(f"  {len(src):,} of {len(rows):,} fall inside a neighborhood")

    return by_hood


def fetch_subway():
    print("step 2d: subway lines and stations")
    out = {}
    for key, dataset in (("lines", MTA_LINES_ID), ("stations", MTA_STATIONS_ID)):
        url = f"{STATE_DATA}/{dataset}.json?$limit=2000"
        with urllib.request.urlopen(url, timeout=300) as fh:
            out[key] = json.load(fh)
        print(f"  {len(out[key])} subway {key}")

    return out


def write_subway(subway, land):
    lines = []
    for row in subway["lines"]:
        geom = row.get("geometry")
        if geom is None:
            continue

        shape_geom = shape(geom).intersection(land.buffer(0.004))
        if shape_geom.is_empty:
            continue

        lines.append(
            {
                "type": "Feature",
                "properties": {"route": row["service"].split()[0], "name": row.get("service_name", "")},
                "geometry": mapping(shape_geom),
            }
        )

    stations = [
        {
            "type": "Feature",
            "properties": {
                "name": row["stop_name"],
                "routes": row.get("daytime_routes", ""),
            },
            "geometry": row["georeference"],
        }
        for row in subway["stations"]
        if row.get("georeference")
    ]

    line_path = os.path.join(OUT_DIR, "subway_lines.geojson")
    stop_path = os.path.join(OUT_DIR, "subway_stations.geojson")
    with open(line_path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": lines}, fh, separators=(",", ":"))
    with open(stop_path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": stations}, fh, separators=(",", ":"))

    topo_path = os.path.join(WEB_DIR, "subway.topo.json")
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
            "4%",
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
        raise RuntimeError(f"subway conversion failed:\n{proc.stdout}\n{proc.stderr}")

    print(f"  {len(lines)} services, {len(stations)} stations")


def scatter_dogs(features):
    rng = random.Random(20260828)
    points = []

    for f in features:
        geom = shape(f["geometry"])
        count = round(f["properties"]["dogs"] / DOGS_PER_GLYPH)
        if count <= 0:
            continue

        x0, y0, x1, y1 = geom.bounds
        placed = 0
        for _ in range(count * 400):
            if placed >= count:
                break
            p = Point(rng.uniform(x0, x1), rng.uniform(y0, y1))
            if geom.contains(p):
                points.append(
                    {
                        "type": "Feature",
                        "properties": {"slug": f["properties"]["slug"]},
                        "geometry": {"type": "Point", "coordinates": [round(p.x, 5), round(p.y, 5)]},
                    }
                )
                placed += 1

    with open(os.path.join(WEB_DIR, "dogs.json"), "w") as fh:
        json.dump({"type": "FeatureCollection", "features": points}, fh, separators=(",", ":"))

    print(f"  {len(points)} dog marks, one per {DOGS_PER_GLYPH}")


def label_point(geom):
    """One anchor inside the largest part; MapLibre otherwise labels every polygon of a MultiPolygon."""
    parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    biggest = max(parts, key=lambda g: g.area)
    try:
        center = Point(shapely.maximum_inscribed_circle(biggest).coords[0])
    except (shapely.errors.GEOSException, ValueError, IndexError):
        center = biggest.representative_point()
    if not biggest.contains(center):
        center = biggest.representative_point()

    return round(center.x, 5), round(center.y, 5)


def split(counter_by_zip, weights):
    out = collections.defaultdict(lambda: collections.defaultdict(float))
    unallocated = 0.0
    for z, counts in counter_by_zip.items():
        w = weights.get(z)
        if not w:
            unallocated += sum(counts.values())
            continue
        total = sum(w.values())
        for hood, units in w.items():
            share = units / total
            for key, n in counts.items():
                out[hood][key] += n * share
    return out, unallocated


def lifts(hood_counts, city_counts, city_total, prior):
    hood_total = sum(hood_counts.values())
    if hood_total <= 0 or city_total <= 0:
        return {}
    out = {}
    for label, n in hood_counts.items():
        city_share = city_counts.get(label, 0.0) / city_total
        if city_share > 0:
            out[label] = (n + prior) / (hood_total * city_share + prior)
    return out


def distinctive(hood_counts, city_counts, city_total, allowed, min_count, prior):
    scored = lifts(hood_counts, city_counts, city_total, prior)
    best, best_lift = None, 0.0
    for label, lift in scored.items():
        if hood_counts[label] >= min_count and label in allowed and lift > best_lift:
            best, best_lift = label, lift
    return best, round(best_lift, 2)


def facet_rows(hood_counts, city_counts, city_total, allowed, min_count, prior):
    scored = lifts(hood_counts, city_counts, city_total, prior)

    def row(label):
        return {"label": label, "est": round(hood_counts[label], 1), "lift": round(scored.get(label, 0.0), 2)}

    common = sorted((k for k, n in hood_counts.items() if n >= 0.5), key=lambda k: -hood_counts[k])
    strong = sorted(
        (k for k, n in hood_counts.items() if n >= min_count and k in allowed and scored.get(k, 0.0) > 0),
        key=lambda k: -scored[k],
    )
    return {
        "common": [row(k) for k in common[:TOP_N]],
        "distinct": [row(k) for k in strong[:DISTINCT_N]],
    }


def leader(counts, floor=LEADER_MIN_TOTAL):
    """Winner by count, ties alphabetical; (None, 0.0) below the floor."""
    total = sum(counts.values())
    if total < floor:
        return None, 0.0
    label, n = min(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return label, round(n / total, 4)


def top(d, n=TOP_N):
    return [
        {"label": k, "est": round(v, 1)} for k, v in sorted(d.items(), key=lambda kv: -kv[1])[:n] if v >= 0.5
    ]


def write_parks(features, land):
    min_area = MIN_PARK_KM2 * 1e6 / (M_PER_DEG_LON * M_PER_DEG_LAT)
    out = []
    for f in features:
        shape_geom = shape(f["geometry"]).buffer(0).intersection(land).buffer(0)
        if shape_geom.is_empty or shape_geom.area < min_area:
            continue

        if shape_geom.geom_type == "MultiPolygon":
            parts = [g for g in shape_geom.geoms if g.area >= min_area]
            if not parts:
                continue
            shape_geom = unary_union(parts)

        lon, lat = label_point(shape_geom)
        out.append(
            {
                "type": "Feature",
                "properties": {
                    "name": f["properties"]["ntaname"],
                    "kind": PARK_KIND[f["properties"]["ntatype"]],
                    "mi2": round(shape_geom.area * M_PER_DEG_LON * M_PER_DEG_LAT / M2_PER_MI2, 3),
                    "lon": lon,
                    "lat": lat,
                },
                "geometry": mapping(shape_geom),
            }
        )

    geo_path = os.path.join(OUT_DIR, "parks.geojson")
    with open(geo_path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": out}, fh, separators=(",", ":"))

    topo_path = os.path.join(WEB_DIR, "parks.topo.json")
    thin_path = os.path.join(OUT_DIR, "parks_drawn.geojson")
    proc = subprocess.run(
        [
            "nlx",
            "mapshaper",
            geo_path,
            "-simplify",
            "visvalingam",
            "12%",
            "keep-shapes",
            "-o",
            "precision=0.00001",
            "format=topojson",
            topo_path,
            "force",
            "-o",
            "precision=0.00001",
            "format=geojson",
            thin_path,
            "force",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 or not os.path.exists(topo_path):
        raise RuntimeError(f"parks conversion failed:\n{proc.stdout}\n{proc.stderr}")

    print(f"  {len(out)} non-residential areas kept")

    # Return the simplified shapes so neighborhoods are cut against what is actually drawn.
    with open(thin_path) as fh:
        drawn = json.load(fh)["features"]

    return unary_union([shape(f["geometry"]).buffer(0) for f in drawn])


def erase_parks(geom, parks):
    cut = geom.difference(parks).buffer(0)
    if cut.is_empty:
        return None

    parts = list(cut.geoms) if cut.geom_type == "MultiPolygon" else [cut]
    keep = [p for p in parts if p.area >= MIN_FRAGMENT_KM2 * 1e6 / (M_PER_DEG_LON * M_PER_DEG_LAT)]

    return unary_union(keep) if keep else None


def place_shelters(hoods):
    path = os.path.join(WEB_DIR, "shelters.json")
    with open(path) as fh:
        shelters = json.load(fh)

    geoms = [shape(f["geometry"]).buffer(0) for f in hoods]
    slugs = [f["properties"]["slug"] for f in hoods]
    tree = STRtree(geoms)

    pts = shapely.points(np.array([s["lon"] for s in shelters]), np.array([s["lat"] for s in shelters]))
    found = np.full(len(pts), -1, dtype=np.int32)
    src, tgt = tree.query(pts, predicate="within")
    found[src] = tgt

    moved = 0
    for i, shelter in enumerate(shelters):
        at = int(found[i])
        if at < 0:
            near = tree.nearest(pts[i])
            assert near is not None
            at = int(near)
        if shelter.get("hood") != slugs[at]:
            moved += 1
        shelter["hood"] = slugs[at]

    with open(path, "w") as fh:
        json.dump(shelters, fh, indent=1)
    print(f"step 2c: {len(shelters)} shelters placed, {moved} moved")

    return shelters


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WEB_DIR, exist_ok=True)

    with open(os.path.join(OUT_DIR, "nyc_neighborhoods.geojson")) as fh:
        hoods = [f for f in json.load(fh)["features"] if f.get("geometry")]
    with open(os.path.join(OUT_DIR, "_nyc_land.geojson")) as fh:
        land = shape(json.load(fh)["features"][0]["geometry"]).buffer(0)

    licenses = cached("licenses_2026.json", fetch_licenses)
    lapse = lapse_estimate(licenses, cached("licenses_lapse.json", fetch_lapse_snapshots))
    parks_raw = cached("nta_non_residential.json", fetch_parks)
    pluto = cached("pluto_residential.json", fetch_pluto)
    place_shelters(hoods)
    units = cached("zip_hood_weights.json", lambda: build_crosswalk(pluto, hoods))
    complaints = cached("complaints_311.json", fetch_complaints)
    complaints_by_hood = count_complaints(complaints, hoods)

    print("step 3: aggregate")
    names_by_zip = collections.defaultdict(collections.Counter)
    breeds_by_zip = collections.defaultdict(collections.Counter)
    dogs_by_zip = collections.Counter()
    birth_by_zip = collections.defaultdict(collections.Counter)
    city_names, city_breeds = collections.Counter(), collections.Counter()
    city_births = collections.Counter()

    for r in licenses:
        z = (r["zipcode"] or "").strip().split(".")[0].zfill(5)
        if len(z) != 5 or not z.isdigit():
            continue
        dogs_by_zip[z] += 1
        name = clean_name(r["animalname"])
        if name:
            names_by_zip[z][name] += 1
            city_names[name] += 1
        breed = clean_breed(r["breedname"])
        if breed:
            breeds_by_zip[z][breed] += 1
            city_breeds[breed] += 1
        year = (r["animalbirth"] or "").strip()
        if year.isdigit() and 1990 <= int(year) <= 2026:
            birth_by_zip[z][int(year)] += 1
            city_births[int(year)] += 1

    weights, split_err = split_weights(
        units, dogs_by_zip, hoods, read_census(SPLIT_FEATURES, float, quiet=True)
    )

    hood_names, name_lost = split(names_by_zip, weights)
    hood_breeds, breed_lost = split(breeds_by_zip, weights)
    hood_dogs, dogs_lost = split({z: {"n": c} for z, c in dogs_by_zip.items()}, weights)
    hood_birth, _ = split(birth_by_zip, weights)

    zip_sources = collections.defaultdict(list)
    for z, w in weights.items():
        if dogs_by_zip.get(z, 0) == 0:
            continue
        total = sum(w.values())
        for hood, weight in w.items():
            zip_sources[hood].append({"zip": z, "dogs": dogs_by_zip[z], "share": round(weight / total, 4)})

    name_labels = [n for n, c in city_names.most_common() if c >= NAME_FLOOR]
    breed_labels = [b for b, _ in city_breeds.most_common()]
    allowed_names = {x["label"] for x in top(city_names, TOP_LABELS)}
    allowed_breeds = {x["label"] for x in top(city_breeds, TOP_LABELS)}
    city_name_total = sum(city_names.values())
    city_breed_total = sum(city_breeds.values())

    park_union = write_parks(parks_raw, land)

    features = []
    all_props = []
    dropped = []
    for f in hoods:
        slug = f["properties"]["slug"]
        est = hood_dogs.get(slug, {}).get("n", 0.0)
        births = hood_birth.get(slug, {})
        weighted = sum(y * n for y, n in births.items())
        total_b = sum(births.values())
        props = dict(f["properties"])
        props["dogs"] = round(est)
        props["density"] = round(est / props["area_mi2"], 1) if props["area_mi2"] else 0
        props["median_age"] = round(2026 - weighted / total_b, 1) if total_b else None

        people, homes = props["people"], props["homes"]
        props["dogs_per_1k"] = round(est / people * 1000, 1) if people else 0
        props["dogs_per_100_homes"] = round(est / homes * 100, 1) if homes else 0
        gripes = complaints_by_hood.get(slug, {})
        props["complaints_barking"] = gripes.get("barking", 0)
        props["complaints_waste"] = gripes.get("waste", 0)
        props["complaints_leash"] = gripes.get("leash", 0)
        props["complaints"] = sum(gripes.values())
        props["complaints_per_100_dogs"] = round(props["complaints"] / est * 100, 1) if est else 0
        hn, hb = hood_names.get(slug, {}), hood_breeds.get(slug, {})
        props["top_breed"], props["top_breed_share"] = leader(hb)
        props["top_name"], props["top_name_share"] = leader(hn)
        label, lift = distinctive(
            hn,
            city_names,
            city_name_total,
            allowed_names,
            NAME_MIN_COUNT,
            NAME_PRIOR,
        )
        props["distinct_name"], props["distinct_name_lift"] = label, lift
        label, lift = distinctive(
            hb,
            city_breeds,
            city_breed_total,
            allowed_breeds,
            BREED_MIN_COUNT,
            BREED_PRIOR,
        )
        props["distinct_breed"], props["distinct_breed_lift"] = label, lift

        cut = erase_parks(shape(f["geometry"]).buffer(0), park_union)
        if cut is None:
            dropped.append(slug)
            continue

        props["area_mi2"] = round(cut.area * M_PER_DEG_LON * M_PER_DEG_LAT / M2_PER_MI2, 3)
        props["density"] = round(est / props["area_mi2"], 1) if props["area_mi2"] else 0
        props["lon"], props["lat"] = label_point(cut)
        all_props.append(props)
        features.append({"type": "Feature", "properties": props, "geometry": mapping(cut)})

    if dropped:
        raise RuntimeError(f"clipping erased {len(dropped)} neighborhoods: {dropped}")

    scatter_dogs(features)
    write_subway(cached("subway.json", fetch_subway), land)

    geo_path = os.path.join(OUT_DIR, "neighborhoods_web.geojson")
    with open(geo_path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, separators=(",", ":"))
    topo_path = os.path.join(WEB_DIR, "neighborhoods.topo.json")
    proc = subprocess.run(
        [
            "nlx",
            "mapshaper",
            geo_path,
            "-o",
            "precision=0.00001",
            "format=topojson",
            "id-field=slug",
            topo_path,
            "force",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 or not os.path.exists(topo_path):
        raise RuntimeError(f"topojson conversion failed:\n{proc.stdout}\n{proc.stderr}")

    details = {}
    for f in hoods:
        slug = f["properties"]["slug"]
        sources = sorted(zip_sources.get(slug, []), key=lambda s: -s["dogs"] * s["share"])
        details[slug] = {
            "names": facet_rows(
                hood_names.get(slug, {}),
                city_names,
                city_name_total,
                allowed_names,
                NAME_MIN_COUNT,
                NAME_PRIOR,
            ),
            "breeds": facet_rows(
                hood_breeds.get(slug, {}),
                city_breeds,
                city_breed_total,
                allowed_breeds,
                BREED_MIN_COUNT,
                BREED_PRIOR,
            ),
            "zips": sources[:12],
        }
    with open(os.path.join(WEB_DIR, "details.json"), "w") as fh:
        json.dump(details, fh, separators=(",", ":"))

    slugs = [f["properties"]["slug"] for f in hoods]
    matrix = {
        "slugs": slugs,
        "names": {
            label: [round(hood_names.get(s, {}).get(label, 0.0), 1) for s in slugs] for label in name_labels
        },
        "breeds": {
            label: [round(hood_breeds.get(s, {}).get(label, 0.0), 1) for s in slugs] for label in breed_labels
        },
        "dogs": [round(hood_dogs.get(s, {}).get("n", 0.0), 1) for s in slugs],
        "rare": {
            label: cells
            for label, c in city_names.most_common()
            if RARE_FLOOR <= c < NAME_FLOOR
            and (
                cells := [
                    [i, n]
                    for i, s in enumerate(slugs)
                    if (n := round(hood_names.get(s, {}).get(label, 0.0), 1)) > 0
                ]
            )
        },
    }
    with open(os.path.join(WEB_DIR, "matrix.json"), "w") as fh:
        json.dump(matrix, fh, separators=(",", ":"))

    total_est = sum(p["dogs"] for p in all_props)
    exact_est = sum(v.get("n", 0.0) for v in hood_dogs.values())
    summary = {
        "extract_year": EXTRACT_YEAR,
        "licenses": len(licenses),
        "breed_unknown": sum(1 for r in licenses if clean_breed(r["breedname"]) is None),
        "licenses_placed": round(total_est),
        "licenses_unallocated": round(dogs_lost),
        "neighborhoods": len(features),
        "zips_in_data": len(dogs_by_zip),
        "zips_matched": len([z for z in dogs_by_zip if z in weights]),
        "residential_units": round(sum(sum(w.values()) for w in units.values())),
        "split_error": round(split_err["model"], 4),
        "split_error_flat": round(split_err["flat"], 4),
        "city_top_names": top(city_names, 40),
        "city_top_breeds": top(city_breeds, 40),
        "max_dogs": max(p["dogs"] for p in all_props),
        "max_density": max(p["density"] for p in all_props),
        "people": sum(p["people"] for p in all_props),
        "homes": sum(p["homes"] for p in all_props),
        "median_age": round(2026 - sum(y * n for y, n in city_births.items()) / sum(city_births.values()), 1),
        "complaints": len(complaints),
        "complaints_placed": sum(p["complaints"] for p in all_props),
        "complaints_through": COMPLAINT_THROUGH,
        **lapse,
    }
    with open(os.path.join(WEB_DIR, "summary.json"), "w") as fh:
        json.dump(summary, fh, indent=1)

    assert abs(exact_est + dogs_lost - sum(dogs_by_zip.values())) < 1e-6, "dogs lost in the split"
    assert abs(total_est - exact_est) < len(features), "rounding drifted"
    assert name_lost / max(sum(city_names.values()), 1) < 0.05, "too many names unallocated"
    assert breed_lost >= 0
    assert 1.2 < lapse["lapse_ratio"] < 4.0, f"lapse ratio {lapse['lapse_ratio']} is not credible"
    assert split_err["model"] < split_err["flat"], (
        f"the fitted split lost to a flat one out of sample ({split_err['model']:.4f} "
        f"against {split_err['flat']:.4f}); drop split_weights and pass `units` to split()"
    )

    print(f"\n  {len(licenses):,} licenses -> {total_est:,} placed, {round(dogs_lost):,} unallocated")
    print(f"  exact placed {exact_est:,.1f}")
    print(
        f"  lapse: {lapse['lapse_holding_now']:,} of {lapse['lapse_dogs_seen']:,} cohort dogs hold a "
        f"license now, ratio {lapse['lapse_ratio']} "
        f"({lapse['lapse_ratio_common_names']}-{lapse['lapse_ratio_rare_names']} by name rarity)"
    )
    print(f"  {summary['zips_matched']}/{summary['zips_in_data']} ZIPs matched a neighborhood")
    print(f"  {summary['complaints_placed']:,} of {summary['complaints']:,} 311 complaints placed")
    for name in (
        "neighborhoods.topo.json",
        "parks.topo.json",
        "details.json",
        "matrix.json",
        "summary.json",
    ):
        size = os.path.getsize(os.path.join(WEB_DIR, name))
        print(f"  {name:<26} {size / 1024:8.1f} KB")


if __name__ == "__main__":
    main()
