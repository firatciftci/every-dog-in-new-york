<script lang="ts">
  import type {
    ExpressionSpecification,
    Map as MapLibreMap,
    StyleSpecification,
  } from "maplibre-gl";
  import { browser } from "$app/env";
  import { setWorkerUrl } from "maplibre-gl";
  import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
  import { watch } from "runed";
  import { untrack } from "svelte";
  import { MapLibre } from "svelte-maplibre";
  import { MediaQuery } from "svelte/reactivity";
  import { fade } from "svelte/transition";
  import type { Painted } from "$lib/layers";
  import type { MapTheme, Slots } from "$lib/map-style";
  import type { HoodLabels, OnHover, PointerAt } from "$lib/types";
  import type { World } from "$lib/world";
  import { plateOf } from "$lib/breeds";
  import { boundsOf } from "$lib/data";
  import { MAP_INK, reink } from "$lib/map-style";
  import { pawImage } from "$lib/paw";
  import { plateIcon } from "$lib/plate-icon";
  import { explorer } from "$lib/state.svelte";
  import type { Bounds, Padding } from "./camera";
  import { Camera, EASE, MAX_ZOOM, roamBounds } from "./camera";
  import CityLayers from "./city-layers.svelte";
  import Controls from "./controls.svelte";
  import { draw } from "./draw.svelte";
  import { carUnder } from "./fleet.svelte";
  import HoodLayers from "./hood-layers.svelte";
  import LabelLayers from "./label-layers.svelte";
  import ParkLayers from "./park-layers.svelte";
  import ParkNotice from "./park-notice.svelte";
  import Ruler from "./ruler.svelte";
  import Shelters from "./shelters.svelte";
  import SinkLayer from "./sink-layer.svelte";
  import { SWELL } from "./tide";
  import Tooltip from "./tooltip.svelte";
  import Trains from "./trains.svelte";

  // MapLibre 6 is ESM-only and cannot resolve its own worker, so Vite emits it as an asset.
  if (browser) {
    setWorkerUrl(maplibreWorkerUrl);
  }

  let {
    style,
    slots,
    theme,
    world,
    painted,
    labels,
    padding,
    focusPadding,
    pointer,
    onready,
  }: {
    style: StyleSpecification;
    slots: Slots;
    theme: MapTheme;
    world: World;
    painted: Painted;
    labels: HoodLabels;
    padding: Padding;
    focusPadding: Padding;
    pointer: boolean;
    onready?: () => void;
  } = $props();

  const data = $derived(painted.data);

  const ink = $derived(MAP_INK[theme]);

  const stage = $derived(explorer.selected == null ? padding : focusPadding);

  // untrack: svelte-maplibre only adds images the map lacks, so the theme effect below re-inks paw itself.
  const images = untrack(() =>
    browser ? [{ id: "paw", data: pawImage(ink.paw) }] : [],
  );

  function resolvePlate(instance: MapLibreMap) {
    return async (id: string) => {
      if (!id.startsWith("plate-") || instance.hasImage(id)) {
        return;
      }

      try {
        const data = await plateIcon(
          `/breeds/${id.slice("plate-".length)}.webp`,
        );

        if (!instance.hasImage(id)) {
          instance.addImage(id, data);
        }
      } catch {
        // A missing plate is not an error; the area just shows no dog.
      }
    };
  }

  const wholePack = untrack(() => {
    const slugs: Array<string> = [];
    for (const f of data.features) {
      for (const breed of [
        f.properties.top_breed,
        f.properties.distinct_breed,
      ]) {
        const slug = breed == null ? null : plateOf(breed);
        if (slug != null && !slugs.includes(slug)) {
          slugs.push(slug);
        }
      }
    }

    return slugs;
  });

  // untrack on purpose: a fresh maxBounds array each render makes svelte-maplibre re-fit and re-enter effects.
  const bounds = $derived(world.bounds);
  const camera = untrack(() => new Camera(bounds));
  const roam = untrack(() => roamBounds(bounds));

  const whole = untrack(() => bounds);

  let map = $state<MapLibreMap>();
  let cursor = $state<PointerAt | null>(null);
  let hoveredSlug = $state<string | null>(null);
  let loaded = $state(false);

  // svelte-maplibre binds the instance before onload, so this is the only safe handle.
  const live = $derived(loaded ? (map ?? null) : null);

  // originalEvent is null for every programmatic camera move, and a tap that never moved fires no move at all.
  $effect(() => {
    const instance = live;
    if (instance == null) {
      return;
    }

    const onPhone = !pointer;
    const byHand = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent == null) {
        return;
      }

      explorer.roam();
      if (onPhone) {
        explorer.duckSheet();
      }
    };
    // Scroll zoom runs on the render frame, so its moves carry no originalEvent of their own.
    const wheeled = () => {
      explorer.roam();
    };
    const settled = () => {
      if (onPhone) {
        explorer.freeSheet();
      }
    };

    instance.on("move", byHand);
    instance.on("wheel", wheeled);
    instance.on("moveend", settled);

    return () => {
      instance.off("move", byHand);
      instance.off("wheel", wheeled);
      instance.off("moveend", settled);
    };
  });

  // Matches printing in app.css. MapLibre cross-fades only single-color paint, so the sheet covers the rest.
  const DISSOLVE = 320;

  let sheet = $state<HTMLCanvasElement>();
  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  // Not $state: the effect below writes it, and reading it reactively there would loop.
  let printed: MapTheme | null = null;

  // The WebGL buffer is cleared after compositing, so redraw() must render in this task before drawImage.
  function lift(instance: MapLibreMap): HTMLCanvasElement | null {
    const board = sheet;
    const ctx = board?.getContext("2d");
    if (board == null || ctx == null) {
      return null;
    }

    const canvas = instance.getCanvas();
    instance.redraw();
    board.width = canvas.width;
    board.height = canvas.height;
    ctx.drawImage(canvas, 0, 0);

    return board;
  }

  // $effect.pre so the sheet captures the old ink before child effects push the new paint.
  $effect.pre(() => {
    const next = theme;
    const instance = live;
    if (instance == null || printed === next) {
      return;
    }

    // First pass still re-inks: the style was built for whichever theme was up when it was fetched.
    const board = printed == null || calm.current ? null : lift(instance);
    printed = next;

    reink(instance, next);

    if (instance.hasImage("paw")) {
      instance.updateImage("paw", pawImage(ink.paw));
    }

    board?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: DISSOLVE,
      easing: "linear",
    });
  });

  // MapLibre holds a tile until every named icon resolves, so plates are cut one per idle slice, not on demand.
  $effect(() => {
    const instance = live;
    if (instance == null) {
      return;
    }

    const cut = resolvePlate(instance);
    let running = true;
    let at = 0;

    const soon = (run: () => void) => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 800 });
      } else {
        setTimeout(run, 150);
      }
    };

    const next = () => {
      if (!running) {
        return;
      }

      const slug = wholePack[at];
      at += 1;
      if (slug === undefined) {
        return;
      }

      void cut(`plate-${slug}`).finally(() => {
        soon(next);
      });
    };

    soon(next);

    return () => {
      running = false;
    };
  });

  const hovered = $derived(
    data.features.find((f) => f.properties.slug === hoveredSlug)?.properties ??
      null,
  );

  function extentOf(props: Array<{ lon: number; lat: number }>): Bounds | null {
    if (props.length === 0) {
      return null;
    }

    const lons = props.map((p) => p.lon);
    const lats = props.map((p) => p.lat);
    const pad = 0.012;

    return [
      Math.min(...lons) - pad,
      Math.min(...lats) - pad,
      Math.max(...lons) + pad,
      Math.max(...lats) + pad,
    ];
  }

  function fit(instance: MapLibreMap, next: Padding, isAnimated: boolean) {
    if (untrack(() => explorer.selected) == null) {
      camera.frame(instance, next, isAnimated);
    } else {
      camera.floor(instance, next);
    }
  }

  const onhover: OnHover = (slug, at) => {
    hoveredSlug = slug;
    cursor = at;
    explorer.point("slug", slug);
  };

  const selectedFilter: ExpressionSpecification = $derived([
    "==",
    ["get", "slug"],
    explorer.selected ?? " ",
  ]);

  const NOTHING: ExpressionSpecification = ["==", ["get", "slug"], " "];

  const pointingFilter: ExpressionSpecification = $derived(
    explorer.pointing?.field === "slug"
      ? ["==", ["get", "slug"], explorer.pointing.value]
      : NOTHING,
  );

  // A borough word, a legend row, or a pill under the pointer: everything that is not it goes back to paper.
  const zoneFilter: ExpressionSpecification = $derived.by(() => {
    const at = explorer.pointing;
    if (at == null || at.field === "slug") {
      return NOTHING;
    }

    return data.features.some((f) => f.properties[at.field] === at.value)
      ? ["!=", ["get", at.field], at.value]
      : NOTHING;
  });

  const lit = $derived(
    data.features.filter((f) => !f.properties.dim).map((f) => f.properties),
  );

  const matchFilter = $derived<ExpressionSpecification | undefined>(
    lit.length === data.features.length
      ? undefined
      : ["in", ["get", "slug"], ["literal", lit.map((p) => p.slug)]],
  );

  // Reading padding reactively here caused update loops.
  watch([() => explorer.selected, () => live], ([slug, instance], [was]) => {
    if (instance == null) {
      return;
    }

    if (slug == null) {
      // Nothing was open, so this run is the arrival, not a reader closing a card.
      if (was != null) {
        camera.home(instance, padding);
      }

      return;
    }

    const picked = data.features.find((f) => f.properties.slug === slug);
    if (picked != null) {
      // Its own outline, so a wide neighborhood lands further out than a narrow one.
      const box = boundsOf({ type: "FeatureCollection", features: [picked] });
      // Slack as a share of the neighborhood's own span, so it sits inside the borough
      // instead of pressed against the padding. The desktop map has the room to stand back.
      const slack = pointer ? 1 : 0.32;
      const wider = (box[2] - box[0]) * slack;
      const taller = (box[3] - box[1]) * slack;

      camera.fitTo(
        instance,
        [box[0] - wider, box[1] - taller, box[2] + wider, box[3] + taller],
        focusPadding,
        MAX_ZOOM - 0.5,
      );
    }
  });

  watch(
    () => live,
    (instance) => {
      if (instance == null) {
        return;
      }

      return camera.followResize(instance, () => padding);
    },
  );

  // Must run untracked: fitBounds fires moveend synchronously and svelte-maplibre writes bounds state in it.
  watch(
    [() => live, () => padding, () => explorer.walk],
    ([instance, next, at], [, , was]) => {
      if (instance == null) {
        return;
      }

      // Every stop of the walk talks about the whole city, so each turn of the page comes back to it.
      if (at >= 0 && was !== undefined && was !== at) {
        camera.home(instance, next);

        return;
      }

      fit(instance, next, true);
    },
  );

  // Drown only after the EASE flight lands, or the borough blanks out mid-pan.
  watch([() => live, () => explorer.sinking], ([instance, asked]) => {
    if (instance == null || !asked) {
      return;
    }

    camera.fitTo(instance, whole, padding);
    const tide = window.setTimeout(() => explorer.drown(), EASE);

    return () => window.clearTimeout(tide);
  });

  // After a sink, wait SWELL before re-framing so the camera holds still while the water comes in.
  watch(
    () => bounds,
    (next, before) => {
      camera.retarget(next);

      const instance = live;
      if (before === undefined || instance == null) {
        return;
      }

      if (!explorer.sank) {
        camera.home(instance, padding);

        return;
      }

      const settle = window.setTimeout(
        () => camera.home(instance, padding),
        SWELL,
      );

      return () => window.clearTimeout(settle);
    },
  );

  watch([() => explorer.zoomTick, () => live], ([tick, instance]) => {
    if (tick === 0 || instance == null) {
      return;
    }

    const extent = extentOf(lit);
    if (extent != null) {
      camera.fitTo(instance, extent, focusPadding);
    }
  });
