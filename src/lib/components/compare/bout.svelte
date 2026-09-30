<script lang="ts">
  import { PawPrintIcon } from "@lucide/svelte";
  import type { Ledger, Tale } from "$lib/compare";
  import type { Part } from "$lib/sentence";
  import type { HoodProperties, Matrix } from "$lib/types";
  import {
    crosstab,
    ledgers,
    lopsided,
    MEASURES,
    tale as taleOf,
  } from "$lib/compare";
  import Plate from "$lib/components/brand/plate.svelte";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import { rivalColor } from "$lib/layers";
  import { rateFormat } from "$lib/query";
  import { liftWeight } from "$lib/rate";
  import { figure, place } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { cn, count } from "$lib/utils";
  import Dumbbell from "./dumbbell.svelte";

  let {
    standing,
    city,
    matrix,
    theme,
  }: {
    standing: ReadonlyArray<HoodProperties>;
    city: ReadonlyArray<HoodProperties>;
    matrix: Matrix;
    theme: "light" | "dark";
  } = $props();

  const rivals = $derived(explorer.rivals);
  const kind = $derived(explorer.bout);

  const tale = $derived<Tale | null>(
    kind === "subject" ? taleOf(standing, city, matrix, rivals) : null,
  );
  const books = $derived<Array<Ledger>>(
    kind === "place" ? ledgers(standing, city, matrix, rivals) : [],
  );
  const measures = $derived(
    MEASURES.filter(
      (m) => m.key !== "hoods" || books.some((book) => book.hoods > 1),
    ),
  );

  const rounds = $derived(tale == null ? [] : lopsided(tale, 12));

  const finding = $derived.by<Array<Part>>(() => {
    if (tale == null || tale.rivals.length < 2) {
      return [];
    }

    const seats = tale.rivals.map((rival, i) => ({
      rival,
      i,
      leads: tale.leads[i] ?? 0,
      city: tale.city[i] ?? 0,
    }));
    const byGround = seats.toSorted((a, b) => b.leads - a.leads);
    const byRate = seats.toSorted((a, b) => b.city - a.city);
    const [first, second] = byGround;
    if (first == null || second == null) {
      return [];
    }

    let held = 0;
    for (const seat of seats) {
      held += seat.leads;
    }
    const named = (at: (typeof seats)[number]): Part => place(at.rival.label);

    const lead: Array<Part> = [
      named(first),
      "is ahead in",
      figure(count(first.leads)),
      `of ${count(held)} neighborhoods,`,
      named(second),
      "in",
      figure(count(second.leads)),
      ".",
    ];

    const topRate = byRate[0];
    if (topRate != null && topRate.i !== first.i) {
      return [
        ...lead,
        named(topRate),
        "is more common citywide, at",
        figure(rateFormat(topRate.city)),
        "per 1,000, but it is concentrated in fewer places.",
      ];
    }

    return lead;
  });

  function best(of: (l: Ledger) => number) {
    let top = -Infinity;
    for (const book of books) {
      top = Math.max(top, of(book));
    }

    return top;
  }

  const GROUPS = [
    { facet: "breeds", title: "Top breeds" },
    { facet: "names", title: "Top names" },
  ] as const;
</script>

