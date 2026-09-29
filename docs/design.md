# The design system

The rules come from reading the CSS The Pudding ships, applied to a map. Each one below carries the value that matters and the reason it exists.

## Principles

- **Copy, tilt, and specificity, not effects.** The Pudding's work is fun because a legend is written into a sentence, a callout names one place and one number, objects sit two degrees off square, and the pointer gets a quarter second of motion. There is no confetti, physics, or mascot.
- **Two materials.** Everything is stamped metal or ink on paper. No second illustration style.
- **Shape may be strange, text may not be hard to read.** No wobble filters on prose and no rotation past two degrees on anything holding a paragraph.

## Type

| Family                          | Job                                       |
| ------------------------------- | ----------------------------------------- |
| Serif, Source Serif 4           | Headlines and prose                       |
| Sans, Inter                     | Deks, tooltips, panels, methodology       |
| Mono                            | Metadata and UI chrome                    |
| Alfa Slab One (`--font-poster`) | `poster`, `showbill`, `slab`, and `shout` |

- Weights are 400 and 700 and nothing between. Emphasis comes from size and family.
- Uppercase only for small, tracked labels and for the slab faces (`poster`, `showbill`, and `shout`). Serif headlines are never uppercase.
- Tabular figures everywhere, so a number does not reflow when a tooltip updates.
- `poster` is the full showbill: paper fill, ink stroke, and an offset second pass in the accent. It needs about 24px before the stroke closes its own counters, so it is kept for big titles (the intro, the 404 page, the noscript page).
- `showbill` is the same offset without the outline, for reading sizes. It sets `EVERY DOG IN NEW YORK` at 15px under the tag, tilted 0.6 degrees.

## Color

Two namespaces that never cross. `--color-*` dresses the chrome: warm paper, ink, and one brand accent. Data colors live in the `CATEGORY` tables and `RAMP` in `layers.ts`, and a breed's color never decorates a button. Dark mode remaps tokens rather than adding `.dark` overrides in components.

## Motion

One duration token, which doubles as the reduced-motion switch:

```css
:root {
  --1s: 1ms;
}
@media (prefers-reduced-motion: no-preference) {
  :root {
    --1s: 1s;
  }
}
```

Every transition is a fraction of it. The default is 250ms, `calc(var(--1s) * 0.25)`. Hover moves things (`translateY(-4px)`, `scale(1.05)`, a rotation back to square) and leaves their color alone. Long cross-fades, around 2s, are only for explaining a change of mode. Only one element idles at a time, and only until the reader touches it. Nothing staggers in.

### The map moves in three places

MapLibre does not read the stylesheet, so the map has its own durations in `hood-layers.svelte` and `camera.ts`, and each checks `prefers-reduced-motion` directly.

| Motion | Timing                      | What it does                                                                                                                                                                              |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soak   | 220ms hold, then 1,100ms    | On a first visit the city sits framed under paper, and the color soaks through as the poster lifts. The camera does not move, because zooming under 300 placed labels makes them flicker. |
| Re-ink | 600ms                       | MapLibre cannot transition a data-driven `fill-color`, so a second fill layer holds the last paint and fades out over the new one. Filters use it too.                                    |
| Camera | 620ms re-frame, 520ms focus | Nothing else on the canvas animates by itself.                                                                                                                                            |

Resting on a legend row washes every other neighborhood back to paper at 62 percent, so the reader learns the colors by pointing.

## Geometry

- **Tilt.** Persistent objects rest at `--tilt-left: -2deg` or `--tilt-right: 2deg` and straighten under the pointer. It makes the interface read as objects a person placed.
- **Radii.** Structural edges are square and floating cards take 4px. Breed chips are 3px. Full rounding is kept for name chips and pills, where it means something.
- **One edge per surface.** Light mode gets the soft shadow, because the panels float over the map. Dark mode gets the hairline, because a shadow on near-black says nothing. Never both.
- **No decoration.** No gradients except a functional scrim, and no colored accent bars on card edges.
- **Hover never sticks on touch.** `app.css` defines the `hover` variant against a `data-pointer` attribute set from the live pointer type in `app.html`, because iPadOS reports `(hover: hover)` as none. Mobile moves chrome around and never deletes it.

