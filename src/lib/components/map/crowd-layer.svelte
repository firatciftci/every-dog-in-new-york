<script lang="ts">
  import type { FeatureCollection, Point } from "geojson";
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { CircleLayer, GeoJSON } from "svelte-maplibre";
  import { SvelteMap } from "svelte/reactivity";
  import type { Shown } from "#lib/crowd.js";
  import type { Ink } from "#lib/map-style.js";
  import type { DogScatter, HoodCollection, PointerAt } from "#lib/types.js";
  import { crowd } from "#lib/crowd.svelte.js";
  import { collarOf } from "#lib/pet.svelte.js";
  import ReaderMarker from "./reader-marker.svelte";

  let {
    map,
    hoods,
    scatter,
    ink,
    pointer,
    onreader,
  }: {
    map: MapLibreMap;
    hoods: HoodCollection;
    scatter: DogScatter;
    ink: Ink;
    pointer: boolean;
    onreader: (
      reader: { name: string | null; breed: string; hood: string } | null,
      at: PointerAt | null,
    ) => void;
  } = $props();

  // Dots swell into small medallions from RISE, and reach full size GROWN zoom levels later.
  const RISE = 11.2;
  const GROWN = 1.2;
  const MOST = 80;

  let open = $state<string | null>(null);
  let view = $state({ zoom: 0, w: 0, s: 0, e: 0, n: 0 });

  const spots = $derived.by(() => {
    const paws = new SvelteMap<string, Array<[number, number]>>();
    for (const paw of scatter.features) {
      const [lon = 0, lat = 0] = paw.geometry.coordinates;
      const list = paws.get(paw.properties.slug) ?? [];
      list.push([lon, lat]);
      paws.set(paw.properties.slug, list);
    }

    const out: Array<{
      key: string;
      peer: string;
      nth: number;
      dog: Shown;
      hood: string;
      borough: string;
      at: [number, number];
    }> = [];

    for (const peer of crowd.peers) {
      for (const [nth, dog] of peer.dogs.entries()) {
        const home = hoods.features.find(
          (f) => f.properties.slug === dog.slug,
        )?.properties;
        if (home == null) {
          continue;
        }

        let hash = 7;
        for (const ch of `${peer.id}:${nth}`) {
          hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 1_000_003;
        }

        const near = paws.get(dog.slug) ?? [];
        const [lon, lat] = near[hash % Math.max(near.length, 1)] ?? [
          home.lon,
          home.lat,
        ];

        out.push({
          key: `${peer.id}:${nth}`,
          peer: peer.id,
          nth,
          dog,
          hood: home.name,
          borough: home.borough,
          at: [
            lon + (((hash >> 4) % 100) - 50) * 0.000_024,
            lat + (((hash >> 11) % 100) - 50) * 0.000_018,
          ],
        });
      }
    }

    return out;
  });

  const dots = $derived<
    FeatureCollection<
      Point,
      {
        key: string;
        name: string | null;
        breed: string;
        hood: string;
        color: string;
      }
    >
  >({
    type: "FeatureCollection",
    features: spots.map((spot) => ({
      type: "Feature",
      properties: {
        key: spot.key,
        name: spot.dog.name,
        breed: spot.dog.breed,
        hood: spot.hood,
        color: collarOf(spot.dog.collar),
      },
      geometry: { type: "Point", coordinates: spot.at },
    })),
  });

  const shown = $derived(
    spots
      .filter(
        (spot) =>
          spot.key === open ||
          (view.zoom >= RISE &&
            spot.at[0] > view.w &&
            spot.at[0] < view.e &&
            spot.at[1] > view.s &&
            spot.at[1] < view.n),
      )
      .slice(0, MOST),
  );

  const grow = $derived(Math.min(Math.max((view.zoom - RISE) / GROWN, 0), 1));

  $effect(() => {
    const read = () => {
      const box = map.getBounds();
      const padLon = (box.getEast() - box.getWest()) * 0.08;
      const padLat = (box.getNorth() - box.getSouth()) * 0.08;
      view = {
        zoom: map.getZoom(),
        w: box.getWest() - padLon,
        e: box.getEast() + padLon,
        s: box.getSouth() - padLat,
        n: box.getNorth() + padLat,
      };
    };

    // Below the rise a dot is the only thing to hit, so a click on one opens its card.
    const tap = (event: { point: { x: number; y: number } }) => {
      const hit = map.queryRenderedFeatures([event.point.x, event.point.y], {
        layers: ["crowd-dots"],
      })[0]?.properties as { key?: string } | undefined;
      open = hit?.key ?? null;
    };

    read();
    map.on("move", read);
    map.on("click", tap);

    return () => {
      map.off("move", read);
      map.off("click", tap);
    };
  });
</script>

<GeoJSON id="crowd" data={dots}>
  <CircleLayer
    id="crowd-dots"
    maxzoom={RISE}
    paint={{
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        2.75,
        11,
        4.25,
        RISE,
        4.75,
      ],
      "circle-color": ["get", "color"],
      "circle-stroke-color": ink.paper,
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        1,
        11,
        1.5,
      ],
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        RISE - 0.15,
        0.95,
        RISE,
        0,
      ],
      "circle-stroke-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        RISE - 0.15,
        1,
        RISE,
        0,
      ],
    }}
    hoverCursor="pointer"
    onmousemove={(e) => {
      if (!pointer || view.zoom >= RISE) {
        onreader(null, null);

        return;
      }

      const props = e.features[0]?.properties as
        { name?: string; breed: string; hood: string } | undefined;
      onreader(
        props == null
          ? null
          : { name: props.name ?? null, breed: props.breed, hood: props.hood },
        { x: e.event.point.x, y: e.event.point.y },
      );
    }}
    onmouseleave={() => {
      onreader(null, null);
    }}
  />
</GeoJSON>

{#each shown as spot (spot.key)}
  <ReaderMarker
    peer={spot.peer}
    nth={spot.nth}
    dog={spot.dog}
    hood={spot.hood}
    borough={spot.borough}
    at={spot.at}
    grow={view.zoom >= RISE ? grow : 0}
    open={open === spot.key}
    ontoggle={() => {
      open = open === spot.key ? null : spot.key;
    }}
    onclose={() => {
      open = null;
    }}
  />
{/each}
