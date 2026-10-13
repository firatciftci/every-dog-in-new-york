<script lang="ts" module>
  const FOCUS: Array<{
    kind: "breeds" | "names" | "news";
    keys: Array<string>;
  }> = [
    { kind: "breeds", keys: [] },
    { kind: "breeds", keys: ["French Bulldog"] },
    { kind: "breeds", keys: ["doodles", "French Bulldog"] },
    { kind: "breeds", keys: ["Chihuahua", "Yorkshire Terrier"] },
    { kind: "breeds", keys: ["Jindo", "Bernese Mountain Dog"] },
    { kind: "names", keys: ["Luna", "Max", "Bella"] },
    { kind: "news", keys: ["early"] },
    { kind: "news", keys: ["late"] },
    { kind: "breeds", keys: [] },
  ];

  const PAD = { l: 44, r: 132, t: 40, b: 34 };

  const SPLIT = 2016;
</script>

<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { prefersReducedMotion, Tween } from "svelte/motion";
  import type { Matrix, Stories } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import { rootFontSize } from "#lib/narrow-layout.svelte.js";
  import { chip, dial, figure, weave } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";
  import { fit, NEWS } from "#lib/stories.js";
  import { cn } from "#lib/utils.js";
  import Scrolly from "./scrolly.svelte";

  let {
    stories,
    matrix,
    leave,
  }: { stories: Stories; matrix: Matrix; leave: (act: () => void) => void } =
    $props();

  const data = $derived(stories.fashion);
  const years = $derived(data.years);
  const first = $derived(years[0]!);
  const final = $derived(years.at(-1)!);
  const family = (key: string) => data.breeds.find((b) => b.key === key)!;
  const valueAt = (series: Array<number>, year: number) =>
    series[years.indexOf(year)] ?? 0;
  const peakOf = (series: Array<number>) => {
    let best = 0;
    for (const [i, v] of series.entries()) {
      if (v > (series[best] ?? 0)) {
        best = i;
      }
    }

    return { year: years[best]!, value: series[best]! };
  };
  const per = (v: number) =>
    v >= 10 ? Math.round(v).toString() : v.toFixed(1);

  const frenchie = $derived(family("French Bulldog").per_1k);
  const since2016 = $derived(frenchie.slice(years.indexOf(2017)));
  const doodles = $derived(family("doodles").per_1k);
  const chihuahua = $derived(family("Chihuahua").per_1k);
  const chiPeak = $derived(peakOf(chihuahua));
  const jindo = $derived(family("Jindo").per_1k);
  const jindoPeak = $derived(peakOf(jindo));

  const lunaFrom = $derived(
    years.find((y) => data.tops[String(y)]?.[1] === "Luna") ?? final,
  );
  const before = $derived([
    ...new Set(
      years
        .filter((y) => y < lunaFrom && y >= 2008)
        .map((y) => data.tops[String(y)]![1]),
    ),
  ]);

  const news = $derived(
    Object.entries(data.spikes).flatMap(([year, list]) =>
      list
        .filter((s) => NEWS[`${year}:${s.name}`] != null)
        .map((s) => ({
          year: Number(year),
          ...s,
          why: NEWS[`${year}:${s.name}`]!,
        })),
    ),
  );

  let pick = $state(2016);
  const picked = $derived<[string, string]>(
    data.tops[String(pick)] ?? ["", ""],
  );
  const pickedNews = $derived(news.find((n) => n.year === pick) ?? null);

  function goBreed(label: string) {
    leave(() => {
      explorer.showSubject("breeds", label, "live");
    });
  }

  function goName(label: string) {
    leave(() => {
      explorer.showSubject("names", label, "live");
    });
  }

  const nameChip = (label: string) =>
    matrix.names[label] == null
      ? chip("names", label)
      : chip("names", label, () => goName(label));

  let active = $state(0);
  const focus = $derived(FOCUS[active] ?? FOCUS[0]!);

  const lines = $derived(focus.kind === "names" ? "names" : "breeds");

  const series = $derived([
    ...data.breeds.map((b) => ({
      kind: "breeds",
      key: b.key,
      plate: b.plate,
      values: b.per_1k,
    })),
    ...Object.entries(data.names).map(([key, values]) => ({
      kind: "names",
      key,
      plate: null,
      values,
    })),
  ]);

  const top = $derived.by(() => {
    const shown = series.filter((s) => s.kind === lines);
    const lit = shown.filter((s) => focus.keys.includes(s.key));
    const pool = lit.length > 0 ? lit : shown;
    let max = 0;
    for (const s of pool) {
      for (const v of s.values) {
        max = Math.max(max, v);
      }
    }

    return max * 1.12;
  });

  const ceiling = Tween.of(() => top, {
    duration: () => (prefersReducedMotion.current ? 0 : 700),
    easing: cubicOut,
  });

  let w = $state(0);
  let h = $state(0);
  const right = $derived(((w < 520 ? 112 : PAD.r) * rootFontSize()) / 16);
  const x = (year: number) =>
    PAD.l + ((year - first) / (final - first)) * Math.max(1, w - PAD.l - right);
  const y = (v: number) =>
    h -
    PAD.b -
    (v / Math.max(1, ceiling.current)) * Math.max(1, h - PAD.t - PAD.b);
  const path = (values: Array<number>) =>
    values
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${x(years[i]!).toFixed(1)} ${y(v).toFixed(1)}`,
      )
      .join("");

  const ticks = $derived.by(() => {
    const raw = ceiling.current / 4;
    const unit = raw > 20 ? 25 : raw > 8 ? 10 : raw > 4 ? 5 : raw > 2 ? 2 : 1;

    return [0, 1, 2, 3, 4]
      .map((k) => k * unit)
      .filter((t) => t <= ceiling.current);
  });

  const label = (key: string) => (key === "doodles" ? "Doodles" : key);
</script>

{#snippet title()}
  <h2
    id="story-title"
    class="font-display text-[1.85rem] leading-none font-bold tracking-tight @min-[55rem]:text-[clamp(2.1rem,4.4vw,3.2rem)] @min-[55rem]:leading-[0.98]"
  >
    Fifteen years of dog fashion
  </h2>
  <p
    class="mt-2 font-display text-[1rem] leading-snug text-foreground/80 @min-[55rem]:mt-3 @min-[55rem]:text-[1.125rem]"
  >
    Sort every dog in the city’s seven license files by the year it was born,
    and you can watch breeds come into fashion and go out of it.
  </p>
  <p
    class="mt-2.5 text-[0.8125rem] leading-snug text-muted-foreground @min-[55rem]:mt-4 @min-[55rem]:text-[0.875rem]"
  >
    Each line is the share of dogs born that year, per 1,000. A dog that appears
    in several files is counted once.
  </p>
{/snippet}

{#snippet french()}
  <Sentence
    parts={weave(
      `Among dogs born in 2011, {{a}} in every 1,000 were {{fb}}. Among dogs born in 2016, {{b}}. Then the climb stopped. Every birth year since has held between {{lo}} and {{hi}}.`,
      {
        a: figure(per(valueAt(frenchie, 2011))),
        fb: chip("breeds", "French Bulldog", () => goBreed("French Bulldog")),
        b: figure(per(valueAt(frenchie, 2016))),
        lo: figure(per(Math.min(...since2016))),
        hi: figure(per(Math.max(...since2016))),
      },
    )}
  />
  <p class="mt-3">
    The breed became the most registered in the country only in 2022, by the
    American Kennel Club’s count. New York got there first.
  </p>
{/snippet}

{#snippet doodle()}
  <Sentence
    parts={weave(
      `Doodles and other poodle mixes kept climbing: {{a}} per 1,000 dogs born in 2014, and {{b}} per 1,000 born in {{final}}. That is about one dog in {{one}}. The group counts the city’s {{gd}}, Labradoodle, Cockapoo, Maltipoo, and poodle crossbreed labels.`,
      {
        a: figure(per(valueAt(doodles, 2014))),
        b: figure(per(valueAt(doodles, final))),
        final: figure(String(final)),
        one: figure(String(Math.round(1000 / valueAt(doodles, final)))),
        gd: chip("breeds", "Goldendoodle", () => goBreed("Goldendoodle")),
      },
    )}
  />
{/snippet}

{#snippet small()}
  <Sentence
    parts={weave(
      `The small dogs that once led the file went the other way. {{chi}} peaked at {{peak}} per 1,000 dogs born in {{py}} and fell to {{now}} for {{final}}. {{yt}} slipped too.`,
      {
        chi: chip("breeds", "Chihuahua", () => goBreed("Chihuahua")),
        peak: figure(per(chiPeak.value)),
        py: figure(String(chiPeak.year)),
        now: figure(per(valueAt(chihuahua, final))),
        final: figure(String(final)),
        yt: chip("breeds", "Yorkshire Terrier", () =>
          goBreed("Yorkshire Terrier"),
        ),
      },
    )}
  />
  <p class="mt-3 text-[0.875rem] text-muted-foreground">
    Each line counts the breed’s crossbreed label too, and only labels the
    city’s form already offered in 2016, so a new label cannot pass for a new
    trend.
  </p>
{/snippet}

{#snippet risers()}
  <Sentence
    parts={weave(
      `Two breeds started from near zero. The {{jindo}}, a breed from Korea, went from {{a}} per 1,000 dogs born in 2012 to {{b}} for {{py}}. The {{bern}} rose from about {{c}} to {{d}}.`,
      {
        jindo: chip("breeds", "Jindo", () => goBreed("Jindo")),
        a: figure(per(valueAt(jindo, 2012))),
        b: figure(per(jindoPeak.value)),
        py: figure(String(jindoPeak.year)),
        bern: chip("breeds", "Bernese Mountain Dog", () =>
          goBreed("Bernese Mountain Dog"),
        ),
        c: figure(per(valueAt(family("Bernese Mountain Dog").per_1k, 2012))),
        d: figure(per(valueAt(family("Bernese Mountain Dog").per_1k, final))),
      },
    )}
  />
{/snippet}

{#snippet names()}
  <Sentence
    parts={weave(
      `Names have fashions too. {{before}} led the dogs born before {{from}}. {{luna}} has led every year since.`,
      {
        before: figure(before.join(" and ")),
        from: figure(String(lunaFrom)),
        luna: nameChip("Luna"),
      },
    )}
  />
{/snippet}

{#snippet newsList(items: typeof news)}
  <ul class="mt-3 space-y-2 text-[0.875rem] @min-[55rem]:text-[0.9375rem]">
    {#each items as item (`${item.year}:${item.name}`)}
      <li>
        <span class="slab text-[0.8125rem]">{item.year}, {item.name}.</span>
        {item.why}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet headlines()}
  <p>
    Some names follow the news. Each of these ran far above its usual rate among
    the dogs born that year.
  </p>
  {@render newsList(news.filter((n) => n.year <= SPLIT))}
{/snippet}

{#snippet headlinesLate()}
  <p>Later birth years show the same pattern.</p>
  {@render newsList(news.filter((n) => n.year > SPLIT))}
{/snippet}

{#snippet yours()}
  <Sentence
    parts={weave(
      `Find your dog’s year. Among dogs born in {{year}}, the most common breed is {{breed}} and the most common name is {{name}}.`,
      {
        year: dial(
          "Birth year",
          pick,
          { min: first, max: final, step: 1 },
          (v) => String(v),
          (v) => {
            pick = v;
          },
        ),
        breed: chip("breeds", picked[0], () => goBreed(picked[0])),
        name: nameChip(picked[1]),
      },
    )}
  />
  {#if pickedNews != null}
    <span> That year’s standout name was {pickedNews.name}.</span>
  {/if}
{/snippet}

{#snippet graphic(at: number)}
  {const mode = $derived(FOCUS[at]?.kind ?? "breeds")}
  <div
    bind:clientWidth={w}
    bind:clientHeight={h}
    class="relative size-full overflow-hidden"
  >
    <div class="scene absolute inset-0" data-on={mode !== "news"}>
      {#if w > 0}
        <svg width={w} height={h} class="absolute inset-0">
          {#each ticks as tick (tick)}
            <line
              x1={PAD.l}
              x2={w - right}
              y1={y(tick)}
              y2={y(tick)}
              class="stroke-foreground/10"
            />
            <text
              x={PAD.l - 8}
              y={y(tick) + 3.5}
              text-anchor="end"
              class="fill-muted-foreground font-mono text-[0.625rem]"
              >{tick}</text
            >
          {/each}
          {#each years.filter( (yr) => (w < 520 ? yr % 5 === 1 : yr % 3 === 0 || yr === final) ) as yr (yr)}
            <text
              x={x(yr)}
              y={h - PAD.b + 18}
              text-anchor="middle"
              class="fill-muted-foreground font-mono text-[0.65625rem]"
              >{yr}</text
            >
          {/each}
          {#each series as s (`${s.kind}:${s.key}`)}
            {const shown = $derived(s.kind === lines)}
            {const lit = $derived(shown && focus.keys.includes(s.key))}
            {const lead = $derived(lit && focus.keys[0] === s.key)}
            <path
              d={path(s.values)}
              pathLength="1"
              stroke-dasharray={s.kind === "names" ? "1" : undefined}
              style:stroke-dashoffset={s.kind === "names" && !lit ? 1 : 0}
              class={cn(
                "fill-none transition-[stroke,stroke-width,opacity,stroke-dashoffset] glide",
                {
                  "stroke-primary": lead,
                  "stroke-foreground": lit && !lead,
                  "stroke-foreground/15": !lit,
                  "opacity-0":
                    !shown ||
                    (s.kind === "names" && !lit) ||
                    (!lit && Math.max(...s.values) > top),
                },
              )}
              stroke-width={lit ? 2.75 : 1.5}
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/each}
          {#if at === FOCUS.length - 1}
            <line
              x1={x(pick)}
              x2={x(pick)}
              y1={PAD.t - 12}
              y2={h - PAD.b}
              class="stroke-primary transition-[x1,x2] duration-200"
              stroke-width="1.5"
              stroke-dasharray="3 3"
            />
            <text
              x={x(pick)}
              y={PAD.t - 18}
              text-anchor="middle"
              class="fill-primary slab text-[0.8125rem]">{pick}</text
            >
          {/if}
        </svg>

        {#each series as s (`${s.kind}:${s.key}`)}
          {const end = $derived(s.values.at(-1) ?? 0)}
          {const lit = $derived(s.kind === lines && focus.keys.includes(s.key))}
          <div
            class={cn(
              "absolute flex -translate-y-1/2 items-center gap-1.5 transition-[top,opacity,translate] glide",
              { "pointer-events-none translate-x-1 opacity-0": !lit },
            )}
            style:left="{x(final) + 8}px"
            style:top="{y(Math.min(end, ceiling.current))}px"
          >
            {#if s.plate != null}
              <Plate breed={s.plate} height={w < 520 ? 24 : 34} />
            {/if}
            <span
              class="max-w-19 text-[0.75rem] leading-tight @min-[32.5rem]:max-w-none"
            >
              <span class="block font-display font-semibold"
                >{label(s.key)}</span
              >
              <span class="numeric text-muted-foreground">{per(end)}</span>
            </span>
          </div>
        {/each}
      {/if}
    </div>

    <div
      class="scene absolute inset-0 flex items-center justify-center px-4 @min-[55rem]:px-10"
      data-on={mode === "news"}
    >
      <ol class="w-full max-w-lg" {@attach fit}>
        {#each news as item, k (`${item.year}:${item.name}`)}
          {const peak = $derived(Math.max(...item.counts))}
          <li
            class={cn(
              "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b rule py-1.5 transition-opacity glide first:border-t @min-[55rem]:grid-cols-[3.25rem_minmax(0,1fr)_auto] @min-[55rem]:gap-4 @min-[55rem]:py-2.5",
              {
                "opacity-30":
                  (focus.keys[0] === "early" && item.year > SPLIT) ||
                  (focus.keys[0] === "late" && item.year <= SPLIT),
              },
            )}
          >
            <span class="slab text-[0.9375rem] text-muted-foreground"
              >{item.year}</span
            >
            <span class="flex items-center gap-3">
              <span
                class={cn(
                  "relative rounded-[9px] px-3 pt-2.5 pb-1.5 text-center brass",
                  { "-rotate-2": k % 2 === 0, "rotate-2": k % 2 === 1 },
                )}
              >
                <span
                  class="absolute top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]"
                ></span>
                <span class="block slab text-[0.9375rem] leading-none stamped"
                  >{item.name}</span
                >
              </span>
              <span class="numeric text-[0.78125rem] text-muted-foreground"
                ><span class="@min-[55rem]:hidden">{item.lift.toFixed(1)}×</span
                ><span class="@max-[55rem]:hidden"
                  >{item.lift.toFixed(1)} times its usual rate</span
                ></span
              >
            </span>
            <span class="flex h-8 items-end gap-0.75">
              {#each item.counts as n, j (j)}
                <span
                  class={cn(
                    "w-2 origin-bottom rounded-t-[1.5px] transition-[scale] glide",
                    {
                      "bg-primary": j === 4,
                      "bg-foreground/35": j !== 4,
                      "scale-y-0": mode !== "news",
                    },
                  )}
                  style:height="{Math.max(2, (n / peak) * 32)}px"
                ></span>
              {/each}
            </span>
          </li>
        {/each}
      </ol>
    </div>
  </div>
{/snippet}

<Scrolly
  steps={[
    title,
    french,
    doodle,
    small,
    risers,
    names,
    headlines,
    headlinesLate,
    yours,
  ]}
  {graphic}
  caption={(i: number) =>
    ({
      breeds:
        "Dogs born each year, per 1,000, across the city’s seven license files.",
      names: "Dogs born each year with the name, per 1,000 named dogs.",
      news: "Each name’s dogs by birth year, from four years before its spike to four years after.",
    })[FOCUS[i]?.kind ?? "breeds"]}
  onstep={(i: number) => {
    active = i;
  }}
/>
