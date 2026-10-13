<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import type { HoodCollection, Matrix, Stories } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import { explorer } from "#lib/state.svelte.js";
  import {
    boroughTable,
    boroughWord,
    percent,
    shortName,
    STORIES,
    tone,
  } from "#lib/stories.js";
  import { cn } from "#lib/utils.js";
  import City from "./city.svelte";

  let {
    stories,
    hoods,
    matrix,
  }: { stories: Stories; hoods: HoodCollection; matrix: Matrix } = $props();

  const lead = $derived(
    hoods.features
      .map((f) => {
        const [then, now, fresh] = stories.built.hoods[f.properties.slug] ?? [
          0, 0, 0,
        ];

        return {
          p: f.properties,
          then,
          now,
          fresh,
          r: then > 0 ? now / then : 1,
        };
      })
      .filter((x) => x.then >= 0.15 && x.fresh >= 0.2)
      .toSorted((a, b) => b.now - b.then - (a.now - a.then))[0],
  );

  const sign = $derived(
    boroughTable(hoods, matrix).signatures.toSorted(
      (a, b) => b.over - a.over,
    )[0],
  );

  const boroughOf = $derived(
    new SvelteMap(
      hoods.features.map((f) => [f.properties.slug, f.properties.borough]),
    ),
  );

  const bars = $derived(
    stories.class.years
      .map((year, i) => ({ year, n: stories.class.births[i] ?? 0 }))
      .filter((b) => b.year >= 2011),
  );
  const tallest = $derived(Math.max(...bars.map((b) => b.n)));

  const lines = $derived(
    ["doodles", "French Bulldog"].map((key) => {
      const values =
        stories.fashion.breeds.find((b) => b.key === key)?.per_1k ?? [];

      return {
        key,
        d: values
          .map(
            (v, i) =>
              `${i === 0 ? "M" : "L"}${((i / (values.length - 1)) * 100).toFixed(1)} ${(40 - (v / 120) * 38).toFixed(1)}`,
          )
          .join(""),
      };
    }),
  );

  const cards = $derived(
    STORIES.map((story) => {
      if (story.id === "class") {
        return {
          ...story,
          figure: `+${percent(stories.class.bump - 1)}`,
          dek: "more dogs born in 2020 than in the years around it.",
        };
      }

      if (story.id === "built") {
        return {
          ...story,
          figure: lead == null ? "" : `+${percent(lead.r - 1)}`,
          dek:
            lead == null
              ? "The dogs moved toward the new buildings."
              : `for ${shortName(lead.p.name)}’s share of the city’s dogs.`,
        };
      }

      if (story.id === "fashion") {
        return {
          ...story,
          figure: "2016",
          dek: "is when New York’s French Bulldog boom ended.",
        };
      }

      return {
        ...story,
        figure: sign == null ? "" : percent(sign.here / sign.total),
        dek:
          sign == null
            ? "A few names gather in one borough."
            : `of dogs named ${sign.name} live in ${boroughWord(sign.borough)}.`,
      };
    }),
  );
</script>

