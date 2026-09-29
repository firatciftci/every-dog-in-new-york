<script lang="ts" module>
</script>

<script lang="ts">
  import { mode } from "mode-watcher";
  import { expoOut } from "svelte/easing";
  import { MediaQuery } from "svelte/reactivity";
  import { slide } from "svelte/transition";
  import type { Painted } from "$lib/layers";
  import type { Focus } from "$lib/types";
  import Chip from "$lib/components/chrome/chip.svelte";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import Tray from "$lib/components/compare/tray.svelte";
  import { layerDef } from "$lib/layers";
  import { filterKey, filterParts } from "$lib/query";
  import { partsText } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { cn, count } from "$lib/utils";
  import Tally from "./tally.svelte";

  let { painted, tally = true }: { painted: Painted; tally?: boolean } =
    $props();

  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");
  const opening = $derived({
    duration: calm.current ? 0 : 250,
    easing: expoOut,
  });

  const total = $derived(painted.data.features.length);
  const kept = $derived(painted.matched ?? total);
  const cutting = $derived(explorer.filters.length > 0);
  const holding = $derived(explorer.rivals.length > 0);

  const reading = $derived(
    explorer.view.kind === "layer" ? layerDef(explorer.layer).label : null,
  );
  const theme = $derived<"light" | "dark">(
    mode.current === "dark" ? "dark" : "light",
  );
</script>

{#snippet searched(focus: Focus)}
  <p class="text-[12.5px] leading-relaxed text-foreground/85">
    <button
      type="button"
      // Punctuation goes inside: Chrome renders buttons inline-block, so a comma outside could wrap alone.
      class="cursor-pointer text-left underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-muted-foreground hover:line-through hover:decoration-solid focus-visible:text-muted-foreground focus-visible:line-through focus-visible:decoration-solid"
      aria-label="Stop showing {focus.label}"
      onclick={() => {
        explorer.focus = null;
      }}
      >{#if focus.facet === "breeds"}Every <Chip
          facet="breeds"
          label={focus.label}
        /> in the city.{:else}Every dog called <Chip
          facet="names"
          label={focus.label}
        />.{/if}</button
    >
  </p>
{/snippet}

<section
  aria-label="What the map is showing"
  class="mb-0.5 shrink-0 overflow-hidden border-y border-primary/25 bg-primary/5.5 px-5 pt-2 pb-2.5"
  transition:slide={opening}
>
  <div class="flex items-baseline justify-between gap-3">
    <h2 class="slab text-[10px] tracking-[0.13em] text-primary uppercase">
      Now showing
    </h2>

    <button
      type="button"
      class="shrink-0 py-1 text-[11.5px] font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
      onclick={() => {
        explorer.clearAll();
      }}
    >
      Start over
    </button>
  </div>

  {#if reading != null}
    <p
      class="mt-0.5 font-display text-[13.5px] leading-tight font-semibold text-foreground"
    >
      {reading}
    </p>
  {/if}

  {#if cutting}
    <p class="mt-0.5 text-[12.5px] leading-snug text-foreground/85">
      <span
        class="mr-0.5 align-baseline figure-sm"
        class:text-foreground={kept > 0}
        class:text-muted-foreground={kept === 0}>{count(kept)}</span
      >{" "}<span class="text-muted-foreground"
        >of {count(total)}
        {total === 1 ? "neighborhood" : "neighborhoods"}.</span
      >{" "}<span class="text-muted-foreground"
        >{kept > 0 ? "Every one" : "Not one"}</span
      >{" "}{#each explorer.filters as filter, i (filterKey(filter))}{const clause =
          $derived(filterParts(filter))}<button
          type="button"
          // Punctuation goes inside: Chrome renders buttons inline-block, so a comma outside could wrap alone.
          class="cursor-pointer text-left underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-muted-foreground hover:line-through hover:decoration-solid focus-visible:text-muted-foreground focus-visible:line-through focus-visible:decoration-solid"
          aria-label="Drop the rule: {partsText(clause)}"
          onclick={() => {
            explorer.removeFilter(filterKey(filter));
          }}
          ><Sentence
            parts={[...clause, i === explorer.filters.length - 1 ? "." : ","]}
          /></button
        >{" "}{/each}
    </p>
  {/if}

  {#if explorer.focus != null}
    <div class:mt-1={cutting}>{@render searched(explorer.focus)}</div>
  {/if}

  {#if holding}
    <div
      class={cn({
        "-mx-5 mt-2 border-t border-primary/25 px-5 pt-1.5":
          cutting || explorer.focus != null,
      })}
    >
      <Tray all={painted.data.features.map((f) => f.properties)} {theme} />
    </div>
  {/if}

  {#if kept === 0}
    <p class="mt-1 text-[12px] leading-snug text-muted-foreground">
      No neighborhood matches all those rules at once. Remove one to bring the
      map back.
    </p>
  {/if}

  {#if tally}
    <Tally
      {painted}
      tip
      class="border-b-0 border-primary/25 bg-transparent px-5 pb-0"
    />
  {/if}
</section>
