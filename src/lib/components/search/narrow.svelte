<script lang="ts">
  import type { Filter, Metric } from "#lib/query.js";
  import type { HoodCollection, Matrix } from "#lib/types.js";
  import Brine from "#lib/components/brand/brine.svelte";
  import Chip from "#lib/components/chrome/chip.svelte";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import {
    BOROUGHS,
    distribution,
    filterKey,
    filterParts,
    matching,
    metricReader,
    wouldKeep,
  } from "#lib/query.js";
  import { cityRate, totals } from "#lib/rate.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";
  import RangeEditor from "./range-editor.svelte";
  import Sink from "./sink.svelte";

  let { hoods, matrix }: { hoods: HoodCollection; matrix: Matrix } = $props();

  const subject = $derived(explorer.subject);

  function keeps(next: Filter, without?: string) {
    const base =
      without == null
        ? explorer.filters
        : explorer.filters.filter((f) => filterKey(f) !== without);

    return wouldKeep(hoods, matrix, base, next);
  }

  function withCount<T extends { filter: Filter }>(offer: T) {
    const live = explorer.filterAt(filterKey(offer.filter));

    return { ...offer, live, n: keeps(live ?? offer.filter) };
  }

  function toggle(next: Filter) {
    const key = filterKey(next);
    if (explorer.filterAt(key) == null) {
      explorer.addFilter(next);
      explorer.capSheet("peek");
    } else {
      explorer.removeFilter(key);
    }
  }

  const boroughs = $derived(
    BOROUGHS.filter((b) =>
      hoods.features.some((f) => f.properties.borough === b),
    ),
  );

  const boroughsOn = $derived(explorer.boroughs);

  const standing = $derived(
    matching(hoods, matrix, explorer.filters)?.size ?? hoods.features.length,
  );

  const quiet = $derived.by(() => {
    const metric: Metric = { kind: "field", field: "dogs" };
    const floor = Math.round(
      distribution(metric, hoods, matrix).quantile(0.25),
    );

    return {
      lead: "Hide the quarter with the fewest dogs",
      tail: "",
      filter: { kind: "range", metric, min: floor, max: null } satisfies Filter,
    };
  });

  const doggy = $derived.by(() => {
    const rate = totals(hoods.features.map((f) => f.properties)).perHome;

    return {
      lead: "Above the citywide rate of dogs per home",
      tail: "",
      filter: {
        kind: "range",
        metric: { kind: "field", field: "dogs_per_100_homes" },
        // Snapped to the slider grid, or the range editor rewrites the rule when it mounts.
        min: Math.round(rate * 10) / 10,
        max: null,
      } satisfies Filter,
    };
  });

  const worthKeeping = $derived(
    boroughsOn.length > 0 ||
      boroughs.some((borough) => {
        const n = keeps(
          { kind: "in", field: "borough", values: [borough], negate: false },
          "in:borough",
        );

        return n > 0 && n < standing;
      }),
  );

  const cuts = $derived.by(() => {
    if (subject == null) {
      return [withCount(doggy), withCount(quiet)].filter(
        (offer) => offer.live != null || (offer.n > 0 && offer.n < standing),
      );
    }

    const { facet, label } = subject;
    const rate: Metric = { kind: "rate", facet, label };
    const citywide = cityRate(
      hoods.features.map((f) => f.properties),
      metricReader(rate, matrix),
    );
    const grid = distribution(rate, hoods, matrix).max < 10 ? 0.1 : 1;

    const offers = [
      {
        lead: "Where",
        tail: "is above its citywide rate",
        filter: {
          kind: "range",
          metric: rate,
          // Snapped to the slider grid, or the range editor rewrites the rule when it mounts.
          min: Math.max(grid, Math.round(citywide / grid) * grid),
          max: null,
        } satisfies Filter,
      },
    ];

    return [...offers, doggy, quiet]
      .map((offer) => withCount(offer))
      .filter(
        (offer) => offer.live != null || (offer.n > 0 && offer.n < standing),
      );
  });

  const loose = $derived.by(() => {
    const claimed = new Set(cuts.map((cut) => filterKey(cut.filter)));

    return explorer.filters.filter(
      (f): f is Extract<Filter, { kind: "range" }> =>
        f.kind === "range" && !claimed.has(filterKey(f)),
    );
  });
</script>

