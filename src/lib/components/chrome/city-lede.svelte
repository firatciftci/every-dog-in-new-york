<script lang="ts">
  import type { Painted } from "#lib/layers.js";
  import type { Part } from "#lib/sentence.js";
  import type { CatKey, LayerId } from "#lib/types.js";
  import { ARTICLED } from "#lib/query.js";
  import { cityRate } from "#lib/rate.js";
  import { chip, figure, place } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";
  import { count } from "#lib/utils.js";
  import Sentence from "./sentence.svelte";

  let { painted }: { painted: Painted } = $props();

  const all = $derived(painted.standing);

  function heartland(key: CatKey, label: string) {
    const tally: Record<string, number> = {};
    let wins = 0;
    for (const p of all) {
      if (p[key] === label) {
        wins += 1;
        tally[p.borough] = (tally[p.borough] ?? 0) + 1;
      }
    }

    const best = Object.entries(tally).toSorted((a, b) => b[1] - a[1])[0];

    return best != null && best[1] > wins / 2 ? best[0] : null;
  }

  const UNITS: Partial<Record<LayerId, string>> = {
    density: "to the square mile",
    "per-home": "dogs for every 100 homes",
    "per-person": "dogs for every 1,000 people",
    complaints: "complaints to 311 for every 100 dogs",
    "since-2016": "in its share of the city’s dogs since 2016",
    "class-2020": "in dogs born in 2020 against 2019 and 2021",
  };

  const unit = $derived(
    explorer.focus != null
      ? "per 1,000 dogs"
      : (UNITS[explorer.layer] ?? "dogs"),
  );

  const citywide = $derived(
    explorer.focus == null ? 0 : cityRate(painted.marks, painted.rank),
  );

  const parts = $derived.by<Array<Part>>(() => {
    if (painted.kind === "categorical" && painted.key != null) {
      const key = painted.key;
      if (explorer.filterAt(`in:${key}`) != null) {
        return [];
      }

      const facet = painted.facet ?? "breeds";
      const [first, second] = painted.legend
        .filter(
          (entry) =>
            entry.members == null && entry.areas != null && entry.areas > 0,
        )
        .toSorted((a, b) => (b.areas ?? 0) - (a.areas ?? 0));
      if (first == null) {
        return [];
      }

      const distinct = key === "distinct_breed" || key === "distinct_name";
      const wins = distinct ? "stands out in" : "leads";
      const share = distinct ? "stand out" : "lead";

      const rest = painted.legend.find((entry) => entry.members != null);
      const spare = rest?.areas ?? 0;
      const others =
        rest?.members?.filter((m) => (m.areas ?? 0) > 0).length ?? 0;

      const named = second?.areas ?? first.areas ?? 0;
      const tail: Array<Part> =
        spare > 1 && others > 1 && spare > named
          ? [
              "In",
              figure(count(spare)),
              "neighborhoods,",
              figure(count(others)),
              `different ${facet} ${share}.`,
            ]
          : [];

      const lead = [
        chip(facet, first.label, () => explorer.setFocus(facet, first.label)),
        wins,
        figure(count(first.areas ?? 0)),
        `of ${count(all.length)} neighborhoods.`,
      ];
      if (second == null) {
        return [...lead, ...tail];
      }

      const spread = new Set(all.map((p) => p.borough)).size > 1;
      const where = spread ? heartland(key, second.label) : null;

      return [
        ...lead,
        chip(facet, second.label, () => explorer.setFocus(facet, second.label)),
        "follows with",
        figure(count(second.areas ?? 0)),
        where == null
          ? "."
          : `, most of them in ${ARTICLED.has(where) ? "the " : ""}${where}.`,
        ...tail,
      ];
    }

    const most = all[0];
    const least = all.at(-1);
    if (painted.kind !== "sequential" || most == null || least == null) {
      return [];
    }

    const lead = [
      place(most.name, () => explorer.goTo(most.slug), {
        field: "slug",
        value: most.slug,
      }),
      "leads with",
      figure(most.valueLabel),
      `${unit}.`,
    ];

    return explorer.focus != null
      ? [...lead, "Across the city it is", figure(painted.unit(citywide)), "."]
      : [
          ...lead,
          place(least.name, () => explorer.goTo(least.slug), {
            field: "slug",
            value: least.slug,
          }),
          "has",
          figure(least.valueLabel),
          ".",
        ];
  });
</script>

{#if parts.length > 0}
  <p class="text-[0.8125rem] leading-relaxed text-foreground/85">
    <Sentence {parts} />
  </p>
{/if}
