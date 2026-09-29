<script lang="ts">
  import type { ExpressionSpecification } from "maplibre-gl";
  import { FillLayer, GeoJSON, LineLayer } from "svelte-maplibre";
  import type { Ink, Slots } from "$lib/map-style";
  import type { OnHover, ParkCollection } from "$lib/types";

  let {
    data,
    ink,
    slots,
    onhover,
  }: { data: ParkCollection; ink: Ink; slots: Slots; onhover: OnHover } =
    $props();

  const BUILT = ["airport", "institution", "island"];

  function split(built: string, open: string): ExpressionSpecification {
    return ["match", ["get", "kind"], BUILT, built, open];
  }

  const fill = $derived(split(ink.builtFill, ink.parkFill));
  const edge = $derived(split(ink.builtLine, ink.parkLine));
</script>

<GeoJSON id="parks" {data}>
  <!-- Left interactive on purpose: eventsIfTopMost on hoods-fill only ignores park taps if this layer registers. -->
  <FillLayer
    id="parks-fill"
    beforeId={slots.underWater}
    paint={{ "fill-color": fill, "fill-opacity": 0.96 }}
    onmousemove={() => {
      onhover(null, null);
    }}
  />
  <LineLayer
    id="parks-line"
    beforeId={slots.overWater}
    interactive={false}
    paint={{ "line-color": edge, "line-width": 0.6 }}
  />
</GeoJSON>
