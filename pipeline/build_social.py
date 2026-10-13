"""Renders static/og.png, the icons, and the README title banners from summary.json and static/favicon.svg."""

import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(ROOT, ".."))
STATIC = os.path.join(SITE, "static")
MODULES = os.path.join(SITE, "node_modules")

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CARD = (1200, 630)
SCALE = 2

COLLAR = 1.25

# Collar dimensions in px, measured off the live intro at a 1200px viewport.
HERO = {
    "strap": 20.0,
    "stitch": 4.0,
    "ring_w": 26.0,
    "ring_h": 18.0,
    "hang": 10.0,
    "radius": 16.0,
    "pad_top": 16.0,
    "pad_side": 24.0,
    "pad_foot": 12.0,
    "hole": 10.0,
    "hole_top": 8.0,
    "tiny": 9.0,
    "figure": 29.6,
    "gap": 2.0,
    "tail": 4.0,
    "pivot": 6.0,
}

PARADE = 7

# Hex equivalents of the oklch tokens in app.css.
INK = "#1e1b17"
PAPER = "#ffffff"
BRAND = "#bc5030"
GRAIN = (
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150'"
    " height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise'"
    " baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix"
    " type='matrix' values='0 0 0 0 0.36 0 0 0 0 0.3 0 0 0 0 0.22 0 0 0 0.075"
    " 0'/%3E%3C/filter%3E%3Crect width='150' height='150' filter='url(%23n)'/%3E%3C/svg%3E\")"
)


def need(path: str) -> str:
    if not os.path.exists(path):
        raise SystemExit(f"missing: {path}")

    return path


def tool(name: str) -> str:
    found = shutil.which(name)
    if found is None:
        raise SystemExit(f"{name} is not on PATH. brew install {name}")

    return found


def read(path: str) -> str:
    with open(need(path)) as fh:
        return fh.read()


def write(path: str, text: str) -> None:
    with open(path, "w") as fh:
        fh.write(text)