{#if worthKeeping || explorer.sank || cuts.length > 0 || loose.length > 0}
  <section>
    <h2 class="slab text-[0.9375rem] text-foreground">Narrow the map</h2>

    {#if worthKeeping}
      <p class="mt-1.5 text-[0.78125rem] leading-relaxed text-foreground/85">
        Keep only{" "}{#each boroughs as borough, i (borough)}{const on =
            $derived(boroughsOn.includes(borough))}{const n = $derived(
            keeps(
              {
                kind: "in",
                field: "borough",
                values: [borough],
                negate: false,
              },
              "in:borough",
            ),
          )}<button
            type="button"
            aria-pressed={on}
            class={cn(
              "py-1 transition-colors duration-200",
              { "relative sodden": explorer.soaked(borough) },
              {
                "font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-[3px]":
                  on,
                "text-foreground":
                  !on && explorer.isPointing("borough", borough),
                "text-foreground/75 hover:text-foreground":
                  !on && n > 0 && !explorer.isPointing("borough", borough),
                "text-foreground/60": !on && n === 0,
              },
            )}
            onpointerenter={() => {
              explorer.point("borough", borough);
            }}
            onpointerleave={() => {
              explorer.point("borough", null);
            }}
            onfocus={() => {
              explorer.point("borough", borough);
            }}
            onblur={() => {
              explorer.point("borough", null);
            }}
            onclick={() => {
              explorer.toggleBorough(borough);
            }}
            >{borough}&#8239;<span
              class="numeric text-[0.65625rem] text-muted-foreground">{n}</span
            ><span class="sr-only">
              neighborhoods</span
            >{#if explorer.soaked(borough)}<Brine
                drop={9}
                from={4}
                class="-bottom-1"
              />{/if}</button
          >{i === boroughs.length - 1
            ? "."
            : i === boroughs.length - 2
              ? boroughs.length > 2
                ? ", or "
                : " or "
              : ", "}{/each}
      </p>
    {/if}

    {#if worthKeeping || explorer.sank}
      <Sink />
    {/if}

    {#if cuts.length > 0}
      <div class="mt-3.5 flex items-baseline justify-between gap-2 px-1.5">
        <h3 class="slab text-[0.78125rem] text-foreground">Quick filters</h3>
        <span
          aria-hidden="true"
          class="shrink-0 text-[0.65625rem] text-muted-foreground"
          >neighborhoods left</span
        >
      </div>

      <ul class="mt-1 grid gap-1">
        {#each cuts as cut (filterKey(cut.filter))}
          {const on = $derived(cut.live != null)}
          <li>
            <button
              type="button"
              aria-pressed={on}
              aria-expanded={on}
              class={cn(
                "flex w-full items-baseline gap-2 rounded-[3px] px-1.5 py-1 text-left text-[0.78125rem] transition-colors duration-200",
                { "bg-foreground/6": on, "hover:bg-foreground/[0.035]": !on },
              )}
              onclick={() => {
                toggle(cut.filter);
              }}
            >
              <span class="min-w-0 flex-1 text-pretty text-foreground/85">
                {cut.lead}{#if cut.tail.length > 0 && subject != null}{" "}<Chip
                    facet={subject.facet}
                    label={subject.label}
                  />{" "}{cut.tail}{/if}
              </span>
              <span
                class="shrink-0 numeric text-[0.6875rem] text-muted-foreground"
              >
                {count(cut.n)}<span class="sr-only"> left</span>
              </span>
            </button>

            {#if cut.live?.kind === "range"}
              <div class="mt-1.5 pr-1.5 pl-3">
                <RangeEditor filter={cut.live} {hoods} {matrix} />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#each loose as filter (filterKey(filter))}
      <div class="mt-3">
        <p
          class="flex items-baseline gap-2 text-[0.78125rem] leading-snug text-foreground"
        >
          <!-- ::first-letter needs a block box; a flex item is one, the flex container is not. -->
          <span class="min-w-0 flex-1 text-pretty first-letter:uppercase">
            <Sentence parts={filterParts(filter)} />
          </span>
          <span class="shrink-0 numeric text-[0.6875rem] text-muted-foreground">
            {count(keeps(filter))}
          </span>
        </p>
        <div class="mt-1.5"><RangeEditor {filter} {hoods} {matrix} /></div>
      </div>
    {/each}
  </section>
{/if}