<section aria-labelledby="stories-heading">
  <h2 id="stories-heading" class="slab text-[0.9375rem]">
    Stories from the license files
  </h2>
  <div>
    <ul class="mt-3 grid gap-2.5">
      {#each cards as card, i (card.id)}
        <li>
          <button
            type="button"
            class={cn(
              "group relative flex w-full cursor-pointer items-center gap-3 rounded-[5px] paper p-1.5 pr-3 text-left shadow-[0_1px_0_rgb(58_48_38/0.14),0_4px_12px_-4px_rgb(58_48_38/0.2)] ring-1 ring-foreground/8 transition-[rotate,translate,box-shadow] duration-[calc(var(--1s)*0.3)] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_1px_0_rgb(58_48_38/0.14),0_10px_22px_-6px_rgb(58_48_38/0.28)] dark:shadow-none",
              {
                "rotate-[-0.6deg]": i % 2 === 0,
                "rotate-[0.6deg]": i % 2 === 1,
              },
            )}
            onclick={() => {
              explorer.story = card.id;
            }}
          >
            <span
              aria-hidden="true"
              class={cn(
                "absolute -top-1.5 -left-1.5 z-10 grid h-5.5 w-4.5 place-items-center rounded-[5px] pt-1 slab text-[0.625rem] brass transition-[rotate] duration-[calc(var(--1s)*0.3)] stamped group-hover:rotate-0",
                { "-rotate-6": i % 2 === 0, "rotate-6": i % 2 === 1 },
              )}>{i + 1}</span
            >

            <span
              aria-hidden="true"
              class="relative block h-14 w-22 shrink-0 overflow-hidden rounded-[3.5px] bg-foreground/[0.035] ring-1 ring-foreground/6"
            >
              {#if card.id === "class"}
                <span
                  class="absolute inset-x-2 top-2.5 bottom-1.5 flex items-end gap-0.5"
                >
                  {#each bars as bar (bar.year)}
                    <span
                      class={cn(
                        "flex-1 origin-bottom rounded-t-[1.5px] transition-[scale] duration-[calc(var(--1s)*0.45)] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        {
                          "bg-primary group-hover:scale-y-110":
                            bar.year === 2020,
                          "bg-foreground/25": bar.year !== 2020,
                        },
                      )}
                      style:height="{(bar.n / tallest) * 100}%"
                    ></span>
                  {/each}
                </span>
              {:else if card.id === "built"}
                <City
                  class="absolute inset-0 transition-[scale] duration-[calc(var(--1s)*0.5)] group-hover:scale-110"
                  {hoods}
                  fill={(slug: string) => {
                    const [then, now] = stories.built.hoods[slug] ?? [0, 0];

                    return then > 0
                      ? tone(Math.log(now / then) / Math.log(1.8))
                      : "var(--color-story-ground)";
                  }}
                />
              {:else if card.id === "fashion"}
                <svg
                  viewBox="0 0 100 42"
                  preserveAspectRatio="none"
                  class="absolute top-2.5 left-2 h-[calc(100%-1rem)] w-[calc(100%-2.75rem)] overflow-visible"
                >
                  {#each lines as line (line.key)}
                    <path
                      d={line.d}
                      pathLength="1"
                      class={cn(
                        "fill-none [stroke-dasharray:1] group-hover:animate-[redraw_calc(var(--1s)*0.9)_cubic-bezier(0.65,0,0.35,1)]",
                        {
                          "stroke-foreground/40": line.key === "doodles",
                          "stroke-primary": line.key === "French Bulldog",
                        },
                      )}
                      stroke-width="2"
                      vector-effect="non-scaling-stroke"
                      stroke-linejoin="round"
                    />
                  {/each}
                </svg>
                <span
                  class="absolute right-1 bottom-0.5 transition-[translate] duration-[calc(var(--1s)*0.3)] group-hover:-translate-y-0.5"
                >
                  <Plate breed="French Bulldog" height={24} halo />
                </span>
              {:else}
                <City
                  class="absolute inset-0"
                  {hoods}
                  fill={(slug: string) =>
                    boroughOf.get(slug) === sign?.borough
                      ? tone(0.8)
                      : "var(--color-story-ground)"}
                />
                {#if sign != null}
                  <span
                    class="absolute top-1 right-1 rotate-3 rounded-[5px] px-1.5 pt-1.5 pb-0.5 slab text-[0.625rem] leading-none brass transition-[rotate] duration-[calc(var(--1s)*0.3)] stamped group-hover:-rotate-3"
                    >{sign.name}</span
                  >
                {/if}
              {/if}
            </span>

            <span class="flex min-w-0 flex-1 flex-col py-0.5">
              <span
                class="font-display text-[0.84375rem] leading-[1.12] font-bold tracking-tight"
                >{card.title}</span
              >
              <span
                class="mt-1 text-[0.6875rem] leading-snug text-muted-foreground"
              >
                {#if card.figure !== ""}
                  <span class="slab text-[0.8125rem] text-primary"
                    >{card.figure}</span
                  >
                {/if}
                {card.dek}
              </span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
</section>
