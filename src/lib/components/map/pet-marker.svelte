<script lang="ts">
  import { watch } from "runed";
  import { Marker } from "svelte-maplibre";
  import { on } from "svelte/events";
  import type { Kind } from "#lib/crowd.js";
  import type { Pet } from "#lib/pet.svelte.js";
  import type { OnHover } from "#lib/types.js";
  import Brine from "#lib/components/brand/brine.svelte";
  import Plate from "#lib/components/brand/plate.svelte";
  import { collarOf, pet } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";
  import { SUNK_BOROUGH } from "#lib/world.js";
  import PingBurst from "./ping-burst.svelte";

  let {
    dog,
    at,
    beside,
    borough,
    ping,
    onhover,
  }: {
    dog: Pet;
    at: [number, number];
    beside: number;
    borough: string;
    ping: { n: number; kind: Kind } | null;
    onhover: OnHover;
  } = $props();

  const LEAP = 900;

  const islander = $derived(borough === SUNK_BOROUGH);
  const afloat = $derived(islander && explorer.sank);
  const wet = $derived(islander && explorer.dripping);
  const away = $derived(explorer.ride?.id === dog.id);
  const chosen = $derived(explorer.tab === "pet" && pet.dog?.id === dog.id);
  const collar = $derived(collarOf(dog.collar));

  let leaping = $state(false);
  let over = $state(false);

  watch(
    () => afloat,
    (now, was) => {
      if (was !== true || now) {
        return;
      }

      leaping = true;
      const done = setTimeout(() => {
        leaping = false;
      }, LEAP);

      return () => clearTimeout(done);
    },
  );

  // Native listeners: Svelte delegates to the document root, above the map's canvas container.
  function swallow(node: HTMLElement) {
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
        over = true;
      }),
      on(node, "pointerleave", () => {
        over = false;
      }),
      on(node, "click", (event) => {
        event.stopPropagation();
        if (explorer.tab === "pet" && pet.dog?.id === dog.id) {
          explorer.closePet();
        } else {
          pet.choose(dog.id);
          explorer.showPet();
        }
      }),
    );

    return () => {
      for (const end of off) {
        end();
      }
    };
  }
</script>

<Marker
  lngLat={at}
  anchor="bottom"
  offset={[(beside % 2 === 1 ? 1 : -1) * Math.ceil(beside / 2) * 76, 0]}
  zIndex={over || chosen || ping != null ? 22 : 12}
  class="cursor-auto!"
