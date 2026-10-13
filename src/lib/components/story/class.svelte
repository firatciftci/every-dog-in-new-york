<script lang="ts" module>
  const MODES = [
    "bars",
    "bars",
    "bars",
    "months",
    "breeds",
    "map",
    "field",
    "zoom",
  ] as const;

  const MONTH = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const DOT = 100;
  const BAR = { l: 54, r: 16, t: 78, b: 34 };
  const GUESS = { min: 3000, max: 13000, step: 100 };
</script>

<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import type { HoodCollection, ParkCollection, Stories } from "#lib/types.js";
  import { hasPlate } from "#lib/breeds.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import { chip, dial, figure, place, weave } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";
  import { boroughWord, fit, percent, shortName, tone } from "#lib/stories.js";
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

  const data = $derived(stories.class);
  const births = $derived(
    new SvelteMap(data.years.map((y, i) => [y, data.births[i] ?? 0])),
  );
  const born = (year: number) => births.get(year) ?? 0;
  const around = $derived((born(2019) + born(2021)) / 2);
  const first = $derived(data.years[0]!);

  let guess = $state(7300);
  let guessed = $state(false);
  let revealed = $state(false);

  const off = $derived(guess - born(2020));
  const verdict = $derived.by(() => {
    if (!guessed) {
      return "";
    }

    if (Math.abs(off) <= born(2020) * 0.05) {
      return `Your guess, ${count(guess)}, was within 5% of it.`;
    }

    return `Your guess, ${count(guess)}, was ${count(Math.abs(off))} too ${off < 0 ? "low" : "high"}.`;
  });

  const monthly = $derived.by(() => {
    const [startYear] = data.months_from.split("-").map(Number);

    return data.months.map((n, i) => ({
      n,
      year: startYear! + Math.floor(i / 12),
      month: i % 12,
    }));
  });
  const monthOf = (year: number, month: number) =>
    monthly.find((m) => m.year === year && m.month === month)?.n ?? 0;
  const shut = $derived(
    (monthOf(2020, 3) + monthOf(2020, 4) + monthOf(2020, 5)) /
      (monthOf(2019, 3) + monthOf(2019, 4) + monthOf(2019, 5)),
  );
  const peak = $derived(monthly.toSorted((a, b) => b.n - a.n)[0]!);

  const breedRows = $derived.by(() => {
    const rows = Object.entries(data.breeds)
      .filter(([label, [, n20]]) => n20 >= 150 && hasPlate(label))
      .map(([label, [n19, n20, n21]]) => ({
        label,
        n20,
        ratio: n20 / ((n19 + n21) / 2),
      }))
      .toSorted((a, b) => b.ratio - a.ratio);

    return [...rows.slice(0, 5), ...rows.slice(-3)];
  });
  const rising = $derived(breedRows.slice(0, 2));
  const flat = $derived(
    breedRows.slice(-3).toSorted((a, b) => b.n20 - a.n20)[0]!,
  );

  const hoodBump = $derived.by(() => {
    const out = new SvelteMap<string, { r: number; base: number }>();
    for (const f of hoods.features) {
      const [n19, , n21] = data.hoods[f.properties.slug] ?? [0, 0, 0];
      out.set(f.properties.slug, {
        r: f.properties.class_2020,
        base: (n19 + n21) / 2,
      });
    }

    return out;
  });

  const boroughs = $derived.by(() => {
    const sums = new SvelteMap<string, [number, number, number]>();
    for (const f of hoods.features) {
      const row = data.hoods[f.properties.slug];
      if (row == null) {
        continue;
      }

      const held = sums.get(f.properties.borough) ?? [0, 0, 0];
      sums.set(f.properties.borough, [
        held[0] + row[0],
        held[1] + row[1],
        held[2] + row[2],
      ]);
    }

    return [...sums]
      .map(([borough, [a, b, c]]) => ({ borough, ratio: b / ((a + c) / 2) }))
      .toSorted((x, y) => y.ratio - x.ratio);
  });

  const ranked = $derived(
    hoods.features
      .map((f) => ({ p: f.properties, ...hoodBump.get(f.properties.slug)! }))
      .filter((h) => h.base >= 30)
      .toSorted((a, b) => b.r - a.r),
  );
  const highs = $derived(ranked.slice(0, 2));
  const low = $derived(ranked.at(-1)!);

  const ages = $derived(data.ages);
  const dated = $derived.by(() => {
    let all = 0;
    for (const [, n] of ages) {
      all += n;
    }

    return all;
  });
  const largest = $derived(
    ages.every(([y, n]) => y === 2020 || n < born(2020)),
  );
  const dots = $derived.by(() => {
    const out: Array<number> = [];
    let running = 0;
    for (const [year, n] of ages) {
      running += n;
      while (out.length < Math.round(running / DOT)) {
        out.push(year);
      }
    }

    return out;
  });

  function goPlace(slug: string) {
    leave(() => {
      explorer.goTo(slug);
    });
  }

  function goBreed(label: string) {
    leave(() => {
      explorer.showSubject("breeds", label, "live");
    });
  }

  let w = $state(0);
  let h = $state(0);
  const columns = $derived((w - BAR.l - BAR.r) / data.years.length);
  const barW = $derived(Math.max(4, columns * 0.58));
  const bx = (i: number) => BAR.l + i * columns + (columns - barW) / 2;
  const by = (v: number) =>
    h - BAR.b - (v / GUESS.max) * Math.max(1, h - BAR.t - BAR.b);
  const iOf = (year: number) => data.years.indexOf(year);

  function dragTo(event: PointerEvent & { currentTarget: SVGRectElement }) {
    const top =
      event.currentTarget.ownerSVGElement?.getBoundingClientRect().top ?? 0;
    const plot = Math.max(1, h - BAR.t - BAR.b);
    const raw = ((h - BAR.b - (event.clientY - top)) / plot) * GUESS.max;
    guess = Math.min(
      GUESS.max,
      Math.max(GUESS.min, Math.round(raw / GUESS.step) * GUESS.step),
    );
    guessed = true;
  }

  const MONTH_MAX = 9000;
  const mx = (i: number) =>
    BAR.l + (i / (monthly.length - 1)) * (w - BAR.l - BAR.r);
  const my = (v: number) =>
    h - BAR.b - (v / MONTH_MAX) * Math.max(1, h - BAR.t - BAR.b);
  const line = $derived(
    monthly
      .map(
        (m, i) =>
          `${i === 0 ? "M" : "L"}${mx(i).toFixed(1)} ${my(m.n).toFixed(1)}`,
      )
      .join(""),
  );

  const LOG = { lo: Math.log(0.8), hi: Math.log(2.2) };
  const along = (r: number) =>
    ((Math.log(Math.min(2.2, Math.max(0.8, r))) - LOG.lo) / (LOG.hi - LOG.lo)) *
    100;
