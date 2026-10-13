<script lang="ts">
  import { TriangleAlertIcon, XIcon } from "@lucide/svelte";
  import type { System } from "#lib/rail.js";
  import { COLLARS, MIXED, newId, pet } from "#lib/pet.svelte.js";
  import { RAILROAD } from "#lib/rail.js";
  import { explorer } from "#lib/state.svelte.js";
  import Bullet from "./bullet.svelte";
  import Goldfinch from "./goldfinch.svelte";

  let {
    dog,
    breed,
    plate,
    system,
    route,
    bullet,
    color,
    service,
    boarded,
    hood,
    borough,
    slug,
    stop,
    getOff,
    dest,
    delay,
    halted,
    finch,
    below,
    nub,
    mine = false,
    peer = false,
    onadopt,
    onclose,
  }: {
    dog: string;
    breed: string;
    plate: string;
    system: System;
    route: string;
    bullet: string;
    color: string;
    service: string;
    boarded: string;
    hood: string;
    borough: string;
    slug: string;
    stop: string;
    getOff: string;
    dest: string;
    delay: string | null;
    halted: boolean;
    finch: boolean;
    below: boolean;
    nub: number;
    mine?: boolean;
    peer?: boolean;
    onadopt: () => void;
    onclose: () => void;
  } = $props();

  function leave(go: () => void) {
    return () => {
      go();
      onclose();
    };
  }
</script>

<div
  role="dialog"
  aria-label="{dog}’s ticket"
  tabindex="-1"
  {@attach (node: HTMLElement) => {
    node.focus({ preventScroll: true });
  }}
  class="pointer-events-auto relative w-62 -translate-x-1/2 rounded-[10px] paper p-3 text-foreground shadow-[0_10px_30px_rgb(20_16_10/0.45)] outline outline-foreground/15 focus:outline-foreground/15"
