<script lang="ts" module>
  const RINGS = [0, 240, 480];
</script>

<script lang="ts">
  import type { FeatureCollection, Point } from "geojson";
  import { CircleLayer, GeoJSON } from "svelte-maplibre";

  let {
    at,
    color,
    swell,
    tag,
  }: { at: [number, number]; color: string; swell: number; tag: string } =
    $props();

  // Set next frame: MapLibre cannot transition from an initial paint value.
  let out = $state(false);
  $effect(() => {
    const frame = requestAnimationFrame(() => {
      out = true;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  });

  const point: FeatureCollection<Point> = $derived({
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

<GeoJSON id="splash-{tag}" data={point}>
  {#each RINGS as beat (beat)}
    <CircleLayer
      id="splash-{tag}-{beat}"
      interactive={false}
      paint={{
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": color,
        "circle-stroke-width": 2,
        "circle-radius": out ? 150 : 6,
        "circle-radius-transition": { duration: swell, delay: beat },
        "circle-stroke-opacity": out ? 0 : 0.85,
        "circle-stroke-opacity-transition": { duration: swell, delay: beat },
      }}
    />
  {/each}
</GeoJSON>
