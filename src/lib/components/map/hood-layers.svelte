<script lang="ts" module>
  // Under the 2s the design system allows for a mode cross-fade; the view picker is pressed all afternoon.
  const REINK = 600;

  // The soak waits out the poster's 260ms fade, so the reader sees the paper city before the color comes.
  const SOAK = 1100;
  const HOLD = 220;

  const FULL = 0.86;
</script>

<script lang="ts">
  import type { ExpressionSpecification } from "maplibre-gl";
  import { untrack } from "svelte";
  import {
    FillLayer,
    GeoJSON,
    getMapContext,
    hoverStateFilter,
    LineLayer,
  } from "svelte-maplibre";
  import { MediaQuery } from "svelte/reactivity";
  import type { Ink, Slots } from "#lib/map-style.js";
  import type {
    OnHover,
    PaintedCollection,
    PaintedProperties,
  } from "#lib/types.js";
  import { explorer } from "#lib/state.svelte.js";
  import { SUNK_BOROUGH } from "#lib/world.js";
  import { carUnder } from "./fleet.svelte";

  let {
    data,
    signature,
    ink,
    slots,
    selectedFilter,
    pointingFilter,
    zoneFilter,
    pointer,
    onhover,
  }: {
    data: PaintedCollection;
    signature: string;
    ink: Ink;
    slots: Slots;
    selectedFilter: ExpressionSpecification;
    pointingFilter: ExpressionSpecification;
    zoneFilter: ExpressionSpecification;
    pointer: boolean;
    onhover: OnHover;
  } = $props();

  const ctx = getMapContext();

  // Painted at full first and thrown to zero next frame: MapLibre cannot transition from an initial value.
  let glossy = $state(false);
  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  // fill-color is data-driven, so MapLibre cannot transition it. A copy of the last paint fades out over the new one.
  let ghost = $state.raw(untrack(() => data));
  // Keyed on what the paint was built from: paint() returns a fresh object every call, so identity never matches.
  let inked = untrack(() => signature);
  let veil = $state<"off" | "hold" | "fade">("off");

  $effect(() => {
    const next = data;
    const mark = signature;
    const map = ctx.map;
    if (mark === inked) {
      return;
    }

    inked = mark;

    if (calm.current || map == null) {
      ghost = next;
      veil = "off";

      return;
    }

    // Back to full even mid-fade: the ghost still holds the last paint that settled, so it is the one to fade.
    veil = "hold";

    // A paint transition interpolates from the value MapLibre last drew, so the hold has to reach the screen first.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      veil = "fade";
      settle = setTimeout(() => {
        ghost = next;
        veil = "off";
      }, REINK + 50);
    };

    map.once("render", start);

    return () => {
      map.off("render", start);
      clearTimeout(settle);
    };
  });

  // The color soaks into the paper as the intro lifts; the veil is paper over the fills until then.
  let veiled = $state(untrack(() => explorer.intro));
  let lifting = $state(false);

  $effect(() => {
    if (explorer.intro || !veiled) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      lifting = true;
    });
    const gone = setTimeout(
      () => {
        veiled = false;
      },
      calm.current ? 0 : HOLD + SOAK + 50,
    );

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(gone);
    };
  });

  $effect(() => {
    if (!explorer.dripping) {
      glossy = false;

      return;
    }

    const frame = requestAnimationFrame(() => {
      glossy = true;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  });
</script>

<GeoJSON id="hoods" {data} promoteId="slug">
  <FillLayer
    id="hoods-fill"
    beforeId={slots.underWater}
    manageHoverState
    eventsIfTopMost
    hoverCursor="pointer"
    paint={{
      "fill-color": ["get", "fill"],
      "fill-opacity": hoverStateFilter(FULL, 0.7),
    }}
    onmousemove={(e) => {
      if (!pointer) {
        return;
      }

      if (carUnder(e.event.point) != null) {
        onhover(null, null);

        return;
      }

      const props = e.features[0]?.properties as PaintedProperties | undefined;
      onhover(props?.slug ?? null, { x: e.event.point.x, y: e.event.point.y });
    }}
    onmouseleave={() => {
      onhover(null, null);
    }}
    onclick={(e) => {
      if (carUnder(e.event.point) != null) {
        return;
      }

      const slug = (e.features[0]?.properties as PaintedProperties | undefined)
        ?.slug;
      if (slug != null) {
        explorer.select(slug);
      }
    }}
  />

  <LineLayer
    id="hoods-line"
    beforeId={slots.overWater}
    interactive={false}
    paint={{
      "line-color": ink.hoodLine,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9.2, 0.5, 13, 1.4],
      "line-opacity": ["case", ["get", "dim"], 0.25, 0.9],
    }}
  />

  {#if explorer.dripping}
    <FillLayer
      id="hoods-wet"
      beforeId={slots.overWater}
      filter={["==", ["get", "borough"], SUNK_BOROUGH]}
      interactive={false}
      paint={{
        "fill-color": ink.waterLabel,
        "fill-opacity": glossy ? 0 : 0.42,
        "fill-opacity-transition": {
          duration: glossy && !calm.current ? 19_000 : 0,
          delay: 0,
        },
      }}
    />
  {/if}

  <FillLayer
    id="hoods-zone"
    beforeId={slots.overWater}
    filter={zoneFilter}
    interactive={false}
    paint={{ "fill-color": ink.paper, "fill-opacity": 0.62 }}
  />

  <LineLayer
    id="hoods-pointing"
    filter={pointingFilter}
    interactive={false}
    paint={{
      "line-color": ink.selectedLine,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9.2, 1.4, 14, 2.8],
      "line-opacity": 0.7,
    }}
  />

  <LineLayer
    id="hoods-selected"
    filter={selectedFilter}
    interactive={false}
    paint={{
      "line-color": ink.selectedLine,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9.2, 1.7, 14, 3.4],
      "line-opacity": 0.92,
    }}
  />
</GeoJSON>

<!-- Directly over hoods-fill and under the shore, so the fade never crosses the water or the roads. -->
<GeoJSON id="hoods-ghost" data={ghost}>
  <FillLayer
    id="hoods-fill-ghost"
    beforeId={slots.underWater}
    interactive={false}
    paint={{
      "fill-color": ["get", "fill"],
      "fill-antialias": false,
      "fill-opacity-transition": {
        duration: veil === "fade" ? REINK : 0,
        delay: 0,
      },
      "fill-opacity": veil === "hold" ? FULL : 0,
    }}
  />

  <!-- Above the copy as well, so a door out of the intro never shows the old ink over the paper. -->
  {#if veiled}
    <FillLayer
      id="hoods-veil"
      beforeId={slots.underWater}
      interactive={false}
      paint={{
        "fill-color": ink.paper,
        "fill-antialias": false,
        "fill-opacity-transition": {
          duration: lifting && !calm.current ? SOAK : 0,
          delay: lifting && !calm.current ? HOLD : 0,
        },
        "fill-opacity": lifting ? 0 : 1,
      }}
    />
  {/if}
</GeoJSON>
