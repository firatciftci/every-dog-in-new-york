"""The four stories under the walk: the class of 2020, new buildings, breed fashion, and names by borough."""

import collections
import json
import os

import numpy as np

from build_data import (
    DATA_DIR,
    LICENSES_ID,
    OUT_DIR,
    PLUTO_ID,
    SPLIT_FEATURES,
    WEB_DIR,
    build_crosswalk,
    cached,
    clean_breed,
    clean_name,
    fetch_pluto,
    socrata,
    split,
    split_weights,
)
from step0_neighborhoods import read_census

NOW = "2026"
THEN = "2016"
BUILT_SINCE = 2016
COHORT = range(2006, 2022)
CLASS_YEARS = range(2008, 2022)
SPIKE_YEARS = range(2012, 2022)
SPIKE_MIN, SPIKE_LIFT = 20, 1.7
BREED_FLOOR = 90
TREND_FLOOR = 100
NAME_FLOOR = 2
BORN = range(2006, 2026)
LOT_ORIGIN = (-74.26, 40.49)
FAMILIES = {
    "French Bulldog": ("French Bulldog", lambda b: b == "French Bulldog"),
    "doodles": (
        "Goldendoodle",
        lambda b: any(s in b.lower() for s in ("doodle", "cockapoo", "maltipoo", "poodle crossbreed")),
    ),
    "Chihuahua": ("Chihuahua", lambda b: b.lower().startswith("chihuahua")),
    "Yorkshire Terrier": ("Yorkshire Terrier", lambda b: b.lower().startswith("yorkshire terrier")),
    "Jindo": ("Jindo", lambda b: "jindo" in b.lower()),
    "Shiba Inu": ("Shiba Inu", lambda b: b == "Shiba Inu"),
    "Bernese Mountain Dog": ("Bernese Mountain Dog", lambda b: b == "Bernese Mountain Dog"),
    "Beagle": ("Beagle", lambda b: b.lower().startswith("beagle")),
}
STORY_NAMES = ("Luna", "Max", "Bella", "Bowie", "Kobe", "Milo")


def zip_of(r):
    z = (r["zipcode"] or "").strip().split(".")[0].zfill(5)
    return z if len(z) == 5 and z.isdigit() else None


def birth_of(r):
    b = (r["animalbirth"] or "").strip()[:4]
    return int(b) if b.isdigit() else None


def fetch_all_licenses():
    print("stories 1: every license file")
    return list(
        socrata(
            LICENSES_ID,
            "animalname,animalgender,animalbirth,breedname,zipcode,licenseissueddate,extract_year",
        )
    )


def fetch_pluto_built():
    print("stories 2: PLUTO lots with the year built")
    return list(
        socrata(
            PLUTO_ID,
            "zipcode,unitsres,latitude,longitude,yearbuilt",
            where="unitsres > 0 AND latitude IS NOT NULL AND zipcode IS NOT NULL",
        )
    )


def ranks(v):
    order = np.argsort(np.argsort(v))
    return order.astype(float)


