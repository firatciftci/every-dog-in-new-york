# Notes for the next person

Things that are easy to break and hard to see.

## The split

- **No fallback rate.** A fitted dogs-per-home rate runs 0.02 to 0.06, so no default is safe. `split_weights()` asserts on a neighborhood with no census row instead of falling back, and anything new there should too.
- **`zip_hood_weights.json` stays a count of homes.** The pipeline publishes it and sums it into `summary.residential_units`. `split_weights()` applies the fitted rate on top and never writes it back.
- **`split()` divides by `sum(w.values())`.** That rakes fitted weights back to each ZIP's own total, which is why the model cannot change a ZIP's dog count. Keep it.
- **Lifts come from `liftOf()` in `rate.ts`, and it has to match `build_data.py` twice.** `PRIOR` must equal `NAME_PRIOR` and `BREED_PRIOR`, and the denominator must be the dogs that carry the facet, not every dog. `FACET_DENOMINATOR` names that population, and `compare.test.ts` fails if the two drift by more than the 0.05 the matrix rounding allows.
- **Pass the population you mean.** `painted.marks` is all 197 neighborhoods, and `painted.standing` is the ones the filters kept. Resolve a rival neighborhood against the whole city, never against `standing`, or a filtered rival shows its slug as its heading and reads 0.

## The camera

- **Never move the camera from a tracked `$effect`.** `fitBounds` fires `moveend` synchronously, and svelte-maplibre reads and writes its own `bounds` in one statement, so inside a reaction the read becomes a dependency and the write re-runs it. Every camera effect is a `watch` from `runed`, which runs its body untracked.
- **Do not pass svelte-maplibre a `bounds` prop.** It writes the observed bounds back on every `moveend` and re-eases from them, so two camera writers never settle. `Camera` owns framing from `onload`. `maxBounds` is one-way and computed once with `untrack`.
- **Never fit the city and ease into a neighborhood together.** With a neighborhood selected, as on a link with `?at=`, `fit()` skips the city fit and only sets the zoom floor.
- **Keep the padding constant per breakpoint.** Deriving it from the live sheet height would move the camera on every frame of a drag.
- **`live` in `map/index.svelte` is the only safe handle on MapLibre.** svelte-maplibre binds the instance before `onload`, so a reader that checks the instance alone runs against a map with no style.

## The map

- **Colors handed to MapLibre are hex.** It cannot parse `oklch()`. The CSS keeps oklch.
- **Adding a layer is one entry in `LAYERS` in `layers.ts`.** Each carries its own `readout`, plus a `key` if categorical or a `read` if sequential. There is no switch to update.
- **Layer and filters are orthogonal.** `cut()` colors every area from the view, then grays and stamps `dim` on the ones the filters exclude, so filters never touch the color scale and the legend stays honest. `cut()` owns the match set and the tally the legend counts against, so pages hand it filters, not cuts.
- **The cross-fade compares `painted.signature`, not the painted object.** `cut()` returns a fresh object every call, so an identity check would fade on every unrelated change. It leaves the theme out, which has its own cross-fade in `index.svelte`.
- **Draw order goes through `slots`.** `map-style.ts` resolves the basemap's ids once into `underWater` and `overWater`, and a new layer names the slot it wants. Labels, plates, and the sink layer order themselves by mount position, because MapLibre places symbols from the top layer down.
- **Parks ignore the pointer through svelte-maplibre.** `parks-fill` stays interactive so it joins the topmost-event tracker, and `hoods-fill` carries `eventsIfTopMost`. Do not bring back a manual `queryRenderedFeatures` on mousemove.
- **Sinking a borough happens only in `worldOf()` in `world.ts`.** It returns every set the map draws, so no dataset can forget Staten Island. It sits behind one `$derived` on the boolean, for the same reason as the query fields below.

## State

- **Each query field is its own `$derived`.** One derived holding the whole query returns a fresh object on any change, which tells the legend, the camera, and the view label that everything moved. `focus`, `filters`, and `rivals` are built objects, so each is gated behind a `$derived` of the raw string it comes from. New fields need the same treatment.
- **`explorer.view` decides whether a search overrides the layer buttons.** Read it instead of testing `focus != null`.
- **Adding an overlay is one entry in `#overlays` in `state.svelte.ts`.** Escape and `explorer.dialogUp` both read that list. Do not hand-roll the check.
- **A component that reads a filter from the URL must survive it disappearing.** `useSearchParams` syncs from inside an effect, so after a history move a child's `$derived` can run once more with a prop the parent no longer renders. `range-editor.svelte` takes a nullable filter for that frame.