>
  <span
    class="absolute left-1/2 size-3 rotate-45 paper outline outline-foreground/15"
    style:margin-left="{nub - 6}px"
    style:top={below ? "-6px" : "auto"}
    style:bottom={below ? "auto" : "-6px"}
    style:clip-path={below
      ? "polygon(0 0, 100% 0, 0 100%)"
      : "polygon(100% 0, 100% 100%, 0 100%)"}
  ></span>

  <button
    type="button"
    onclick={onclose}
    aria-label="Close the ticket"
    title="Close the ticket"
    class="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center text-muted-foreground transition-colors duration-200 hover:text-foreground"
  >
    <XIcon aria-hidden="true" class="size-3.5" />
  </button>

  <div class="flex items-end gap-2">
    <img
      src="/breeds/{plate}.webp"
      alt=""
      class="h-11.5 w-auto shrink-0 object-contain dark:plate-cut"
    />
    <div class="min-w-0 flex-1 pb-0.5">
      {#if mine || peer}
        <span
          class="block slab text-[0.625rem] tracking-[0.13em] text-signet uppercase"
          >{mine ? "Your dog" : "Another reader’s dog"}</span
        >
      {/if}
      {#if !peer || dog !== breed}
        <button
          type="button"
          onclick={leave(() =>
            mine ? explorer.showPet() : explorer.setFocus("names", dog),
          )}
          aria-label={mine ? `Open ${dog}’s card` : `Every dog named ${dog}`}
          class="block max-w-full cursor-pointer truncate slab text-[1.0625rem] leading-tight underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        >
          {dog}
        </button>
      {/if}
      {#if breed === MIXED}
        <span
          class="block max-w-full truncate py-0.5 text-[0.71875rem] leading-snug text-muted-foreground"
          >{breed}</span
        >
      {:else}
        <button
          type="button"
          onclick={leave(() => explorer.setFocus("breeds", breed))}
          aria-label="Every {breed}"
          class="block max-w-full cursor-pointer truncate py-0.5 text-left text-[0.71875rem] leading-snug text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-foreground hover:decoration-primary"
        >
          {breed}
        </button>
      {/if}
      <button
        type="button"
        onclick={leave(() => explorer.goTo(slug))}
        aria-label="Go to {hood}, {borough}"
        class="block max-w-full cursor-pointer truncate py-0.5 text-left text-[0.6875rem] leading-snug text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
      >
        {hood}, {borough}
      </button>
    </div>
  </div>

  <div class="mt-2.5 flex items-center gap-1.5 border-t rule pt-2">
    <Bullet {system} {route} {bullet} {color} />
    <span class="min-w-0 flex-1 leading-tight">
      <span class="block truncate text-[0.71875rem] text-foreground/85"
        >{service}</span
      >
      {#if system !== "subway"}
        <span
          class="block truncate text-[0.625rem] tracking-wide text-muted-foreground uppercase"
        >
          {RAILROAD[system].name}
        </span>
      {/if}
    </span>
  </div>

  <ol class="mt-2 grid gap-0 text-[0.75rem]">
    <li class="flex gap-2">
      <span class="relative flex w-3 shrink-0 justify-center">
        <span
          class="mt-1.25 size-1.75 rounded-full ring-[1.5px] ring-foreground"
          style:background={color}
        ></span>
        <span class="absolute top-3 -bottom-0.5 w-0.5 bg-foreground/25"></span>
      </span>
      <span class="min-w-0 flex-1 pb-2">
        <span
          class="block text-[0.625rem] tracking-wide text-muted-foreground uppercase"
          >Got on</span
        >
        <span class="block leading-snug font-medium">{boarded}</span>
      </span>
    </li>

    <li class="flex gap-2">
      <span class="relative flex w-3 shrink-0 justify-center">
        <span
          class="mt-1.25 size-1.75 rounded-full bg-background ring-[1.5px] ring-foreground/45"
        ></span>
        <span class="absolute top-3 -bottom-0.5 w-0.5 bg-foreground/25"></span>
      </span>
      <span class="min-w-0 flex-1 pb-2">
        <span
          class="block text-[0.625rem] tracking-wide text-muted-foreground uppercase"
        >
          {halted ? "Standing at" : "Next stop"}
        </span>
        <span class="block leading-snug font-medium">{stop}</span>
      </span>
    </li>

    <li class="flex gap-2">
      <span class="flex w-3 shrink-0 justify-center">
        <span
          class="mt-1.25 size-1.75 rounded-full ring-[1.5px] ring-foreground"
          style:background={color}
        ></span>
      </span>
      <span class="min-w-0 flex-1">
        <span
          class="block text-[0.625rem] tracking-wide text-muted-foreground uppercase"
          >{mine || peer ? "Riding to" : "Getting off"}</span
        >
        <span class="block leading-snug font-medium">{getOff}</span>
        <span class="block text-[0.6875rem] leading-snug text-muted-foreground">
          train runs to {dest}
        </span>
      </span>
    </li>
  </ol>

  {#if finch}
    <p
      class="mt-2.5 flex items-start gap-1.5 border-t rule pt-2 text-[0.71875rem] leading-snug text-muted-foreground"
    >
      <Goldfinch
        body="#f2c31c"
        edge="#2a2418"
        class="mt-px h-3.5 w-auto shrink-0"
      />
      <span>
        <strong class="font-semibold text-foreground">Also aboard:</strong> a goldfinch.
      </span>
    </p>
  {/if}

  {#if mine}
    <div
      class="mt-2.5 flex items-center justify-between gap-2 border-t rule pt-2"
    >
      <span class="text-[0.71875rem] leading-snug text-muted-foreground"
        >They ride until you say so.</span
      >
      <button
        type="button"
        onclick={() => {
          explorer.ride = null;
        }}
        class="shrink-0 cursor-pointer py-1 text-[0.75rem] font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        >Get off</button
      >
    </div>
  {/if}

  {#if !mine && !peer}
    <div
      class="mt-2.5 flex items-center justify-between gap-2 border-t rule pt-2"
    >
      <span class="min-w-0 text-[0.71875rem] leading-snug text-muted-foreground"
        >Bring {dog} home to {hood}.</span
      >
      <button
        type="button"
        onclick={() => {
          const now = new Date().getFullYear();
          const id = newId();
          pet.keep({
            id,
            name: dog,
            breed,
            slug,
            born: now - 1 - Math.floor(Math.random() * 10),
            collar: COLLARS[pet.dogs.length % COLLARS.length]?.key ?? "red",
          });
          explorer.showPet();
          onadopt();
        }}
        class="shrink-0 cursor-pointer py-1 text-[0.75rem] font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        >Adopt {dog}</button
      >
    </div>
  {/if}

  {#if delay != null}
    <p
      class="mt-2.5 flex items-start gap-1.5 rounded-[5px] border-[1.5px] border-[#16181a] bg-[#fdb713] px-1.5 py-1 text-[0.6875rem] leading-snug text-[#1a1508]"
    >
      <TriangleAlertIcon class="mt-0.5 size-3 shrink-0" strokeWidth={2.4} />
      <span><strong class="font-semibold">Delayed:</strong> {delay}</span>
    </p>
  {/if}
</div>