## Words on the map

### The legend goes in the sentence

No keys. A breed or name in running prose is a chip tinted with its map color, so the reader learns the encoding by reading. A sentence is a list of parts built with the constructors in `sentence.ts`:

```ts
[
  chip("names", "Luna"),
  "is the most common dog name in New York, but not in the",
  place("Financial District"),
  ", where it is",
  chip("names", "Teddy"),
  ".",
];
```

The one rule is spacing: punctuation closes up against the word before it, and everything else takes a space.

Breeds and names share ten hues turned 180 degrees apart, so color alone cannot say which is which. Shape does:

|       | Shape       | Ink                                      |
| ----- | ----------- | ---------------------------------------- |
| Breed | square, 3px | filled at 24% of its map color, 1px edge |
| Name  | full round  | hollow, 1.5px edge                       |

A breed is inked solid and cut square like its plate. A name is round like the tag on a collar. The intro teaches the pair in one line: "Breeds get a box, like Maltese. Names get a ring, like Coco." A clickable chip gets no underline because its edge already marks it. A clickable `place` or `figure` gets a dotted rule.

### Say one specific thing

- **The label is the data.** Each neighborhood is labeled with what the layer shows, in the category's color, with the neighborhood name under it in small mono. Zoomed out, the answer reads across five boroughs before anything is touched.
- **Annotate the named specific, never the aggregate.** "Greenpoint keeps the Jindo at nearly three times the city's rate," not "Korean breeds are over-represented in northern Brooklyn."
- **Findings are places a reader can picture.** The intro uses Greenpoint, the Upper East Side, and the Financial District, and every named thing in a finding opens the map on itself.

### Narrate, then hand over the keys

The intro names three findings and one button opens the map. The city view then offers the walk: a hook, and a button in the reader's voice, `Walk me through it`. The walk is six stops in a narrator card that sits over New Jersey: the common-breed map, the distinctive map, names, dogs per home, the 311 line, and the license file. The map re-inks to match each stop, and paw prints jump between stops. The last card lists four things to try, and `Enough walking` puts the map back as it loaded.

Everything the walk names is computed at render time from templates with slots (`{{lab}}`) in `walk.ts`, so it stays true after a rebuild. Each breed it names is shown where it runs strongest, so the chip matches the fill beside it. Two stops carry a number the reader can drag, in Bret Victor's Tangle sense: the filter floor sits inside the sentence and the count of neighborhoods still lit updates with it. Arrow keys move it, and a screen reader gets a real slider. On a phone the sheet is put away for the walk and returns when it ends.

### Two popup grammars

- **Data popup:** tinted, fixed width, tailed, `pointer-events: none`. The map speaking.
- **Narrator popup:** paper, `fit-content`, heavier shadow. The site speaking. The walk card and the train ticket use it.

Never one component doing both. Everything that speaks gets a bubble with one square corner as the tail, pointing at the speaker.

### Seed the empty state

An empty search offers a few curated starting points, as The Pudding's name search does ("Not sure where to start?").

## The objects

### The collar and tag

The masthead is a leather strap with a split ring and a brass tag struck with the license rather than the site's name, at every size:

```
NEW YORK CITY
   96,459
DOG LICENSES · 2026
```

The license is the reason any of this can be counted. The intro hangs the same strap and tag across its top, and the site name sits under the tag in the poster face, so the front page and the masthead are one object. On a phone the strap is the grab bar of the bottom sheet.

### The button is the reader's line

`SHOW ME THE DOGS` is the one line the reader says, so it gets a speech bubble in ink, set in the poster face with the offset second pass. Hover lifts it a pixel and lengthens the shadow, and a press moves it four pixels into its own shadow. It is `@utility shout`, so the 404 page's `BACK TO THE MAP` is the same object.

### The breed plates

