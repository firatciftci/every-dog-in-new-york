<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { fly, slide } from "svelte/transition";
  import type { Painted } from "#lib/layers.js";
  import type {
    HoodCollection,
    HoodDetail,
    Matrix,
    PaintedProperties,
    Shelter,
    Summary,
  } from "#lib/types.js";
  import Collar from "#lib/components/brand/collar.svelte";
  import Rosette from "#lib/components/brand/rosette.svelte";
  import Bout from "#lib/components/compare/bout.svelte";
  import Answer from "#lib/components/panel/answer.svelte";
  import Detail from "#lib/components/panel/detail.svelte";
  import HoodHead from "#lib/components/panel/hood-head.svelte";
  import { paneOf } from "#lib/components/panel/pane.svelte.js";
  import ShelterLine from "#lib/components/panel/shelter-line.svelte";
  import Stats from "#lib/components/panel/stats.svelte";
  import Subject from "#lib/components/panel/subject.svelte";
  import Turn from "#lib/components/panel/turn.svelte";
  import Box from "#lib/components/search/box.svelte";
  import Docket from "#lib/components/search/docket.svelte";
  import Narrow from "#lib/components/search/narrow.svelte";
  import Results from "#lib/components/search/results.svelte";
  import Shelf from "#lib/components/search/shelf.svelte";
  import { scrollEdges } from "#lib/scroll.js";
  import { explorer } from "#lib/state.svelte.js";
  import CityLede from "./city-lede.svelte";
  import Colophon from "./colophon.svelte";
  import LegendBody from "./legend-body.svelte";
  import Tabs from "./tabs.svelte";
  import ViewPicker from "./view-picker.svelte";
  import WalkHook from "./walk-hook.svelte";

  let {
    painted,
    selected,
    detail,
    hoods,
    matrix,
    summary,
    shelters,
    licenses,
  }: {
    painted: Painted;
    selected: PaintedProperties | null;
    detail: HoodDetail | null;
    hoods: HoodCollection;
    matrix: Matrix;
    summary: Summary;
    shelters: Array<Shelter>;
    licenses: number;
  } = $props();

  const view = paneOf(() => ({ painted, selected, detail, shelters }));
  const here = $derived(view.here);
  const filtering = $derived(view.filtering);
  const versus = $derived(view.versus);
  const comparing = $derived(view.comparing);
  const theme = $derived(view.theme);
  const open = $derived(view.open);
  const showing = $derived(view.showing);
  const pane = $derived(view.pane);
  const turn = $derived(view.turn);
  const refocus = view.refocus;
</script>

{#snippet deck()}
  <ViewPicker />
  {#if explorer.walk < 0}
    <div class="mt-3"><CityLede {painted} /></div>
  {/if}
  <div class="mt-3 border-t rule pt-3">
    <LegendBody {painted} />
  </div>
{/snippet}

<section
  aria-label="Panel"
  class="pointer-events-auto absolute inset-y-0 left-0 z-40 flex w-90 flex-col paper shadow-[6px_0_22px_rgb(58_48_38/0.14)] dark:shadow-[6px_0_22px_rgb(0_0_0/0.5)]"
>
  <div
    class="pointer-events-none deckle-r absolute inset-y-0 -right-3 w-3 paper"
    aria-hidden="true"
  ></div>

  <Collar {licenses} year={summary.extract_year} />

  <div class="shrink-0 px-5 pt-3.5 pb-1.5">
    <h1
      class="rotate-[-0.6deg] text-center showbill text-[15px] leading-none uppercase"
    >
      Every dog in New York
    </h1>
  </div>

  <div class="relative z-40 mt-2 shrink-0 border-t rule px-5 pt-3 pb-1.5">
    <Box {hoods} {matrix} {shelters} />
  </div>

  <Shelf {hoods} {matrix} />

  {#if filtering}
    <Docket {painted} />
  {/if}

  {#if open && selected != null}
    <Tabs {painted} {selected} />
  {/if}

  <div
    id="rail-pane"
    role={open ? "tabpanel" : undefined}
    aria-labelledby={open ? `rail-tab-${explorer.tab}` : undefined}
    class="relative min-h-0 flex-1 border-t rule"
  >
    {#key pane}
      <div
        in:fly={{
          x: turn.x,
          duration: turn.in,
          delay: turn.delay,
          easing: cubicOut,
        }}
        out:fly={{ x: -turn.x, duration: turn.out, easing: cubicOut }}
        {@attach refocus}
        tabindex="-1"
        class="absolute inset-0 scroll-fade-y outline-none"
      >
        <div
          {@attach scrollEdges()}
          class="h-full overflow-y-auto overscroll-contain px-5 py-4"
        >
          {#if showing && selected != null && detail != null}
            <HoodHead props={selected} {painted} />
            <Answer props={selected} {painted} {matrix} />
            <div class="mt-3">
              <Stats props={selected} {hoods} {summary} />
            </div>
            <ShelterLine {here} />
            <div class="mt-4">
              <Detail props={selected} {detail} {matrix} />
            </div>
            <Turn {painted} />
          {:else if filtering}
            {#if explorer.subject != null && !versus}
              {const shown = $derived(explorer.subject)}
              <Subject
                facet={shown.facet}
                label={shown.label}
                {hoods}
                {matrix}
                class="mb-4 border-b rule pb-4"
              />
            {/if}
            {#if comparing}
              <Bout
                standing={painted.standing}
                city={painted.marks}
                {matrix}
                {theme}
              />
              <div class="mt-4 border-t rule pt-3"></div>
            {/if}
            <Results {painted} />
            <div class="mt-4 border-t rule pt-3">
              <Narrow {hoods} {matrix} />
            </div>
            <div class="mt-4 border-t rule pt-3">{@render deck()}</div>
          {:else}
            {#if explorer.walk < 0 && !explorer.hookInBubble}
              <div
                transition:slide={{ duration: 260 }}
                class="mb-3 border-b rule pb-3"
              >
                <WalkHook />
              </div>
            {/if}
            {@render deck()}
            <div class="mt-4 border-t rule pt-3">
              <Narrow {hoods} {matrix} />
            </div>
          {/if}
        </div>
      </div>
    {/key}
  </div>

  <Colophon />
</section>

<div class="pointer-events-none absolute top-5 right-6 z-30 hidden xl:block">
  <Rosette
    class="pointer-events-auto"
    breed={painted.facet === "breeds"
      ? (painted.legend[0]?.label ?? "Labrador (or Crossbreed)")
      : "Labrador (or Crossbreed)"}
    {licenses}
    onclick={() => {
      explorer.about = true;
    }}
  />
</div>
