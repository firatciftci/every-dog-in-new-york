<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";
  import { fade, fly } from "svelte/transition";
  import type { System } from "#lib/rail.js";
  import { collarOf, pet } from "#lib/pet.svelte.js";
  import { RAILROAD } from "#lib/rail.js";
  import { explorer } from "#lib/state.svelte.js";
  import { signName } from "#lib/trains.js";
  import { cn, tw } from "#lib/utils.js";
  import Bullet from "./bullet.svelte";
  import Goldfinch from "./goldfinch.svelte";

  let {
    system,
    route,
    bullet,
    color,
    dest,
    dog,
    boarded,
    stop,
    plate,
    delay,
    halted,
    faceLeft,
    finch,
    open,
    grazed,
    mine = false,
  }: {
    system: System;
    route: string;
    bullet: string;
    color: string;
    dest: string;
    dog: string;
    boarded: string;
    stop: string;
    plate: string;
    delay: string | null;
    halted: boolean;
    faceLeft: boolean;
    finch: boolean;
    open: boolean;
    grazed: boolean;
    mine?: boolean;
  } = $props();

  const own = $derived(
    mine ? pet.dogs.find((d) => d.id === explorer.ride?.id) : undefined,
  );
  const collar = $derived(own == null ? null : collarOf(own.collar));

  const short = $derived(signName(boarded));

  const room = $derived(system === "path" ? "max-w-42" : "max-w-52");

  const shell = $derived(
    system === "amtrak" ? "rounded-t-[13px]" : "rounded-t-[7px]",
  );
</script>

<div
  role="img"
  aria-label="{dog}, a dog riding the {system === 'subway'
    ? bullet
    : RAILROAD[system].name} to {dest}"
  class="relative -translate-x-1/2 -translate-y-full pb-1.75"