The plates come from the Pearson Scott Foresman archive: 73 public-domain line drawings on Wikimedia Commons, plus 125 drawn to match (see below). `pipeline/fetch_breeds.py` removes the paper and keeps the ink as alpha, and `breeds.ts` maps each license breed to a plate. One asset set does every job a swatch would:

| Where          | What it does                                                  |
| -------------- | ------------------------------------------------------------- |
| The map        | The local breed stands on its neighborhood, over the readouts |
| The legend     | Each category is a dog standing on its color                  |
| The panel head | The neighborhood's own dog on a ground line in its map color  |
| The tooltip    | The dog leans over the top edge of its bubble                 |
| The bar lists  | A portrait per breed row                                      |
| The search box | A portrait per breed result                                   |
| The intro      | Seven breeds in the order the city keeps them, on one ground  |

`plate-icon.ts` tints each plate for the theme at runtime and hands MapLibre an `ImageData` through `setMissingStyleImageResolver`, so only breeds that win a neighborhood are fetched.

Every plate needs paper behind it on a saturated fill, and the halo is a **hard dilation**, not a glow: the ink is stamped round a ring 4.8 plate pixels wide (`RING` in `plate-icon.ts`), flooded with paper, and inked again on top. A soft glow bleeds into outline plates and fills the dog with cream. The ring is measured in plate pixels so it scales with the dog, and plates in the DOM get the same cut in CSS.

### The rest of the kit

- **The rosette.** A prize ribbon with text on a slowly turning path, top right on wide screens. It opens the About card.
- **The torn edge.** The rail ends in a deckle mask (`deckle-r`), and the map runs under it.
- **The speech bubble.** The tooltip is an animal talking, so it is a bubble with a square-corner tail.
- **A ground line, never a box.** Wherever a dog appears it stands on a flat ellipse in the color the map painted. That is the swatch.

## The NYC layer

Three things make the map read as New York, in the order a New Yorker notices them:

1. **The subway in the MTA's own colors.** Nobody needs a legend for a red 1.
2. **Street names at walking zoom.** Without them a choropleth is a diagram.
3. **Paw prints by density.** One per 75 licensed dogs (`DOGS_PER_GLYPH` in `build_data.py`), scattered inside their own neighborhood from zoom 9.

**The shore draws last.** Positron puts water at the bottom, where the choropleth would cover the Reservoir and the Gowanus. `map-style.ts` lifts the shore out and sets it directly under the roads, above the color and the parks. It holds water and waterways, beaches (filtered on `subclass: beach`, since the `sand` class also covers ball fields), and piers on top of the water. The park mask also sits under the roads, so Central Park's drives show through. The water in dark mode is a step lighter than the park green so the two separate when stacked.

## The neighborhood panel

### The lists read twice

Every breed and name row carries both readings:

- **The bar is the count**, scaled against the fullest list. It does not rescale when the sort changes.
- **The mark on the right is the comparison:** a hairline, a notch at the citywide rate, and a dot for this neighborhood. The scale is logarithmic from a third to three times, clamped at the ends (`rate.ts`), so half and double sit the same distance out.
- **The heading is the sort.** `common · distinctive` beside the title.

The pipeline computes each row's `lift` in `details.json`, with the same function that picks the breed the map paints, so the panel and the map always agree.

Above the lists, one sentence per facet says who wins. When the most common breed is also the most distinctive, it says so once instead of printing the same chip twice.

### Every number is a door

A row colors the map by that breed's rate, and so does a chip in a sentence. A legend row keeps only the neighborhoods that category wins. The one row that cannot click is a name with no column to paint from, and it is disabled rather than graying out the city.

### The ledger

The card's figures are one line each, set as a sentence fragment rather than a labeled field (`661 dogs to the square mile`, `2.6 dogs per 100 homes`, `6.6 years old, the average dog`), with the city's figure at the end. Under each runs a word-sized strip ranking all 197 neighborhoods, with a notch for the city and a dot for this one, the same reading as the breed rows. Pressing a line keeps every neighborhood at or above the dot. The raw count stays a sentence above the ledger, next to the people and homes it is measured against.

