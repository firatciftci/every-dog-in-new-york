"""Pulls Wikipedia photos and opening lines for every breed in matrix.json into breed-photos.json."""

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(ROOT)
MATRIX = os.path.join(APP_ROOT, "static", "data", "matrix.json")
OUT = os.path.join(APP_ROOT, "static", "data", "breed-photos.json")

REST = "https://en.wikipedia.org/api/rest_v1/page/media-list"
SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKI = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
DATA = "https://www.wikidata.org/w/api.php"
UA = "EveryDogInNewYork/1.0 (https://everydog.nyc; firatciftci@uchicago.edu)"

PACE = 0.4
WANT = 7
THUMB = 640

FLOOR = 3

FREE = re.compile(r"public domain|^pd[\b-]|cc0|cc by", re.I)

TRIM = re.compile(
    r"\s*\((?:or )?(?:crossbreed|mix|toy|miniature)\)"
    r"|\s+crossbreed$|\s+mix$|,\s*english$"
    # `giant`, `standard`, `shorthaired` stay out: those breeds have articles of their own.
    r"|(?:\s*,?\s*(?:long ?haired|smooth ?coat(?:ed)?|wire ?haired|"
    r"rough ?coat(?:ed)?|miniature))+$",
    re.I,
)

ARTICLES = {
    "Labrador": "Labrador Retriever",
    "Pit Bull": "Pit bull",
    "Chihuahua": "Chihuahua (dog breed)",
    "Maltese": "Maltese dog",
    "Maltipoo": "Maltese dog",
    "Morkie": "Yorkshire Terrier",
    "Pomsky": "Siberian Husky",
    "Pomeranian": "Pomeranian dog",
    "Havanese": "Havanese dog",
    "German Shepherd Dog": "German Shepherd",
    "Shepard": "German Shepherd",
    "Jindo": "Korean Jindo",
    "Boxer": "Boxer (dog)",
    "Bull Dog": "Bulldog",
    "Australian Cattledog": "Australian Cattle Dog",
    "Miniature Australian Shepherd": "Miniature American Shepherd",
    "Doberman Pinscher": "Dobermann",
    "Cocker Spaniel": "American Cocker Spaniel",
    "Terrier": "Terrier",
    "Hound": "Hound",
    "Saint Bernard": "St. Bernard (dog)",
    "Samoyed": "Samoyed dog",
    "Papillon": "Papillon dog",
    "Pointer": "Pointer (dog breed)",
    "Dalmatian": "Dalmatian dog",
    "Akita": "Akita (dog breed)",
    "Plott": "Plott Hound",
    "Puli": "Puli dog",
    "Pumi": "Pumi dog",
    "Harrier": "Harrier (dog)",
    "Barbet": "Barbet (dog)",
    "Bolognese": "Bolognese dog",
    "Tosa": "Tosa (dog)",
    "Chinook": "Chinook (dog)",
    "Alaskan Klee kai": "Alaskan Klee Kai",
    "Bassett Hound": "Basset Hound",
    "Wheaton Terrier": "Soft-Coated Wheaten Terrier",
    "West High White Terrier": "West Highland White Terrier",
    "Cotton De Tulear": "Coton de Tulear",
    "Pharoh hound": "Pharaoh Hound",
    "Greek Shephard": "Greek Shepherd",
    "Shih Poo": "Poodle",
    "Japanese Chin/Spaniel": "Japanese Chin",
    "Curly-Coated Retriever": "Curly-Coated Retriever",
    "Formosan Mountain": "Formosan Mountain Dog",
    "Cirneco dell": "Cirneco dell'Etna",
    "Perro de Presa Canario": "Perro de Presa Canario",
    "American Leopard Hound": "American Leopard Hound",
    "Treeing Tennessee Brindle": "Treeing Tennessee Brindle",
    "Mountain Feist": "Feist (dog)",
    "Baladi": "Baladi dog",
    "Bull Dog, French": "French Bulldog",
    "Coonhound, Blue Tick": "Bluetick Coonhound",
    "Mastiff, Old English": "English Mastiff",
    "Mastiff, French (Dogue de Bordeaux)": "Dogue de Bordeaux",
    "Schipperkee": "Schipperke",
    "Russell Terrier": "Jack Russell Terrier",
    "Pointer, German Wirehaired": "German Wirehaired Pointer",
    "Pointer, German Shorthaired": "German Shorthaired Pointer",
    "Small Munsterlander Pointer": "Small Münsterländer",
}