## Touch, scroll, and pointer

- **Decide who owns a touch on the first move, and never revisit it.** A `touchmove` is only cancellable before scrolling starts, and re-deciding mid-gesture makes the sheet and a list fight over the finger.
- **That listener is non-passive and attached by hand.** Svelte delegates `touchmove` to the root, where it is passive and cannot stop a scroll.
- **Never use Tailwind's `truncate` inside a scroller.** Its `overflow: hidden` makes each clipped label a scroll container, Chrome latches the wheel to it, and the list stops moving. Use `truncate-clip` from `app.css`, and `overflow-clip` for any decorative clip.
- **Rows in a scroller need `select-none`**, or a drag that starts on text selects instead of scrolling. The sheet's scroller sets `touch-pan-y` so the browser does not hold the gesture back waiting for a tap.
- **Floating panel columns must not scroll.** A scroll container clips the panels' drop shadow, so the lists inside carry the scroll.
- **Edge fades come from `scrollEdges()` in `scroll.ts`**, through `scroll-fade-y` and `scroll-fade-x`. A fixed mask dims the last row of a list that never scrolls.
- **Draw tally gaps as a transparent right border.** A real grid gap belongs to no mark, and the readout flickers as the pointer crosses it. Set fills with `background-color` and `background-image`, since the `background` shorthand resets `background-clip` and paints over the gap.
- **The tally readout holds for 160ms before letting go.** That carries the pointer across the gap between rows. Never clearing is the opposite bug.
- **The suggestion list measures the room under the box every frame.** A `dvh` fraction is wrong because the sheet may still be sliding when the box gets focus.
- **Chrome renders a `<button>` as `inline-block` whatever its `display`.** A clause inside running prose cannot wrap, so keep its punctuation inside the button or the comma lands alone on the next line.
- **A range slider only stops on `min + n * step`.** `range-editor.svelte` snaps its domain to those stops, or the top handle never reaches the maximum.

## Games and trains

- **`PARKS` carries only the start minute.** Play always ends on the hour, and `offLeash()` derives the run from it. Every clock reader asks that module.
- **`Gauges` and `NO_GAUGES` in `game/run.ts` are load-bearing.** The HUD is one flat record compared by `JSON.stringify` every frame, so both games report the same shape. Do not add a shared `Game` interface, because every input path needs the concrete game.
- **Train rules live in `trains.ts` and drawing lives in `trains.svelte`.** `crew(riders)` handles dwell, delay, terminal reversal, and boarding without touching the map, so `trains.test.ts` can run a car to the end of the line.

## Time

- **Never compare totals across the yearly files.** The city built them in different ways (`docs/method.md`, "Over time"), so every time figure is a share or a birth-year comparison inside one file.
- **The time layers live on the neighborhood properties.** `timed()` in `stories.ts` merges `stories.json` into each hood at load, so the layers, filters, and ledger read `share_change` and `class_2020` like any other field.
- **Breed lines use only labels on the 2016 form.** `FAMILIES` and `trends.json` skip labels the city added later, or a new label would look like a rising breed.

## Your dog

- **`pet.dogs` is a list, and `pet.dog` is the open card's dog.** `read()` also accepts the first build's single object, so an old save still loads.
- **A reader's car is `mine`.** It is never culled off the stage or handed a new rider, its legs are `Infinity`, and `explorer.ride.id` names the dog aboard.
- **Train ids start above the parked fleet.** The fleet outlives `trains.svelte`, so `minted` is seeded from the highest id. Starting at 0 after a remount duplicates keys and crashes the page.

## Tooling

- **Write number literals in decimal.** oxfmt lowercases hex digits and `unicorn/number-literal-case` uppercases them, so `lint:fix` and `format:fix` undo each other.
- **Avoid `Array.from({ length: n }, () => 0)`.** The `unicorn/no-array-from-fill` fixer rewrites it into a form it then flags, so `lint:fix` never converges.
- **`quantileOf` in `query.ts` takes values and a fraction, and the caller filters.** The map's shades drop zeros and the histogram keeps them.
- **Tests are two Vitest projects.** `rules` runs `*.test.ts` in node, and `browser` runs `*.svelte.test.ts` in Chromium. Anything that needs a mounted map or a canvas has no test, on purpose.
