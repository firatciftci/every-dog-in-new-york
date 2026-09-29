<script lang="ts">
  import type { Part } from "$lib/sentence";
  import type { HoodDetail, Matrix, PaintedProperties } from "$lib/types";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import Gallery from "$lib/components/panel/gallery.svelte";
  import { chip } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { FACET_FIELDS, FACETS } from "$lib/types";
  import { count, lift } from "$lib/utils";
  import FacetList from "./facet-list.svelte";

  let {
    props,
    detail,
    matrix,
  }: { props: PaintedProperties; detail: HoodDetail; matrix: Matrix } =
    $props();

  const findings = $derived(
    FACETS.map((facet): Array<Part> | null => {
      const row = FACET_FIELDS[facet];
      const strongest = props[row.distinct];
      const mostCommon = props[row.top];
      const open = (label: string) => () => explorer.setFocus(facet, label);

      if (strongest == null) {
        return mostCommon == null
          ? null
          : [
              `The most common ${row.noun} here is`,
              chip(facet, mostCommon, open(mostCommon)),
              ".",
            ];
      }

      const named = chip(facet, strongest, open(strongest));
      if (mostCommon === strongest) {
        return [
          named,
          `is the most common ${row.noun} here and the one furthest above its citywide rate, at ${lift(props[row.lift])}.`,
        ];
      }

      return [
        named,
        `runs ${lift(props[row.lift])} its citywide rate, wider than any other ${row.noun}.`,
        ...(mostCommon == null
          ? []
          : [
              "The most common is",
              chip(facet, mostCommon, open(mostCommon)),
              ".",
            ]),
      ];
    }).filter((parts) => parts != null),
  );

  const asks = $derived(explorer.question);

  const album = $derived.by(() => {
    const signature = props.distinct_breed;
    if (asks === "distinct" && signature != null) {
      return { breed: signature, why: "distinct" as const };
    }

    const mostCommon = props.top_breed;

    return mostCommon == null
      ? null
      : { breed: mostCommon, why: "common" as const };
  });
</script>

{#if findings.length > 0}
  <section
    class="relative mb-5 rotate-[-0.7deg] bg-accent px-3.5 pt-3 pb-5 [clip-path:polygon(0_0,100%_0,100%_calc(100%-7px),92%_100%,84%_calc(100%-6px),76%_100%,68%_calc(100%-6px),60%_100%,52%_calc(100%-6px),44%_100%,36%_calc(100%-6px),28%_100%,20%_calc(100%-6px),12%_100%,4%_calc(100%-6px),0_100%)]"
  >
    <h3
      class="flex items-center gap-1.5 slab text-[13.5px] text-accent-foreground"
    >
      <svg viewBox="0 0 16 20" class="size-4 shrink-0" aria-hidden="true">
        <path d="M5 10 L2.5 19 L8 16 L13.5 19 L11 10 Z" fill="currentColor" />
        <circle cx="8" cy="6.5" r="6" fill="currentColor" />
        <circle cx="8" cy="6.5" r="3" class="fill-accent" />
      </svg>
      Who wins here
    </h3>

    {#if explorer.soaked(props.borough)}
      <span aria-hidden="true" class="watermark"></span>
    {/if}
    <div class="mt-1.5 grid gap-1.5 text-[13.5px] leading-snug text-foreground">
      {#each findings as parts, i (i)}
        <p><Sentence {parts} /></p>
      {/each}
    </div>
  </section>
{/if}

{#if album != null}
  <Gallery breed={album.breed} why={album.why} class="mb-5" />
{/if}

{#if detail.breeds.common.length > 0 || detail.names.common.length > 0}
  <p class="mb-2 text-[11.5px] leading-snug text-muted-foreground">
    Bar length is the raw count. A dot to the right of the line means a breed or
    name runs above its citywide rate, and left means it falls below.
  </p>
{/if}

<div class="mb-4">
  <FacetList
    title="Breeds here"
    facet="breeds"
    rows={detail.breeds}
    mappable={matrix.breeds}
    {asks}
  />
</div>

<div class="mb-4">
  <FacetList
    title="Names here"
    facet="names"
    rows={detail.names}
    mappable={matrix.names}
    {asks}
  />
</div>

<section>
  <h3 class="mb-1 slab text-[15px] text-foreground">
    Where these numbers come from
  </h3>
  <p class="mb-2 text-[12px] leading-snug text-muted-foreground">
    The city counts dogs by ZIP. This neighborhood draws on
    {detail.zips.length.toLocaleString("en-US")}
    {detail.zips.length === 1 ? "ZIP" : "ZIPs"}, split by homes on each side and
    weighted by a fitted estimate of dogs per home.
  </p>
  <ul class="grid">
    {#each detail.zips as source (source.zip)}
      <li class="flex items-baseline gap-1.5 py-1 text-[12px]">
        <span class="numeric font-medium text-foreground">{source.zip}</span>
        <span class="shrink-0 text-muted-foreground"
          >{count(source.dogs)} dogs</span
        >
        <span
          aria-hidden="true"
          class="min-w-4 flex-1 -translate-y-0.75 border-b border-dotted border-border"
        ></span>
        <span class="shrink-0 numeric text-muted-foreground">
          {source.share > 0 && source.share < 0.005
            ? "<1"
            : Math.round(source.share * 100)}% here
        </span>
      </li>
    {/each}
  </ul>
</section>
