<script lang="ts">
  import { PawPrintIcon } from "@lucide/svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { Pet } from "#lib/pet.svelte.js";
  import type { Everyone, HoodCollection, Matrix } from "#lib/types.js";
  import Brine from "#lib/components/brand/brine.svelte";
  import Kelp from "#lib/components/brand/kelp.svelte";
  import Plate from "#lib/components/brand/plate.svelte";
  import City from "#lib/components/story/city.svelte";
  import { PARKS } from "#lib/game/parks.js";
  import { collarOf, everyone, MIXED, nameKey, pet } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { tone } from "#lib/stories.js";
  import { cn, count, lift, ordinal } from "#lib/utils.js";
  import { SUNK_BOROUGH } from "#lib/world.js";
  import RideBooth from "./ride-booth.svelte";
  import Trend from "./trend.svelte";

  let {
    dog,
    den,
    hoods,
    matrix,
    size = 78,
  }: {
    dog: Pet;
    den: { at: [number, number]; borough: string; hood: string };
    hoods: HoodCollection;
    matrix: Matrix;
    size?: number;
  } = $props();

  const NOW = new Date().getFullYear();

  let city = $state<Everyone | null>(null);

  $effect(() => {
    let live = true;
    void everyone().then((found) => {
      if (live) {
        city = found;
      }
    });

    return () => {
      live = false;
    };
  });

  const collar = $derived(collarOf(dog.collar));
  const islander = $derived(den.borough === SUNK_BOROUGH);
  const afloat = $derived(islander && explorer.sank);
  const wet = $derived(islander && explorer.dripping);
  const age = $derived(NOW - dog.born);
  const key = $derived(nameKey(dog.name));

  const total = $derived.by(() => {
    let n = 0;
    for (const d of matrix.dogs) {
      n += d;
    }

    return n;
  });

  const at = $derived(matrix.slugs.indexOf(dog.slug));
  const breedRow = $derived(matrix.breeds[dog.breed] ?? null);
  const nameRow = $derived(matrix.names[key] ?? null);

  const breed = $derived.by(() => {
    if (breedRow == null) {
      return null;
    }

    let all = 0;
    for (const n of breedRow) {
      all += n;
    }

    let rank = 1;
    for (const row of Object.values(matrix.breeds)) {
      let other = 0;
      for (const n of row) {
        other += n;
      }
      if (other > all) {
        rank += 1;
      }
    }

    const here = at < 0 ? 0 : (breedRow[at] ?? 0);
    const dogs = at < 0 ? 0 : (matrix.dogs[at] ?? 0);
    const ratio = dogs > 0 && all > 0 ? here / dogs / (all / total) : 0;

    return { all, rank, here, ratio };
  });

  const name = $derived.by(() => {
    if (city == null) {
      return null;
    }

    const n = city.names[key] ?? 0;
    const rank = n === 0 ? null : Object.keys(city.names).indexOf(key) + 1;
    const here = nameRow == null || at < 0 ? null : (nameRow[at] ?? 0);

    return { n, rank, here };
  });

  // Lift with the map's own pull toward 1, for the breed and, where it is mapped, the name.
  const kin = $derived.by(() => {
    const live = new Set(hoods.features.map((f) => f.properties.slug));
    const sum = (row: Array<number>) => {
      let n = 0;
      for (const v of row) {
        n += v;
      }

      return n;
    };
    const bAll = breedRow == null ? 0 : sum(breedRow);
    const nAll = nameRow == null ? 0 : sum(nameRow);

    const scores = new SvelteMap<string, number>();
    for (const [i, slug] of matrix.slugs.entries()) {
      const dogs = matrix.dogs[i] ?? 0;
      if (!live.has(slug) || dogs < 150) {
        continue;
      }

      const b =
        breedRow == null
          ? 1
          : ((breedRow[i] ?? 0) + 8) / ((dogs * bAll) / total + 8);
      const n =
        nameRow == null
          ? 1
          : ((nameRow[i] ?? 0) + 4) / ((dogs * nAll) / total + 4);
      scores.set(slug, b * n);
    }

    const ranked = [...scores].toSorted((a, b) => b[1] - a[1]);
    const nameOf = (slug: string | undefined) =>
      hoods.features.find((f) => f.properties.slug === slug)?.properties.name ??
      "";
    const best = ranked[0];
    const worst = ranked.at(-1);
    const mine = ranked.findIndex(([slug]) => slug === dog.slug);

    return {
      scores,
      best: best == null ? null : { slug: best[0], name: nameOf(best[0]) },
      worst: worst == null ? null : { slug: worst[0], name: nameOf(worst[0]) },
      rank: mine < 0 ? null : mine + 1,
      of: ranked.length,
      byBreed: breedRow != null,
      byName: nameRow != null,
    };
  });

  const ages = $derived.by(() => {
    if (city == null) {
      return null;
    }

    let all = 0;
    let younger = 0;
    let tallest = 1;
    for (const [i, year] of city.years.entries()) {
      const n = city.born[i] ?? 0;
      all += n;
      tallest = Math.max(tallest, n);
      if (year > dog.born) {
        younger += n;
      }
    }

    return {
      older: all > 0 ? younger / all : 0,
      bars: city.years.map((year, i) => ({ year, n: city?.born[i] ?? 0 })),
      tallest,
    };
  });

  const ageWords = $derived(
    age <= 0 ? "a puppy" : age === 1 ? "1 year old" : `${age} years old`,
  );

  const breedWords = $derived.by(() => {
    if (breed == null || breed.ratio === 0) {
      return null;
    }

    if (breed.ratio >= 1.15) {
      return `${lift(breed.ratio)} as common in ${den.hood} as in the whole city`;
    }

    if (breed.ratio <= 0.87) {
      return `${Math.round(breed.ratio * 100)}% as common in ${den.hood} as in the whole city`;
    }

    return `about as common in ${den.hood} as in the whole city`;
  });
