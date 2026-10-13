<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { PawPrintIcon, XIcon } from "@lucide/svelte";
  import { mode } from "mode-watcher";
  import { untrack } from "svelte";
  import { on } from "svelte/events";
  import { MediaQuery } from "svelte/reactivity";
  import { fade } from "svelte/transition";
  import type { ParkId } from "#lib/game/parks.js";
  import type { ParkCollection } from "#lib/types.js";
  import { kennel } from "#lib/game/kennel.svelte.js";
  import { offLeash } from "#lib/game/off-leash.js";
  import { parkOf, PARKS, rankOf } from "#lib/game/parks.js";
  import { explorer } from "#lib/state.svelte.js";
  import { count } from "#lib/utils.js";
  import type { Padding } from "./camera";
  import { stage } from "./camera";

  let {
    map,
    parks,
    padding,
  }: { map: MapLibreMap; parks: ParkCollection; padding: Padding } = $props();

  const SHOW_ZOOM = 12.9;

  type Box = {
    id: ParkId;
    west: number;
    south: number;
    east: number;
    north: number;
  };

  type Spot = { id: ParkId; x: number; y: number };

  const boxes = $derived.by(() => {
    const found: Array<Box> = [];
    for (const f of parks.features) {
      const id = parkOf(f.properties.name);
      if (id == null) {
        continue;
      }

      const box: Box = {
        id,
        west: Infinity,
        south: Infinity,
        east: -Infinity,
        north: -Infinity,
      };
      const parts =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      for (const rings of parts) {
        for (const [lon = 0, lat = 0] of rings[0] ?? []) {
          box.west = Math.min(box.west, lon);
          box.east = Math.max(box.east, lon);
          box.south = Math.min(box.south, lat);
          box.north = Math.max(box.north, lat);
        }
      }

      found.push(box);
    }

    return found;
  });

  let opened = $state<Array<ParkId>>([]);
  let spots = $state<Array<Spot>>([]);
  let tilt = $state({ x: 0, y: 0 });

  const fine = new MediaQuery("(hover: hover) and (pointer: fine)");
  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  function show(id: ParkId, isOpen: boolean) {
    opened = isOpen
      ? [...opened.filter((f) => f !== id), id]
      : opened.filter((f) => f !== id);
  }

  $effect(() => {
    const place = () => {
      const zoom = map.getZoom();
      if (zoom < SHOW_ZOOM) {
        if (spots.length > 0) {
          spots = [];
          opened = [];
        }

        return;
      }

      const room = stage(map, padding);

      const next: Array<Spot> = [];
      for (const box of boxes) {
        const a = map.project([box.west, box.north]);
        const b = map.project([box.east, box.south]);
        const x0 = Math.max(a.x, room.left);
        const x1 = Math.min(b.x, room.right);
        const y0 = Math.max(a.y, room.top);
        const y1 = Math.min(b.y, room.bottom);
        if (x1 - x0 < 150 || y1 - y0 < 120) {
          continue;
        }

        next.push({ id: box.id, x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
      }

      const same =
        next.length === spots.length &&
        next.every(
          (s, i) =>
            spots[i]?.id === s.id &&
            Math.abs(spots[i].x - s.x) < 0.5 &&
            Math.abs(spots[i].y - s.y) < 0.5,
        );
      if (!same) {
        spots = next;
      }

      const shown = opened.filter((id) => next.some((s) => s.id === id));
      if (shown.length !== opened.length) {
        opened = shown;
      }
    };

    const key = (event: KeyboardEvent) => {
      const open = opened.find((id) => spots.some((s) => s.id === id));
      if (event.key === "Escape" && open != null && !explorer.dialogUp) {
        event.preventDefault();
        show(open, false);
      }
    };

    place();
    const offKey = on(document, "keydown", key);
    map.on("move", place);
    map.on("resize", place);

    return () => {
      offKey();
      map.off("move", place);
      map.off("resize", place);
    };
  });

  $effect(() => {
    const isExpanded = opened.some((id) => spots.some((s) => s.id === id));
    untrack(() => {
      if (isExpanded) {
        explorer.coverSheet();
      } else {
        explorer.uncoverSheet();
      }
    });
  });

  $effect(() => () => explorer.uncoverSheet());

  function lean(event: PointerEvent) {
    if (!fine.current || calm.current) {
      return;
    }

    const rect =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.getBoundingClientRect()
        : null;
    if (rect == null) {
      return;
    }

    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    tilt = { x: -py * 10, y: px * 12 };
  }

  function open(id: ParkId) {
    explorer.game = id;
  }
</script>

{#if explorer.game == null}
  <div class="pointer-events-none absolute inset-0 z-10 overflow-hidden">
    {#each spots as spot (spot.id)}
      {const park = $derived(PARKS[spot.id])}
      {const best = $derived(kennel.best(spot.id))}
      <div
        transition:fade={{ duration: 220 }}
        onwheelcapture={(event) => {
          event.preventDefault();
          map
            .getCanvasContainer()
            .dispatchEvent(new WheelEvent("wheel", event));
        }}
        class="pointer-events-none absolute top-0 left-0 w-max will-change-transform select-none"
        style:transform="translate3d({spot.x}px, {spot.y}px, 0)"
      >
        {#if !opened.includes(spot.id)}
          <div
            class="flex -translate-x-1/2 translate-y-[-62%] flex-col items-center"
          >
            <button
              type="button"
              onclick={() => show(spot.id, true)}
              class="pointer-events-auto relative mb-2 max-w-47.5 cursor-pointer rounded-[14px_14px_14px_4px] paper px-3 py-1.5 text-left text-[0.78125rem] leading-snug text-foreground shadow-[0_8px_22px_rgb(20_16_10/0.35)] outline outline-foreground/15 motion-safe:animate-[rise_0.45s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]"
            >
              There is a game on in {park.name}.
              <span class="block slab text-[0.6875rem] text-primary"
                >Tap the tag to see it</span
              >
              <span
                aria-hidden="true"
                class="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 paper outline outline-foreground/15 [clip-path:polygon(100%_0,100%_100%,0_100%)]"
              ></span>
            </button>
            <div
              class="motion-safe:animate-[drop-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]"
            >
              <button
                type="button"
                aria-label="Open the {park.name} game notice"
                title={park.title}
                onclick={() => show(spot.id, true)}
                class="pointer-events-auto grid size-12 swing cursor-pointer place-items-center rounded-[12px] brass"
              >
                <PawPrintIcon aria-hidden="true" class="size-6 -rotate-12" />
              </button>
            </div>
          </div>
        {:else}
          <div
            role="presentation"
            onpointermove={lean}
            onpointerleave={() => {
              tilt = { x: 0, y: 0 };
            }}
            class="pointer-events-auto relative w-[min(15.375rem,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 transition-transform duration-250 ease-out"
            style:transform="perspective(640px) rotateX({tilt.x}deg) rotateY({tilt.y}deg)"
          >
            <button
              type="button"
              aria-label="Fold the notice back into its tag"
              title="Fold the notice"
              onclick={() => show(spot.id, false)}
              class="relative z-10 mx-auto flex cursor-pointer flex-col items-center motion-safe:animate-[drop-in_0.55s_cubic-bezier(0.34,1.56,0.64,1)_both]"
            >
              <svg viewBox="0 0 22 16" class="h-3.5 w-5" aria-hidden="true">
                <path
                  d="M11 1.5 a6.5 6.5 0 1 0 0.01 0"
                  class="fill-none stroke-[oklch(0.75_0.055_82)]"
                  stroke-width="2.4"
                />
              </svg>
              <span
                class="sheen relative -mt-2 block swing rounded-[12px] px-5 pt-2.5 pb-1.5 text-center brass"
              >
                <span
                  aria-hidden="true"
                  class="absolute top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1.5px_rgb(0_0_0/0.6),0_1px_0_oklch(0.95_0.04_92/0.55)]"
                ></span>
                <span
                  class="block font-sans text-[0.5rem] font-semibold tracking-[0.19em] uppercase stamped"
                  >Off-leash hours</span
                >
                <span
                  class="mt-0.5 block slab text-[1.25rem] leading-none stamped"
                  >{offLeash(park, mode.current === "dark").words}</span
                >
                <span
                  class="mt-0.5 block font-sans text-[0.5rem] font-semibold tracking-[0.19em] uppercase stamped"
                  >{park.name}</span
                >
              </span>
            </button>

            <button
              type="button"
              onclick={() => open(spot.id)}
              class="group relative -mt-3.5 block w-full cursor-pointer bubble paper px-4 pt-6 pb-4 text-left text-foreground shadow-[0_12px_32px_rgb(20_16_10/0.4)] outline outline-foreground/15 motion-safe:animate-[rise_0.45s_cubic-bezier(0.16,1,0.3,1)_0.16s_both]"
            >
              <span class="block pr-7 slab text-[1.0625rem] leading-tight"
                >{park.title}</span
              >
              <span
                class="mt-1.5 block text-[0.78125rem] leading-snug text-foreground/80"
                >{park.brief}</span
              >
              {#if best > 0}
                <span
                  class="mt-1.5 block numeric text-[0.71875rem] text-muted-foreground"
                >
                  Your best here: {count(best)}, {rankOf(spot.id, best).name}
                </span>
              {/if}
              <span
                class="mt-3 inline-block shout px-3.5 py-1.5 text-[0.84375rem] whitespace-nowrap uppercase group-hover:transform-[translate(-1px,-1px)_rotate(-1.4deg)] group-hover:[box-shadow:5px_5px_0_var(--color-primary)] group-active:transform-[translate(4px,4px)_rotate(-1deg)] group-active:[box-shadow:0_0_0_var(--color-primary)]"
              >
                {park.cta}
              </span>
            </button>

            <button
              type="button"
              onclick={() => show(spot.id, false)}
              aria-label="Close the notice"
              title="Close the notice"
              class="absolute top-13 right-0 z-20 grid size-10 cursor-pointer place-items-center text-foreground/70 transition-colors duration-200 hover:text-foreground"
            >
              <XIcon aria-hidden="true" class="size-5" />
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
