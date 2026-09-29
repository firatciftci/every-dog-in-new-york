<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { LayersIcon, MinusIcon, PlusIcon } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { fly, slide } from "svelte/transition";
  import Plate from "$lib/components/brand/plate.svelte";
  import Daylight from "$lib/components/chrome/daylight.svelte";
  import { explorer } from "$lib/state.svelte";
  import { cn } from "$lib/utils";
  import { draw } from "./draw.svelte";

  let { map, onhome }: { map: MapLibreMap; onhome: () => void } = $props();

  let zoom = $state({ at: 0, floor: 0, ceiling: 0 });

  $effect(() => {
    const read = () => {
      zoom = {
        at: map.getZoom(),
        floor: map.getMinZoom(),
        ceiling: map.getMaxZoom(),
      };
    };

    read();
    map.on("zoom", read);
    map.on("resize", read);

    return () => {
      map.off("zoom", read);
      map.off("resize", read);
    };
  });

  const wide = new MediaQuery("(min-width: 880px)");
  const buried = $derived(!wide.current && explorer.sheet === "full");

  let running = $state(false);
  let timer = 0;

  function home() {
    onhome();
    clearTimeout(timer);
    running = false;
    // A frame apart, or re-adding a class already present restarts nothing.
    requestAnimationFrame(() => {
      running = true;
    });
    timer = window.setTimeout(() => {
      running = false;
    }, 700);
  }

  let drawer = $state(false);
  let group = $state<HTMLElement | null>(null);
  const panel = $props.id();

  const packed = $derived(!wide.current);
  let opened = $state(false);
  // $props.id() may only be called once per component.
  const stack = `${panel}-stack`;
  const showAll = $derived(!packed || opened);
  const lid = $derived(opened ? "Fold the controls away" : "More map controls");

  $effect(() => {
    if (buried) {
      drawer = false;
      opened = false;
    }
  });

  function away(event: PointerEvent) {
    if (group == null || group.contains(event.target as Node)) {
      return;
    }

    drawer = false;
    opened = false;
  }

  function dismiss(event: KeyboardEvent) {
    if (event.key !== "Escape") {
      return;
    }

    const back = (id: string) =>
      group?.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus();

    // preventDefault marks it handled so the page's own Escape does not also clear the map.
    if (drawer) {
      event.preventDefault();
      drawer = false;
      back(panel);
    } else if (opened) {
      event.preventDefault();
      opened = false;
      back(stack);
    }
  }
</script>

<!-- On the document rather than the window, so it runs before the page handler. -->
<svelte:document onkeydown={dismiss} />
<svelte:window onpointerdown={away} />

<div
  bind:this={group}
  inert={buried}
  style:transform="translateY(calc(-1 * var(--sheet, 0px)))"
  style:transition={"transform var(--sheet-ms, 0ms) cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease"}
  class={cn(
    "pointer-events-auto absolute right-3 bottom-3.5 z-30 flex items-end gap-2 min-[880px]:right-6 min-[880px]:bottom-6",
    { "pointer-events-none opacity-0": buried },
  )}
