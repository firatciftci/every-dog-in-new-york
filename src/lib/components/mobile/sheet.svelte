<script lang="ts">
  import { ChevronsDownIcon, ChevronUpIcon } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fly, slide } from "svelte/transition";
  import type { Painted } from "#lib/layers.js";
  import type {
    Detent,
    HoodCollection,
    HoodDetail,
    Matrix,
    PaintedProperties,
    SheetGrip,
    Shelter,
    Stories,
    Summary,
  } from "#lib/types.js";
  import Collar from "#lib/components/brand/collar.svelte";
  import CityLede from "#lib/components/chrome/city-lede.svelte";
  import Colophon from "#lib/components/chrome/colophon.svelte";
  import LegendBody from "#lib/components/chrome/legend-body.svelte";
  import Tabs from "#lib/components/chrome/tabs.svelte";
  import ViewPicker from "#lib/components/chrome/view-picker.svelte";
  import WalkHook from "#lib/components/chrome/walk-hook.svelte";
  import Bout from "#lib/components/compare/bout.svelte";
  import Answer from "#lib/components/panel/answer.svelte";
  import Detail from "#lib/components/panel/detail.svelte";
  import HoodHead from "#lib/components/panel/hood-head.svelte";
  import { paneOf } from "#lib/components/panel/pane.svelte.js";
  import PetTag from "#lib/components/panel/pet-tag.svelte";
  import Pet from "#lib/components/panel/pet.svelte";
  import ShelterLine from "#lib/components/panel/shelter-line.svelte";
  import Stats from "#lib/components/panel/stats.svelte";
  import Subject from "#lib/components/panel/subject.svelte";
  import Turn from "#lib/components/panel/turn.svelte";
  import Box from "#lib/components/search/box.svelte";
  import Docket from "#lib/components/search/docket.svelte";
  import Narrow from "#lib/components/search/narrow.svelte";
  import Results from "#lib/components/search/results.svelte";
  import Shelf from "#lib/components/search/shelf.svelte";
  import Tally from "#lib/components/search/tally.svelte";
  import Stack from "#lib/components/story/stack.svelte";
  import { pet } from "#lib/pet.svelte.js";
  import { scrollEdges } from "#lib/scroll.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";
  import Shell from "./sheet-shell.svelte";

  let {
    painted,
    selected,
    detail,
    hoods,
    matrix,
    summary,
    shelters,
    licenses,
    stories,
    den,
  }: {
    painted: Painted;
    selected: PaintedProperties | null;
    detail: HoodDetail | null;
    hoods: HoodCollection;
    matrix: Matrix;
    summary: Summary;
    shelters: Array<Shelter>;
    licenses: number;
    stories: Stories;
    den: { at: [number, number]; borough: string; hood: string } | null;
  } = $props();

  const view = paneOf(() => ({ painted, selected, detail, shelters }));
  const here = $derived(view.here);
  const filtering = $derived(view.filtering);
  const versus = $derived(view.versus);
  const comparing = $derived(view.comparing);
  const theme = $derived(view.theme);
  const open = $derived(view.open);
  const showing = $derived(view.showing);
  const petting = $derived(view.pet);
  const pane = $derived(view.pane);
  const turn = $derived(view.turn);
  const refocus = view.refocus;
</script>

{#snippet deck(picker: boolean)}
  {#if picker}
    <div class="mb-3"><ViewPicker /></div>
  {/if}
  {#if explorer.walk < 0}
    <CityLede {painted} />
  {/if}
  <div class="mt-3 border-t rule pt-3">
    <LegendBody {painted} />
  </div>
{/snippet}

<Shell
  detent={explorer.sheet}
  onrest={(next: Detent) => {
    explorer.restSheet(next);
  }}
>
  {#snippet head(grip: SheetGrip)}
    <button
      type="button"
      class="relative block w-full cursor-grab active:cursor-grabbing"
      aria-label={grip.label}
      aria-expanded={grip.detent !== "shut"}
      aria-controls="rail-pane"
      aria-describedby="sheet-tag"
      onclick={grip.step}
    >
      <Collar
        {licenses}
        year={summary.extract_year}
        size="sheet"
        hung={grip.detent !== "shut"}
      />
      <span
        aria-hidden="true"
        class="absolute top-2.5 right-3.5 grid size-8 place-items-center rounded-full brass"
      >
        <ChevronUpIcon
          class={cn("size-4.5 transition-transform duration-300", {
            "rotate-180": grip.detent === "full",
          })}
          strokeWidth={2.75}
        />
      </span>
    </button>
    <span id="sheet-tag" class="sr-only">
      {count(licenses)} New York City dog licenses, {summary.extract_year}
    </span>

    <button
      type="button"
      class={cn(
        "absolute top-2.5 right-14 z-10 grid size-8 cursor-pointer place-items-center rounded-full brass transition-opacity duration-300",
        { "opacity-0": grip.detent === "shut" },
      )}
      inert={grip.detent === "shut"}
      aria-label="Put the panel away"
      title="Put the panel away"
      onclick={() => {
        explorer.shutSheet();
      }}
    >
      <ChevronsDownIcon class="size-4.5" strokeWidth={2.75} />
    </button>

    <div inert={grip.detent === "shut"}>
      <div class="px-5 pt-3 pb-1.5">
        <h1
          class="rotate-[-0.6deg] text-center showbill text-[0.9375rem] leading-none uppercase"
        >
          Every dog in New York
        </h1>
      </div>

      <div class="relative z-40 mt-1 border-t rule px-5 py-2.5">
        <Box {hoods} {matrix} {shelters} />
      </div>

      <Shelf {hoods} {matrix} />

      {#if filtering}
        <Docket {painted} tally={false} />
      {/if}

      {#if open}
        <Tabs {painted} {selected} />
      {/if}
    </div>
  {/snippet}

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
          data-sheet-scroll
          {@attach scrollEdges()}
          class="h-full touch-pan-y overflow-y-auto overscroll-contain px-5 pt-3 pb-4"
        >
          {#if filtering}
            <Tally {painted} class="-mt-3 mb-3.5" />
          {/if}

          {#if petting && pet.dog != null && den != null}
            <Pet dog={pet.dog} {den} {hoods} {matrix} size={70} />
          {:else if showing && selected != null && detail != null}
            <HoodHead props={selected} {painted} size={70} />
            {#each pet.dogs.filter((d) => d.slug === selected.slug) as dog (dog.id)}
              <PetTag
                {dog}
                class="mt-3"
                words="lives here, one of an estimated {count(
                  selected.dogs,
                )} dogs."
              />
            {/each}
            <Answer props={selected} {painted} {matrix} />
            <div class="mt-3">
              <Stats props={selected} {hoods} {summary} {stories} />
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
                size={70}
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
            <div class="mt-4 border-t rule pt-3">{@render deck(true)}</div>
          {:else}
            <div class="mb-3 border-b rule pb-3"><ViewPicker /></div>
            {#if explorer.walk < 0 && !explorer.hookInBubble}
              <div
                transition:slide={{ duration: 260 }}
                class="mb-3 border-b rule pb-3"
              >
                <WalkHook />
              </div>
            {/if}
            {#if explorer.walk < 0}
              <div class="mb-4 border-b rule pb-4">
                <Stack {stories} {hoods} {matrix} />
              </div>
            {/if}
            {@render deck(false)}
            <div class="mt-4 border-t rule pt-3">
              <Narrow {hoods} {matrix} />
            </div>
          {/if}

          <div class="-mx-5 mt-5"><Colophon /></div>
        </div>
      </div>
    {/key}
  </div>
</Shell>
