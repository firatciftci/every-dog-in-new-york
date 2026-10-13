"""Draws missing breed plates with Gemini in the archive style and cuts them out into static/breeds."""

import glob
import io
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from functools import cache
from threading import Event, Lock

from google import genai
from google.genai import types
from PIL import Image

from fetch_breeds import CAPTIONED, CREDITS, HEIGHT, OUT_DIR, cut_out

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(ROOT, "data", "breed-art")
WORK_DIR = os.path.join(ROOT, "out", "drawn")

MODEL = "gemini-3-pro-image-preview"

SIZE = "1K"
SHAPE = "4:3"

REFS = ("terrier", "golden-retriever", "husky", "yorkshire-terrier", "pug", "beagle")
REF_PX = 1024

TRIES = 3
PACE = 4.0

# The API throttles at five concurrent calls.
JOBS = 2

BACKOFF = 20.0
CEILING = 180.0
PATIENCE = 6

HOUSE = """\
Draw one dog as a plate from a mid-century pen-and-ink breed encyclopedia.

The attached drawings are the house style. Match them exactly: the same pen, the same
weight of line, the same way of building tone. They are the only style.

Ink and paper.
- This is a flat digital scan of a printed page. It is not a photograph of a drawing.
- Every pixel that is not ink is pure white, #FFFFFF. No cream, no ivory, no beige, no
  aged or antique paper tone, no gray.
- Flat even light across the whole image. No shadow anywhere. No vignette. No darkening
  at any corner or edge. No paper grain, no fiber, no texture, no speckle.
- Pure black ink. No color, no gray wash, no tint.
- The paper is bare white all the way out to the four edges of the image.

The pen.
- Line work only: contour lines, directional hatching, cross-hatching, stipple.
- The hatching lies along the coat and does all of the shading. Solid black is spent
  only on the nose, the eye and genuinely dark markings.
- Carry visible hatching across the body. A clean outline around an empty white body is
  the one thing that will get this rejected: the plate is laid over a colored map, and
  an empty body lets the color through and the dog disappears.

The pose.
- The whole dog, standing square in a show stance, seen broadside from the side.
- Head in profile or turned slightly toward the viewer. All four legs and the tail in
  view. Correct conformation for the breed named.

The ground.
- A few short broken strokes, or a tuft or two of grass, under the paws. Nothing else.
  No horizon, no landscape, no interior.

Nothing else in the frame.
- No border, no frame, no ruled box, no caption, no lettering, no letters, no numbers,
  no signature, no watermark, no color swatch.
- One dog only. No person, no handler, no lead, no collar, no props, no second animal.
- The dog sits centered with a small margin of white around it.
"""

# Mean alpha bounds, measured off the 73 shipped plates; the floor is the corpus tenth percentile.
INK = (0.095, 0.40)
# Width to height bounds; the shipped corpus runs 0.70 to 1.75.
SHAPES = (0.62, 1.90)
# Corner brightness floor on the raw return; measured, since paper at 240 still cuts out but loses hatching.
PAPER = 250

# Dollars per million tokens, off the Gemini developer pricing page.
RATES = {"in": 2.00, "think": 12.00, "image": 120.00}
BILL = {"calls": 0, "in": 0, "think": 0, "image": 0}
TILL = Lock()
QUILL = Lock()
LEDGER = Lock()
DRY = Event()


def say(line):
    with QUILL:
        print(line, flush=True)


def spend(usage):
    if usage is None:
        return
    with TILL:
        BILL["calls"] += 1
        BILL["in"] += usage.prompt_token_count or 0
        BILL["think"] += usage.thoughts_token_count or 0
        BILL["image"] += sum(
            d.token_count or 0
            for d in (usage.candidates_tokens_details or [])
            if d.modality == types.MediaModality.IMAGE
        )


def bill():
    total = sum(BILL[k] * RATES[k] / 1e6 for k in RATES)
    per = total / max(1, BILL["calls"])
    return (
        f"{BILL['calls']} calls, ${total:.2f} (${per:.3f} a call). "
        f"in {BILL['in']}, thinking {BILL['think']}, image {BILL['image']} tokens."
    )


def told_to_wait(why):
    """Seconds the API asked for in `retryDelay`, or None."""
    said = re.search(r"'retryDelay':\s*'(\d+(?:\.\d+)?)s'", why)
    return float(said.group(1)) if said else None


