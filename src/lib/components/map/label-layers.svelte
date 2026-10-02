<script lang="ts" module>
  import type { HoodLabels } from "#lib/types.js";

  function packOf(labels: HoodLabels) {
    return labels.features.map((f) => f.properties.plate).join(" ");
  }
</script>

<script lang="ts">
  import type { ExpressionSpecification } from "maplibre-gl";
  import { untrack } from "svelte";
  import { GeoJSON, SymbolLayer } from "svelte-maplibre";
  import type { Ink } from "#lib/map-style.js";
  import type { BoroughLabels, ParkLabels } from "#lib/types.js";
  import { FONT_BOLD, FONT_REGULAR } from "#lib/map-style.js";

  let {
    hoods,
    boroughs,
    parks,
    ink,
    plates,
    names,
    selectedFilter,
    matchFilter,
  }: {
    hoods: HoodLabels;
    boroughs: BoroughLabels;
    parks: ParkLabels;
    ink: Ink;
    plates: boolean;
    names: boolean;
    selectedFilter: ExpressionSpecification;
    matchFilter: ExpressionSpecification | undefined;
  } = $props();

  const NAME_THE_HOODS = 11;
  const NAME_THE_BREED = 12;

  const FIRST_NAMED = 24;

  const strongest: ExpressionSpecification = [
    "<",
    ["get", "rank"],
    FIRST_NAMED,
  ];

  const drawn: ExpressionSpecification = ["!=", ["get", "plate"], ""];

  const plateFilter = $derived<ExpressionSpecification>(
    matchFilter == null ? drawn : ["all", drawn, matchFilter],
  );

  const nameFilter = $derived<ExpressionSpecification>([
    "step",
    ["zoom"],
    false,
    NAME_THE_HOODS,
    matchFilter == null ? strongest : ["all", strongest, matchFilter],
    NAME_THE_BREED,
    matchFilter ?? true,
  ]);

  const DROP = 1.2;

  const anchor = $derived(plates ? "top" : "center");
  const offset = $derived<[number, number]>(plates ? [0, DROP] : [0, 0]);

  const OUT = 170;
  const IN = 340;
  const REST = -3;
  const LIFT = -13;

  // icon-image resolves at tile layout and cannot cross-fade, so the old pack stays until it has faded out.
  const first = untrack(() => hoods);
  let standing = $state(first);
  let leaving = $state(false);
  // Not $state: the effect below writes it, and reading it reactively there would loop.
  let shown = packOf(first);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const pack = $derived(packOf(hoods));

  $effect(() => {
    const arriving = hoods;

    if (pack === shown) {
      standing = arriving;
      leaving = false;

      return;
    }

    leaving = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      shown = pack;
      standing = arriving;
      leaving = false;
    }, OUT);

    return () => {
      clearTimeout(timer);
    };
  });

  function parkInk(built: string, open: string): ExpressionSpecification {
    return [
      "match",
      ["get", "kind"],
      ["airport", "institution", "island"],
      built,
      open,
    ];
  }
</script>

<!-- interactive={false}: svelte-maplibre layers default to interactive and would swallow choropleth clicks. -->
<GeoJSON id="hood-labels" data={standing} promoteId="slug">
  {#if plates}
    <SymbolLayer
      id="hoods-plate"
      interactive={false}
      filter={plateFilter}
      minzoom={8.6}
      layout={{
        "icon-image": ["concat", "plate-", ["get", "plate"]],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8.6,
          0.1,
          12,
          0.2,
          15,
          0.36,
        ],
        "icon-anchor": "bottom",
        "icon-padding": 4,
        "symbol-sort-key": ["get", "rank"],
      }}
      paint={{
        // Transitions first: paint keys apply in written order, and a fade needs its duration set beforehand.
        "icon-opacity-transition": { duration: leaving ? OUT : IN, delay: 0 },
        "icon-translate-transition": { duration: leaving ? OUT : IN, delay: 0 },
        "icon-opacity": leaving ? 0 : 1,
        "icon-translate": [0, leaving ? LIFT : REST],
      }}
    />
  {/if}

  {#if names}
    <SymbolLayer
      id="hoods-label"
      interactive={false}
      filter={nameFilter}
      minzoom={NAME_THE_HOODS}
      layout={{
        "text-field": [
          "step",
          ["zoom"],
          [
            "format",
            ["get", "short"],
            { "text-font": ["literal", [FONT_BOLD]] },
          ],
          NAME_THE_BREED,
          [
            "format",
            ["get", "short"],
            { "text-font": ["literal", [FONT_BOLD]] },
            "\n",
            {},
            ["get", "value"],
            { "font-scale": 0.78 },
          ],
        ],
        "text-font": [FONT_REGULAR],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          NAME_THE_HOODS,
          ["case", strongest, 11.5, 10],
          15,
          ["case", strongest, 14.5, 12.5],
        ],
        "text-line-height": 1.15,
        "text-max-width": 7,
        "text-padding": 4,
        "text-anchor": anchor,
        "text-offset": offset,
        "symbol-sort-key": ["get", "rank"],
      }}
      paint={{
        "text-color": ink.label,
        "text-halo-color": ink.labelHalo,
        "text-halo-width": 1.4,
        "text-halo-blur": 0.4,
      }}
    />
  {/if}

  <SymbolLayer
    id="hoods-label-selected"
    interactive={false}
    filter={selectedFilter}
    layout={{
      "text-field": ["get", "name"],
      "text-font": [FONT_BOLD],
      "text-size": ["interpolate", ["linear"], ["zoom"], 9.2, 12, 14, 16],
      "text-max-width": 8,
      "text-anchor": anchor,
      "text-offset": offset,
      "text-allow-overlap": true,
    }}
    paint={{
      "text-color": ink.selectedLabel,
      "text-halo-color": ink.selectedLabelHalo,
      "text-halo-width": 2,
    }}
  />
</GeoJSON>

<GeoJSON id="park-labels" data={parks}>
  {#if names}
    <SymbolLayer
      id="parks-label"
      interactive={false}
      minzoom={9.6}
      layout={{
        "text-field": ["get", "name"],
        "text-font": [FONT_REGULAR],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10.4, 8.5, 14, 11.5],
        "text-max-width": 8,
        "text-padding": 6,
        "symbol-sort-key": ["-", 0, ["get", "mi2"]],
      }}
      paint={{
        "text-color": parkInk(ink.builtLabel, ink.parkLabel),
        "text-halo-color": parkInk(ink.builtLabelHalo, ink.parkLabelHalo),
        "text-halo-width": 1.2,
      }}
    />
  {/if}
</GeoJSON>

<GeoJSON id="borough-labels" data={boroughs}>
  {#if names}
    <SymbolLayer
      id="boroughs-label"
      interactive={false}
      maxzoom={NAME_THE_HOODS}
      layout={{
        "text-field": ["get", "name"],
        "text-font": [FONT_BOLD],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.24,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11.5, 10.6, 15],
        "text-line-height": 1.5,
        "text-max-width": 8,
        "text-padding": 4,
      }}
      paint={{
        "text-color": ink.label,
        "text-halo-color": ink.labelHalo,
        "text-halo-width": 1.8,
        "text-halo-blur": 0.6,
        // Held until the last moment: the neighborhood names take over at NAME_THE_HOODS, and a
        // borough word that fades out early leaves the city view with nothing written on it.
        "text-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          0.68,
          10.85,
          0.6,
          NAME_THE_HOODS,
          0,
        ],
      }}
    />
  {/if}
</GeoJSON>