>
  {#if delay != null}
    <div
      in:fly={{ y: 6, duration: 220 }}
      out:fade={{ duration: 130 }}
      class="absolute bottom-full left-1/2 mb-1 w-max max-w-48 -translate-x-1/2 rounded-[6px] border-[1.5px] border-[#16181a] bg-[#fdb713] px-1.5 py-0.75 text-[#1a1508] shadow-[0_2px_5px_rgb(0_0_0/0.35)]"
    >
      <p
        class="flex items-center gap-1 font-sans text-[8.5px] leading-[1.3] font-bold tracking-wider uppercase"
      >
        <TriangleAlertIcon class="size-2.25 shrink-0" strokeWidth={2.6} />
        Delayed at {stop}
      </p>
      <p class="font-sans text-[8.5px] leading-[1.35]">{delay}</p>
    </div>
  {/if}

  <div class="flex items-end justify-center gap-0.5">
    <span
      class={cn(
        "block origin-bottom drop-shadow-[0_1px_1.5px_rgb(0_0_0/0.45)]",
        {
          "motion-safe:animate-[fidget_1.7s_ease-in-out_infinite]": halted,
          "motion-safe:animate-[rattle_0.26s_ease-in-out_infinite]": !halted,
        },
      )}
    >
      <img
        src="/breeds/{plate}.webp"
        alt=""
        class={cn("-mb-0.5 block w-auto object-contain plate-cut", {
          "-scale-x-100": faceLeft,
          "h-11": mine,
          "h-8.5": !mine,
        })}
      />
    </span>

    {#if finch}
      <span
        class={cn("mb-0.5 block origin-bottom", {
          "motion-safe:animate-[hop_2.4s_cubic-bezier(0.3,0,0.2,1)_infinite]":
            halted,
          "motion-safe:animate-[rattle_0.26s_ease-in-out_infinite]": !halted,
        })}
      >
        <Goldfinch
          body="#f2c31c"
          edge="#2a2418"
          class={cn(
            "block h-4.5 w-auto drop-shadow-[0_1px_1px_rgb(0_0_0/0.3)]",
            { "-scale-x-100": faceLeft },
          )}
        />
      </span>
    {/if}
  </div>

  <div
    class={cn(
      "relative w-max overflow-hidden rounded-b-lg border-[1.5px] border-[#16181a] transition-shadow duration-200",
      room,
      shell,
      { "bg-[#cfcdc6]": system === "njt", "bg-[#d9d7cf]": system !== "njt" },
      {
        "shadow-[0_2px_6px_rgb(0_0_0/0.4)]": !grazed && !open && collar == null,
        "shadow-[0_0_0_2px_var(--color-primary),0_3px_10px_rgb(0_0_0/0.45)]":
          (grazed || open) && collar == null,
        "shadow-[0_0_0_2.5px_var(--ring),0_0_14px_2px_var(--ring),0_3px_10px_rgb(0_0_0/0.45)]":
          collar != null,
      },
    )}
    style:--ring={collar}
  >
    <div class="relative h-1 bg-linear-to-b from-[#e4e2da] to-[#b0aea6]">
      <span
        class="absolute top-px left-[22%] h-0.5 w-4 rounded-[1px] bg-[#8d8b84]"
      ></span>
    </div>

    {#if system === "subway"}
      {@render subway()}
    {:else if system === "lirr"}
      {@render lirr()}
    {:else if system === "mnr"}
      {@render metroNorth()}
    {:else if system === "path"}
      {@render path()}
    {:else if system === "amtrak"}
      {@render amfleet()}
    {:else}
      {@render bilevel()}
    {/if}

    {@render rider()}

    <div class="relative h-0.75 bg-[#87857e]">
      <span
        class={cn(
          "absolute -top-px size-0.75 rounded-full bg-[#ffeeb6] ring-[0.5px] ring-[#16181a]",
          { "left-0.75": faceLeft, "right-0.75": !faceLeft },
        )}
      ></span>
      <span
        class={cn(
          "absolute -top-px size-0.75 rounded-full bg-[#d8483a] ring-[0.5px] ring-[#16181a]",
          { "right-0.75": faceLeft, "left-0.75": !faceLeft },
        )}
      ></span>
    </div>

    {#if system === "njt"}
      <span
        class="pointer-events-none absolute inset-y-1 left-4 w-[1.5px] bg-[#16181a]/45"
      ></span>
      <span
        class="pointer-events-none absolute inset-y-1 right-4 w-[1.5px] bg-[#16181a]/45"
      ></span>
    {:else if system !== "path"}
      <span
        class="pointer-events-none absolute inset-y-1 right-6.5 w-[1.5px] bg-[#16181a]/45"
      ></span>
      <span
        class="pointer-events-none absolute inset-y-1 right-10.25 w-[1.5px] bg-[#16181a]/45"
      ></span>
    {/if}
  </div>

  <div
    class={cn("absolute bottom-0 flex justify-between", {
      "inset-x-1.25": system === "njt",
      "inset-x-2.25": system !== "njt",
    })}
  >
    {#each [0, 1] as truck (truck)}
      <span
        class="flex h-1.75 items-start gap-0.5 rounded-b-xs bg-[#4a4d52] px-[1.5px]"
      >
        <span
          class="size-1.25 rounded-full bg-[#191b1e] ring-[1px] ring-[#6f7378]"
        ></span>
        <span
          class="size-1.25 rounded-full bg-[#191b1e] ring-[1px] ring-[#6f7378]"
        ></span>
      </span>
    {/each}
  </div>
</div>

{#snippet sign(box: string, tall: string)}
  <span class={cn("flex items-center gap-1.25 rounded-xs px-0.75 py-px", box)}>
    <Bullet {system} {route} {bullet} {color} small />
    <span class={cn("block min-w-0 overflow-hidden", tall)}>
      {#key dest}
        <span
          class={cn(
            "block truncate font-sans text-[10px] font-bold tracking-wider text-white uppercase motion-safe:animate-[rollsign_0.5s_cubic-bezier(0.2,0.9,0.25,1)]",
            tall,
          )}
        >
          {dest}
        </span>
      {/key}
    </span>
  </span>
{/snippet}

{#snippet glass()}
  <span
    class="min-w-6 flex-1 rounded-[1px] bg-[repeating-linear-gradient(to_right,#39424a_0_7px,transparent_7px_9px,#39424a_9px_16px,transparent_16px_21px)]"
  ></span>
{/snippet}

{#snippet rider()}
  {#if collar != null}
    <div style:background={collar}>
      <p
        class="truncate px-1.5 py-0.5 font-sans text-[9px] leading-[1.4] text-white [text-shadow:0_1px_0_rgb(0_0_0/0.25)]"
      >
        <span class="font-bold">{dog}</span>
        <span class="opacity-85">· your dog, on at {short}</span>
      </p>
    </div>
  {:else}
    <div
      class="bg-[repeating-linear-gradient(to_bottom,rgb(22_24_26/0.13)_0_1px,transparent_1px_3px)]"
    >
      <p
        class="truncate px-1.5 py-0.5 font-sans text-[9px] leading-[1.4] text-[#33302b]"
      >
        <span class="font-semibold">{dog}</span>
        <span class="text-[#5d574e]">· on at {short}</span>
      </p>
    </div>
  {/if}
{/snippet}

{#snippet subway()}
  <div class="flex items-stretch gap-0.75 bg-[#0e1012] px-0.75 py-0.75">
    {@render sign(tw`bg-[#191c1f] ring-[0.5px] ring-[#40464c]`, tw`h-3.25`)}
    {@render glass()}
  </div>
  <div class="h-0.75" style:background={color}></div>
{/snippet}

{#snippet lirr()}
  <div class="flex items-stretch gap-0.75 bg-[#c9c7bf] px-0.75 py-0.75">
    <span class="flex flex-col">
      {@render sign(tw`flex-1 bg-[#0e1012]`, tw`h-3`)}
      <span class="h-[1.5px] rounded-b-xs bg-[#ffd200]"></span>
    </span>
    {@render glass()}
  </div>
  <div class="h-1" style:background="#0039a6"></div>
  <div class="h-[1.5px] bg-[#ffd200]"></div>
{/snippet}

{#snippet metroNorth()}
  <div class="flex items-stretch gap-0.75 bg-[#c9c7bf] px-0.75 py-0.75">
    <span class="relative flex overflow-hidden rounded-xs bg-[#123a72]">
      <span class="absolute inset-x-0 top-1 h-px bg-white/70"></span>
      <span class="absolute inset-x-0 bottom-1 h-px bg-white/70"></span>
      {@render sign("", tw`h-3.25`)}
    </span>
    {@render glass()}
  </div>
  <div class="h-1" style:background={color}></div>
{/snippet}

{#snippet path()}
  <div class="flex items-center gap-1 bg-[#16191c] px-1 py-px">
    <Bullet {system} {route} {bullet} {color} small />
    <span class="block h-2.75 min-w-0 flex-1 overflow-hidden">
      {#key dest}
        <span
          class="block truncate font-sans text-[8px] leading-2.75 font-bold tracking-[0.08em] text-[#ffb43a] uppercase motion-safe:animate-[rollsign_0.5s_cubic-bezier(0.2,0.9,0.25,1)]"
        >
          {dest}
        </span>
      {/key}
    </span>
  </div>

  <div class="h-px bg-[#8b8981]"></div>

  <div class="flex items-stretch gap-1.25 bg-[#0e1012] px-1 py-0.75">
    {#each [0, 1, 2] as bay (bay)}
      <span
        class="h-2.75 min-w-3 flex-1 rounded-[1px] bg-[repeating-linear-gradient(to_right,#4a545d_0_6px,transparent_6px_8px)]"
      ></span>
    {/each}
  </div>
  <div class="h-0.75" style:background={color}></div>
{/snippet}

{#snippet amfleet()}
  <div class="flex items-stretch gap-0.75 bg-[#cbc9c2] px-1 py-0.75">
    {@render sign(tw`bg-[#12161a]`, tw`h-3`)}
    <span
      class="min-w-6 flex-1 rounded-[1px] bg-[repeating-linear-gradient(to_right,transparent_0_4px,#39424a_4px_10px,transparent_10px_15px)]"
    ></span>
  </div>
  <div class="h-[2.5px]" style:background="#123a63"></div>
  <div class="h-[1.5px] bg-[#c3372e]"></div>
{/snippet}

{#snippet bilevel()}
  <div class="flex items-stretch gap-0.75 bg-[#c9c7bf] px-0.75 pt-1 pb-0.75">
    {@render sign(tw`bg-[#141719]`, tw`h-3.5`)}
    {@render glass()}
  </div>

  <div class="h-0.75" style:background="#003da5"></div>

  <div class="bg-[#c9c7bf] px-0.75 py-0.75">
    <span
      class="block h-1.75 rounded-[1px] bg-[repeating-linear-gradient(to_right,#39424a_0_5px,transparent_5px_8px)]"
    ></span>
  </div>
{/snippet}