- **Per home is the flagship.** Dogs belong to households, and raw counts mostly follow population.
- **Per person stays because it disagrees.** The West Village ranks 4th per person but 18th per home, which is a fact about household size.
- **A field with no signal does not ship.** Renter-occupied units correlate at -0.13 with dogs per home, so the column was removed before anyone could read a story into it.

### The city view leads with a finding

Above the legend, one sentence names the leader, the runner-up, and the borough holding most of the runner-up when one does. It counts only what is lit, keeps the rate citywide, and drops the borough clause when one borough is all that is left.

## The view picker

The map's heading is the control, and it shows every option instead of hiding them behind a caret:

```
Breeds   Names   Dogs
most common · most distinctive
The breed with the most dogs here.
```

`Dogs` swaps the second row for `how many · how packed · per home · per person · on 311`. The chosen question survives a change of subject, so distinctive breeds go to distinctive names. The third line is the gloss for the current choice.

## The controls

One piece of paper in the bottom corner, 4px cells divided by hairlines, with the floating shadow. Zoom out grays at the zoom where there is no more city to show. The last cell, "Show the whole city," carries a Labrador plate instead of a fourth arrow. Day and night is the top cell, because on this map it changes the map itself (the basemap is refetched in the other ink), and it is visible in both layouts. The sun and moon are drawn in the card's ink at the same 1.5px weight as the plus and minus.

The colophon signs the work with the dog source, the basemap license, and links to the About and maker cards. It is not a credits list. The full sources live in the About card.

## What we refuse

- **Micro-labels.** A 10px uppercase caption over a value is the loudest tell of a generated interface. Write the sentence instead: "2,151 dogs, give or take."
- **A flat type scale.** The hero figure is `clamp(1.9rem, 3.4vw, 2.6rem)` against 13.5px body.
- **A weight ramp, large radii on containers, big ambient shadows on flat UI, and decorative gradients.**
- **Color-change hovers.** No `hover:bg-muted`, no `scale(1.02)`, and no shadow upgrade. Opacity and color of ink, or nothing.
- **Staggered entrances.**
- **An icon library as the visual system.**
- **"Explore the data" as the opening move**, hedged institutional voice, and aggregate-only annotation.

## The loading screen

`chrome/loader.svelte` is a block of the city passing behind a walking dog, in paper and ink.

| Track    | Speed        | Drawn as                                      |
| -------- | ------------ | --------------------------------------------- |
| Skyline  | 0.22 × pace  | a flat tone at 16%, masked by a silhouette    |
| Street   | 1 × pace     | a stroked line at 45%, one pen width          |
| Pavement | 1 × pace     | slab joints and paw prints masked from a tone |
| The dog  | stands still | an archive plate at full ink                  |

The stroke ramp creates the depth and keeps the dog the only solid thing in the frame. Every track is one tile translated by its own width with one keyframe, `drift-x`, reading `--tile`, so the loop has no seam at any screen width. All motion takes its duration from one pace, so nothing drifts out of step.

The walk is rolled once on the reader's machine after mount: one of five skylines in `skyline.ts`, one of fourteen common breeds, six slots of street furniture, and a pace of 46 to 64 pixels a second. A roll during prerender would be baked into the page for every reader.

The bar has two real stages, **Unrolling the basemap** and **Inking 197 neighborhoods**, and never runs ahead of the work. There is no percentage. If the basemap fails, the walk stops and the dog stands under the reason. Under reduced motion the block is a still drawing.

## Service on the dog line

Past zoom 12.6 (`RIDE_ZOOM` in `trains.svelte`), dogs ride the trains. It is an easter egg, so it never asks for attention, and everything in it is real.

### The system

`trains.ts` turns the MTA's arcs into services:

