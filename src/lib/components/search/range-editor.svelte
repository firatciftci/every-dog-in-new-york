<script lang="ts">
  import type { Filter } from "#lib/query.js";
  import type { HoodCollection, Matrix } from "#lib/types.js";
  import { Slider } from "#lib/components/ui/slider/index.js";
  import {
    distribution,
    filterParts,
    metricFormat,
    metricStep,
  } from "#lib/query.js";
  import { partsText } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  let {
    filter,
    hoods,
    matrix,
  }: {
    filter: Extract<Filter, { kind: "range" }> | null;
    hoods: HoodCollection;
    matrix: Matrix;
  } = $props();

  const scale = $derived.by(() => {
    if (filter == null) {
      return null;
    }

    const spread = distribution(filter.metric, hoods, matrix);
    // Domain snapped to the grid, or the top thumb can never reach the maximum.
    const grid =
      filter.metric.kind === "rate" && spread.max < 10
        ? 0.1
        : metricStep(filter.metric);
    const domain = {
      min: Math.floor(spread.min / grid) * grid,
      max: Math.ceil(spread.max / grid) * grid,
    };

    return {
      spread,
      domain,
      grid,
      peak: Math.max(...spread.bins, 1),
      format: metricFormat(filter.metric),
      low: filter.min ?? domain.min,
      high: filter.max ?? domain.max,
    };
  });

  const step = $derived(scale?.grid ?? 1);

  function commit(next: Array<number>) {
    if (filter == null || scale == null) {
      return;
    }

    const { domain } = scale;
    const [a = domain.min, b = domain.max] = next;

    explorer.addFilter({
      ...filter,
      min: a <= domain.min ? null : a,
      max: b >= domain.max ? null : b,
    });
  }
</script>

{#if scale != null}
  <!-- One $derived per field: destructuring a $derived yields non-reactive snapshots. -->
  {const spread = $derived(scale.spread)}
  {const domain = $derived(scale.domain)}
  {const peak = $derived(scale.peak)}
  {const format = $derived(scale.format)}
  {const low = $derived(scale.low)}
  {const high = $derived(scale.high)}
  <div
    role="group"
    aria-label={filter == null ? "Range" : partsText(filterParts(filter))}
  >
    <div class="flex h-9 items-end gap-px px-2" aria-hidden="true">
      {#each spread.bins as tally, i (i)}
        {const lo = $derived(
          spread.min + (i / spread.bins.length) * (spread.max - spread.min),
        )}
        {const hi = $derived(
          spread.min +
            ((i + 1) / spread.bins.length) * (spread.max - spread.min),
        )}
        <span
          class={cn("flex-1 rounded-t-xs", {
            "bg-primary/70": hi >= low && lo <= high,
            "bg-foreground/15": hi < low || lo > high,
          })}
          style:height="{Math.max(6, Math.sqrt(tally / peak) * 100)}%"
        ></span>
      {/each}
    </div>

    <Slider
      type="multiple"
      class="mt-2"
      min={domain.min}
      max={domain.max}
      {step}
      value={[low, high]}
      thumbLabels={["Lowest", "Highest"]}
      thumbTexts={[format(low), format(high)]}
      onValueChange={commit}
    />

    <div
      aria-hidden="true"
      class="mt-1.5 flex justify-between numeric text-[10.5px] text-muted-foreground"
    >
      <span>{format(domain.min)}</span>
      <span>{format(domain.max)}</span>
    </div>
  </div>
{/if}