>
  {#if drawer}
    <div
      id={panel}
      style:box-shadow={"0 2px 1px rgb(58 48 38/0.14), 0 9px 24px rgb(30 26 20/0.26)"}
      class="w-max shrink-0 rotate-[-0.7deg] rounded-[10px] paper px-2.5 py-2 outline outline-foreground/12"
      transition:fly={{ x: 10, duration: 200, opacity: 0 }}
    >
      <p
        id="{panel}-head"
        class="px-1 slab text-[10px] tracking-[0.13em] text-muted-foreground uppercase"
      >
        What else is on the map
      </p>
      <span class="mt-1.5 block h-px w-full border-b rule" aria-hidden="true"
      ></span>

      <ul class="mt-1 grid" aria-labelledby="{panel}-head">
        {#each draw.flourishes as extra (extra.key)}
          <li>
            <button
              type="button"
              aria-pressed={extra.on}
              class={cn(
                "flex w-full items-center gap-2 rounded-[5px] px-1 py-1 text-left text-[12px] leading-snug whitespace-nowrap transition-colors duration-200 hover:bg-foreground/[0.035]",
                {
                  "text-foreground": extra.on,
                  "text-muted-foreground line-through": !extra.on,
                },
              )}
              onclick={() => {
                draw.flip(extra.key);
                explorer.capSheet("peek");
              }}
            >
              <span
                aria-hidden="true"
                class={cn(
                  "h-0.75 w-3 shrink-0 rounded-[50%] transition-colors duration-200",
                  { "bg-primary/80": extra.on, "bg-foreground/20": !extra.on },
                )}
              ></span>
              {extra.label}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div
    class="flex w-12 shrink-0 rotate-[-1.2deg] flex-col overflow-clip rounded-[10px] paper outline outline-foreground/12"
    style:box-shadow={"0 2px 1px rgb(58 48 38/0.14), 0 9px 24px rgb(30 26 20/0.26)"}
  >
    <!-- Duration 0 on wide screens: Controls mounts after map load, so the intro slide would really play. -->
    {#if showAll}
      <div id={stack} transition:slide={{ duration: packed ? 210 : 0 }}>
        <Daylight class="map-cell h-11 min-[880px]:h-9" />

        <span class="h-px w-full border-b rule" aria-hidden="true"></span>

        <button
          type="button"
          class={cn("map-cell h-11 min-[880px]:h-9", {
            "text-foreground": drawer,
          })}
          aria-label="What else is on the map"
          title="What else is on the map"
          aria-expanded={drawer}
          aria-controls={panel}
          onclick={() => {
            drawer = !drawer;
          }}
        >
          <LayersIcon
            aria-hidden="true"
            class="size-4.5 text-current"
            strokeWidth={2}
          />
        </button>

        <span class="h-px w-full border-b rule" aria-hidden="true"></span>

        <button
          type="button"
          class="relative map-cell h-11 min-[880px]:h-9"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={zoom.at >= zoom.ceiling - 0.01}
          onclick={() => map.zoomIn({ duration: 280 })}
        >
          <PlusIcon aria-hidden="true" class="size-4.5 text-current" />
        </button>

        <span class="h-px w-full border-b rule" aria-hidden="true"></span>

        <button
          type="button"
          class="relative map-cell h-11 min-[880px]:h-9"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={zoom.at <= zoom.floor + 0.01}
          onclick={() => map.zoomOut({ duration: 280 })}
        >
          <MinusIcon aria-hidden="true" class="size-4.5 text-current" />
        </button>

        <span class="h-px w-full border-b rule" aria-hidden="true"></span>
      </div>
    {/if}

    {#if packed}
      <button
        type="button"
        class={cn("map-cell h-11", { "text-foreground": opened })}
        aria-label={lid}
        title={lid}
        aria-expanded={opened}
        aria-controls={stack}
        onclick={() => {
          opened = !opened;
        }}
      >
        <svg
          viewBox="0 0 14 8"
          class={cn("h-1.75 w-3 transition-transform duration-300 ease-out", {
            "rotate-180": opened,
          })}
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M1 6L7 1.5L13 6" />
        </svg>
      </button>

      <span class="h-px w-full border-b rule" aria-hidden="true"></span>
    {/if}

    <button
      type="button"
      class="map-cell gap-0 pt-1.5 pb-1"
      aria-label="Show the whole city"
      title="Show the whole city"
      onclick={home}
    >
      <span class="grid h-6 w-full place-items-end overflow-clip">
        <Plate
          breed="Labrador (or Crossbreed)"
          height={22}
          class={cn("mx-auto max-w-9 origin-bottom", {
            "motion-safe:animate-[wag_0.6s_cubic-bezier(0.22,1,0.36,1)]":
              running,
          })}
        />
      </span>
      <span class="h-0.75 w-7 rounded-[50%] bg-primary/80" aria-hidden="true"
      ></span>
      <span class="mt-1 slab text-[10px] tracking-[0.13em] uppercase">City</span
      >
    </button>
  </div>
</div>