def mean(band):
    hist = band.histogram()
    return sum(i * n for i, n in enumerate(hist)) / max(1, sum(hist))


@cache
def refs():
    out = []
    for slug in REFS:
        hit = glob.glob(os.path.join(RAW_DIR, slug + ".*"))
        if not hit:
            raise SystemExit(f"no reference scan for {slug}; run fetch_breeds.py first")
        plate = Image.open(hit[0]).convert("RGB")
        keep = CAPTIONED.get(slug)
        if keep is not None:
            plate = plate.crop((0, 0, plate.width, round(plate.height * keep)))
        plate.thumbnail((REF_PX, REF_PX), Image.Resampling.LANCZOS)
        out.append(plate)
    return out


def draw(client, breed, note, gripe):
    ask = HOUSE + f"\nThe breed is a {breed}."
    if note:
        ask += f" {note}"
    if gripe:
        ask += f"\n\nThe last attempt was rejected: {gripe} Fix that."

    reply = client.models.generate_content(
        model=MODEL,
        contents=[ask, *refs()],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=SHAPE, image_size=SIZE),
        ),
    )
    spend(reply.usage_metadata)
    for part in reply.parts:
        if part.inline_data is not None:
            return part.inline_data.data
    raise RuntimeError(f"{breed}: the model returned no image")


