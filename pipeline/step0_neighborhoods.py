"""Step 0: 2020 NTA neighborhoods with census counts -> out/nyc_neighborhoods.geojson."""

import json
import math
import os
import re
import subprocess
import unicodedata
import urllib.request

import openpyxl
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("NYC_DOGS_DATA", os.path.join(ROOT, "data"))
OUT_DIR = os.path.join(ROOT, "out")

NTA_PATH = os.path.join(DATA_DIR, "nta_2020.geojson")
BOROUGHS = os.path.join(DATA_DIR, "borough_boundaries.geojson")
CENSUS_PATH = os.path.join(DATA_DIR, "nyc_census_2020_core_geographies.xlsx")

NTA_URL = "https://data.cityofnewyork.us/api/geospatial/9nt8-h7nd?method=export&format=GeoJSON"
BOROUGHS_URL = "https://data.cityofnewyork.us/api/geospatial/gthc-hcne?method=export&format=GeoJSON"
CENSUS_URL = (
    "https://s-media.nyc.gov/agencies/dcp/assets/files/excel/data-tools/census/"
    "census2020/nyc_decennialcensusdata_2010_2020_change-core-geographies.xlsx"
)

# NTA type code 0 is residential; the other types are parks, cemeteries, airports, and the like.
RESIDENTIAL = "0"

SIMPLIFY_M = 20

LAT0 = 40.70
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT0))
M2_PER_MI2 = 2_589_988.11

CENSUS_COLUMNS = {
    "people": "Pop1",
    "homes": "OcHU_1",
}


def fetch(url, path, label):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"downloading {label} -> {path}")
    urllib.request.urlretrieve(url, path)


def fetch_inputs():
    fetch(NTA_URL, NTA_PATH, "2020 neighborhood tabulation areas")
    fetch(BOROUGHS_URL, BOROUGHS, "borough boundaries")
    fetch(CENSUS_URL, CENSUS_PATH, "2020 decennial census by NTA")


def slugify(name):
    flat = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", flat.lower())).strip("-")


def read_census(columns=None, cast=int, quiet=False):
    """One row per 2020 NTA, keyed by the NTA code the boundary file carries."""
    columns = CENSUS_COLUMNS if columns is None else columns
    if not quiet:
        print("step 0b: 2020 decennial census by neighborhood")
    book = openpyxl.load_workbook(CENSUS_PATH, read_only=True, data_only=True)
    rows = book["2020"].iter_rows(values_only=True)
    header = next(rows)
    at = {name: header.index(col) for name, col in columns.items()}
    geo_type, geo_id = header.index("GeoType"), header.index("GeoID")

    out = {}
    for row in rows:
        if row[geo_type] != "NTA2020":
            continue
        out[str(row[geo_id]).strip()] = {key: cast(row[i] or 0) for key, i in at.items()}
    book.close()

    if not quiet:
        people = sum(v["people"] for v in out.values())
        print(f"  {len(out)} areas, {people:,} people, {sum(v['homes'] for v in out.values()):,} homes")
    return out


def load_land():
    with open(BOROUGHS) as fh:
        fc = json.load(fh)
    return unary_union([shape(f["geometry"]).buffer(0) for f in fc["features"]])


def tidy(raw_path, land_path, out_path):
    """`snap -clean` must run before simplify, or mapshaper opens gaps along shared borders."""
    proc = subprocess.run(
        [
            "nlx",
            "mapshaper",
            "-i",
            raw_path,
            "snap",
            "-clean",
            "-simplify",
            f"interval={SIMPLIFY_M}",
            "keep-shapes",
            "-clip",
            land_path,
            "-clean",
            "-o",
            "precision=0.0000001",
            out_path,
            "force",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 or not os.path.exists(out_path):
        raise RuntimeError(f"mapshaper failed:\n{proc.stdout}\n{proc.stderr}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    fetch_inputs()

    with open(NTA_PATH) as fh:
        every = [f for f in json.load(fh)["features"] if f.get("geometry")]
    lived_in = [f for f in every if f["properties"].get("ntatype") == RESIDENTIAL]
    print(f"step 0a: {len(lived_in)} residential areas of {len(every)}")

    census = read_census()
    land = load_land()

    land_path = os.path.join(OUT_DIR, "_nyc_land.geojson")
    with open(land_path, "w") as fh:
        json.dump(
            {
                "type": "FeatureCollection",
                "features": [{"type": "Feature", "properties": {}, "geometry": mapping(land)}],
            },
            fh,
        )

    seen = {}
    raw = []
    for f in lived_in:
        props = f["properties"]
        name = props["ntaname"].strip()
        slug = slugify(name)
        assert slug not in seen, f"slug collision: {name} and {seen[slug]}"
        seen[slug] = name

        code = props["nta2020"]
        counts = census.get(code)
        assert counts is not None, f"no census row for {code} ({name})"

        raw.append(
            {
                "type": "Feature",
                "properties": {
                    "slug": slug,
                    "name": name,
                    "nta": code,
                    "borough": props["boroname"],
                    **counts,
                },
                "geometry": f["geometry"],
            }
        )

    raw_path = os.path.join(OUT_DIR, "nyc_neighborhoods_raw.geojson")
    with open(raw_path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": raw}, fh)

    out_geo = os.path.join(OUT_DIR, "nyc_neighborhoods.geojson")
    tidy(raw_path, land_path, out_geo)

    with open(out_geo) as fh:
        features = [f for f in json.load(fh)["features"] if f.get("geometry")]

    for f in features:
        geom = shape(f["geometry"]).buffer(0)
        f["properties"]["area_mi2"] = round(geom.area * M_PER_DEG_LON * M_PER_DEG_LAT / M2_PER_MI2, 3)
    with open(out_geo, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh)

    geoms = [shape(f["geometry"]).buffer(0) for f in features]
    total = unary_union(geoms)
    overlap = sum(g.area for g in geoms) - total.area
    assert len(features) == len(raw), f"mapshaper dropped {len(raw) - len(features)} areas"
    assert overlap / total.area < 0.001, f"polygons overlap by {overlap / total.area:.3%}"
    assert total.area / land.area > 0.60, f"only {total.area / land.area:.1%} of NYC land covered"

    people = sum(f["properties"]["people"] for f in features)
    homes = sum(f["properties"]["homes"] for f in features)
    covered = sum(f["properties"]["area_mi2"] for f in features)
    print(f"wrote {len(features)} neighborhoods -> {out_geo}")
    print(f"  {people:,} people, {homes:,} homes, {covered:,.0f} mi² of land")
    print(f"  land coverage {total.area / land.area:.1%}, overlap {overlap / total.area:.4%}")

    with open(os.path.join(OUT_DIR, "step0_report.json"), "w") as fh:
        json.dump(
            {
                "source": "NYC DCP 2020 Neighborhood Tabulation Areas (9nt8-h7nd)",
                "census": "NYC DCP 2020 decennial census, core geographies",
                "neighborhoods": len(features),
                "non_residential_areas": len(every) - len(lived_in),
                "people": people,
                "homes": homes,
                "land_mi2": round(covered, 1),
                "coverage": round(total.area / land.area, 4),
                "overlap": round(overlap / total.area, 6),
                "simplify_m": SIMPLIFY_M,
            },
            fh,
            indent=2,
        )


if __name__ == "__main__":
    main()