- **Terminals** are leaves with a station on them. A leaf with no platform is a yard lead.
- **Every run starts at the trunk end.** Two leaves off one junction are alternatives, never two ends of one trip, which gives the A its three real patterns.
- **A run that ends partway along a longer one** is the same ride cut short, tested by geometry because a short turn comes back on the other rail.
- **Stops** come from each station's route list, so the 4 runs express and the 6 stops at 23 St.

**Every rollsign names a station the map draws.** Commuter lines are cut at the city line and trimmed to the outermost New York platform. PATH and three New Jersey Transit lines run to their terminals across the river. Amtrak signs its far terminal (`FAR_SIGN` in `rail.ts`).

### The cars

A railroad is recognizable by the order of its horizontal bands, so each car is a stack of bands.

- **Subway, R-series.** Painted roof, black window band with the route bullet in a front sign box, route stripe, corrugated stainless. Silver in both themes.
- **LIRR, M9.** Stainless to the roof, a black cab end with a yellow stripe, blue and gold under the windows.
- **Metro-North, M7A.** The same Kawasaki shell with a blue nose and white stripes, and a stripe in the line's own color.
- **PATH, PA5.** Fifty-one feet instead of sixty, three doors a side, the destination on an LED strip above the windows.
- **NJ Transit, Multilevel.** Tall, with a deep upper row of windows over a blue belt rail. Each line keeps its drawn symbol in the bullet, and the Montclair-Boonton Line's is a goldfinch, which also rides on the roof.
- **Amtrak, Amfleet.** A stainless tube with small, high, widely spaced windows and a navy stripe.

Each railroad has its own list of delay messages in `rail.ts`, and Montclair has its own list while a train stands there.

### The passenger

A dog boards from the neighborhood around the platform, carrying its winning breed and a name common there, and rides three to seven stops. It keeps its black ink in both themes so it never reads as a neighborhood plate. Clicking a train makes the map follow it with its ticket open: name, breed, line, where it boarded, the next stop, and where it gets off. The name, breed, and neighborhood on the ticket are links. Dragging the map ends the ride, which hangs on `drag` rather than `dragstart`, because MapLibre raises `dragstart` on mouse-down.

### Rules the layer obeys

- **Cards take no pointer events**, so the map keeps its scroll and drag. `carUnder()` in `fleet.svelte.ts` does the hit test.
- **Nothing boards behind the chrome.** The stage is the canvas minus the camera padding.
- **Trains are parked, never scrapped.** The roster survives zooming out, capped at 24 (`STABLED`), and the oldest unwatched train gives up its slot.
- **Screen speed, not ground speed**, so trains look the same at every zoom.
- **Signs never stack.** Where tracks converge, the upper train rides up.
- **A service already on screen goes to the back of the queue**, so the view mixes railroads.
- **Reduced motion parks them** at their platforms with readable signs.

## Drawing the breeds the archive never had

The archive does not have many of the breeds in the license file, including the Shiba Inu and every doodle. `pipeline/draw_breed.py` draws them with Gemini 3 Pro Image and files each one in `static/data/breed-art.json` with its breed, model, and ink.

- **Why Gemini.** It reads its six reference images as a style corpus, and it leaves clean paper. The cut-out maps luminance to alpha, so any faint wash on the paper comes back as a smear around the dog.
- **References.** Six archive plates chosen to bound the style rather than resemble the target: wire coat with solid markings, long feathered coat, dense working hatch, toy long-hair, flat face, and short-coat stipple.
- **1K output** (`SIZE`), because the plate serves at about 220px and the archive scans run 500 to 2600px. Hatching drawn at 4K averages into gray.
- **The prompt says it is a flat scan of a printed page**, or the model returns a photograph of paper.
- **The cut-out is imported.** `draw_breed.py` imports `cut_out` from `fetch_breeds.py`, so a drawn plate goes through exactly the steps a scan does.

Three gates, measured off the archive, reject a drawing and send the reason back to the model, up to three times:

| Gate  | Constant | Range         | Why                                                                          |
| ----- | -------- | ------------- | ---------------------------------------------------------------------------- |
| Paper | `PAPER`  | 250 of 255    | Toned paper pushes light hatching lighter and thins the pen                  |
| Ink   | `INK`    | 0.095 to 0.40 | Mean alpha over the trimmed box. The floor is the archive's tenth percentile |
| Shape | `SHAPES` | 0.62 to 1.90  | The archive runs 0.70 to 1.75                                                |

