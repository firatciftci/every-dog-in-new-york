<script lang="ts">
  import { CrosshairIcon } from "@lucide/svelte";
  import type { Painted } from "#lib/layers.js";
  import type { LayerId, PaintedProperties } from "#lib/types.js";
  import Brine from "#lib/components/brand/brine.svelte";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";

  let { painted, limit = 6 }: { painted: Painted; limit?: number } = $props();

  let expanded = $state(false);
  const rows = $props.id();

  // A row removed from under the pointer never fires pointerleave; clear on unmount.
  $effect(() => () => {
    explorer.point("slug", null);
  });

  const hits = $derived(painted.standing);
  const at = $derived(hits.findIndex((p) => p.slug === explorer.selected));

  const shown = $derived.by(() => {
    if (expanded) {
      return hits;
    }

    const head = hits.slice(0, limit);
    const mine = at >= limit ? hits[at] : null;

    return mine == null ? head : [...head, mine];
  });
  const skipped = $derived(!expanded && at >= limit);
  const peak = $derived(Math.max(1, ...hits.map((p) => painted.rank(p))));

  const figureOf = $derived(
    painted.kind === "categorical"
      ? (p: PaintedProperties) => count(p.dogs)
      : (p: PaintedProperties) => p.valueLabel,
  );

  const unit = $derived.by(() => {
    const view = explorer.view;

    if (view.kind === "focus") {
      const { facet, label } = view.focus;

      return facet === "breeds"
        ? `${label} per 1,000 dogs, neighborhood by neighborhood.`
        : `Dogs called ${label} per 1,000, neighborhood by neighborhood.`;
    }

    if (view.kind === "bout") {
      return "Dogs in each, biggest first.";
    }

    const ORDERS: Record<LayerId, string> = {
      breed: "Dogs in each, biggest first.",
      "distinct-breed": "Dogs in each, biggest first.",
      name: "Dogs in each, biggest first.",
      "distinct-name": "Dogs in each, biggest first.",
      dogs: "Dogs in each, biggest first.",
      density: "Dogs per square mile, biggest first.",
      "per-home": "Dogs for every 100 homes, highest first.",
      "per-person": "Dogs for every 1,000 people, highest first.",
      complaints: "Complaints to 311 for every 100 dogs, most first.",
      "since-2016":
        "Change in share of the city’s dogs since 2016, largest gain first.",
      "class-2020": "Dogs born in 2020 against 2019 and 2021, largest first.",
    };

    return ORDERS[view.layer];
  });
</script>

{#if hits.length > 0}
  <div class="flex items-baseline justify-between gap-2">
    <h2 class="slab text-[0.9375rem] text-foreground">
      {explorer.focus == null ? "On the map" : "Where the rate is highest"}
    </h2>
    {#if explorer.filters.length > 0}
      <button
        type="button"
        class="flex shrink-0 items-center gap-1 text-[0.71875rem] font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        onclick={() => {
          explorer.zoomToMatches();
        }}
      >
        <CrosshairIcon class="size-3" />
        Zoom to them
      </button>
    {/if}
  </div>

  <p class="mt-0.5 text-[0.71875rem] leading-snug text-muted-foreground">
    {unit}
  </p>

  <ul id={rows} class="mt-1.5 grid gap-0.5">
    {#each shown as hood, i (hood.slug)}
      {#if skipped && i === limit}
        <li
          aria-hidden="true"
          class="py-0.5 text-center text-[0.6875rem] leading-none text-muted-foreground/50"
        >
          ⋯
        </li>
      {/if}
      <li>
        <button
          type="button"
          class={cn(
            "relative flex w-full items-center gap-2 overflow-hidden rounded-[3px] px-2 py-1.5 text-left transition-colors duration-150 select-none",
            {
              "bg-foreground/6": explorer.selected === hood.slug,
              "bg-foreground/[0.035]":
                explorer.selected !== hood.slug &&
                explorer.isPointing("slug", hood.slug),
            },
          )}
          onpointerenter={() => {
            explorer.point("slug", hood.slug);
          }}
          onpointerleave={() => {
            explorer.point("slug", null);
          }}
          onfocus={() => {
            explorer.point("slug", hood.slug);
          }}
          onblur={() => {
            explorer.point("slug", null);
          }}
          onclick={() => {
            explorer.goTo(hood.slug);
          }}
        >
          <span
            class="absolute inset-y-0 left-0 rounded-r-xs [--bar:62%] dark:[--bar:38%]"
            style:width="{Math.max(2, (painted.rank(hood) / peak) * 100)}%"
            style:background="color-mix(in oklab, {hood.fill} var(--bar), transparent)"
            aria-hidden="true"
          ></span>
          <span class="relative min-w-0 flex-1">
            <span
              class="block text-[0.78125rem] leading-snug text-pretty text-foreground"
            >
              {hood.name}
            </span>
            <span
              class={cn(
                "relative block truncate-clip text-[0.65625rem] text-muted-foreground",
                { sodden: explorer.soaked(hood.borough) },
              )}
            >
              {hood.borough}{#if explorer.soaked(hood.borough)}<Brine
                  drop={9}
                  from={3}
                  class="-bottom-1"
                />{/if}
            </span>
          </span>
          <span
            class="relative shrink-0 text-right numeric text-[0.71875rem] text-foreground/75"
          >
            {figureOf(hood)}
          </span>
        </button>
      </li>
    {/each}
  </ul>

  {#if hits.length > limit}
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={rows}
      class="mt-1 min-h-6 py-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
      onclick={() => {
        expanded = !expanded;
      }}
    >
      {expanded ? "Show fewer" : `Show all ${hits.length}`}
    </button>
  {/if}
{/if}
