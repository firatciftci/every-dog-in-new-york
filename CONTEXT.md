# The words this codebase uses

Names for the things the site is made of. A module named after one of these should behave the way the entry says.

## The data

**Neighborhood.** One of the city's 197 populated 2020 Neighborhood Tabulation Areas. Identified by `slug` everywhere in the app. `HoodProperties` carries its counts, its rates, and its four winner columns.

**The matrix.** `matrix.json`: one column per breed and per name, one row per neighborhood, aligned by index with `matrix.slugs`. It holds the top 347 breeds and the top 305 names, so the breed columns sum to every dog with a breed on file and the name columns do not sum to every named dog.

**Facet.** Either `breeds` or `names`. `FACET_FIELDS` in `types.ts` is the one place a facet says which neighborhood columns belong to it: its leader, its share, its standout, and its lift. Nothing else spells that pairing out.

**Lift.** How far a breed or a name runs above its citywide rate here, smoothed by a prior. `liftOf` in `rate.ts` is the only spelling of the formula, and it takes counts rather than free numbers so no caller can pick its own denominator. `FACET_DENOMINATOR` names the population each facet divides by, and it has to match `lifts()` in `build_data.py`.

## The map

**Reading.** One entry in `LAYERS` (`layers.ts`), which carries its own paint, caption, and readout. A reading is either categorical (a breed or a name per neighborhood) or sequential (a number per neighborhood).

**View.** What the reader asked for: a reading, a focus on one breed or name, or a bout between rivals. `resolveView` turns the URL and the filters into one.

**Painted.** What `cut()` returns: every neighborhood with a fill, a value label, and a `dim` flag, plus the legend, the caption, and the rank function. `marks` is all of them and `standing` is the ones the filters kept, sorted by the reading. The layer and the filters are orthogonal: filters gray a neighborhood and never touch the color scale.

**Label rank.** The order the map hands out neighborhood names, set by `labelOrder` in `data.ts`. Each turn takes the neighborhood with the most dogs that also stands furthest from every name already given out, and distance stops counting past three miles, so the head of the list covers all five boroughs instead of crowding into Manhattan. `label-layers.svelte` reads it twice: as the cut for how many names a zoom can afford, and as the `symbol-sort-key` MapLibre settles collisions by. Below that zoom the map writes the five borough words instead, because a neighborhood name there is wider than the shape it belongs to.

**The world.** `worldOf(data, sank)` in `world.ts`: every set the map draws, with the sunk borough taken out of all of them at once. The page holds no geography, and the map takes the world as one prop.

**Slot.** Where an added layer sits in the basemap's stack. `map-style.ts` resolves the basemap's own ids once into `slots.underWater` and `slots.overWater`, so no child picks between two anchor strings.

**The live map.** `live` in `map/index.svelte`: the MapLibre instance, non-null only after `onload`. svelte-maplibre binds the instance earlier than that, so `live` is the only safe handle and every reader takes it.

## The panels

**The walk.** The stepped tour of the city view. `buildStops` computes its prose from the live data, and `Doors` is what a pressed word does: go to a place, show a subject, narrow the map, or open the method.

**Part.** A piece of a sentence: plain prose, a chip, a place, a figure, or a dial. Prose stays a string and a breed stays an object until it is drawn, so the legend can live inside the sentence.

**Bout.** A comparison of two to five rivals, each a neighborhood, a borough, a breed, or a name. `ledgers` builds one column of figures per rival and resolves a hood rival's name against the whole city, never against the filtered set.

## The parks

**The arena.** The canvas the two mini-games draw on. It owns the frame loop, the input, and the HUD, and hands each game the shared camera.

**The off-leash window.** `offLeash(park, isNight)`: the park's own start minute, the run it implies, and every way of saying the time. Play always ends on the hour, so the start is the only number in the park table and the run length is derived from it. Every reader of the clock asks this, and nothing else divides by two or names an hour.

**Conditions.** The one thing that makes today's run different, rolled from the daily seed.

**The kennel.** One holder of what a player has done: bests, tags, plays, streak, and the dog they picked. The arena and the park notice read the same book.

**The crew.** `crew(riders)` in `trains.ts`: the rules a subway car runs by, including dwell, delay, terminal reversal, and which dog boards where. Nothing in it projects a coordinate, so a reversal can be checked with no map. `trains.svelte` holds the projection and the DOM.

## The chrome

**The draw set.** `draw` in `map/draw.svelte.ts`: the five things the map can add on top of the choropleth. Read only inside the map.

**Overlay.** Anything that covers the map and answers Escape. One entry in `#overlays` (`state.svelte.ts`) is all a new one needs.

**Rest.** Where the mobile sheet settles: shut, peek, or full. `explorer.sheet` is read-only from outside, and every rest goes through `restSheet` or `holdSheet` so a pending timer cannot re-raise the sheet.