</script>

{#snippet action(label: string, go: () => void)}
  <button
    type="button"
    class="cursor-pointer text-left font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
    onclick={go}>{label}</button
  >
{/snippet}

<section>
  <div class="flex items-end justify-between gap-2">
    <div class="min-w-0 flex-1 pb-1">
      <p class="slab text-[0.625rem] tracking-[0.13em] text-signet uppercase">
        Your dog
      </p>
      <h2
        class="mt-0.5 -ml-0.5 font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight text-pretty wrap-break-word text-foreground"
      >
        {dog.name}
      </h2>
      <p class="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
        {dog.breed}, {ageWords}, {den.hood}
      </p>
      {#if afloat}
        <p
          class="relative mt-1 inline-block sodden text-[0.75rem] leading-snug text-brine"
        >
          Afloat in a life ring off what used to be Staten Island.
          <button
            type="button"
            class="cursor-pointer font-medium underline decoration-dotted underline-offset-[3px]"
            onclick={() => {
              explorer.unsink();
            }}>Bring the island back</button
          >
          <Brine drop={11} from={5} class="-bottom-0.5" />
        </p>
      {:else if wet}
        <p
          class="relative mt-1 inline-block sodden text-[0.75rem] leading-snug text-brine"
        >
          Back on dry land and still dripping.
          <Brine drop={11} from={5} class="-bottom-0.5" />
        </p>
      {/if}
    </div>

    {#key dog.breed}
      <span
        class={cn(
          "relative block max-w-[44%] origin-bottom motion-safe:animate-[fetch_0.66s_linear]",
          { sodden: wet || afloat },
        )}
      >
        <span
          class={cn("relative block origin-bottom", {
            shivers: wet,
            "motion-safe:animate-[float_calc(var(--1s)*3.2)_ease-in-out_infinite]":
              afloat,
          })}
        >
          <Plate
            breed={dog.breed}
            height={size}
            class="origin-bottom wag-hover"
          />
        </span>
        {#if afloat}
          <Kelp
            class="top-[2%] left-[6%] z-20 h-[52%] w-[24%] text-[oklch(0.45_0.048_168)] opacity-85 dark:text-[oklch(0.63_0.055_168)]"
          />
        {/if}
      </span>
    {/key}
  </div>

  <div class="h-1.25 rounded-[50%]" style:background={collar}></div>

  <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem]">
    {@render action(`Edit ${dog.name}`, () => {
      explorer.adopting = "edit";
    })}
    {#if !afloat}
      {@render action(`Open ${den.hood}`, () => {
        explorer.goTo(dog.slug);
      })}
    {/if}
  </p>

  {#if pet.dogs.length > 1}
    <ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Your other dogs">
      {#each pet.dogs.filter((d) => d.id !== dog.id) as other (other.id)}
        <li>
          <button
            type="button"
            class="group flex cursor-pointer items-end gap-1 rounded-[5px] bg-foreground/[0.035] py-0.5 pr-2 pl-1 ring-1 ring-foreground/8 transition-[background-color,box-shadow] duration-200 hover:bg-foreground/6 hover:ring-foreground/15"
            onclick={() => {
              pet.choose(other.id);
            }}
          >
            <span
              aria-hidden="true"
              class="origin-bottom group-hover:animate-[wag_calc(var(--1s)*0.55)_ease-in-out]"
            >
              <Plate breed={other.breed} height={22} />
            </span>
            <span class="flex items-center gap-1 pb-0.5 slab text-[0.71875rem]">
              <span
                aria-hidden="true"
                class="size-1.5 rounded-full"
                style:background={collarOf(other.collar)}
              ></span>
              {other.name}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <ul class="mt-4 grid gap-3.5">
    <li>
      <h3 class="slab text-[0.8125rem]">The name</h3>
      <p class="mt-1 text-[0.8125rem] leading-snug text-foreground/85">
        {#if name == null}
          &nbsp;
        {:else if name.n === 0}
          At most one licensed dog in New York is named {key}, so {dog.name}
          has a name almost no other dog in the city shares.
        {:else}
          <strong class="numeric font-bold text-foreground"
            >{count(name.n)}</strong
          >
          licensed dogs in the city are named {key}{#if name.rank === 1}, the
            most common name of all{:else if name.rank != null && name.rank <= 500},
            the {ordinal(name.rank)} most common name{/if}.
          {#if name.here != null && name.here >= 1.5}
            An estimated {count(name.here)} of them live in {den.hood}.
          {:else if name.here != null && name.here >= 0.5}
            About one of them lives in {den.hood}.
          {/if}
        {/if}
      </p>
      {#if nameRow != null}
        <p class="mt-1 text-[0.78125rem]">
          {@render action(`Map every dog named ${key}`, () => {
            explorer.setFocus("names", key);
          })}
        </p>
        {#key key}
          <Trend
            facet="names"
            label={key}
            mark={{ year: dog.born, color: collar }}
          />
        {/key}
      {/if}
    </li>

    {#if breed != null}
      <li>
        <h3 class="slab text-[0.8125rem]">The breed</h3>
        <p class="mt-1 text-[0.8125rem] leading-snug text-foreground/85">
          The city has <strong class="numeric font-bold text-foreground"
            >{count(breed.all)}</strong
          >
          licensed {dog.breed} dogs, {breed.rank === 1
            ? "the most common breed"
            : `the ${ordinal(breed.rank)} most common breed`}.
          {#if breedWords != null}
            The breed is {breedWords}.
          {/if}
        </p>
        <p class="mt-1 text-[0.78125rem]">
          {@render action(`Map every ${dog.breed}`, () => {
            explorer.setFocus("breeds", dog.breed);
          })}
        </p>
        {#key dog.breed}
          <Trend
            facet="breeds"
            label={dog.breed}
            mark={{ year: dog.born, color: collar }}
          />
        {/key}
      </li>
    {:else if dog.breed === MIXED}
      <li>
        <h3 class="slab text-[0.8125rem]">The breed</h3>
        <p class="mt-1 text-[0.8125rem] leading-snug text-foreground/85">
          The city’s license file has no entry for a mixed breed. It lists a mix
          under one breed, such as Terrier Crossbreed, or lists no breed at all.
          If one breed shows in {dog.name}, pick its Crossbreed entry to see how
          common it is.
        </p>
        <p class="mt-1 text-[0.78125rem]">
          {@render action("Change the breed", () => {
            explorer.adopting = "edit";
          })}
        </p>
      </li>
    {/if}

    {#if ages != null}
      <li>
        <h3 class="slab text-[0.8125rem]">The age</h3>
        <p class="mt-1 text-[0.8125rem] leading-snug text-foreground/85">
          {#if ages.older > 0}
            Born in {dog.born}, {dog.name} is older than
            <strong class="numeric font-bold text-foreground"
              >{Math.round(ages.older * 100)}%</strong
            > of the city’s licensed dogs.
          {:else}
            Born in {dog.born}, {dog.name} is younger than almost every licensed dog
            in the city.
          {/if}
          {#if dog.born === 2020}
            They belong to the class of 2020, the birth year with the most
            licensed dogs.
            {@render action(`Read why`, () => {
              explorer.story = "class";
            })}
          {/if}
        </p>
        <div class="mt-2 flex h-9 items-end gap-0.5" aria-hidden="true">
          {#each ages.bars as bar (bar.year)}
            <span
              class={cn("flex-1 rounded-t-[1.5px]", {
                "bg-foreground/18": bar.year !== dog.born,
              })}
              style:height="{Math.max(5, (bar.n / ages.tallest) * 100)}%"
              style:background={bar.year === dog.born ? collar : undefined}
            ></span>
          {/each}
        </div>
        <div
          class="mt-1 flex justify-between numeric text-[0.65625rem] text-muted-foreground"
          aria-hidden="true"
        >
          <span>born {ages.bars[0]?.year}</span>
          <span>{ages.bars.at(-1)?.year}</span>
        </div>
      </li>
    {/if}

    {#if kin.byBreed || kin.byName}
      <li>
        <h3 class="slab text-[0.8125rem]">Where {dog.name} would blend in</h3>
        <p class="mt-1 text-[0.8125rem] leading-snug text-foreground/85">
          Shaded by how common {kin.byBreed && kin.byName
            ? "both the breed and the name are"
            : kin.byBreed
              ? "the breed is"
              : "the name is"} for each neighborhood’s size.
          {#if kin.best != null}
            The best match is
            {@render action(`${kin.best.name}`, () => {
              if (kin.best != null) {
                explorer.goTo(kin.best.slug);
              }
            })}{#if kin.worst != null}, and {dog.name} would stand out most in
              {@render action(`${kin.worst.name}`, () => {
                if (kin.worst != null) {
                  explorer.goTo(kin.worst.slug);
                }
              })}{/if}.
          {/if}
          {#if kin.rank != null}
            {den.hood} ranks {ordinal(kin.rank)} of {kin.of}.
          {/if}
        </p>
        <div class="relative mt-2 aspect-[1.05] w-full">
          <City
            class="absolute inset-0 mask-none!"
            {hoods}
            fill={(slug: string) => {
              const score = kin.scores.get(slug);

              return score == null
                ? "var(--color-story-ground)"
                : tone(
                    Math.log(score) /
                      Math.log(kin.byBreed && kin.byName ? 2.2 : 1.7),
                  );
            }}
          >
            {#snippet over(
              project: (lon: number, lat: number) => [number, number],
            )}
              {const spot = $derived(project(den.at[0], den.at[1]))}
              {#if !afloat}
                <circle
                  cx={spot[0]}
                  cy={spot[1]}
                  r="9"
                  fill={collar}
                  opacity="0.3"
                  class="origin-center transform-fill motion-safe:animate-[beacon_calc(var(--1s)*2.6)_ease-in-out_infinite]"
                />
                <circle
                  cx={spot[0]}
                  cy={spot[1]}
                  r="4"
                  fill={collar}
                  stroke="white"
                  stroke-width="1.5"
                />
              {/if}
            {/snippet}
          </City>
        </div>
        <div
          class="mt-1 flex justify-between text-[0.65625rem] text-muted-foreground"
          aria-hidden="true"
        >
          <span>stands out</span>
          <span>blends in</span>
        </div>
      </li>
    {/if}
  </ul>

  <div class="mt-5 grid gap-2">
    <RideBooth {dog} {afloat} />

    {#each [PARKS.central, PARKS.prospect] as park (park.id)}
      <button
        type="button"
        disabled={afloat}
        class="group flex w-full cursor-pointer items-center gap-2 rounded-[6px] bg-foreground/[0.035] px-3 py-2.5 text-left ring-1 ring-foreground/8 transition-[background-color,box-shadow] duration-200 hover:bg-foreground/6 hover:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-100"
        onclick={() => {
          explorer.game = park.id;
        }}
      >
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full brass shadow-none! transition-transform duration-200 group-hover:-rotate-6"
          aria-hidden="true"
        >
          <PawPrintIcon class="size-3.5 -rotate-12" strokeWidth={2.25} />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block slab text-[0.8125rem] text-foreground"
            >{park.title} in {park.name}</span
          >
          <span
            class="block text-[0.71875rem] leading-snug text-muted-foreground"
          >
            {afloat
              ? "The park waits for dry land."
              : `Play it with ${dog.name} in front.`}
          </span>
        </span>
      </button>
    {/each}
  </div>

  <p class="mt-4 text-[0.71875rem] leading-snug text-muted-foreground">
    {dog.name} lives only in this browser and is not counted in any figure on the
    map.
  </p>
</section>
