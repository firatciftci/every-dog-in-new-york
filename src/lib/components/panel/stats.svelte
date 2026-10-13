<script lang="ts" module>
  // All 197 neighborhoods on one line, lowest on the left: the share of them that sit below a value.
  function along(values: Array<number>, value: number) {
    let under = 0;
    for (const v of values) {
      if (v < value) {
        under += 1;
      }
    }

    return values.length > 1 ? (under / (values.length - 1)) * 100 : 50;
  }
</script>

<script lang="ts">
  import type { NumericField } from "#lib/query.js";
  import type {
    HoodCollection,
    PaintedProperties,
    Stories,
    Summary,
  } from "#lib/types.js";
  import { rankIn, totals } from "#lib/rate.js";
  import { explorer } from "#lib/state.svelte.js";
  import { change, percent } from "#lib/stories.js";
  import { cn, count, ordinal } from "#lib/utils.js";

  let {
    props,
    hoods,
    summary,
    stories,
  }: {
    props: PaintedProperties;
    hoods: HoodCollection;
    summary: Summary;
    stories: Stories;
  } = $props();

  const city = $derived.by(() => {
    const sum = totals(hoods.features.map((f) => f.properties));

    return {
      density: sum.density,
      perHome: sum.perHome,
      complaints: sum.perHundredDogs,
    };
  });

  const lines = $derived.by(
    (): Array<{
      figure: string;
      words: string;
      here: number;
      city: number;
      cityLabel: string;
      values: Array<number>;
      field: NumericField;
      keep: string;
      note: string | null;
    }> => {
      const all = hoods.features.map((f) => f.properties);
      const age = props.median_age;

      return [
        {
          figure: count(props.density),
          words: "dogs to the square mile",
          here: props.density,
          city: city.density,
          cityLabel: count(city.density),
          values: all.map((p) => p.density),
          field: "density",
          keep: "Keep only neighborhoods at least this dense.",
          note: null,
        },
        {
          figure: props.dogs_per_100_homes.toFixed(1),
          words: "dogs per 100 homes",
          here: props.dogs_per_100_homes,
          city: city.perHome,
          cityLabel: city.perHome.toFixed(1),
          values: all.map((p) => p.dogs_per_100_homes),
          field: "dogs_per_100_homes",
          keep: "Keep only neighborhoods with at least this many dogs per 100 homes.",
          note: null,
        },
        ...(age == null
          ? []
          : [
              {
                figure: age.toFixed(1),
                words: "years old, the average dog",
                here: age,
                city: summary.median_age,
                cityLabel: summary.median_age.toFixed(1),
                values: all.map((p) => p.median_age).filter((v) => v != null),
                field: "median_age" as const,
                keep: "Keep only neighborhoods where the average dog is at least this old.",
                note: null,
              },
            ]),
        {
          figure: props.complaints_per_100_dogs.toFixed(1),
          words: "complaints to 311 per 100 dogs",
          here: props.complaints_per_100_dogs,
          city: city.complaints,
          cityLabel: city.complaints.toFixed(1),
          values: all.map((p) => p.complaints_per_100_dogs),
          field: "complaints_per_100_dogs",
          keep: "Keep only neighborhoods with at least this many complaints per 100 licensed dogs.",
          note: `${count(props.complaints_barking)} barking, ${count(props.complaints_waste)} waste, ${count(props.complaints_leash)} off the leash`,
        },
        ...(props.share_change > 0
          ? [
              {
                figure: change(props.share_change),
                words: "in its share of the city’s dogs since 2016",
                here: props.share_change,
                city: 1,
                cityLabel: "0%",
                values: all.map((p) => p.share_change).filter((v) => v > 0),
                field: "share_change" as const,
                keep: "Keep only neighborhoods whose share grew at least this much.",
                note: `${percent(props.new_homes)} of its homes were built in 2016 or later`,
              },
            ]
          : []),
        ...(props.class_2020 > 0
          ? [
              {
                figure: change(props.class_2020),
                words: "in dogs born in 2020 against 2019 and 2021",
                here: props.class_2020,
                city: stories.class.bump,
                cityLabel: change(stories.class.bump),
                values: all.map((p) => p.class_2020).filter((v) => v > 0),
                field: "class_2020" as const,
                keep: "Keep only neighborhoods where the class of 2020 is at least this large.",
                note: null,
              },
            ]
          : []),
      ];
    },
  );
</script>

<p class="text-[0.84375rem] text-foreground/85">
  An estimated <strong
    class="numeric text-[1.0625rem] font-bold text-foreground"
    >{count(props.dogs)}</strong
  >
  dogs live among {count(props.people)} people in {count(props.homes)} homes.
</p>

{#snippet body(
  line: (typeof lines)[number],
  at: number,
  notch: number,
  rank: number,
)}
  <span class="flex items-baseline gap-x-1.5" aria-hidden="true">
    <strong class="numeric text-[1.0625rem] font-bold text-foreground"
      >{line.figure}</strong
    >
    <span class="min-w-0 flex-1 text-[0.8125rem] text-foreground/85"
      >{line.words}</span
    >
    <span class="shrink-0 numeric text-[0.6875rem] text-muted-foreground"
      >city {line.cityLabel}</span
    >
  </span>
  {#if line.note != null}
    <span
      class="block text-[0.71875rem] leading-snug text-muted-foreground"
      aria-hidden="true">{line.note}</span
    >
  {/if}
  <span class="relative mt-0.5 block h-6" aria-hidden="true">
    <span class="absolute inset-x-0 bottom-1.5 h-px bg-foreground/12"></span>
    <span
      class="absolute bottom-0.5 h-3 w-px -translate-x-1/2 bg-foreground/45"
      style:left="{notch}%"
    ></span>
    <span
      class="absolute bottom-1.5 h-px bg-foreground/35"
      style:left="{Math.min(at, notch)}%"
      style:width="{Math.abs(at - notch)}%"
    ></span>
    <span
      class="absolute bottom-1.5 size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
      style:left="{at}%"
    ></span>
    <span
      class={cn(
        "absolute bottom-3.5 numeric text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground",
        {
          "-translate-x-1/2": at >= 6 && at <= 94,
          "-translate-x-full": at > 94,
        },
      )}
      style:left="{at}%">{ordinal(rank)}</span
    >
  </span>
{/snippet}

<ul class="-mx-1.5 mt-2 grid gap-0.5">
  {#each lines as line (line.words)}
    {const at = $derived(along(line.values, line.here))}
    {const notch = $derived(along(line.values, line.city))}
    {const rank = $derived(rankIn(line.values, line.here))}
    {const label = $derived(
      `${line.figure} ${line.words}, city ${line.cityLabel}. ${ordinal(rank)} of ${line.values.length}.${line.note == null ? "" : ` ${line.note}.`}`,
    )}
    <li class="min-w-0">
      <button
        type="button"
        aria-label="{label} {line.keep}"
        class="block w-full cursor-pointer rounded-[3px] px-1.5 py-1 text-left transition-colors duration-200 hover:bg-foreground/[0.035]"
        onclick={() => {
          explorer.addFilter({
            kind: "range",
            metric: { kind: "field", field: line.field },
            min: line.here,
            max: null,
          });
          explorer.capSheet("peek");
        }}
      >
        {@render body(line, at, notch, rank)}
      </button>
    </li>
  {/each}
</ul>

<p class="mt-1.5 text-[0.71875rem] leading-snug text-muted-foreground">
  Each strip ranks all {hoods.features.length} neighborhoods from lowest to highest.
  The notch marks the city, the dot marks this neighborhood, and pressing a line keeps
  only the neighborhoods at or above the dot.
</p>
