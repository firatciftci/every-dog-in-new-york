<script lang="ts">
  import type { Round, Tale } from "#lib/compare.js";
  import { rivalColor } from "#lib/layers.js";
  import { rateFormat } from "#lib/query.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  let {
    tale,
    rounds,
    theme,
  }: { tale: Tale; rounds: Array<Round>; theme: "light" | "dark" } = $props();

  const ceiling = $derived.by(() => {
    let top = 0;
    for (const round of rounds) {
      for (const rate of round.rates) {
        top = Math.max(top, rate);
      }
    }

    return top > 0 ? top : 1;
  });

  const at = (rate: number) => (rate / ceiling) * 100;

  function span(round: Round) {
    let low = Infinity;
    let high = 0;
    for (const rate of round.rates) {
      low = Math.min(low, rate);
      high = Math.max(high, rate);
    }

    return { low: low === Infinity ? 0 : low, high };
  }
</script>

<ul class="grid gap-y-2.5">
  {#each rounds as round (round.slug)}
    {const bar = $derived(span(round))}
    {const winner = $derived(tale.rivals[round.won])}
    <li class="min-w-0">
      <button
        type="button"
        class="group block w-full rounded-[3px] px-1 py-0.5 text-left transition-colors duration-200 hover:bg-foreground/[0.035]"
        onpointerenter={() => {
          explorer.point("slug", round.slug);
        }}
        onpointerleave={() => {
          explorer.point("slug", null);
        }}
        onfocus={() => {
          explorer.point("slug", round.slug);
        }}
        onblur={() => {
          explorer.point("slug", null);
        }}
        onclick={() => {
          explorer.goTo(round.slug);
        }}
      >
        <span class="flex items-baseline justify-between gap-2">
          <span
            class="min-w-0 truncate text-[0.78125rem] leading-tight text-foreground/90"
          >
            {round.name}
          </span>
          <span
            class="shrink-0 numeric text-[0.6875rem] tabular-nums"
            style:color={round.won >= 0 ? rivalColor(theme, round.won) : ""}
          >
            +{rateFormat(round.gap)}
          </span>
        </span>

        <span class="relative mt-1.5 block h-2.5 w-full" aria-hidden="true">
          <span
            class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/12"
          ></span>
          <span
            class="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground/25"
            style:left="{at(bar.low)}%"
            style:width="{Math.max(0, at(bar.high) - at(bar.low))}%"
          ></span>
          {#each round.rates as rate, i (i)}
            <span
              class={cn(
                "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-background",
                { "z-10": i === round.won },
              )}
              style:left="{at(rate)}%"
              style:background={rivalColor(theme, i)}
              style:opacity={i === round.won ? 1 : 0.55}
            ></span>
          {/each}
        </span>

        <span class="sr-only">
          {round.name}:
          {#each round.rates as rate, i (i)}
            {tale.rivals[i]?.label}
            {rateFormat(rate)} per 1,000{i < round.rates.length - 1
              ? ", "
              : ". "}
          {/each}
          {winner?.label} leads by {rateFormat(round.gap)}.
        </span>
      </button>
    </li>
  {/each}
</ul>

<div
  class="mt-2 flex justify-between border-t rule pt-1 numeric text-[0.65625rem] text-muted-foreground tabular-nums"
>
  <span>0</span>
  <span>{rateFormat(ceiling)} per 1,000 dogs</span>
</div>