</script>

{#snippet title()}
  <h2
    id="story-title"
    class="font-display text-[1.85rem] leading-none font-bold tracking-tight @min-[55rem]:text-[clamp(2.1rem,4.4vw,3.2rem)] @min-[55rem]:leading-[0.98]"
  >
    The class of 2020
  </h2>
  <p
    class="mt-2 font-display text-[1rem] leading-snug text-foreground/80 @min-[55rem]:mt-3 @min-[55rem]:text-[1.125rem]"
  >
    Every license records the year a dog was born. On the city’s {stories.now}
    file, one birth year is larger than the years around it.
  </p>
{/snippet}

{#snippet climb()}
  <Sentence
    parts={weave(
      `Every year, some older dogs leave the file, so younger birth years run larger. The counts climb from {{a}} dogs born in {{first}} to {{b}} born in 2019.`,
      {
        a: figure(count(born(first))),
        first: figure(String(first)),
        b: figure(count(born(2019))),
      },
    )}
  />
  <p class="mt-3">
    <Sentence
      parts={weave(
        `How many dogs born in 2020 do you think the file holds? Drag the 2020 bar, or this number: {{guess}}.`,
        {
          guess: dial(
            "Your guess for dogs born in 2020",
            guess,
            GUESS,
            (v) => count(v),
            (v) => {
              guess = v;
              guessed = true;
            },
          ),
        },
      )}
    />
  </p>
{/snippet}

{#snippet reveal()}
  <Sentence
    parts={weave(
      `The file holds {{n}} dogs born in 2020. That is {{more}} more than the average of 2019 and 2021, even though the 2020 dogs have had a year longer than the 2021 dogs to leave the file.`,
      { n: figure(count(born(2020))), more: figure(percent(data.bump - 1)) },
    )}
  />
  {#if verdict !== ""}
    <span> {verdict}</span>
  {/if}
  <p class="mt-3 text-[0.875rem] text-muted-foreground">
    The city’s 2024 file, checked on its own, shows the same bump: {percent(
      data.bump_2024 - 1,
    )}.
  </p>
{/snippet}

{#snippet months()}
  <Sentence
    parts={weave(
      `The license dates show the year’s rhythm. In April, May, and June of 2020, while the city was shut, licensing fell to {{shut}} of its pace a year earlier. Then it rebounded. {{peak}}, with {{n}} licenses, was the busiest month from 2019 through 2021.`,
      {
        shut: figure(percent(shut)),
        peak: figure(`${MONTH[peak.month]} ${peak.year}`),
        n: figure(count(peak.n)),
      },
    )}
  />
  <p class="mt-3 text-[0.875rem] text-muted-foreground">
    These come from the city’s 2022 file, which holds every license issued from
    2019 to 2021.
  </p>
{/snippet}

{#snippet breeds()}
  <Sentence
    parts={weave(
      `Some breeds grew faster than the class as a whole. Among dogs born in 2020, the count of {{a}} runs {{ra}} above the years on either side, and {{b}} {{rb}} above. {{c}} stayed near level: {{rc}}.`,
      {
        a: chip("breeds", rising[0]!.label, () => goBreed(rising[0]!.label)),
        ra: figure(percent(rising[0]!.ratio - 1)),
        b: chip("breeds", rising[1]!.label, () => goBreed(rising[1]!.label)),
        rb: figure(percent(rising[1]!.ratio - 1)),
        c: chip("breeds", flat.label, () => goBreed(flat.label)),
        rc: figure(
          `${flat.ratio >= 1 ? "up" : "down"} ${percent(Math.abs(flat.ratio - 1))}`,
        ),
      },
    )}
  />
{/snippet}

{#snippet map()}
  {const top = $derived(boroughs[0]!)}
  {const bottom = $derived(boroughs.at(-1)!)}
  <Sentence
    parts={weave(
      `The bump was largest in {{top}}, where the class of 2020 runs {{rt}} above the years around it, and smallest in {{bottom}}, at {{rb}}. Among neighborhoods, the two highest are {{h1}} and {{h2}}, and the lowest is {{lo}}.`,
      {
        top: figure(boroughWord(top.borough)),
        rt: figure(percent(top.ratio - 1)),
        bottom: figure(boroughWord(bottom.borough)),
        rb: figure(percent(bottom.ratio - 1)),
        h1: place(shortName(highs[0]!.p.name), () => goPlace(highs[0]!.p.slug)),
        h2: place(shortName(highs[1]!.p.name), () => goPlace(highs[1]!.p.slug)),
        lo: place(shortName(low.p.name), () => goPlace(low.p.slug)),
      },
    )}
  />
  <p class="mt-3 text-[0.875rem] text-muted-foreground">
    The file records where a dog lives now, so this is where the class of 2020
    lives today. Neighborhoods with few dogs are pulled toward the city’s
    figure.
  </p>
{/snippet}

{#snippet field()}
  <Sentence
    parts={weave(
      `The class of 2020 is six years old now. Its {{n}} dogs are {{share}} of the {{all}} licensed dogs with a birth year on the file, about one in {{one}}{{tail}}`,
      {
        n: figure(count(born(2020))),
        share: figure(percent(born(2020) / dated)),
        all: figure(count(dated)),
        one: figure(String(Math.round(dated / born(2020)))),
        tail: largest ? ", the largest of any birth year." : ".",
      },
    )}
  />
  {#if largest}
    <p class="mt-3 text-[0.875rem] text-muted-foreground">
      Each birth year since has had less time to leave the file, and none of
      them is larger. The shading alternates by birth year.
    </p>
  {/if}
{/snippet}

{#snippet end()}
  <p>
    <Sentence
      parts={weave(`Open {{h1}} to see its dogs, or color the map by {{a}}.`, {
        h1: place(shortName(highs[0]!.p.name), () => goPlace(highs[0]!.p.slug)),
        a: chip("breeds", rising[0]!.label, () => goBreed(rising[0]!.label)),
      })}
    />
  </p>
{/snippet}

{#snippet graphic(active: number)}
  {const mode = $derived(MODES[active] ?? "map")}
  {const tagValue = $derived(
    revealed ? count(born(2020)) : guessed ? count(guess) : "?",
  )}
  {const tagLabel = $derived(
    revealed ? "born in 2020" : guessed ? "your guess" : "drag to guess",
  )}
  <div
    bind:clientWidth={w}
    bind:clientHeight={h}
    class="relative size-full overflow-hidden"
  >
    <div class="scene absolute inset-0" data-on={mode === "bars"}>
      {#if w > 0}
        <svg width={w} height={h} class="absolute inset-0">
          {#each [0, 4000, 8000, 12000] as tick (tick)}
            <line
              x1={BAR.l}
              x2={w - BAR.r}
              y1={by(tick)}
              y2={by(tick)}
              class="stroke-foreground/10"
            />
            <text
              x={BAR.l - 8}
              y={by(tick) + 3.5}
              text-anchor="end"
              class="fill-muted-foreground font-mono text-[0.625rem]"
              >{count(tick)}</text
            >
          {/each}
          {#each data.years as year, i (year)}
            {const hidden = $derived(
              (year === 2020 || year === 2021) && !revealed,
            )}
            <rect
              x={bx(i)}
              y={by(born(year))}
              width={barW}
              height={Math.max(0, h - BAR.b - by(born(year)))}
              rx="2"
              class={cn(
                "origin-bottom transition-[scale,fill] glide transform-fill",
                {
                  "fill-primary": year === 2020,
                  "fill-foreground/70": year !== 2020,
                  "scale-y-0": hidden,
                },
              )}
            />
            {#if year === 2020 && !revealed}
              <g
                class={cn("transition-opacity duration-300", {
                  "opacity-0": active < 1,
                })}
              >
                <rect
                  x={bx(i)}
                  y={by(guess)}
                  width={barW}
                  height={Math.max(0, h - BAR.b - by(guess))}
                  class={cn("stroke-primary transition-[fill]", {
                    "fill-primary/25": guessed,
                    "fill-primary/8": !guessed,
                  })}
                  stroke-dasharray="4 3"
                  stroke-width="1.5"
                />
                {#each [-3, 0, 3] as dy (dy)}
                  <line
                    x1={bx(i) + barW * 0.3}
                    x2={bx(i) + barW * 0.7}
                    y1={by(guess) + 8 + dy}
                    y2={by(guess) + 8 + dy}
                    class="stroke-primary"
                    stroke-width="1.25"
                    stroke-linecap="round"
                  />
                {/each}
                <rect
                  role="presentation"
                  x={bx(i) - 10}
                  y={BAR.t - 30}
                  width={barW + 20}
                  height={Math.max(0, h - BAR.b - BAR.t + 30)}
                  class="cursor-ns-resize touch-none fill-transparent"
                  onpointerdown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragTo(event);
                  }}
                  onpointermove={(event) => {
                    if (
                      event.currentTarget.hasPointerCapture(event.pointerId)
                    ) {
                      dragTo(event);
                    }
                  }}
                />
              </g>
            {/if}
            {#if year === 2020 && revealed && guessed}
              <line
                x1={bx(i) - 6}
                x2={bx(i) + barW + 6}
                y1={by(guess)}
                y2={by(guess)}
                class="stroke-foreground"
                stroke-dasharray="3 2"
                stroke-width="1.5"
              />
            {/if}
            {#if year === 2021 && !revealed}
              <rect
                x={bx(i)}
                y={h - BAR.b - 2}
                width={barW}
                height="2"
                class="fill-foreground/25"
              />
            {/if}
            {#if year % 4 === 0 || (year === 2021 && w > 520)}
              <text
                x={bx(i) + barW / 2}
                y={h - BAR.b + 18}
                text-anchor="middle"
                class="fill-muted-foreground font-mono text-[0.65625rem]"
                >{year}</text
              >
            {/if}
          {/each}
          {#if revealed}
            <line
              x1={bx(iOf(2019)) - 4}
              x2={bx(iOf(2021)) + barW}
              y1={by(around)}
              y2={by(around)}
              class="stroke-foreground"
              stroke-dasharray="2 3"
              stroke-width="1.5"
            />
          {/if}
        </svg>
        <div
          class={cn(
            "pointer-events-none absolute -translate-x-1/2 -translate-y-full transition-[top,opacity] duration-[calc(var(--1s)*0.6)] ease-out",
            { "opacity-0": active < 1 },
          )}
          style:left="min({bx(iOf(2020)) + barW / 2}px, calc(100% - 2.75rem))"
          style:top="{by(revealed ? born(2020) : guess) - 10}px"
        >
          <div
            class="relative -rotate-2 rounded-[10px] px-3 pt-3 pb-1.5 text-center brass"
          >
            <span
              class="absolute top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]"
            ></span>
            <span class="block slab text-[1.0625rem] leading-none stamped"
              ><Strike value={tagValue} /></span
            >
            <span
              class="mt-0.5 block font-sans text-[0.46875rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase stamped @max-xs:whitespace-normal"
              >{tagLabel}</span
            >
            {#if revealed && guessed}
              <span
                class="mt-1 block border-t border-[oklch(0.45_0.05_70/0.35)] pt-1 font-sans text-[0.53125rem] font-semibold whitespace-nowrap stamped @max-xs:whitespace-normal"
                >you guessed {count(guess)}</span
              >
            {/if}
          </div>
        </div>
        {#if revealed}
          <p
            class="absolute -translate-x-full text-right font-mono text-[0.65625rem] leading-tight whitespace-nowrap text-foreground/70"
            style:left="{bx(iOf(2019)) - 6}px"
            style:top="{by(around) - 7}px"
          >
            average of 2019 and 2021<br />{count(around)}
          </p>
        {/if}
      {/if}
    </div>

    <div class="scene absolute inset-0" data-on={mode === "months"}>
      {#if w > 0}
        <svg width={w} height={h} class="absolute inset-0">
          <rect
            x={mx(15) - 4}
            y={BAR.t - 10}
            width={mx(17) - mx(15) + 8}
            height={h - BAR.b - BAR.t + 10}
            class="fill-foreground/6"
          />
          {#each [0, 3000, 6000, 9000] as tick (tick)}
            <line
              x1={BAR.l}
              x2={w - BAR.r}
              y1={my(tick)}
              y2={my(tick)}
              class="stroke-foreground/10"
            />
            <text
              x={BAR.l - 8}
              y={my(tick) + 3.5}
              text-anchor="end"
              class="fill-muted-foreground font-mono text-[0.625rem]"
              >{count(tick)}</text
            >
          {/each}
          {#each [0, 12, 24] as i (i)}
            <text
              x={mx(i)}
              y={h - BAR.b + 18}
              class="fill-muted-foreground font-mono text-[0.65625rem]"
              >{monthly[i]?.year}</text
            >
          {/each}
          <path
            d={line}
            pathLength="1"
            stroke-dasharray="1"
            style:stroke-dashoffset={mode === "months" ? 0 : 1}
            class="fill-none stroke-foreground transition-[stroke-dashoffset] duration-[calc(var(--1s)*1.6)] ease-in-out"
            stroke-width="2.25"
            stroke-linejoin="round"
          />
          {#each monthly as m, i (i)}
            {#if m === peak}
              <circle
                cx={mx(i)}
                cy={my(m.n)}
                r="5"
                class="fill-primary stroke-background"
                stroke-width="2"
              />
            {/if}
          {/each}
        </svg>
        <p
          class="absolute -translate-x-1/2 text-center font-mono text-[0.65625rem] leading-tight text-foreground/70"
          style:left="{mx(16)}px"
          style:top="{BAR.t - 34}px"
        >
          April to June<br />2020
        </p>
        <p
          class="absolute font-display text-[0.8125rem] leading-tight font-semibold"
          style:left="{mx(monthly.indexOf(peak)) + 10}px"
          style:top="{my(peak.n) - 26}px"
        >
          {MONTH[peak.month]}
          {peak.year}<br /><span class="font-mono text-[0.6875rem] font-normal"
            >{count(peak.n)} licenses</span
          >
        </p>
      {/if}
    </div>

    <div
      class="scene absolute inset-0 grid place-items-center px-4 @min-[55rem]:px-12"
      data-on={mode === "breeds"}
    >
      <div class="w-full max-w-xl" {@attach fit}>
        <div class="relative mb-2 ml-48 h-4">
          {#each [1, 1.5, 2] as r (r)}
            <span
              class="absolute -translate-x-1/2 font-mono text-[0.625rem] text-muted-foreground"
              style:left="{along(r)}%"
              >{r === 1 ? "no change" : `+${percent(r - 1)}`}</span
            >
          {/each}
        </div>
        {#each breedRows as row (row.label)}
          <div
            class="grid grid-cols-[40px_9.5rem_1fr] items-center gap-0 border-b rule py-0.5 @min-[55rem]:py-1"
          >
            <Plate breed={row.label} height={30} />
            <span class="pr-2 text-[0.78125rem] leading-tight">{row.label}</span
            >
            <div class="relative h-6">
              <div
                class="absolute inset-x-0 top-1/2 h-px bg-foreground/15"
              ></div>
              <div
                class="absolute top-1 bottom-1 w-0.5 -translate-x-1/2 bg-foreground/50"
                style:left="{along(data.bump)}%"
              ></div>
              <div
                class="absolute top-1/2 size-3 -translate-1/2 rounded-full bg-primary ring-2 ring-background transition-[left] duration-[calc(var(--1s)*0.9)] ease-out"
                style:left="{along(mode === 'breeds' ? row.ratio : 1)}%"
              ></div>
            </div>
          </div>
        {/each}
        <p class="mt-2 ml-48 text-[0.71875rem] text-muted-foreground">
          The notch is the whole class: {percent(data.bump - 1)}.
        </p>
      </div>
    </div>

    <div
      class="scene absolute inset-0 flex flex-col"
      data-on={mode === "map" || mode === "zoom"}
    >
      <City
        class="min-h-0 flex-1"
        {hoods}
        {parks}
        focus={mode === "zoom" ? highs[0]!.p.slug : null}
        lit={mode === "zoom"
          ? (slug: string) => slug === highs[0]!.p.slug
          : undefined}
        fill={(slug: string) => {
          const bump = hoodBump.get(slug);
          if (bump == null || (mode !== "map" && mode !== "zoom")) {
            return "var(--color-story-ground)";
          }

          return tone(bump.r >= 1 ? (bump.r - 1) / 0.6 : (bump.r - 1) / 0.25);
        }}
        marks={mode === "map"
          ? [
              ...highs.map((x) => ({
                slug: x.p.slug,
                text: shortName(x.p.name),
                sub: `+${percent(x.r - 1)}`,
              })),
              {
                slug: low.p.slug,
                text: shortName(low.p.name),
                sub: `${low.r >= 1 ? "+" : "−"}${percent(Math.abs(low.r - 1))}`,
              },
            ]
          : []}
      />
      <div
        class={cn(
          "flex shrink-0 items-center justify-center gap-2 pt-1 font-mono text-[0.65625rem] text-muted-foreground transition-opacity duration-[calc(var(--1s)*0.4)]",
          { "opacity-0": mode === "zoom" },
        )}
      >
        <span>a smaller class</span>
        <span
          class="h-2 w-28 rounded-full"
          style:background="linear-gradient(90deg, {tone(-1)}, {tone(0)}, {tone(
            1,
          )})"
        ></span>
        <span>a larger class</span>
      </div>
    </div>

    {const home = $derived(highs[0]!)}
    <div
      class="scene pointer-events-none absolute inset-x-0 bottom-8 flex justify-center"
      data-on={mode === "zoom"}
      style:transition-delay={mode === "zoom" ? "calc(var(--1s) * 0.7)" : "0s"}
    >
      <div
        class="flex items-end gap-3 rounded-[5px] paper px-4 pt-3 pb-3 shadow-[0_1px_0_rgb(58_48_38/0.14),0_14px_34px_-6px_rgb(58_48_38/0.28)] ring-1 ring-foreground/8 dark:shadow-none"
      >
        {#if home.p.top_breed != null}
          <span class="flex flex-col items-center">
            <Plate breed={home.p.top_breed} height={64} />
            <span
              class="-mt-1 h-1.5 w-16 rounded-[50%]"
              style:background-color={tone(0.8)}
            ></span>
          </span>
        {/if}
        <span class="pb-1">
          <span
            class="block font-display text-[1.1875rem] leading-tight font-bold"
            >{shortName(home.p.name)}</span
          >
          <span
            class="block text-[0.8125rem] leading-snug text-muted-foreground"
            ><span class="numeric font-semibold text-foreground"
              >+{percent(home.r - 1)}</span
            >
            in the class of 2020<br />Its most common breed is {home.p
              .top_breed}.</span
          >
        </span>
      </div>
    </div>

    <div class="scene absolute inset-0" data-on={mode === "field"}>
      {#if w > 0}
        {const cell = $derived.by(() => {
          const room = h - 36;
          let size = Math.floor(Math.sqrt((w * room) / dots.length));
          while (
            size > 4 &&
            Math.ceil(dots.length / Math.floor(w / size)) * size > room
          ) {
            size -= 1;
          }

          return size;
        })}
        {const cols = $derived(Math.floor(w / cell))}
        {const left = $derived((w - cols * cell) / 2)}
        {const first = $derived(dots.indexOf(2020))}
        {const lastAt = $derived(dots.lastIndexOf(2020))}
        {const bandTop = $derived(Math.floor(first / cols) * cell + 18)}
        {const bandBottom = $derived(
          (Math.floor(lastAt / cols) + 1) * cell + 18,
        )}
        <svg width={w} height={h} class="absolute inset-0">
          {#each dots as year, i (i)}
            {const lit = $derived(year === 2020)}
            <circle
              cx={left + (i % cols) * cell + cell / 2}
              cy={18 + Math.floor(i / cols) * cell + cell / 2}
              r={cell * 0.36}
              class={cn("transition-[fill,scale] glide transform-fill", {
                "origin-center": true,
                "fill-primary": lit && mode === "field",
                "fill-foreground/24":
                  (!lit || mode !== "field") && year % 2 === 0,
                "fill-foreground/13":
                  (!lit || mode !== "field") && year % 2 === 1,
                "scale-75": lit && mode !== "field",
              })}
              style:transition-delay={lit ? "calc(var(--1s) * 0.35)" : "0s"}
            />
          {/each}
        </svg>
        <p
          class="absolute font-mono text-[0.65625rem] text-muted-foreground"
          style:left="{left}px"
          style:top="0px"
        >
          oldest dogs
        </p>
        <p
          class="absolute -translate-x-full text-right font-mono text-[0.65625rem] whitespace-nowrap text-muted-foreground"
          style:left="{left + cols * cell}px"
          style:top="{18 + Math.ceil(dots.length / cols) * cell + 4}px"
        >
          born in {ages.at(-1)?.[0]}
        </p>
        <div
          class={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 transition-[opacity,scale] glide",
            { "scale-90 opacity-0": mode !== "field" },
          )}
          style:left="{w / 2}px"
          style:top="{(bandTop + bandBottom) / 2}px"
          style:transition-delay="calc(var(--1s) * 0.6)"
        >
          <div
            class="relative -rotate-2 rounded-[10px] px-3 pt-3 pb-1.5 text-center brass"
          >
            <span
              class="absolute top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]"
            ></span>
            <span class="block slab text-[1.0625rem] leading-none stamped"
              >{count(born(2020))}</span
            >
            <span
              class="mt-0.5 block font-sans text-[0.46875rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase stamped"
              >born in 2020</span
            >
          </div>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<Scrolly
  steps={[title, climb, reveal, months, breeds, map, field, end]}
  {graphic}
  caption={(i: number) =>
    ({
      bars: `Dogs on the city’s ${stories.now} license file, by the year they were born.`,
      months:
        "Dog licenses issued each month, 2019 through 2021, from the city’s 2022 file.",
      breeds:
        "Dogs born in 2020 against the average of 2019 and 2021, for breeds with at least 150 dogs born in 2020.",
      map: "Dogs born in 2020 against the average of 2019 and 2021, by neighborhood.",
      zoom: `${shortName(highs[0]!.p.name)}, where the class of 2020 ran highest.`,
      field: `Every licensed dog on the ${stories.now} file with a birth year, one dot per ${DOT}, oldest first.`,
    })[MODES[i] ?? "map"]}
  onstep={(i: number) => {
    if (i >= 2) {
      revealed = true;
    }
  }}
/>