# Labels whose article is a parent breed: keep the photos, drop the description.
LOANED = frozenset(
    {
        "Maltipoo",
        "Morkie",
        "Pomsky",
        "Shih Poo",
        "Miniature Australian Shepherd",
        "Miniature Australian Shepherd Crossbreed",
    }
)


def uninvert(name):
    family, _, variant = name.partition(", ")
    return f"{variant} {family}".strip() if variant else name


JUNK = re.compile(
    r"dysplasia|diagram|chart|pedigree|skeleton|x-?ray|radiograph|anatom|map of"
    r"|coat of arms|flag|logo|stamp|coin|\.svg$|icon|graph|chromosom|dna|skull"
    r"|statue|sculpture|monument|guardian lion",
    re.I,
)

MIN_WIDTH = 500
MAX_RATIO = 2.4


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def api(endpoint, params):
    params["format"] = "json"
    return get(f"{endpoint}?{urllib.parse.urlencode(params)}")


def article_for(label):
    # Exact label first: `Pointer, German Wirehaired` has its own article and must beat TRIM.
    if label in ARTICLES:
        return ARTICLES[label]

    trimmed = TRIM.sub("", label).strip()
    if trimmed in ARTICLES:
        return ARTICLES[trimmed]

    flipped = uninvert(trimmed)
    return ARTICLES.get(flipped, flipped)


SAY = 190
HARD = 300

ABBR = (
    "St",
    "Mt",
    "Dr",
    "Mr",
    "Mrs",
    "Ms",
    "Jr",
    "Sr",
    "Fig",
    "No",
    "Est",
    "approx",
    "ca",
    "c",
    "vs",
    "etc",
    "U.S",
    "U.K",
    "A.D",
    "B.C",
)
BREAK = re.compile(
    # Each lookbehind must include the dot, or it lands one character past it and never fires.
    "".join(rf"(?<!\b{re.escape(a)}\.)" for a in ABBR) + r"(?<=[.!?])\s+(?=[A-Z])"
)

FOREIGN = re.compile(r"\s*\([^()]*[^\x00-\x7F][^()]*\)")


def blurb(article):
    url = f"{SUMMARY}/{urllib.parse.quote(article.replace(' ', '_'), safe='')}"
    try:
        page = get(url)
    except urllib.error.HTTPError as err:
        print(f"  ! {article}: summary {err.code}")
        return None

    text = FOREIGN.sub("", page.get("extract") or "").strip()
    if not text:
        return None

    said = ""
    for part in BREAK.split(text):
        if said and len(said) + len(part) > SAY:
            break
        said = f"{said} {part}".strip()
    if len(said) > HARD:
        said = said[: HARD - 1].rsplit(" ", 1)[0] + "\u2026"

    return {
        "text": said,
        "page": (
            page.get("content_urls", {}).get("desktop", {}).get("page")
            or f"https://en.wikipedia.org/wiki/{urllib.parse.quote(article.replace(' ', '_'))}"
        ),
    }


def media_titles(article):
    url = f"{REST}/{urllib.parse.quote(article.replace(' ', '_'), safe='')}"
    try:
        page = get(url)
    except urllib.error.HTTPError as err:
        print(f"  ! {article}: media list {err.code}")
        return {}

    out = {}
    for item in page.get("items", []):
        title = item.get("title", "")
        if item.get("type") != "image" or not item.get("showInGallery", True):
            continue
        if JUNK.search(title):
            continue
        caption = (item.get("caption") or {}).get("text", "")
        # The REST list uses underscores and the Action API uses spaces; key on the spaced form.
        out[title.replace("_", " ")] = re.sub(r"\s+", " ", caption).strip()

    return out