# Every length is a measured page value times COLLAR, and every color is the oklch the
# page declares, because Chrome is drawing this and can read it.
COLLAR_CSS = f"""
  .strap {{
    position: relative;
    height: {HERO["strap"] * COLLAR:.2f}px;
    background: oklch(0.34 0.045 58);
    box-shadow:
      inset 0 {-2 * COLLAR:.2f}px {3 * COLLAR:.2f}px rgb(0 0 0 / 0.35),
      inset 0 {2 * COLLAR:.2f}px {2 * COLLAR:.2f}px oklch(0.62 0.06 60 / 0.5);
  }}
  .strap i {{
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: {COLLAR:.2f}px dashed oklch(0.72 0.07 70 / 0.5);
  }}
  .ring {{
    display: block;
    margin: {COLLAR:.2f}px auto 0;
    width: {HERO["ring_w"] * COLLAR:.2f}px;
    height: {HERO["ring_h"] * COLLAR:.2f}px;
  }}
  /* Caught at one end of the five-second swing the page runs, pivoting on the ring
     rather than on itself, which is where the transform origin sits there too. */
  .tag {{
    position: relative;
    width: max-content;
    margin: {-HERO["hang"] * COLLAR:.2f}px auto 0;
    padding: {HERO["pad_top"] * COLLAR:.2f}px {HERO["pad_side"] * COLLAR:.2f}px
      {HERO["pad_foot"] * COLLAR:.2f}px;
    border-radius: {HERO["radius"] * COLLAR:.2f}px;
    transform-origin: 50% {-HERO["pivot"] * COLLAR:.2f}px;
    transform: rotate(-1.1deg);
    background: linear-gradient(
      168deg,
      oklch(0.9 0.055 88) 0%,
      oklch(0.82 0.075 82) 38%,
      oklch(0.71 0.07 76) 70%,
      oklch(0.79 0.07 84) 100%
    );
    color: oklch(0.32 0.045 70);
    box-shadow:
      inset 0 {1.5 * COLLAR:.2f}px 0 oklch(0.96 0.04 92 / 0.9),
      inset 0 {-1.5 * COLLAR:.2f}px 0 oklch(0.5 0.06 70 / 0.55),
      0 {3 * COLLAR:.2f}px 0 oklch(0.55 0.06 72 / 0.5),
      0 {10 * COLLAR:.2f}px {22 * COLLAR:.2f}px rgb(58 48 38 / 0.3);
    text-align: center;
  }}
  .tag u {{
    position: absolute;
    top: {HERO["hole_top"] * COLLAR:.2f}px;
    left: 50%;
    margin-left: {-HERO["hole"] * COLLAR / 2:.2f}px;
    width: {HERO["hole"] * COLLAR:.2f}px;
    height: {HERO["hole"] * COLLAR:.2f}px;
    border-radius: 50%;
    background: oklch(0.48 0.05 70);
    box-shadow:
      inset 0 {COLLAR:.2f}px {1.5 * COLLAR:.2f}px rgb(0 0 0 / 0.6),
      0 {COLLAR:.2f}px 0 oklch(0.95 0.04 92 / 0.55);
  }}
  .tag b, .tag s {{
    display: block;
    font-size: {HERO["tiny"] * COLLAR:.2f}px;
    font-weight: 600;
    letter-spacing: 0.19em;
    line-height: 1.5;
    text-decoration: none;
    text-transform: uppercase;
    opacity: 0.8;
  }}
  .tag s {{ margin-top: {HERO["tail"] * COLLAR:.2f}px; }}
  .tag em {{
    display: block;
    margin-top: {HERO["gap"] * COLLAR:.2f}px;
    font-family: Slab;
    font-size: {HERO["figure"] * COLLAR:.2f}px;
    font-style: normal;
    letter-spacing: -0.01em;
    line-height: 1.5;
  }}
  .tag em, .tag b, .tag s {{
    text-shadow:
      0 {COLLAR:.2f}px 0 oklch(0.97 0.03 92 / 0.65),
      0 {-0.5 * COLLAR:.2f}px 0 oklch(0.4 0.05 70 / 0.35);
  }}
"""

THEMES = {
    "light": ("oklch(1 0 0)", "oklch(0.225 0.01 78)", "oklch(0.565 0.147 37)"),
    "dark": ("oklch(0.168 0.008 76)", "oklch(0.945 0.006 93)", "oklch(0.715 0.135 45)"),
}


def collar(summary: dict) -> str:
    return f"""<div class="collar">
  <div class="strap">
    <i style="top:{HERO["stitch"] * COLLAR:.2f}px"></i>
    <i style="bottom:{HERO["stitch"] * COLLAR:.2f}px"></i>
  </div>
  <svg class="ring" viewBox="0 0 22 16" fill="none">
    <path d="M11 1.5 a6.5 6.5 0 1 0 0.01 0" stroke="#c0ab87" stroke-width="2.4"/>
  </svg>
  <div class="tag">
    <u></u>
    <b>New York City</b>
    <em>{summary["licenses"]:,}</em>
    <s>Dog licenses &middot; {summary["extract_year"]}</s>
  </div>
</div>"""


def fonts(work: str) -> None:
    shutil.copy(
        need(os.path.join(MODULES, "@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2")),
        os.path.join(work, "slab.woff2"),
    )
    shutil.copy(
        need(os.path.join(MODULES, "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")),
        os.path.join(work, "inter.woff2"),
    )


def shoot(page: str, shot: str, size: tuple[int, int], transparent: bool = False) -> None:
    subprocess.run(
        [
            need(CHROME),
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--allow-file-access-from-files",
            *(["--default-background-color=00000000"] if transparent else []),
            f"--force-device-scale-factor={SCALE}",
            f"--window-size={size[0]},{size[1]}",
            f"--screenshot={shot}",
            f"file://{page}",
        ],
        check=True,
        capture_output=True,
    )