Ink is the number that matters, because the map shows through whatever the ink leaves open:

| Plate                | Ink   |
| -------------------- | ----- |
| chihuahua2           | 0.051 |
| vizsla               | 0.061 |
| the archive's median | 0.166 |
| schipperke           | 0.379 |

An outline plate far below the median does not sit on a green neighborhood, it turns green. Run against the archive's own plates, the ink gate rejects exactly the thin ones.

## Two parks, two mornings

Past zoom 12.9 (`SHOW_ZOOM` in `park-notice.svelte`), a brass tag drops onto Central Park and Prospect Park with one line of paper: a game is on here. Tapping it opens the notice, a tag struck with the off-leash hours and a card with the game's name and one button in the reader's voice. It folds back into a small tag that stays on the park, and the choice lasts for the session. `?play=central` and `?play=prospect` open a game directly, and the share card links there.

The hours are the city's real off-leash hours, `6 to 9 am` and `9 pm to 1 am` (`off-leash.ts`), and the site's day or night decides which one runs. At night the games run under stars with the lampposts on. The clock is an analog dial with the deadline hour in the brand color.

### How a morning is set

By default a game plays today's morning, seeded from the date and the park, so everyone who plays on a given day gets the same conditions. "Any morning" rolls a fresh one. Each park has five ranks in `parks.ts`, with Best in show at 1,600 in Central Park and 1,500 in Prospect Park, and a set of collar tags to earn. The conditions (`CONDITIONS` in `parks.ts`) sharpen one hazard for the day and appear on the start card, the banner, and the share card. The streak, best scores, tags, and chosen dog live in `localStorage` (`kennel.svelte.ts`).

### The two games

- **Eight Leashes, Central Park.** A dog walker up the East Drive, steering with one thumb. Every dog is a real breed with a name from nearby, with a rough temperament: Beagles and Dachshunds drag toward food, terriers and the Pit Bull lunge at squirrels, the Shepherd pulls, and small dogs stop at hydrants. A tree or lamppost between the walker and a dog hooks the leash, and a stretched leash snaps. A loose dog has six seconds. Walking past a client adds a dog and raises the score per second. The whistle, on an eight-second cooldown, pulls the pack tight. The tuning lives in `game/walker.ts`.
- **The Long Meadow dash, Prospect Park.** A three-lane runner down the full meadow to Dog Beach. Low hazards are jumped, a frisbee is run under, and strollers, carts, joggers, and Citi Bikes must be stepped around. Speed floors rise by zone (23, 26, and 29, capped at 38, in `game/dash.ts`). Tennis balls add speed, and bones, bagels, cans of balls, and squeaky toys are power-ups. Seconds left at the water add points.

Both are one canvas drawn as a paper diorama. The ground is filled in bands anchored to world distance and follows an elevation profile, trees are cutouts on sticks, and the dogs are their own plates. Shadows fall long to the west because the sun is low in the east. There is no lighting model, gradient, or haze. The landmarks are real and in order along each route.

### The shell

A full-screen paper dialog. Escape pauses during play and closes after, and the game pauses when the tab is hidden. The start card is a printed notice: title, brief, the fourteen breeds on one ground line, the rules as prose, and choices in the picker's two-word grammar (`Today's morning · Any morning`, `Full speed · Half speed`). The end card sets the score as a hero figure with the rank beside it, the earned tags hanging from a collar strap, and one paragraph of what happened. During play the score sits top right, a short feed in 13px slab lists recent events, and a status region reads the feed to screen readers. The share card is a 1200 by 630 canvas sent through the Web Share API on a phone and the clipboard on a desktop.

The games are the one place with sound. The chrome stays silent. The games synthesize theirs with the Web Audio API (`game/sound.svelte.ts`), with a mute that is remembered.