def main():
    with open(os.path.join(OUT_DIR, "nyc_neighborhoods.geojson")) as fh:
        hoods = [f for f in json.load(fh)["features"] if f.get("geometry")]
    slugs = [f["properties"]["slug"] for f in hoods]
    borough = {f["properties"]["slug"]: f["properties"]["borough"] for f in hoods}

    rows = cached("licenses_all.json", fetch_all_licenses)
    files = collections.defaultdict(list)
    for r in rows:
        files[r["extract_year"]].append(r)
    now, then = files[NOW], files[THEN]
    print(f"  {len(rows):,} rows in {len(files)} files, {len(now):,} in {NOW}, {len(then):,} in {THEN}")

    units = cached(
        "zip_hood_weights.json", lambda: build_crosswalk(cached("pluto_residential.json", fetch_pluto), hoods)
    )
    dogs_now = collections.Counter(z for r in now if (z := zip_of(r)))
    weights, _ = split_weights(units, dogs_now, hoods, read_census(SPLIT_FEATURES, float, quiet=True))

    print("stories 3: the class of 2020")
    births = collections.Counter(b for r in now if (b := birth_of(r)))
    births_2024 = collections.Counter(b for r in files["2024"] if (b := birth_of(r)))

    def bump(c):
        return c[2020] / ((c[2019] + c[2021]) / 2)

    seen = set()
    months = collections.Counter()
    for r in files["2022"]:
        key = (
            r["animalname"],
            r["animalgender"],
            r["animalbirth"],
            r["breedname"],
            r["zipcode"],
            r["licenseissueddate"][:10],
        )
        if key in seen:
            continue
        seen.add(key)
        months[r["licenseissueddate"][:7]] += 1
    month_keys = [f"{y}-{m:02d}" for y in (2019, 2020, 2021) for m in range(1, 13)]
    print(f"  {len(files['2022']) - len(seen):,} repeated rows dropped from the 2022 file")

    breed_years = collections.defaultdict(collections.Counter)
    births_zip = collections.defaultdict(collections.Counter)
    for r in now:
        b = birth_of(r)
        if b is None:
            continue
        breed = clean_breed(r["breedname"])
        if breed and 2019 <= b <= 2021:
            breed_years[breed][b] += 1
        z = zip_of(r)
        if z and 2019 <= b <= 2021:
            births_zip[z][b] += 1

    breeds = {
        label: [c[2019], c[2020], c[2021]]
        for label, c in breed_years.items()
        if sum(c.values()) >= BREED_FLOOR
    }
    hood_births, _ = split(births_zip, weights)

    print("stories 4: the new buildings")
    pluto = cached("pluto_built.json", fetch_pluto_built)

    def year_of(p):
        try:
            return int(float(p.get("yearbuilt") or 0))
        except ValueError:
            return 0

    old = build_crosswalk([p for p in pluto if year_of(p) < BUILT_SINCE], hoods)
    new = build_crosswalk([p for p in pluto if year_of(p) >= BUILT_SINCE], hoods)
    rate = {}
    for z, w in units.items():
        for s, u in w.items():
            if u > 0:
                rate[s] = weights[z][s] / u
    weights_then = {z: {s: u * rate[s] for s, u in w.items()} for z, w in old.items()}
    dogs_then = collections.Counter(z for r in then if (z := zip_of(r)))
    placed_now, _ = split({z: {"n": n} for z, n in dogs_now.items()}, weights)
    placed_then, _ = split({z: {"n": n} for z, n in dogs_then.items()}, weights_then)
    total_now = sum(v["n"] for v in placed_now.values())
    total_then = sum(v["n"] for v in placed_then.values())
    homes_all = collections.Counter()
    homes_new = collections.Counter()
    for w in units.values():
        for s, u in w.items():
            homes_all[s] += u
    for w in new.values():
        for s, u in w.items():
            homes_new[s] += u

    built = {}
    for s in slugs:
        share_then = placed_then.get(s, {}).get("n", 0.0) / total_then
        share_now = placed_now.get(s, {}).get("n", 0.0) / total_now
        built[s] = [
            round(share_then * 100, 4),
            round(share_now * 100, 4),
            round(homes_new[s] / homes_all[s], 4) if homes_all[s] else 0,
        ]
    boroughs = collections.defaultdict(lambda: [0.0, 0.0])
    for s, (a, b, _) in built.items():
        boroughs[borough[s]][0] += a
        boroughs[borough[s]][1] += b

    kept = [s for s in slugs if built[s][0] > 0.05]
    change = np.array([built[s][1] / built[s][0] for s in kept])
    newness = np.array([built[s][2] for s in kept])
    rho = float(np.corrcoef(ranks(change), ranks(newness))[0, 1])
    print(f"  {len(kept)} neighborhoods, Spearman {rho:.2f} between share change and new homes")

    lots = sorted(
        (
            [
                round((float(p["longitude"]) - LOT_ORIGIN[0]) * 1e4),
                round((float(p["latitude"]) - LOT_ORIGIN[1]) * 1e4),
                int(float(p["unitsres"])),
                year_of(p),
            ]
            for p in pluto
            if BUILT_SINCE <= year_of(p) <= int(NOW)
        ),
        key=lambda lot: lot[3],
    )
    print(f"  {len(lots):,} lots built since {BUILT_SINCE}, {sum(lot[2] for lot in lots):,} homes")

    print("stories 5: ten years of breeds")
    labels_then = {r["breedname"] for r in then}
    dogs: dict[tuple, dict] = {}
    for r in rows:
        b = birth_of(r)
        if b is None:
            continue
        key = ((r["animalname"] or "").strip().upper(), r["animalgender"], b, r["breedname"], zip_of(r))
        dogs.setdefault(key, r)
    cohort = collections.Counter(k[2] for k in dogs)
    fashion = []
    for key, (plate, test) in FAMILIES.items():
        labels = sorted(b for b in labels_then if b and test(b))
        c = collections.Counter(k[2] for k in dogs if k[3] in labels)
        fashion.append(
            {
                "key": key,
                "plate": plate,
                "labels": labels,
                "per_1k": [round(1000 * c[y] / cohort[y], 2) for y in COHORT],
            }
        )
        print(f"  {key}: {labels}")

    names_cohort = collections.defaultdict(collections.Counter)
    named = collections.Counter()
    tops = {}
    breeds_cohort = collections.defaultdict(collections.Counter)
    for k, r in dogs.items():
        name = clean_name(r["animalname"])
        if name:
            names_cohort[name][k[2]] += 1
            named[k[2]] += 1
        breed = clean_breed(r["breedname"])
        if breed:
            breeds_cohort[k[2]][breed] += 1
    breed_words = {w.lower() for b in labels_then if b for w in b.replace(",", " ").replace("/", " ").split()}
    junk = breed_words | {
        "puppy",
        "dog",
        "cavapoo",
        "mini",
        "noname",
        "tbd",
        "undecided",
        "unknowed",
        "unkown",
        "pending",
    }
    spikes = {}
    for y in SPIKE_YEARS:
        found = []
        for name, c in names_cohort.items():
            if not name.isalpha() or name.lower() in junk or c[y] < SPIKE_MIN:
                continue
            base = sum(c[k] / named[k] for k in (y - 2, y - 1, y + 1, y + 2)) / 4
            lift = (c[y] / named[y]) / base if base else 0
            if lift >= SPIKE_LIFT:
                found.append((lift, name))
        found.sort(reverse=True)
        spikes[str(y)] = [
            {"name": n, "lift": round(x, 2), "counts": [names_cohort[n][k] for k in range(y - 4, y + 5)]}
            for x, n in found[:6]
        ]
        print(f"  {y} spikes: {[(n, round(x, 2), names_cohort[n][y]) for x, n in found[:6]]}")
    for y in COHORT:
        top_name = max(names_cohort, key=lambda n: names_cohort[n][y])
        tops[str(y)] = [breeds_cohort[y].most_common(1)[0][0], top_name]

    per_file = {}
    for year, rs in sorted(files.items()):
        c = collections.Counter(r["breedname"] for r in rs)
        n = len(rs)
        per_file[year] = {
            key: round(1000 * sum(v for b, v in c.items() if b in labels_then and test(b)) / n, 2)
            for key, (_, test) in FAMILIES.items()
        }

    stories = {
        "now": NOW,
        "then": THEN,
        "class": {
            "years": list(CLASS_YEARS),
            "births": [births[y] for y in CLASS_YEARS],
            "ages": sorted([y, n] for y, n in births.items() if 1990 <= y <= int(NOW)),
            "bump": round(bump(births), 4),
            "bump_2024": round(bump(births_2024), 4),
            "months_from": month_keys[0],
            "months": [months[m] for m in month_keys],
            "breeds": breeds,
            "hoods": {
                s: [round(hood_births.get(s, {}).get(y, 0.0), 1) for y in (2019, 2020, 2021)] for s in slugs
            },
        },
        "built": {
            "since": BUILT_SINCE,
            "hoods": built,
            "boroughs": {b: [round(v[0], 2), round(v[1], 2)] for b, v in sorted(boroughs.items())},
            "rho": round(rho, 2),
            "lots": len(lots),
            "homes": sum(lot[2] for lot in lots),
        },
        "fashion": {
            "years": list(COHORT),
            "cohort": [cohort[y] for y in COHORT],
            "breeds": fashion,
            "names": {
                n: [round(1000 * names_cohort[n][y] / named[y], 2) for y in COHORT] for n in STORY_NAMES
            },
            "tops": tops,
            "spikes": spikes,
            "files": per_file,
        },
    }
    breed_years = collections.defaultdict(collections.Counter)
    for k in dogs:
        if k[3] in labels_then:
            breed = clean_breed(k[3])
            if breed:
                breed_years[breed][k[2]] += 1
    trends = {
        "years": list(COHORT),
        "breeds": {
            b: [round(1000 * c[y] / cohort[y], 2) for y in COHORT]
            for b, c in breed_years.items()
            if sum(c[y] for y in COHORT) >= TREND_FLOOR
        },
        "names": {
            n: [round(1000 * c[y] / named[y], 2) for y in COHORT]
            for n, c in names_cohort.items()
            if sum(c[y] for y in COHORT) >= TREND_FLOOR
        },
    }
    with open(os.path.join(WEB_DIR, "trends.json"), "w") as fh:
        json.dump(trends, fh, separators=(",", ":"))
    print(f"  trends for {len(trends['breeds'])} breeds and {len(trends['names'])} names")

    named_now = collections.Counter(n for r in now if (n := clean_name(r["animalname"])))
    everyone = {
        "years": list(BORN),
        "born": [births[y] for y in BORN],
        "named": sum(named_now.values()),
        "names": {n: c for n, c in named_now.most_common() if c >= NAME_FLOOR},
    }
    with open(os.path.join(WEB_DIR, "names.json"), "w") as fh:
        json.dump(everyone, fh, separators=(",", ":"))
    print(f"  {len(everyone['names'])} names shared by at least {NAME_FLOOR} dogs")

    with open(os.path.join(WEB_DIR, "stories.json"), "w") as fh:
        json.dump(stories, fh, separators=(",", ":"))
    with open(os.path.join(WEB_DIR, "new-homes.json"), "w") as fh:
        json.dump(
            {"origin": LOT_ORIGIN, "scale": 1e4, "lots": [v for lot in lots for v in lot]},
            fh,
            separators=(",", ":"),
        )

    assert 1.1 < stories["class"]["bump"] < 1.5, f"class of 2020 bump {stories['class']['bump']} moved"
    assert abs(sum(v[1] for v in built.values()) - 100) < 0.01
    assert abs(sum(v[0] for v in built.values()) - 100) < 0.01
    for name in ("stories.json", "new-homes.json", "trends.json", "names.json"):
        print(f"  {name:<16} {os.path.getsize(os.path.join(WEB_DIR, name)) / 1024:8.1f} KB")
    print(f"  data from {DATA_DIR}")


if __name__ == "__main__":
    main()