def banner(work: str, theme: str) -> None:
    """The collar and the title off the intro, on nothing, for the README in either theme."""
    summary = json.loads(read(os.path.join(STATIC, "data", "summary.json")))
    fonts(work)
    background, foreground, primary = THEMES[theme]
    html = f"""<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {{ font-family: Slab; src: url(slab.woff2) format("woff2"); }}
  @font-face {{ font-family: Inter; src: url(inter.woff2) format("woff2"); font-weight: 100 900; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ width: {CARD[0]}px; background: transparent; font-family: Inter, sans-serif; }}
{COLLAR_CSS}
  h1 {{
    margin: 18px 40px 48px;
    transform: rotate(-1.4deg);
    color: {background};
    font-family: Slab;
    font-size: 112px;
    font-weight: 400;
    letter-spacing: -0.015em;
    line-height: 0.86;
    paint-order: stroke fill;
    text-align: center;
    text-shadow: 0.055em 0.06em 0 {primary};
    -webkit-text-stroke: 0.055em {foreground};
  }}
</style>
{collar(summary)}
<h1>EVERY DOG<br>IN NEW YORK</h1>
"""
    page = os.path.join(work, f"banner-{theme}.html")
    write(page, html)
    shot = os.path.join(work, f"banner-{theme}.png")
    shoot(page, shot, (CARD[0], 540), transparent=True)
    out = os.path.join(SITE, "docs", "screenshots", f"title-{theme}.png")
    subprocess.run([tool("magick"), shot, "-trim", "+repage", "-resize", "1600x", "-strip", out], check=True)
    print(f"  title-{theme}.png {os.path.getsize(out) // 1024} KB")


def plates(summary: dict) -> list[str]:
    table = read(os.path.join(SITE, "src", "lib", "breeds.ts"))

    out = []
    for breed in [b["label"] for b in summary["city_top_breeds"][:PARADE]]:
        for key in (f'"{breed}": "', f'{breed}: "'):
            if key in table:
                out.append(table.split(key, 1)[1].split('"', 1)[0])
                break
        else:
            raise SystemExit(f"breeds.ts does not name {breed!r}")

    return out


def card(work: str) -> None:
    summary = json.loads(read(os.path.join(STATIC, "data", "summary.json")))

    slugs = plates(summary)
    for slug in slugs:
        shutil.copy(need(os.path.join(STATIC, "breeds", f"{slug}.webp")), work)
    fonts(work)

    parade = "".join(
        f'<img src="{slug}.webp" style="height:{132 if i % 2 == 0 else 116}px'
        f'{";transform:scaleX(-1)" if i % 3 == 1 else ""}">'
        for i, slug in enumerate(slugs)
    )

    html = f"""<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {{
    font-family: Slab;
    src: url(slab.woff2) format("woff2");
  }}
  @font-face {{
    font-family: Inter;
    src: url(inter.woff2) format("woff2");
    font-weight: 100 900;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    display: flex;
    flex-direction: column;
    width: {CARD[0]}px;
    height: {CARD[1]}px;
    overflow: hidden;
    background-color: {PAPER};
    background-image: {GRAIN};
    color: {INK};
    font-family: Inter, sans-serif;
    font-feature-settings: "kern" 1, "onum" 0, "liga" 0, "tnum" 1;
  }}
  /* The strap, the ring and the tag are one object and hang together off the top
     edge. Centering them with the poster tore the ring off the strap. */
  .collar {{ flex: none; }}
  /* The poster, centered in what the collar leaves. The 60px either side is the safe
     area every platform leaves uncropped, so nothing here can be trimmed by a feed. */
  main {{
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    padding: 0 60px 10px;
  }}
  /* Every length below is a measured page value times COLLAR, and every color is the
     oklch the page declares, because Chrome is drawing this and can read it. */
{COLLAR_CSS}
  h1 {{
    margin-top: 0;
    transform: rotate(-1.4deg);
    color: {PAPER};
    font-family: Slab;
    font-size: 112px;
    font-weight: 400;
    letter-spacing: -0.015em;
    line-height: 0.86;
    paint-order: stroke fill;
    text-align: center;
    text-shadow: 0.055em 0.06em 0 {BRAND};
    -webkit-text-stroke: 0.055em {INK};
  }}
  .row {{
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
    margin-top: 28px;
  }}
  .ground {{
    width: 820px;
    height: 7px;
    margin: 0 auto;
    border-radius: 50%;
    background: {BRAND};
    opacity: 0.85;
  }}
</style>
{collar(summary)}
<main>
<h1>EVERY DOG<br>IN NEW YORK</h1>
<div class="row">{parade}</div>
<div class="ground"></div>
</main>
"""
    page = os.path.join(work, "card.html")
    write(page, html)

    shot = os.path.join(work, "shot.png")
    shoot(page, shot, CARD)

    out = os.path.join(STATIC, "og.png")
    subprocess.run(
        [
            tool("magick"),
            shot,
            "-filter",
            "Lanczos",
            "-resize",
            f"{CARD[0]}x{CARD[1]}",
            "-strip",
            "-quality",
            "94",
            out,
        ],
        check=True,
    )
    print(f"  og.png {os.path.getsize(out) // 1024} KB")