def credits(titles):
    found = {}
    for i in range(0, len(titles), 40):
        page = api(
            COMMONS,
            {
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|size",
                "iiurlwidth": str(THUMB),
                "titles": "|".join(titles[i : i + 40]),
            },
        )
        for entry in page.get("query", {}).get("pages", {}).values():
            info = (entry.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            license = meta.get("LicenseShortName", {}).get("value", "")
            width = info.get("width") or 0
            height = info.get("height") or 1
            if not FREE.search(license) or width < MIN_WIDTH:
                continue
            if max(width / height, height / width) > MAX_RATIO:
                continue
            found[entry["title"]] = {
                # Commons appends a tracking query to every thumbnail it hands out.
                "thumb": info["thumburl"].split("?")[0],
                "page": info["descriptionurl"],
                "by": strip_tags(meta.get("Artist", {}).get("value", "")),
                "license": license,
            }
        time.sleep(PACE)

    return found


def commons_category(article):
    page = api(
        WIKI,
        {
            "action": "query",
            "prop": "pageprops",
            "ppprop": "wikibase_item",
            "titles": article,
            # Without this the lookup silently fails on redirect titles such as `Harrier (dog)`.
            "redirects": "1",
        },
    )
    entity = next(
        (
            p.get("pageprops", {}).get("wikibase_item")
            for p in page.get("query", {}).get("pages", {}).values()
        ),
        None,
    )
    if entity is None:
        return None

    claims = api(
        DATA,
        {"action": "wbgetclaims", "entity": entity, "property": "P373"},
    ).get("claims", {})
    for claim in claims.get("P373", []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value")
        if value:
            return f"Category:{value}"

    return None


def category_titles(category):
    page = api(
        COMMONS,
        {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category,
            "cmtype": "file",
            "cmlimit": "60",
        },
    )
    return [
        m["title"] for m in page.get("query", {}).get("categorymembers", []) if not JUNK.search(m["title"])
    ]


def strip_tags(html):
    text = re.sub(r"<[^>]*>", " ", html)
    text = re.sub(r"&[a-z]+;|&#\d+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" ,;")
    return text[:70] if len(text) <= 70 else text[:67].rstrip() + "…"


def pick(captions, info):
    out = []
    for title, caption in captions.items():
        shot = info.get(title)
        if shot is None:
            continue
        out.append({**shot, "caption": caption} if caption else shot)
        if len(out) == WANT:
            break

    return out


def main():
    with open(MATRIX) as f:
        labels = sorted(json.load(f)["breeds"])

    articles = {label: article_for(label) for label in labels}

    photos, says = {}, {}
    for article in sorted(set(articles.values())):
        said = blurb(article)
        time.sleep(PACE)
        if said is not None:
            says[article] = said

        captions = media_titles(article)
        time.sleep(PACE)
        if not captions:
            continue

        info = credits(list(captions))
        shots = pick(captions, info)

        if len(shots) < WANT:
            category = commons_category(article)
            time.sleep(PACE)
            if category is not None:
                spares = [t for t in category_titles(category) if t not in captions]
                time.sleep(PACE)
                shots += pick(dict.fromkeys(spares, ""), credits(spares))[: WANT - len(shots)]

        flag = " " if len(shots) >= FLOOR else "!"
        note = "and a line" if article in says else "and NO line"
        print(f"{flag} {article:36s} {len(shots)} photos {note}")
        if len(shots) >= FLOOR:
            photos[article] = shots

    of = {label: art for label, art in articles.items() if art in photos or art in says}
    about = {label: art for label, art in articles.items() if art in says and label not in LOANED}
    thin = sorted({art for art in articles.values() if art not in photos})

    with open(OUT, "w") as f:
        json.dump(
            {
                "source": "Wikimedia Commons, via the breed articles on Wikipedia",
                "note": "Each photo carries its own credit: CC BY-SA, CC BY, public domain, or CC0.",
                "said": "Descriptions are the opening lines of the English Wikipedia article, CC BY-SA 4.0.",
                "photos": photos,
                "says": says,
                "of": of,
                "about": about,
            },
            f,
            indent=1,
        )

    kept = sum(len(v) for v in photos.values())
    print(f"\n{kept} photos across {len(photos)} breeds, {len(of)} of {len(labels)} labels covered")
    if thin:
        print("thin: " + ", ".join(thin))
    print(f"{os.path.getsize(OUT) / 1024:.0f} kB -> {OUT}")


if __name__ == "__main__":
    main()