>
  <button
    type="button"
    aria-label={afloat
      ? `${dog.name}, your dog, afloat in a life ring`
      : `${dog.name}, your dog`}
    aria-pressed={chosen}
    inert={away}
    class={cn(
      "group relative -m-2 block cursor-pointer p-2 transition-[opacity,scale] duration-300 outline-none",
      { "pointer-events-none scale-75 opacity-0": away },
    )}
    {@attach swallow}
  >
    <span class="relative block h-15 w-18">
      {#if afloat}
        <span
          aria-hidden="true"
          class="absolute bottom-0 left-1/2 h-4 w-18 -translate-x-1/2 translate-y-1/2"
        >
          {#each [0, 1, 2] as ring (ring)}
            <span
              class="absolute inset-0 rounded-[50%] border-[1.5px] border-white/70 motion-safe:animate-[ripple_calc(var(--1s)*2.7)_ease-out_infinite]"
              style:animation-delay="{ring * 0.9}s"
            ></span>
          {/each}
        </span>
      {:else}
        <span
          aria-hidden="true"
          class={cn(
            "absolute bottom-0 left-1/2 h-3.5 w-15 -translate-x-1/2 translate-y-1/2 rounded-[50%] motion-safe:animate-[beacon_calc(var(--1s)*2.6)_ease-in-out_infinite]",
            { "opacity-80": chosen || over },
          )}
          style:background="radial-gradient(closest-side, {collar}, transparent)"
        ></span>
        <span
          aria-hidden="true"
          class="absolute bottom-0 left-1/2 size-14 -translate-x-1/2 rounded-full bg-[#f7f4ec] shadow-[0_0_0_3px_var(--collar),0_0_0_4.5px_rgb(255_255_255/0.85),0_6px_14px_rgb(20_16_10/0.45)] transition-[scale] duration-200 group-hover:scale-105"
          style:--collar={collar}
        ></span>
      {/if}

      {#key afloat}
        <span
          class={cn("absolute inset-x-0 bottom-0 block origin-bottom", {
            "motion-safe:animate-[plop_calc(var(--1s)*0.9)_both]": afloat,
            "motion-safe:animate-[leap-home_calc(var(--1s)*0.9)_both]":
              !afloat && leaping,
          })}
        >
          <span
            class={cn("block origin-bottom", {
              "motion-safe:animate-[float_calc(var(--1s)*3.2)_ease-in-out_infinite] motion-safe:[animation-delay:0.9s]":
                afloat,
              shivers: wet && !leaping,
            })}
          >
            {#if afloat}
              <svg
                viewBox="0 0 64 22"
                aria-hidden="true"
                class="absolute -bottom-1.75 left-1/2 w-16 -translate-x-1/2 overflow-visible"
              >
                {@render ring("back")}
              </svg>
            {/if}

            <span
              class={cn("relative mx-auto block w-max origin-bottom", {
                "translate-y-3 mask-[linear-gradient(to_bottom,black_70%,transparent_84%)]":
                  afloat,
                "group-hover:animate-[wag_calc(var(--1s)*0.55)_ease-in-out]":
                  !afloat,
              })}
            >
              <Plate breed={dog.breed} height={afloat ? 46 : 54} halo />
              {#if wet && !leaping}
                <Brine drop={10} from={4} class="-bottom-1" />
              {/if}
            </span>

            {#if afloat}
              <svg
                viewBox="0 0 64 22"
                aria-hidden="true"
                class="absolute -bottom-1.75 left-1/2 w-16 -translate-x-1/2 overflow-visible"
              >
                {@render ring("front")}
              </svg>
            {/if}
          </span>
        </span>
      {/key}

      {#if ping != null && !afloat}
        {#key ping.n}
          <PingBurst kind={ping.kind} />
        {/key}
      {/if}

      {#if leaping}
        <svg
          viewBox="0 0 64 22"
          aria-hidden="true"
          class="absolute -bottom-1.75 left-1/2 w-16 -translate-x-1/2 overflow-visible motion-safe:animate-[adrift_calc(var(--1s)*1.1)_ease-in_both]"
        >
          {@render ring("back")}
          {@render ring("front")}
        </svg>
      {/if}
    </span>

    <span
      class={cn(
        "absolute bottom-3 left-[calc(50%+1.25rem)] z-10 flex w-max items-center gap-1 rounded-full py-0.5 pr-2 pl-1 shadow-[0_2px_5px_rgb(30_26_20/0.35)] ring-1 ring-black/15 transition-[translate,rotate] duration-200 group-hover:-translate-y-0.5",
        { "-rotate-3": !chosen, "rotate-0": chosen },
      )}
      style:background={collar}
    >
      <span
        aria-hidden="true"
        class="size-2.5 shrink-0 rounded-full brass shadow-none!"
      ></span>
      <span
        class="max-w-28 truncate slab text-[0.6875rem] leading-[1.15] text-white [text-shadow:0_1px_0_rgb(0_0_0/0.25)]"
        >{dog.name}</span
      >
    </span>
  </button>
</Marker>

{#snippet ring(half: "back" | "front")}
  {const clip = $derived(half === "back" ? "pet-ring-back" : "pet-ring-front")}
  <defs>
    <clipPath id={clip}>
      {#if half === "back"}
        <rect x="-4" y="-4" width="72" height="15" />
      {:else}
        <rect x="-4" y="11" width="72" height="15" />
      {/if}
    </clipPath>
  </defs>
  <g clip-path="url(#{clip})">
    <ellipse
      cx="32"
      cy="11"
      rx="29"
      ry="9.5"
      fill="none"
      stroke="#1d1b18"
      stroke-opacity="0.35"
      stroke-width="11"
    />
    <ellipse
      cx="32"
      cy="11"
      rx="29"
      ry="9.5"
      fill="none"
      stroke="#f7f4ec"
      stroke-width="9"
    />
    <ellipse
      cx="32"
      cy="11"
      rx="29"
      ry="9.5"
      fill="none"
      stroke="#d8432f"
      stroke-width="9"
      pathLength="100"
      stroke-dasharray="12.5 12.5"
      stroke-dashoffset="6"
    />
    <ellipse
      cx="32"
      cy="10"
      rx="29"
      ry="9"
      fill="none"
      stroke="white"
      stroke-opacity="0.45"
      stroke-width="1.6"
    />
  </g>
{/snippet}
