"""Pulls Pearson Scott Foresman breed line art from Wikimedia Commons and cuts it out into static/breeds."""

import json
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(ROOT)
RAW_DIR = os.path.join(ROOT, "data", "breed-art")
OUT_DIR = os.path.join(APP_ROOT, "static", "breeds")
CREDITS = os.path.join(APP_ROOT, "static", "data", "breed-art.json")

API = "https://commons.wikimedia.org/w/api.php"
UA = "EveryDogInNewYork/1.0 (https://everydog.nyc; firatciftci@uchicago.edu)"
CATEGORY = "Category:Line art of dogs"

PD = re.compile(r"public domain|^pd\b|cc0", re.I)

HEIGHT = 220
PACE = 1.1


def api(params):
    params["format"] = "json"
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def plates():
    titles, cont = [], None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": CATEGORY,
            "cmlimit": "500",
            "cmtype": "file",
        }
        if cont:
            params["cmcontinue"] = cont
        page = api(params)
        titles += [m["title"] for m in page["query"]["categorymembers"]]
        cont = page.get("continue", {}).get("cmcontinue")
        if not cont:
            break

    psf = [t for t in titles if "PSF" in t and t.lower().endswith((".png", ".jpg", ".jpeg"))]

    out = []
    for i in range(0, len(psf), 40):
        page = api(
            {
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|size",
                "titles": "|".join(psf[i : i + 40]),
            }
        )
        for entry in page["query"]["pages"].values():
            info = (entry.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            license = meta.get("LicenseShortName", {}).get("value", "")
            if not PD.search(license):
                continue
            # Below 380px the plate goes soft at the 220px output height.
            if (info.get("width") or 0) < 380:
                continue
            out.append(
                {
                    "slug": slugify(entry["title"]),
                    "title": entry["title"].removeprefix("File:"),
                    "url": info["url"],
                    "page": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(entry['title'])}",
                    "license": license,
                }
            )

    out.sort(key=lambda x: x["slug"])
    return out


def slugify(title):
    name = title.removeprefix("File:").rsplit(".", 1)[0]
    name = re.sub(r"\(?PSF[^)]*\)?", "", name)
    name = re.sub(r"\(line art\)|\(cropped\)|- ?Dog|Dog ?-|\bDog\b", "", name, flags=re.I)
    name = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return name


def download(plate):
    path = os.path.join(RAW_DIR, plate["slug"] + os.path.splitext(plate["url"])[1])
    if os.path.exists(path) and os.path.getsize(path) > 4096:
        return path

    req = urllib.request.Request(plate["url"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as response, open(path, "wb") as f:
        f.write(response.read())
    time.sleep(PACE)
    return path


# Fraction of raw scan height to keep; these three scans carry the book's caption under the dog.
CAPTIONED = {
    "airedale": 644 / 760,
    "golden-retriever": 2230 / 2703,
    "irish-terrier": 1844 / 2215,
}


def cut_out(src, dest):
    keep = CAPTIONED.get(os.path.basename(src).split(".")[0])
    if keep is not None:
        w, h = Image.open(src).size
        src = f"{src}[{w}x{round(h * keep)}+0+0]"
    subprocess.run(
        [
            "magick",
            src,
            "-colorspace",
            "gray",
            "-level",
            "8%,92%",
            "-negate",
            "-alpha",
            "copy",
            "-channel",
            "RGB",
            "-evaluate",
            "set",
            "0",
            "+channel",
            "-trim",
            "+repage",
            "-resize",
            f"x{HEIGHT}",
            "-quality",
            "88",
            "-define",
            "webp:method=6",
            dest,
        ],
        check=True,
    )


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    found = plates()
    print(f"{len(found)} public-domain plates")

    kept = []
    for plate in found:
        raw = download(plate)
        dest = os.path.join(OUT_DIR, plate["slug"] + ".webp")
        cut_out(raw, dest)
        kept.append({k: plate[k] for k in ("slug", "title", "page", "license")})
        print(f"  {plate['slug']:34s} {os.path.getsize(dest) / 1024:5.1f} kB")

    with open(CREDITS, "w") as f:
        json.dump(
            {
                "source": "Pearson Scott Foresman, via Wikimedia Commons",
                "note": "Released into the public domain by the publisher.",
                "plates": kept,
            },
            f,
            indent=1,
        )

    total = sum(os.path.getsize(os.path.join(OUT_DIR, p["slug"] + ".webp")) for p in kept)
    print(f"{len(kept)} plates, {total / 1024:.0f} kB total")


if __name__ == "__main__":
    main()