</script>

<!-- No bounds prop: svelte-maplibre refits from its own bounds on every moveend and fights the Camera. -->
<MapLibre
  bind:map
  class="absolute inset-0 h-full w-full"
  {style}
  maxBounds={roam}
  maxZoom={MAX_ZOOM}
  {images}
  attributionControl={false}
  renderWorldCopies={false}
  dragRotate={false}
  pitchWithRotate={false}
  antialias={true}
  onload={(instance) => {
    instance.setMissingStyleImageResolver(resolvePlate(instance));
    instance.touchZoomRotate.disableRotation();
    instance.touchPitch.disable();
    instance.keyboard.disableRotation();

    // Right after the canvas and under the markers, so the dissolve covers only what MapLibre draws.
    if (sheet != null) {
      instance
        .getCanvasContainer()
        .insertBefore(sheet, instance.getCanvas().nextSibling);
    }

    fit(instance, padding, false);
    loaded = true;
    onready?.();
  }}
  onclick={(event) => {
    if (hovered == null && carUnder(event.point) == null) {
      explorer.clearSelection();
    }
  }}
>
  {#if loaded}
    <CityLayers
      lines={world.subway}
      stations={world.stations}
      rail={world.rail}
      railStops={world.railStops}
      dogs={world.dogs}
      {ink}
      {slots}
      {matchFilter}
      showRail={draw.rail}
      showDogs={draw.dogs}
    />
    <HoodLayers
      {data}
      signature={painted.signature}
      {ink}
      {slots}
      {selectedFilter}
      {pointingFilter}
      {zoneFilter}
      {pointer}
      {onhover}
    />
    <ParkLayers data={world.parks} {ink} {slots} {onhover} />
    <LabelLayers
      hoods={labels}
      boroughs={world.boroughNames}
      parks={world.parkNames}
      {ink}
      plates={draw.plates}
      names={draw.labels}
      {selectedFilter}
      {matchFilter}
    />
    <SinkLayer
      land={world.sunk.shapes}
      at={world.sunk.center}
      under={world.sunk.under}
      {ink}
    />
    {#if draw.shelters && live != null}
      <Shelters
        map={live}
        shelters={world.shelters}
        {camera}
        padding={stage}
        {onhover}
      />
    {/if}
  {/if}
</MapLibre>

<canvas
  bind:this={sheet}
  aria-hidden="true"
  class="pointer-events-none absolute inset-0 h-full w-full opacity-0"
></canvas>

{#if live != null}
  <Controls map={live} onhome={() => camera.home(live, stage)} />
{/if}

{#if live != null}
  <Ruler map={live} {painted} />
{/if}

{#if live != null}
  <Trains
    map={live}
    lines={world.subway}
    stations={world.stations}
    rail={world.rail}
    railStops={world.railStops}
    riders={world.riders}
    padding={stage}
    show={draw.rail}
  />
{/if}

{#if live != null}
  <ParkNotice map={live} parks={world.parks} padding={stage} />
{/if}

{#if pointer && hovered != null && cursor != null}
  <div transition:fade={{ duration: 90 }}>
    <Tooltip props={hovered} x={cursor.x} y={cursor.y} />
  </div>
{/if}
