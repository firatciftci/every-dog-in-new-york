<script lang="ts">
  import type { HoodProperties } from "#lib/types.js";
  import { boutOf, MAX_RIVALS, rivalKey, rivalName } from "#lib/compare.js";
  import Chip from "#lib/components/chrome/chip.svelte";
  import { rivalColor } from "#lib/layers.js";
  import { explorer } from "#lib/state.svelte.js";

  let {
    all,
    theme,
  }: { all: ReadonlyArray<HoodProperties>; theme: "light" | "dark" } = $props();

  const rivals = $derived(explorer.rivals);
  const bout = $derived(boutOf(rivals));

  const waiting = $derived(rivals.length === 1);
</script>

<div class="mt-1.5">
  <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
    <span class="text-[12.5px] text-muted-foreground">
      {#if bout === "subject"}
        Head to head:
      {:else}
        Comparing
      {/if}
    </span>

    {#each rivals as rival, i (rivalKey(rival))}
      <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
        <button
          type="button"
          title="Stop comparing"
          aria-label="Stop comparing {rivalName(rival, all)}"
          class="min-h-6 cursor-pointer text-left text-[12.5px] leading-tight transition-colors duration-200 hover:line-through hover:opacity-70 focus-visible:line-through focus-visible:opacity-70"
          onclick={() => {
            explorer.removeRival(rival);
          }}
        >
          {#if rival.kind === "breeds" || rival.kind === "names"}
            <Chip
              facet={rival.kind}
              label={rival.label}
              tone={rivalColor(theme, i)}
              title="Stop comparing"
            />
          {:else}
            <span class="font-display font-semibold text-foreground">
              {rivalName(rival, all)}
            </span>
          {/if}
        </button>

        {#if i < rivals.length - 1}
          <span aria-hidden="true" class="text-[12.5px] text-muted-foreground">
            {bout === "place" ? (i < rivals.length - 2 ? "," : "and") : "vs"}
          </span>
        {/if}
      </span>
    {/each}

    {#if waiting}
      <span class="text-[12.5px] text-muted-foreground">with…</span>
    {/if}

    {#if rivals.length > 1}
      <button
        type="button"
        class="ml-0.5 min-h-6 shrink-0 py-1 text-[11.5px] font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        onclick={() => {
          explorer.clearRivals();
        }}
      >
        Clear
      </button>
    {/if}
  </div>

  {#if waiting}
    <p class="mt-0.5 text-[12px] leading-snug text-muted-foreground">
      <button
        type="button"
        class="text-left font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        onclick={() => {
          explorer.openSearch();
        }}
      >
        {rivals[0]?.kind === "hood" || rivals[0]?.kind === "borough"
          ? "Pick another place"
          : "Pick another dog"}
      </button>
      {rivals[0]?.kind === "hood" || rivals[0]?.kind === "borough"
        ? "and the two go side by side."
        : "and the map splits between them."}
    </p>
  {:else if rivals.length >= MAX_RIVALS}
    <p class="mt-0.5 text-[12px] leading-snug text-muted-foreground">
      Four is the most that stays readable. Adding a fifth drops the first.
    </p>
  {/if}
</div>