def icons() -> None:
    mark = need(os.path.join(STATIC, "favicon.svg"))
    rsvg = tool("rsvg-convert")
    magick = tool("magick")

    # iOS and Android round and mask the tile themselves, so the icon ships square.
    square = read(mark).replace('rx="7"', 'rx="0"')

    with tempfile.TemporaryDirectory() as work:
        flat = os.path.join(work, "square.svg")
        write(flat, square)

        # Maskable icon: keep the mark inside the central 60% every Android launcher mask leaves uncropped.
        pulled = os.path.join(work, "pulled.svg")
        write(
            pulled,
            square.replace("<g fill=", '<g transform="translate(6.4 6.4) scale(0.6)"><g fill=', 1).replace(
                "</g>", "</g></g>", 1
            ),
        )

        for name, size, src in [
            ("apple-touch-icon.png", 180, flat),
            ("icon-192.png", 192, flat),
            ("icon-512.png", 512, flat),
            ("icon-maskable.png", 512, pulled),
        ]:
            out = os.path.join(STATIC, name)
            subprocess.run([rsvg, "-w", str(size), "-h", str(size), src, "-o", out], check=True)
            # iOS composites a transparent touch icon onto black, so alpha is flattened onto BRAND.
            subprocess.run(
                [
                    magick,
                    out,
                    "-background",
                    BRAND,
                    "-alpha",
                    "remove",
                    "-alpha",
                    "off",
                    "-strip",
                    f"PNG24:{out}",
                ],
                check=True,
            )
            print(f"  {name} {os.path.getsize(out) // 1024} KB")

        sizes = [os.path.join(work, f"{n}.png") for n in (16, 32, 48)]
        for size, png in zip((16, 32, 48), sizes, strict=True):
            subprocess.run([rsvg, "-w", str(size), "-h", str(size), mark, "-o", png], check=True)
        ico = os.path.join(STATIC, "favicon.ico")
        subprocess.run([magick, *sizes, "-strip", ico], check=True)
        print(f"  favicon.ico {os.path.getsize(ico) // 1024} KB")


def main() -> None:
    what = sys.argv[1:] or ["card", "icons", "banner"]
    if "card" in what:
        print("card")
        with tempfile.TemporaryDirectory() as work:
            card(work)
    if "icons" in what:
        print("icons")
        icons()
    if "banner" in what:
        print("banner")
        with tempfile.TemporaryDirectory() as work:
            for theme in THEMES:
                banner(work, theme)


if __name__ == "__main__":
    main()
