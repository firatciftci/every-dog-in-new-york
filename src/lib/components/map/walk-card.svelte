<script lang="ts" module>
  const PAW_TILT = [-12, 6, -3, 12, -6, 3, -12];
</script>

<script lang="ts">
  import { ArrowLeftIcon, ArrowRightIcon, PawPrintIcon } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import type { HoodCollection, Matrix, Summary } from "$lib/types";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import WalkHook from "$lib/components/chrome/walk-hook.svelte";
  import { strange } from "$lib/query";
  import { weave } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { swatches } from "$lib/swatches.svelte";
  import { cn } from "$lib/utils";
  import { buildStops } from "$lib/walk";

  let {
    hoods,
    matrix,
    summary,
  }: { hoods: HoodCollection; matrix: Matrix; summary: Summary } = $props();

  const palette = swatches();
  const isColored = (facet: "breeds" | "names", label: string) =>
    palette?.()[facet].has(label) ?? false;

  const stops = $derived(
    buildStops(
      hoods,
      matrix,
      summary,
      isColored,
      (field) => {
        const live = explorer.filterAt(`range:${field}`);

        return live?.kind === "range" ? live.min : null;
      },
      {
        goTo: (slug) => explorer.goTo(slug),
        show: (facet, label, as) => explorer.showSubject(facet, label, as),
        narrow: (filter) => explorer.addFilter(filter),
        openMethod: () => {
          explorer.about = true;
        },
      },
    ),
  );
  const at = $derived(explorer.walk);
  const greeting = $derived(explorer.greeting);
  const stop = $derived(stops[at] ?? null);
  const last = $derived(at === stops.length);

  function step(to: number) {
    explorer.walk = to;
    const next = stops[to];
    if (next != null) {
      explorer.leap({
        layer: next.leap.layer,
        focus: null,
        filters: next.leap.filters,
        rivals: [],
        at: null,
      });
    }
  }

  function handOver(go: () => void) {
    return () => {
      explorer.endWalk();
      go();
    };
  }

  function surprise() {
    const found = strange(hoods, matrix, {
      layer: explorer.layer,
      focus: explorer.focus,
      filters: explorer.filters,
      rivals: explorer.rivals,
      at: explorer.selected,
    });
    if (found != null) {
      explorer.leap(found);
    }
  }
</script>

<section
  aria-label="A walk through the map"
  in:fly={{ y: 20, duration: 340, easing: cubicOut }}
  out:fly={{ y: 28, duration: 220, easing: cubicOut }}
  class={cn(
    "pointer-events-auto absolute inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 max-h-[46dvh] translate-y-0 overflow-y-auto rounded-[18px] rounded-bl-lg paper px-3 py-2 text-foreground shadow-[0_10px_30px_rgb(20_16_10/0.35)] outline outline-foreground/15 transition-[opacity,translate,bottom] duration-[calc(var(--1s)*0.3)] ease-[cubic-bezier(0.16,1,0.3,1)] min-[880px]:inset-x-auto min-[880px]:top-6 min-[880px]:bottom-auto min-[880px]:left-101 min-[880px]:max-h-[60dvh] min-[880px]:w-95 min-[880px]:rounded-tl-lg min-[880px]:rounded-bl-[18px]",
    { "bottom-[calc(var(--sheet,0px)+12px)]": greeting },
    {
      "translate-y-[calc(100%+6rem)] opacity-0 ease-[cubic-bezier(0.4,0,0.7,0.2)] min-[880px]:translate-y-0 min-[880px]:opacity-20":
        explorer.roaming,
    },
  )}
>
  <div class="flex items-center justify-between gap-3">
    <div role="tablist" aria-label="Stops on the walk" class="-ml-1 flex">
      {#each [...stops, { title: "Your turn" }] as mark, i (mark.title)}
        <button
          type="button"
          role="tab"
          aria-selected={i === at}
          aria-label={mark.title}
          class="cursor-pointer p-1"
          onclick={() => step(i)}
        >
          {#key i === at}
            <PawPrintIcon
              style="rotate:{PAW_TILT[i] ?? 0}deg"
              class={cn("size-3.5 transition-colors duration-200", {
                "text-primary motion-safe:animate-[stamp_360ms_ease-out]":
                  i === at,
                "text-foreground/45": i < at,
                "text-foreground/25": i > at,
              })}
              fill={i <= at ? "currentColor" : "none"}
            />
          {/key}
        </button>
      {/each}
    </div>
    <button
      type="button"
      class="mr-1 shrink-0 cursor-pointer py-1 text-[11.5px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
      onclick={() => {
        explorer.endWalk();
      }}>{greeting ? "Not now" : "Enough walking"}</button
    >
  </div>

  {#key at}
    <div in:fade={{ duration: 220 }} class="mt-1.5 px-1">
      {#if greeting}
        <WalkHook />
      {:else if stop != null}
        <h3 class="slab text-[15px] text-foreground">{stop.title}</h3>
        <p class="mt-1 text-[13.5px] leading-relaxed text-foreground/85">
          <Sentence parts={weave(stop.template, stop.slots)} />
        </p>
      {:else}
        <h3 class="slab text-[15px] text-foreground">Your turn</h3>
        <p class="mt-1 text-[13.5px] leading-relaxed text-foreground/85">
          Breed and name chips color the map, place names open their cards, and
          clicking a number shows what it counts.
        </p>
        <ul class="mt-2 grid gap-1 text-[13px]">
          <li>
            <button
              type="button"
              class="cursor-pointer text-left font-medium text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              onclick={handOver(() => {
                explorer.openSearch();
              })}>Look up your own dog’s name</button
            >
          </li>
          <li>
            <button
              type="button"
              class="cursor-pointer text-left font-medium text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              onclick={handOver(() => {
                explorer.tryInSearch("Greenpoint vs Park Slope");
              })}>Hold two neighborhoods up against each other</button
            >
          </li>
          <li>
            <button
              type="button"
              class="cursor-pointer text-left font-medium text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              onclick={surprise}>Show me something strange</button
            >
          </li>
          <li>
            <button
              type="button"
              class="cursor-pointer text-left font-medium text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              onclick={handOver(() => {
                explorer.about = true;
              })}>How I built it</button
            >
          </li>
        </ul>
      {/if}
    </div>
  {/key}

  {#if !greeting}
    <div class="mt-2 flex items-baseline justify-between gap-3 text-[12.5px]">
      {#if at > 0}
        <button
          type="button"
          class="cursor-pointer py-1 text-left text-muted-foreground transition-colors duration-200 hover:text-foreground"
          onclick={() => step(at - 1)}
          ><ArrowLeftIcon
            aria-hidden="true"
            class="inline size-3 -translate-y-px text-current"
            strokeWidth={2.25}
          />
          {stops[at - 1]?.title ?? "Back"}</button
        >
      {:else}
        <span></span>
      {/if}
      {#if !last}
        <button
          type="button"
          class="group flex cursor-pointer items-baseline gap-1.5 py-1 text-right slab text-[13px] text-foreground transition-colors duration-200 hover:text-primary"
          onclick={() => step(at + 1)}
        >
          {stops[at + 1]?.title ?? "Your turn"}
          <ArrowRightIcon
            aria-hidden="true"
            class="size-3 translate-y-px text-primary transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={2.25}
          />
        </button>
      {/if}
    </div>
  {/if}
</section>