{#if kind === "subject" && tale != null}
  {#if finding.length > 0}
    <p class="text-[13px] leading-relaxed text-foreground/85">
      <Sentence parts={finding} />
    </p>
  {/if}

  <ul class="mt-2.5 grid">
    {#each tale.rivals as rival, i (rival.label)}
      {const seat = $derived(tale.home[i])}
      <li class="border-t rule py-1.5 first:border-t-0">
        <div class="flex items-end gap-2.5">
          <span class="relative grid h-8 w-10 shrink-0 place-items-end">
            <span
              aria-hidden="true"
              class="absolute bottom-0 left-1/2 h-1.5 w-8.5 -translate-x-1/2 rounded-[50%]"
              style:background={rivalColor(theme, i)}
            ></span>
            {#if rival.kind === "breeds"}
              <Plate
                breed={rival.label}
                height={30}
                flip={i % 2 === 1}
                class="relative mx-auto max-w-10 origin-bottom wag-hover"
              />
            {:else}
              <PawPrintIcon
                class="relative mb-1.5 size-4 text-muted-foreground/60"
                fill="currentColor"
              />
            {/if}
          </span>

          <span class="flex min-w-0 flex-1 items-baseline gap-1.5 pb-0.5">
            <span
              class="min-w-0 text-[13.5px] leading-tight font-semibold text-pretty text-foreground"
            >
              {rival.label}
            </span>
            <span
              class="ml-auto shrink-0 numeric text-[11px] text-muted-foreground tabular-nums"
            >
              <span class="font-bold text-foreground">
                {rateFormat(tale.city[i] ?? 0)}
              </span>
              per 1,000
            </span>
          </span>
        </div>

        <p
          class="mt-0.5 pl-12.5 text-[11.5px] leading-snug text-muted-foreground"
        >
          Ahead in
          <span class="numeric font-medium text-foreground/80">
            {count(tale.leads[i] ?? 0)}</span
          >{(tale.leads[i] ?? 0) === 1
            ? " neighborhood"
            : " neighborhoods"}{#if seat != null}, highest rate in
            <button
              type="button"
              class="text-left font-display font-semibold text-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              onpointerenter={() => {
                explorer.point("slug", seat.slug);
              }}
              onpointerleave={() => {
                explorer.point("slug", null);
              }}
              onfocus={() => {
                explorer.point("slug", seat.slug);
              }}
              onblur={() => {
                explorer.point("slug", null);
              }}
              onclick={() => {
                explorer.goTo(seat.slug);
              }}>{seat.name}</button
            >{/if}.
        </p>
      </li>
    {/each}
  </ul>

  {#if rounds.length > 0}
    <div class="mt-4 border-t rule pt-3">
      <h3
        class="slab text-[10px] tracking-[0.13em] text-muted-foreground uppercase"
      >
        Where they disagree most
      </h3>
      <p class="mt-0.5 mb-2 text-[11.5px] leading-snug text-muted-foreground">
        Ranked by the width of the lead rather than by the size of the
        neighborhood.
      </p>
      <Dumbbell {tale} {rounds} {theme} />
    </div>
  {/if}
{:else if kind === "place"}
  <table class="w-full table-fixed border-collapse text-left">
    <caption class="sr-only">Each place by measure</caption>
    <colgroup>
      {#each books as book (book.key)}
        <col style:width="{100 / books.length}%" />
      {/each}
    </colgroup>
    <thead>
      <tr>
        {#each books as book (book.key)}
          <th
            scope="col"
            class="px-0.5 pb-1 align-bottom font-display text-[12px] leading-tight font-semibold text-pretty text-foreground"
          >
            {book.label}
          </th>
        {/each}
      </tr>
    </thead>
    {#each measures as measure (measure.key)}
      {const top = $derived(best(measure.of))}
      <tbody>
        <tr>
          <th
            scope="rowgroup"
            colspan={books.length}
            class="border-t rule pt-1.5 pb-0 text-[11px] leading-snug font-normal text-muted-foreground"
          >
            {measure.label}
          </th>
        </tr>
        <tr>
          {#each books as book (book.key)}
            {const value = $derived(measure.of(book))}
            <td
              class={cn(
                "px-0.5 pt-0.5 pb-1.5 numeric text-[12px] tabular-nums",
                {
                  "font-bold text-foreground":
                    value === top && books.length > 1,
                  "text-foreground/70": value !== top || books.length <= 1,
                },
              )}
            >
              {measure.whole ? count(Math.round(value)) : value.toFixed(1)}
            </td>
          {/each}
        </tr>
      </tbody>
    {/each}
  </table>

  {#each GROUPS as group (group.facet)}
    {const rows = $derived(crosstab(books, group.facet))}
    {#if rows.length > 0}
      <div class="mt-4 border-t rule pt-3">
        <h3
          class="slab text-[10px] tracking-[0.13em] text-muted-foreground uppercase"
        >
          {group.title}
        </h3>
        <p class="mt-0.5 mb-1 text-[11.5px] leading-snug text-muted-foreground">
          How each place’s share compares with the city’s own. Over 1 is more
          than its share.
        </p>
        <table class="w-full table-fixed border-collapse text-left">
          <caption class="sr-only"
            >{group.title}, against the city’s share</caption
          >
          <colgroup>
            <col style:width="{books.length > 2 ? 40 : 52}%" />
            {#each books as book (book.key)}
              <col
                style:width="{(books.length > 2 ? 60 : 48) / books.length}%"
              />
            {/each}
          </colgroup>
          <thead class="sr-only">
            <tr>
              <th scope="col">{group.title}</th>
              {#each books as book (book.key)}<th scope="col">{book.label}</th
                >{/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as row (row.label)}
              <tr class="border-t rule">
                <th
                  scope="row"
                  class="py-1 pr-1.5 text-[11.5px] leading-snug font-normal text-pretty text-foreground/85"
                >
                  {row.label}
                </th>
                {#each row.lifts as value, at (at)}
                  {const weight = $derived(liftWeight(value))}
                  <td
                    class={cn(
                      "w-12 px-1 py-1 numeric text-[12px] tabular-nums",
                      {
                        "font-bold text-foreground": weight === "over",
                        "text-foreground/70": weight === "level",
                        "text-muted-foreground": weight === "under",
                      },
                    )}
                  >
                    {value.toFixed(1)}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/each}
{/if}
