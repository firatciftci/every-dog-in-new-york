# Contributing

Thanks for looking under the hood. This is a one-person project, so the fastest way to help is to be specific: which neighborhood, which number, which screen, which browser.

## Reporting a number that looks wrong

Every neighborhood figure on the map is an estimate, because a dog license carries a ZIP code and nothing finer. Before opening an issue about a figure:

1. Open that neighborhood's panel on [everydog.nyc](https://everydog.nyc). It lists the ZIPs behind the number and the share each one contributed.
2. Read [docs/method.md](docs/method.md), in particular the section on the fitted split and what it cannot fix. A neighborhood that licenses few dogs and one that keeps few dogs look the same in this file.
3. If it still looks wrong, open an issue with the neighborhood, the layer, the figure you see, and what you expected. A ZIP that sits at least 90% inside one neighborhood is the best kind of evidence, since it measures that neighborhood directly.

Bugs in the app itself need the usual: browser, device, what you did, what happened, and a screenshot if it is visual. Light or dark theme matters here, since the two themes do not share one set of edges and shadows.

## Setting up

The app:

```
pnpm install
pnpm dev            # http://localhost:3010
```

The data pipeline, only if you are touching the numbers:

```
cd pipeline
uv sync
.venv/bin/python step0_neighborhoods.py
.venv/bin/python build_data.py
```

Every script downloads its own inputs into `pipeline/data/` on first run. The README has the full order and what each script needs on PATH.

## Before you push

```
pnpm ci             # svelte-check, oxfmt, eslint
```

and, if you changed Python:

```
cd pipeline && .venv/bin/ruff format . && .venv/bin/ruff check . && .venv/bin/ty check .
```

Both must pass. Cloudflare runs `pnpm ci` before every deploy, so a pull request that fails it cannot ship.

## Conventions

- Svelte 5 with runes. TypeScript everywhere, no `any`. `Array<T>` over `T[]`.
- Formatting is oxfmt's business, and lint is eslint's. Do not hand-format.
- American English in code, comments, and copy: color, gray, license, neighborhood.
- Comments explain what the code cannot say on its own. A comment that restates the line below it gets deleted in review.
- No new dependency for something a few lines can do. No server, no analytics, no tracking. The site is static files and stays that way.
- Do not commit anything under `pipeline/out/` or `pipeline/data/`. Those are rebuilt.
- `static/data/*` and `static/og.png` are pipeline outputs. Change the pipeline, rerun it, and commit what it wrote, rather than editing those files by hand.

## Copy and design

The words on the site follow rules written up in [docs/design.md](docs/design.md): the legend goes in the sentence, the label is the data, one place and one number rather than an aggregate. A pull request that adds interface copy should read as one sentence a New Yorker would say, and it should hold up in both themes and on a phone.

New visual elements are either stamped metal or ink on paper. That is the whole palette of materials, and it is the reason the map looks like one thing.

## Data

The city republishes the license file once a year. Refreshing the map for a new extract means running the pipeline scripts in order and checking that the counts on the share card, in `summary.json`, and in the intro agree, since all three come from the same file. If a new extract names a breed the archive has no plate for, `draw_breed.py` draws one to match, and `docs/design.md` explains the gates it must pass.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind, be specific, and remember that somebody's dog is in here.