def bare_paper(png):
    im = Image.open(io.BytesIO(png)).convert("L")
    w, h = im.size
    edge = max(8, min(w, h) // 24)
    worst = 255.0
    for x, y in ((0, 0), (w - edge, 0), (0, h - edge), (w - edge, h - edge)):
        worst = min(worst, mean(im.crop((x, y, x + edge, y + edge))))
    return worst


def grade(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    return w / h, mean(im.getchannel("A")) / 255


def sheet(slug):
    strip = os.path.join(WORK_DIR, slug + "-sheet.png")
    plates = [os.path.join(OUT_DIR, s + ".webp") for s in (slug, "beagle", "collie", "pug")]
    rows = []
    for i, back in enumerate(("white", "#a8c68f")):
        row = os.path.join(WORK_DIR, f"{slug}-{i}.png")
        subprocess.run(
            [
                "magick",
                *plates,
                "-background",
                back,
                "-alpha",
                "remove",
                "-alpha",
                "off",
                "-resize",
                f"x{HEIGHT}",
                "+append",
                row,
            ],
            check=True,
        )
        rows.append(row)
    subprocess.run(
        ["magick", *rows, "-background", "white", "-gravity", "center", "-append", strip],
        check=True,
    )
    for row in rows:
        os.remove(row)
    return strip


def slugify(breed):
    out = "".join(c if c.isalnum() else "-" for c in breed.lower())
    return "-".join(part for part in out.split("-") if part)


def record(breed, slug, ink):
    with LEDGER:
        with open(CREDITS) as f:
            credits = json.load(f)

        drawn = [d for d in credits.get("drawn", []) if d["slug"] != slug]
        drawn.append({"slug": slug, "breed": breed, "model": MODEL, "ink": round(ink, 3)})
        credits["drawn"] = sorted(drawn, key=lambda d: d["slug"])
        credits["drawn_note"] = (
            "The archive never drew these breeds. Each one was "
            f"drawn to match the scanned plates by {MODEL}, then cut out by the same "
            "script."
        )

        with open(CREDITS, "w") as f:
            json.dump(credits, f, indent=1)


def plate(client, ask):
    """One breed end to end; returns the credit record, or None. Never raises."""
    breed, _, note = ask.partition("=")
    slug = slugify(breed)
    raw = os.path.join(WORK_DIR, slug + ".png")
    dest = os.path.join(OUT_DIR, slug + ".webp")
    gripe = ""

    attempt, waits = 0, 0
    while attempt < TRIES:
        if DRY.is_set():
            return None
        try:
            png = draw(client, breed, note, gripe)
        except Exception as err:  # noqa: BLE001 - one bad breed must not stop the batch
            why = str(err)
            # A 429 carries retryDelay: seconds on a burst limit, hours on the daily cap.
            if "RESOURCE_EXHAUSTED" in why or "429" in why:
                wait = told_to_wait(why) or min(BACKOFF * 2**waits, CEILING)
                waits += 1
                if wait > CEILING or waits > PATIENCE:
                    if not DRY.is_set():
                        DRY.set()
                        back = time.strftime("%H:%M", time.localtime(time.time() + wait))
                        say(f"  out of quota for {wait / 3600:.1f}h, back at {back}.")
                    return None
                time.sleep(wait)
                continue
            attempt += 1
            say(f"  {slug:30s} try {attempt}: the call failed, {why[:90]}")
            time.sleep(PACE * attempt)
            continue
        attempt += 1

        with open(raw, "wb") as f:
            f.write(png)

        paper = bare_paper(png)
        if paper < PAPER:
            gripe = (
                f"the paper was not white, it read {paper:.0f} of 255 in the corners; "
                "leave the background bare white with nothing on it."
            )
            say(f"  {slug:30s} try {attempt}: toned paper at {paper:.0f}")
            continue

        cut_out(raw, dest)
        shape, ink = grade(dest)

        if not INK[0] <= ink <= INK[1]:
            gripe = f"the drawing carried {ink:.3f} ink where a plate carries " + (
                f"at least {INK[0]:.3f}; hatch the coat far more heavily, the body came back nearly empty."
                if ink < INK[0]
                else f"at most {INK[1]:.3f}; lighten it, the dog came back almost solid black."
            )
        elif not SHAPES[0] <= shape <= SHAPES[1]:
            gripe = (
                f"the dog came out {shape:.2f} wide for its height where a plate runs "
                f"{SHAPES[0]:.2f} to {SHAPES[1]:.2f}; stand it square and side on, the "
                "whole dog in view."
            )
        else:
            record(breed, slug, ink)
            sheet(slug)
            kb = os.path.getsize(dest) / 1024
            say(f"  {slug:30s} ink {ink:.3f}  shape {shape:.2f}  {kb:5.1f} kB")
            return {"slug": slug, "breed": breed, "model": MODEL, "ink": round(ink, 3)}

        say(f"  {slug:30s} try {attempt}: {gripe.split(';')[0]}")
        os.remove(dest)

    say(f"  {slug:30s} GAVE UP after {TRIES}")
    return None


def main():
    asks = sys.argv[1:]
    if len(asks) == 1 and asks[0].endswith(".json"):
        with open(asks[0]) as f:
            asks = json.load(f)
    if not asks:
        raise SystemExit(__doc__)

    names = ("GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY")
    key = next((os.environ[n] for n in names if os.environ.get(n)), "")
    dotenv = os.path.join(ROOT, ".env")
    if not key and os.path.exists(dotenv):
        with open(dotenv) as f:
            for line in f:
                name, _, value = line.strip().partition("=")
                if name in names and value:
                    key = value.strip().strip("\"'")
    if not key:
        raise SystemExit(f"No key. Export {names[0]}, or put it in {dotenv}")

    os.makedirs(WORK_DIR, exist_ok=True)
    client = genai.Client(api_key=key)
    refs()  # warm the cache before the pool

    print(f"{len(asks)} breeds, {JOBS} at a time\n")
    done, start = [], time.monotonic()
    with ThreadPoolExecutor(max_workers=JOBS) as pool:
        for got in pool.map(lambda a: plate(client, a), asks):
            if got is not None:
                done.append(got)

    mins = (time.monotonic() - start) / 60
    print(f"\n{len(done)} of {len(asks)} drawn in {mins:.0f} min. Spent: {bill()}")
    got = {d["slug"] for d in done}
    missed = [a for a in asks if slugify(a.partition("=")[0]) not in got]
    if missed:
        rest = os.path.join(WORK_DIR, "unfinished.json")
        with open(rest, "w") as f:
            json.dump(missed, f, indent=1)
        why = "the daily quota ran out" if DRY.is_set() else "they never cleared the gate"
        print(f"{len(missed)} left, {why}. Resume with:\n  uv run draw_breed.py {rest}")

    print("\nAdd to PLATES in src/lib/breeds.ts:")
    for got in sorted(done, key=lambda d: d["breed"]):
        print(f'  "{got["breed"]}": "{got["slug"]}",')


if __name__ == "__main__":
    main()
