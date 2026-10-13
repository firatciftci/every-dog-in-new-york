<script lang="ts" module>
  const MODES = ["build", "build", "shift", "dial", "odd", "shift"] as const;

  const NEW_FLOOR = { min: 5, max: 45, step: 5 };

  const SPAN = Math.log(1.8);
</script>

<script lang="ts">
  import { prefersReducedMotion } from "svelte/motion";
  import { SvelteMap } from "svelte/reactivity";
  import type {
    HoodCollection,
    NewHomes,
    ParkCollection,
    Stories,
  } from "#lib/types.js";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import { fetchJson } from "#lib/data.js";
  import { dial, figure, place, weave } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";
  import { percent, shortName, tone } from "#lib/stories.js";
  import { cn, count } from "#lib/utils.js";
  import City from "./city.svelte";
  import Scrolly from "./scrolly.svelte";
  import Strike from "./strike.svelte";

  let {
    stories,
    hoods,
    parks,
    leave,
  }: {
    stories: Stories;
    hoods: HoodCollection;
    parks: ParkCollection;
    leave: (act: () => void) => void;
  } = $props();

  const data = $derived(stories.built);
  const since = $derived(data.since);
  const last = $derived(Number(stories.now) - 1);

  const rows = $derived(
    hoods.features.map((f) => {
      const [then, now, fresh] = data.hoods[f.properties.slug] ?? [0, 0, 0];

      return {
        p: f.properties,
        then,
        now,
        fresh,
        r: then > 0 ? now / then : 1,
      };
    }),
  );
  const steady = $derived(rows.filter((x) => x.then >= 0.15));

  const newest = $derived(steady.toSorted((a, b) => b.fresh - a.fresh)[0]!);
  const gainers = $derived(
    steady
      .filter((x) => x.fresh >= 0.2)
      .toSorted((a, b) => b.now - b.then - (a.now - a.then))
      .slice(0, 3),
  );
  const lead = $derived(gainers[0]!);
  const odd = $derived(
    steady
      .filter((x) => x.fresh < 0.05)
      .toSorted((a, b) => b.r - a.r)
      .slice(0, 2),
  );
  const island = $derived<[number, number]>(
    data.boroughs["Staten Island"] ?? [0, 0],
  );

  let floor = $state(25);
  const split = $derived.by(() => {
    let inThen = 0;
    let inNow = 0;
    let outThen = 0;
    let outNow = 0;
    let kept = 0;
    for (const x of rows) {
      if (x.fresh * 100 >= floor) {
        kept += 1;
        inThen += x.then;
        inNow += x.now;
      } else {
        outThen += x.then;
        outNow += x.now;
      }
    }

    return {
      kept,
      rest: rows.length - kept,
      grew: inThen > 0 ? inNow / inThen - 1 : 0,
      fell: outThen > 0 ? 1 - outNow / outThen : 0,
    };
  });

  let homes = $state<NewHomes | null>(null);
  $effect(() => {
    let canceled = false;
    fetchJson<NewHomes>(fetch, "/data/new-homes.json")
      .then((loaded) => {
        if (!canceled) {
          homes = loaded;
        }
      })
      .catch(() => {});

    return () => {
      canceled = true;
    };
  });

  const lots = $derived.by(() => {
    if (homes == null) {
      return [];
    }

    const out: Array<{
      lon: number;
      lat: number;
      units: number;
      year: number;
    }> = [];
    const [lon0, lat0] = homes.origin;
    for (let i = 0; i + 3 < homes.lots.length; i += 4) {
      out.push({
        lon: lon0 + homes.lots[i]! / homes.scale,
        lat: lat0 + homes.lots[i + 1]! / homes.scale,
        units: homes.lots[i + 2]!,
        year: homes.lots[i + 3]!,
      });
    }

    return out;
  });

  const byYear = $derived.by(() => {
    const out = new SvelteMap<number, typeof lots>();
    for (const lot of lots) {
      const held = out.get(lot.year) ?? [];
      held.push(lot);
      out.set(lot.year, held);
    }

    return out;
  });

  const bySlug = $derived(new SvelteMap(rows.map((x) => [x.p.slug, x])));

  const years = $derived(
    Array.from({ length: last - since + 1 }, (_, i) => since + i),
  );

  let shownYear = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function play() {
    clearInterval(timer);
    if (prefersReducedMotion.current) {
      shownYear = last;

      return;
    }

    shownYear = since;
    timer = setInterval(() => {
      if (shownYear >= last) {
        clearInterval(timer);

        return;
      }

      shownYear += 1;
    }, 380);
  }

  $effect(() => () => {
    clearInterval(timer);
  });

  function goPlace(slug: string) {
    leave(() => {
      explorer.goTo(slug);
    });
  }

  const shade = (r: number) => tone(Math.log(r) / SPAN);
