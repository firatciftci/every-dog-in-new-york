<script lang="ts">
  import type { Painted } from "$lib/layers";
  import type { Part } from "$lib/sentence";
  import type { LayerId, Matrix, PaintedProperties } from "$lib/types";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import { failing, filterKey, filterParts } from "$lib/query";
  import { cityRate, rankIn } from "$lib/rate";
  import { chip, figure, partsText } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { count, ordinal } from "$lib/utils";

  let {
    props,
    painted,
    matrix,
  }: { props: PaintedProperties; painted: Painted; matrix: Matrix } = $props();

  const focus = $derived(explorer.focus);
  const asking = $derived(focus != null || explorer.filters.length > 0);

  const at = $derived(painted.standing.findIndex((p) => p.slug === props.slug));
  const rates = $derived(painted.standing.map((p) => painted.rank(p)));
  const rankOf = (p: PaintedProperties) => rankIn(rates, painted.rank(p));
  const place = $derived(rankOf(props));
  const total = $derived(painted.standing.length);
  const above = $derived(at > 0 ? (painted.standing[at - 1] ?? null) : null);
  const below = $derived(at >= 0 ? (painted.standing[at + 1] ?? null) : null);

  const broken = $derived(failing(explorer.filters, matrix, props));

  const rate = $derived(focus == null ? null : painted.rank(props));
  const city = $derived(
    focus == null ? 0 : cityRate(painted.marks, painted.rank),
  );

  const said = $derived.by<Array<Part>>(() => {
    if (focus == null || rate == null) {
      return [];
    }

    const tag = chip(focus.facet, focus.label, () => {
      explorer.showCity();
    });
    const isBreed = focus.facet === "breeds";

    if (rate <= 0) {
      return isBreed
        ? ["No", tag, "on record here."]
        : ["No dogs called", tag, "on record here."];
    }

    const lead: Array<Part> = isBreed
      ? [figure(props.valueLabel), tag, "per 1,000 dogs here,"]
      : [figure(props.valueLabel), "dogs called", tag, "per 1,000 here,"];

    return [...lead, "against", figure(painted.unit(city)), "across the city."];
  });

  const stands = $derived(
    at >= 0 && (focus == null || rate == null || rate > 0),
  );

  const word = $derived.by(() => {
    if (focus != null) {
      return "highest";
    }

    const WORDS: Partial<Record<LayerId, string>> = {
      density: "most packed",
      "per-home": "doggiest",
      "per-person": "doggiest",
      complaints: "most complained about",
    };

    return WORDS[explorer.layer] ?? "biggest";
  });
</script>

{#if asking}
  <div class="mt-3 border-b rule pb-3">
    {#if said.length > 0}
      <p class="text-[13px] leading-relaxed text-foreground/85">
        <Sentence parts={said} />
      </p>
    {/if}

    {#if at < 0}
      <p class="mt-2 text-[13px] leading-relaxed text-foreground/85">
        <strong class="font-semibold text-foreground">Grayed out</strong>: not
        one of the neighborhoods{" "}{#each broken as filter, i (filterKey(filter))}{#if i > 0},
            nor one{" "}{/if}<button
            type="button"
            aria-label="Drop the rule: {partsText(filterParts(filter))}"
            class="cursor-pointer text-left underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-muted-foreground hover:line-through hover:decoration-solid focus-visible:text-muted-foreground focus-visible:line-through focus-visible:decoration-solid"
            onclick={() => {
              explorer.removeFilter(filterKey(filter));
            }}
            ><Sentence
              parts={i === broken.length - 1
                ? [...filterParts(filter), "."]
                : filterParts(filter)}
            /></button
          >{/each}
      </p>
    {:else if stands}
      <p class="mt-1 text-[13px] leading-relaxed text-foreground/85">
        {#if place === 1}
          The {word} of the
        {:else}
          The <strong class="numeric font-bold text-foreground"
            >{ordinal(place)}</strong
          >
          {word} of the
        {/if}{" "}<button
          type="button"
          class="cursor-pointer numeric font-bold text-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
          aria-label="Turn to the {count(total)} neighborhoods on the map"
          onclick={() => {
            explorer.showCity();
          }}>{count(total)}</button
        > on the map.
      </p>
    {/if}

    {#if above != null || below != null}
      <div class="mt-2 flex items-start justify-between gap-3 text-[12px]">
        {#if above != null}
          {const step = $derived(above)}
          <button
            type="button"
            aria-label="Go to {step.name}, {ordinal(rankOf(step))}"
            class="max-w-[47%] cursor-pointer py-1 text-left font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            onclick={() => {
              explorer.goTo(step.slug);
            }}
          >
            <span aria-hidden="true">‹</span>
            {step.name}&#8239;<span class="numeric text-[10.5px]"
              >{rankOf(step)}</span
            >
          </button>
        {:else}
          <span></span>
        {/if}

        {#if below != null}
          {const step = $derived(below)}
          <button
            type="button"
            aria-label="Go to {step.name}, {ordinal(rankOf(step))}"
            class="max-w-[47%] cursor-pointer py-1 text-right font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            onclick={() => {
              explorer.goTo(step.slug);
            }}
          >
            {step.name}&#8239;<span class="numeric text-[10.5px]"
              >{rankOf(step)}</span
            >&nbsp;<span aria-hidden="true">›</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
