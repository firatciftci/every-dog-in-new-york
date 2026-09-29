<script lang="ts">
  import type { Said } from "$lib/photos";
  import type { Filter } from "$lib/query";
  import type { Facet, HoodCollection, Matrix } from "$lib/types";
  import Plate from "$lib/components/brand/plate.svelte";
  import ModeLine from "$lib/components/chrome/mode-line.svelte";
  import Gallery from "$lib/components/panel/gallery.svelte";
  import { saidOf } from "$lib/photos";
  import { filterKey, wouldKeep } from "$lib/query";
  import { explorer } from "$lib/state.svelte";
  import { FACET_FIELDS } from "$lib/types";
  import { count } from "$lib/utils";

  let {
    facet,
    label,
    hoods,
    matrix,
    size = 78,
    class: className,
  }: {
    facet: Facet;
    label: string;
    hoods: HoodCollection;
    matrix: Matrix;
    size?: number;
    class?: string;
  } = $props();

  let said = $state<Said | null>(null);

  $effect(() => {
    const wanted = label;
    let live = true;
    void saidOf(wanted).then((found) => {
      if (live) {
        said = found;
      }
    });

    return () => {
      live = false;
      said = null;
    };
  });

  const readings = $derived.by(() => {
    const { top, distinct } = FACET_FIELDS[facet];
    const only = (field: typeof top | typeof distinct): Filter => ({
      kind: "in",
      field,
      values: [label],
      negate: false,
    });
    const lead = only(top);
    const stand = only(distinct);
    const keys = [filterKey(lead), filterKey(stand)];

    const mine = (key: string) => {
      const live = explorer.filterAt(key);

      return (
        live?.kind === "in" &&
        !live.negate &&
        live.values.length === 1 &&
        live.values[0] === label
      );
    };

    const winner = (
      word: string,
      gloss: string,
      none: string,
      as: "lead" | "stand",
      filter: Filter,
      key: string,
    ) => ({
      key,
      word,
      gloss,
      none,
      as,
      on: mine(key),
      n: wouldKeep(
        hoods,
        matrix,
        explorer.filters.filter((f) => !keys.includes(filterKey(f))),
        filter,
      ),
    });

    return [
      {
        key: "live",
        word: "where they live",
        gloss: "Every neighborhood, shaded by how common they are.",
        none: "",
        as: "live" as const,
        on: explorer.isActiveFocus(facet, label),
        n: null,
      },
      winner(
        "where they lead",
        "Only where they are the most common of all.",
        "They lead nowhere on this map.",
        "lead",
        lead,
        keys[0]!,
      ),
      winner(
        "where they stand out",
        "Only where they beat their citywide rate most.",
        "They stand out nowhere on this map.",
        "stand",
        stand,
        keys[1]!,
      ),
    ];
  });
</script>

<section class={className}>
  <div class="flex items-end justify-between gap-2">
    <h2
      class="-ml-0.5 min-w-0 flex-1 pb-1 font-display text-[27px] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
    >
      {label}
    </h2>

    {#if facet === "breeds"}
      <!-- Separate element: wag-hover and the arrival both set animation, and one element cannot hold both. -->
      {#key label}
        <span
          class="block max-w-[44%] shrink-0 origin-bottom motion-safe:animate-[fetch_0.66s_linear]"
        >
          <Plate breed={label} height={size} class="origin-bottom wag-hover" />
        </span>
      {/key}
    {/if}
  </div>

  <div class="h-1.25 rounded-[50%] bg-primary/70"></div>

  {#if said != null}
    <p class="mt-2 text-[13px] leading-relaxed text-foreground/85">
      {said.text}
    </p>
    <p class="mt-1 text-[11px] leading-snug text-muted-foreground">
      From
      <a
        href={said.page}
        target="_blank"
        rel="noreferrer external"
        class="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
        >Wikipedia<span class="sr-only"> (opens in a new tab)</span></a
      >,
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="license noreferrer external"
        class="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
        >CC BY-SA 4.0<span class="sr-only"> (opens in a new tab)</span></a
      >.
    </p>
  {/if}

  <div class="mt-3">
    <ModeLine
      id="subject"
      size="md"
      options={readings.map((reading) => ({
        key: reading.key,
        word: reading.word,
        gloss: !reading.on && reading.n === 0 ? reading.none : reading.gloss,
        on: reading.on,
        dead: !reading.on && reading.n === 0,
        count: reading.n == null ? undefined : count(reading.n),
        pick: () => explorer.showSubject(facet, label, reading.as),
      }))}
    />
  </div>

  <p class="mt-2.5 text-[12.5px] leading-snug text-muted-foreground">
    <button
      type="button"
      class="text-left font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
      onclick={() => {
        explorer.openCompare({ kind: facet, label });
      }}
    >
      Hold {label} up against another {facet === "breeds" ? "breed" : "name"}
    </button>
  </p>

  {#if facet === "breeds"}
    <Gallery breed={label} why="searched" plate={false} class="mt-3" />
  {/if}
</section>