</script>

{#snippet title()}
  <h2
    id="story-title"
    class="font-display text-[1.85rem] leading-none font-bold tracking-tight @min-[55rem]:text-[clamp(2.1rem,4.4vw,3.2rem)] @min-[55rem]:leading-[0.98]"
  >
    Where the city built, the dogs followed
  </h2>
  <p
    class="mt-2 font-display text-[1rem] leading-snug text-foreground/80 @min-[55rem]:mt-3 @min-[55rem]:text-[1.125rem]"
  >
    Between the city’s {stories.then} and {stories.now} license files, New York’s
    dogs shifted toward the neighborhoods that added the most homes.
  </p>
{/snippet}

{#snippet building()}
  <Sentence
    parts={weave(
      `By the city’s tax-lot records, {{lots}} lots across New York hold homes built in {{since}} or later, {{homes}} homes in all. In {{newest}}, {{fresh}} of homes are that new.`,
      {
        lots: figure(count(data.lots)),
        since: figure(String(since)),
        homes: figure(count(data.homes)),
        newest: place(shortName(newest.p.name), () => goPlace(newest.p.slug)),
        fresh: figure(percent(newest.fresh)),
      },
    )}
  />
{/snippet}

{#snippet shift()}
  <Sentence
    parts={weave(
      `Over the same years, the city’s dogs shifted toward those places. {{lead}} held {{then}} of the city’s licensed dogs in {{y0}} and holds {{now}} now.`,
      {
        lead: place(shortName(lead.p.name), () => goPlace(lead.p.slug)),
        then: figure(`${lead.then.toFixed(2)}%`),
        y0: figure(stories.then),
        now: figure(`${lead.now.toFixed(2)}%`),
      },
    )}
  />
  <p class="mt-3">
    Across all {rows.length} neighborhoods, the larger the share of new homes, the
    more of the city’s dogs a neighborhood gained. The rank correlation between the
    two is {data.rho.toFixed(2)}.
  </p>
{/snippet}

{#snippet threshold()}
  <Sentence
    parts={weave(
      `In the {{kept}} neighborhoods where at least {{floor}} of homes are new, the share of the city’s dogs grew {{grew}}. In the other {{rest}}, it fell {{fell}}.`,
      {
        kept: figure(String(split.kept)),
        floor: dial(
          "Share of homes built since 2016",
          floor,
          NEW_FLOOR,
          (v) => `${v}%`,
          (v) => {
            floor = v;
          },
        ),
        grew: figure(percent(split.grew)),
        rest: figure(String(split.rest)),
        fell: figure(percent(split.fell)),
      },
    )}
  />
  <p class="mt-3 text-[0.875rem] text-muted-foreground">
    Drag the number to change the minimum. The map shows the neighborhoods at or
    above it.
  </p>
{/snippet}

{#snippet exceptions()}
  {#if odd.length >= 2}
    <Sentence
      parts={weave(
        `Not every gain came with new buildings. {{a}} and {{b}} gained dogs with few new homes. And Staten Island’s share fell from {{then}} in {{y0}} to {{now}}.`,
        {
          a: place(shortName(odd[0]!.p.name), () => goPlace(odd[0]!.p.slug)),
          b: place(shortName(odd[1]!.p.name), () => goPlace(odd[1]!.p.slug)),
          then: figure(`${island[0].toFixed(1)}%`),
          y0: figure(stories.then),
          now: figure(`${island[1].toFixed(1)}%`),
        },
      )}
    />
  {/if}
{/snippet}

{#snippet end()}
  <p>
    These are shares of the whole city. The city builds its yearly files in
    different ways, so only each place’s part of the whole compares across
    years. The split places the {stories.then} dogs using only the homes that stood
    then.
  </p>
  <p class="mt-3">
    <Sentence
      parts={weave(`Open {{lead}} to see who lives there now.`, {
        lead: place(shortName(lead.p.name), () => goPlace(lead.p.slug)),
      })}
    />
  </p>
{/snippet}

{#snippet graphic(active: number)}
  {const mode = $derived(MODES[active] ?? "shift")}
  {const painted = $derived(mode !== "build")}
  <div class="relative flex size-full flex-col">
    <City
      class="min-h-0 flex-1"
      {hoods}
      {parks}
      fill={(slug: string) => {
        const x = bySlug.get(slug);
        if (!painted || x == null || x.then === 0) {
          return "var(--color-story-ground)";
        }

        return shade(x.r);
      }}
      lit={mode === "dial"
        ? (slug: string) => (data.hoods[slug]?.[2] ?? 0) * 100 >= floor
        : mode === "odd"
          ? (slug: string) =>
              odd.some((x) => x.p.slug === slug) ||
              hoods.features.some(
                (f) =>
                  f.properties.slug === slug &&
                  f.properties.borough === "Staten Island",
              )
          : undefined}
      marks={mode === "shift"
        ? gainers.map((x) => ({
            slug: x.p.slug,
            text: shortName(x.p.name),
            sub: `${x.then.toFixed(2)}% to ${x.now.toFixed(2)}%`,
          }))
        : mode === "odd"
          ? odd.map((x) => ({
              slug: x.p.slug,
              text: shortName(x.p.name),
              sub: `${percent(x.fresh)} new homes`,
            }))
          : mode === "build" && shownYear >= last
            ? [
                {
                  slug: newest.p.slug,
                  text: shortName(newest.p.name),
                  sub: `${percent(newest.fresh)} of homes new`,
                },
              ]
            : []}
    >
      {#snippet over(
        at: (lon: number, lat: number) => [number, number],
        scale: number,
      )}
        {const size = $derived(Math.max(0.5, scale / 2600))}
        {#each years as year (year)}
          <g
            class={cn(
              "transition-opacity duration-[calc(var(--1s)*0.5)] ease-out",
              {
                "opacity-0": shownYear < year || mode !== "build",
                "opacity-60": mode === "build" && shownYear >= year,
              },
            )}
          >
            {const dots = $derived(
              (byYear.get(year) ?? []).map((lot) => {
                const [x, y] = at(lot.lon, lot.lat);

                return {
                  x,
                  y,
                  r: Math.max(0.5, Math.sqrt(lot.units) * 0.2 * size),
                };
              }),
            )}
            {#each dots as dot, i (i)}
              <circle cx={dot.x} cy={dot.y} r={dot.r} class="fill-foreground" />
            {/each}
          </g>
        {/each}
      {/snippet}
    </City>

    <div
      class={cn(
        "absolute top-2 left-2 -rotate-2 rounded-[10px] px-2.5 pt-3 pb-1.5 text-center brass transition-opacity duration-[calc(var(--1s)*0.4)] @min-[55rem]:top-4 @min-[55rem]:left-4 @min-[55rem]:rounded-[12px] @min-[55rem]:px-3.5 @min-[55rem]:pt-3.5 @min-[55rem]:pb-2",
        { "opacity-0": mode !== "build" || shownYear < since },
      )}
    >
      <span
        class="absolute top-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]"
      ></span>
      <span
        class="block font-sans text-[0.46875rem] font-semibold tracking-[0.18em] uppercase stamped"
        >built in</span
      >
      <span
        class="block slab text-[1.0625rem] leading-none stamped @min-[55rem]:text-[1.375rem]"
        ><Strike value={String(Math.max(since, shownYear))} /></span
      >
    </div>

    <div
      class={cn(
        "flex shrink-0 items-center justify-center gap-2 pt-1 font-mono text-[0.65625rem] text-muted-foreground transition-opacity duration-[calc(var(--1s)*0.4)]",
        { "opacity-0": !painted },
      )}
    >
      <span>lost share</span>
      <span
        class="h-2 w-28 rounded-full"
        style:background="linear-gradient(90deg, {tone(-1)}, {tone(0)}, {tone(
          1,
        )})"
      ></span>
      <span>gained share</span>
    </div>
  </div>
{/snippet}

<Scrolly
  steps={[title, building, shift, threshold, exceptions, end]}
  {graphic}
  caption={(i: number) => {
    const mode = MODES[i] ?? "shift";
    if (mode === "build") {
      return `Lots with homes built in ${since} or later, sized by the number of homes.`;
    }

    return mode === "dial"
      ? `Neighborhoods where at least ${floor}% of homes were built in ${since} or later.`
      : `Each neighborhood’s share of the city’s licensed dogs, ${stories.now} against ${stories.then}.`;
  }}
  onstep={(i: number) => {
    if (i === 1 && shownYear < last) {
      play();
    }
    if (i >= 2) {
      clearInterval(timer);
      shownYear = last;
    }
  }}
/>
