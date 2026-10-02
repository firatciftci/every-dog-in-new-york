<script lang="ts">
  import type { ExpressionSpecification } from "maplibre-gl";
  import {
    CircleLayer,
    GeoJSON,
    LineLayer,
    SymbolLayer,
  } from "svelte-maplibre";
  import type { Ink, Slots } from "#lib/map-style.js";
  import type {
    DogScatter,
    RailLines,
    RailStations,
    SubwayLines,
    SubwayStations,
  } from "#lib/types.js";
  import { FONT_REGULAR } from "#lib/map-style.js";
  import { railOffset, railPaint } from "#lib/rail.js";
  import { routePaint } from "#lib/subway.js";

  let {
    lines,
    stations,
    rail,
    railStops,
    dogs,
    ink,
    slots,
    matchFilter,
    showRail,
    showDogs,
  }: {
    lines: SubwayLines;
    stations: SubwayStations;
    rail: RailLines;
    railStops: RailStations;
    dogs: DogScatter;
    ink: Ink;
    slots: Slots;
    matchFilter: ExpressionSpecification | undefined;
    showRail: boolean;
    showDogs: boolean;
  } = $props();
</script>

<GeoJSON id="subway" data={lines}>
  <LineLayer
    id="subway-line"
    beforeId={slots.overWater}
    interactive={false}
    layout={{ "line-cap": "round", "line-join": "round" }}
    paint={{
      "line-color": routePaint(ink.road) as ExpressionSpecification,
      "line-width": [
        "interpolate",
        ["exponential", 1.4],
        ["zoom"],
        9,
        0.9,
        12,
        2,
        15,
        3.8,
      ],
      "line-opacity": showRail
        ? ["interpolate", ["linear"], ["zoom"], 9, 0.22, 11, 0.5, 13, 0.82]
        : 0,
    }}
  />
</GeoJSON>

<GeoJSON id="subway-stops" data={stations}>
  <CircleLayer
    id="subway-station"
    beforeId={slots.overWater}
    interactive={false}
    minzoom={12.4}
    paint={{
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12.4,
        1.6,
        15,
        3.6,
      ],
      "circle-color": ink.stationFill,
      "circle-stroke-color": ink.stationRing,
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12.4,
        0.6,
        15,
        1.3,
      ],
      "circle-opacity": showRail ? 0.95 : 0,
      "circle-stroke-opacity": showRail ? 0.95 : 0,
    }}
  />

  <SymbolLayer
    id="subway-station-label"
    interactive={false}
    minzoom={13.6}
    layout={{
      "text-field": ["get", "name"],
      "text-font": [FONT_REGULAR],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13.6, 9, 15, 11],
      "text-offset": [0, 1],
      "text-anchor": "top",
      "text-max-width": 8,
      "text-padding": 6,
    }}
    paint={{
      "text-color": ink.stationLabel,
      "text-halo-color": ink.streetHalo,
      "text-halo-width": 1.2,
      "text-opacity": showRail ? 0.9 : 0,
    }}
  />
</GeoJSON>

<GeoJSON id="rail" data={rail}>
  <LineLayer
    id="rail-line"
    beforeId={slots.overWater}
    interactive={false}
    layout={{ "line-cap": "butt", "line-join": "round" }}
    paint={{
      "line-color": railPaint(ink.road) as ExpressionSpecification,
      "line-width": [
        "interpolate",
        ["exponential", 1.4],
        ["zoom"],
        9,
        0.8,
        12,
        1.7,
        15,
        3.2,
      ],
      "line-dasharray": [3.2, 1.8],
      "line-offset": railOffset() as ExpressionSpecification,
      "line-opacity": showRail
        ? ["interpolate", ["linear"], ["zoom"], 9, 0.2, 11, 0.46, 13, 0.78]
        : 0,
    }}
  />
</GeoJSON>

<GeoJSON id="rail-stops" data={railStops}>
  <CircleLayer
    id="rail-station"
    beforeId={slots.overWater}
    interactive={false}
    minzoom={11.6}
    paint={{
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11.6,
        1.9,
        15,
        4.2,
      ],
      "circle-color": ink.stationFill,
      "circle-stroke-color": ink.stationRing,
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11.6,
        0.7,
        15,
        1.5,
      ],
      "circle-opacity": showRail ? 0.95 : 0,
      "circle-stroke-opacity": showRail ? 0.95 : 0,
    }}
  />

  <SymbolLayer
    id="rail-station-label"
    interactive={false}
    minzoom={12.6}
    layout={{
      "text-field": ["get", "name"],
      "text-font": [FONT_REGULAR],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12.6, 9.5, 15, 11.5],
      "text-offset": [0, 1],
      "text-anchor": "top",
      "text-max-width": 8,
      "text-padding": 6,
    }}
    paint={{
      "text-color": ink.stationLabel,
      "text-halo-color": ink.streetHalo,
      "text-halo-width": 1.2,
      "text-opacity": showRail ? 0.92 : 0,
    }}
  />
</GeoJSON>

<GeoJSON id="dog-scatter" data={dogs} promoteId="slug">
  <SymbolLayer
    id="dog-paws"
    beforeId={slots.overWater}
    interactive={false}
    filter={matchFilter}
    minzoom={9}
    layout={{
      "icon-image": "paw",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        0.3,
        13,
        0.44,
        15,
        0.66,
      ],
      "icon-rotate": ["*", ["%", ["*", ["to-number", ["id"], 0], 97], 60], 1],
      "icon-padding": 3,
      "icon-allow-overlap": false,
    }}
    paint={{
      "icon-opacity": showDogs
        ? ["interpolate", ["linear"], ["zoom"], 9, 0.26, 12.5, 0.42, 15, 0.5]
        : 0,
    }}
  />
</GeoJSON>
