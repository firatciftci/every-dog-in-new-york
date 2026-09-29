<script lang="ts">
  import type { Point, FeatureCollection as Points } from "geojson";
  import { FillLayer, GeoJSON, LineLayer, SymbolLayer } from "svelte-maplibre";
  import { MediaQuery } from "svelte/reactivity";
  import type { Ink } from "$lib/map-style";
  import { FONT_ITALIC } from "$lib/map-style";
  import type { SunkShapes } from "./tide";
  import Splash from "./splash.svelte";
  import { SWELL } from "./tide";

  let {
    land,
    at,
    under,
    ink,
  }: { land: SunkShapes; at: [number, number]; under: boolean; ink: Ink } =
    $props();

  let called = $state(false);
  let wet = $state(false);

  // MapLibre paint transitions are not CSS, so the page's reduced-motion rule cannot reach them.
  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");
  const swell = $derived(calm.current ? 0 : SWELL);

  $effect(() => {
    if (under) {
      called = true;
    }
  });

  $effect(() => {
    if (!called) {
      return;
    }

    const target = under;
    const frame = requestAnimationFrame(() => {
      wet = target;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  });

  const bay: Points<Point> = $derived({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: at },
      },
    ],
  });
</script>

{#if called}
  <GeoJSON id="sunk-land" data={land}>
    <FillLayer
      id="sunk-fill"
      interactive={false}
      paint={{
        "fill-color": ink.water,
        "fill-antialias": false,
        "fill-opacity": wet ? 1 : 0,
        "fill-opacity-transition": { duration: swell, delay: 0 },
      }}
    />
    <LineLayer
      id="sunk-shore"
      interactive={false}
      layout={{ "line-join": "round", "line-cap": "round" }}
      paint={{
        "line-color": ink.water,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 16, 10],
        "line-opacity": wet ? 1 : 0,
        "line-opacity-transition": { duration: swell, delay: 0 },
      }}
    />
  </GeoJSON>

  <GeoJSON id="sunk-name" data={bay}>
    <SymbolLayer
      id="sunk-name-label"
      interactive={false}
      layout={{
        "text-field": "Staten Bay",
        "text-font": [FONT_ITALIC],
        "text-letter-spacing": 0.2,
        "text-max-width": 5,
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 8, 14],
      }}
      paint={{
        "text-color": ink.waterLabel,
        "text-halo-color": ink.water,
        "text-halo-width": 1.5,
        "text-opacity": wet ? 1 : 0,
        "text-opacity-transition": { duration: swell, delay: wet ? 700 : 0 },
      }}
    />
  </GeoJSON>

  {#key under}
    <Splash {at} tag={under ? "down" : "up"} color={ink.waterLabel} {swell} />
  {/key}
{/if}
