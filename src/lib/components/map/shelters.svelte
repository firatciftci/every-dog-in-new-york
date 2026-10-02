<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { watch } from "runed";
  import { Marker } from "svelte-maplibre";
  import { on } from "svelte/events";
  import type { OnHover, Shelter } from "#lib/types.js";
  import { DOORWAY, KENNEL } from "#lib/kennel.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";
  import type { Camera, Padding } from "./camera";

  let {
    map,
    shelters,
    camera,
    padding,
    onhover,
  }: {
    map: MapLibreMap;
    shelters: Array<Shelter>;
    camera: Camera;
    padding: Padding;
    onhover: OnHover;
  } = $props();

  // Raised marker uses zIndex 20 to clear the train overlay at z-10.
  let over = $state<string | null>(null);

  watch(
    () => explorer.shelter,
    (slug) => {
      const open = shelters.find((place) => place.slug === slug);
      if (open == null) {
        return;
      }

      camera.focus(map, [open.lon, open.lat], padding, 13.2);
    },
  );

  // Native listeners: Svelte delegates to the document root, above the map's canvas container.
  function swallow(slug: string) {
    return (node: HTMLElement) => {
      const stop = (event: Event) => {
        event.stopPropagation();
      };
      const off = [
        "pointerdown",
        "mousedown",
        "pointerup",
        "mouseup",
        "dblclick",
        "touchstart",
        "touchend",
        "mousemove",
        "mouseover",
        "pointermove",
        "pointerover",
      ].map((type) => on(node, type as "click", stop));

      off.push(
        on(node, "pointerenter", () => {
          onhover(null, null);
          over = slug;
        }),
        on(node, "pointerleave", () => {
          if (over === slug) {
            over = null;
          }
        }),
      );

      off.push(
        on(node, "click", (event) => {
          event.stopPropagation();
          explorer.openShelter(slug);
        }),
      );

      return () => {
        for (const end of off) {
          end();
        }
      };
    };
  }
</script>

{#each shelters as place (place.slug)}
  {const on = $derived(explorer.shelter === place.slug)}
  <Marker
    lngLat={[place.lon, place.lat]}
    anchor="bottom"
    zIndex={on || over === place.slug ? 20 : 1}
    class="cursor-auto!"
  >
    <button
      type="button"
      aria-label="{place.name}, a shelter in {place.borough}"
      aria-describedby="shelter-note-{place.slug}"
      class={cn(
        "group relative -m-1 block origin-bottom -rotate-2 cursor-pointer p-1 transition-transform duration-200 hover:scale-110 hover:rotate-0 focus-visible:scale-110 focus-visible:rotate-0",
        { "scale-110 rotate-0": on },
      )}
      {@attach swallow(place.slug)}
    >
      <svg
        viewBox="0 0 26 25"
        class="h-4.75 w-5 drop-shadow-[0_1.5px_3px_rgb(30_26_20/0.35)]"
        aria-hidden="true"
      >
        <path
          d={KENNEL}
          class={cn("fill-background transition-colors duration-200", {
            "stroke-primary": on,
            "stroke-foreground/80": !on,
          })}
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <path
          d={DOORWAY}
          class={cn("transition-colors duration-200", {
            "fill-primary": on,
            "fill-foreground/80": !on,
          })}
        />
      </svg>

      <span
        class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-56 -translate-x-3 rounded-[14px] rounded-bl-lg bg-card px-2.5 py-1.5 text-left opacity-0 shadow-[0_6px_18px_rgb(30_26_20/0.28),inset_0_0_0_1.5px_color-mix(in_oklab,var(--color-primary)_45%,transparent)] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 min-[880px]:block"
      >
        <span
          class="block font-display text-[13px] leading-tight font-bold tracking-tight text-foreground"
          >{place.name}</span
        >
        <span
          id="shelter-note-{place.slug}"
          class="mt-0.5 line-clamp-2 font-display text-[10.5px] leading-tight text-primary"
          >{place.note}</span
        >
      </span>
    </button>
  </Marker>
{/each}
