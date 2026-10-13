<script lang="ts" module>
  const PLAY_FLOOR = 1.6;
</script>

<script lang="ts">
  import { ArrowRightIcon } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { HoodCollection, Matrix, ParkCollection } from "#lib/types.js";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import { isNarrowLayout } from "#lib/narrow-layout.svelte.js";
  import { chip, figure, weave } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";
  import {
    boroughTable,
    boroughWord,
    percent,
    SIGNATURE_FLOOR,
    tone,
  } from "#lib/stories.js";
  import { cn } from "#lib/utils.js";
  import City from "./city.svelte";
  import Scrolly from "./scrolly.svelte";

  let {
    hoods,
    parks,
    matrix,
    leave,
  }: {
    hoods: HoodCollection;
    parks: ParkCollection;
    matrix: Matrix;
    leave: (act: () => void) => void;
  } = $props();

  const table = $derived(boroughTable(hoods, matrix));
  const boroughOf = $derived(
    new Map(
      hoods.features.map((f) => [f.properties.slug, f.properties.borough]),
    ),
  );

  const spotlight = $derived(
    table.signatures.toSorted((a, b) => b.over - a.over).slice(0, 3),
  );

  const leaders = $derived(
    table.boroughs.map((borough) => {
      let best = "";
      let most = 0;
      for (const [name, row] of table.names) {
        const here = row.by[borough] ?? 0;
        if (here > most) {
          most = here;
          best = name;
        }
      }

      return { borough, name: best };
    }),
  );
  const cityLeader = $derived.by(() => {
    let best = "";
    let most = 0;
    for (const [name, row] of table.names) {
      if (row.total > most) {
        most = row.total;
        best = name;
      }
    }

    return best;
  });
  const rebel = $derived(leaders.find((l) => l.name !== cityLeader) ?? null);
  const loyal = $derived(leaders.filter((l) => l.name === cityLeader).length);

  function spread(name: string) {
    const row = table.names.get(name);
    if (row == null) {
      return null;
    }

    const parts = table.boroughs.map((borough) => {
      const share = (row.by[borough] ?? 0) / row.total;

      return { borough, share, over: share / table.share[borough]! };
    });
    const best = parts.toSorted((a, b) => b.over - a.over)[0]!;

    return { name, total: row.total, parts, best };
  }

  function goName(label: string) {
    leave(() => {
      explorer.showSubject("names", label, "live");
    });
  }

  const pool = $derived(
    [...table.names.keys()].filter((name) => {
      const s = spread(name);

      return (
        s != null &&
        s.total >= SIGNATURE_FLOOR.name &&
        s.best.over >= PLAY_FLOOR
      );
    }),
  );

  const order = $state(untrack(() => pool.toSorted(() => Math.random() - 0.5)));
  let round = $state(0);
  let typed = $state("");
  let asked = $state<string | null>(null);
  let guess = $state<string | null>(null);
  let score = $state({ right: 0, played: 0 });

  const current = $derived(
    asked ?? order[round % Math.max(1, order.length)] ?? null,
  );
  const shown = $derived(current == null ? null : spread(current));

  function choose(borough: string) {
    if (guess != null || shown == null) {
      return;
    }

    guess = borough;
    score = {
      right: score.right + (borough === shown.best.borough ? 1 : 0),
      played: score.played + 1,
    };
  }

  function another() {
    asked = null;
    guess = null;
    round += 1;
  }

  let active = $state(0);
  const focus = $derived(
    active >= 1 && active <= spotlight.length ? spotlight[active - 1]! : null,
  );
  const focused = $derived(focus == null ? null : spread(focus.name));
  const wide = $derived(!isNarrowLayout());
  const showing = $derived(
    focused ??
      spread(spotlight[active === 0 ? 0 : spotlight.length - 1]?.name ?? ""),
  );
</script>

{#snippet bars(
  s: NonNullable<ReturnType<typeof spread>>,
  reveal: boolean,
  picked: string | null,
)}
  {const span = $derived(
    Math.max(
      0.4,
      ...s.parts.map((p) => Math.max(p.share, table.share[p.borough]!)),
    ) * 1.12,
  )}
  <div class="space-y-2">
    {#each s.parts as part (part.borough)}
      {const over = $derived(part.over >= 1.15)}
      <div
        class="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-2 @max-xs:grid-cols-[1fr_3rem] @max-xs:gap-y-0.5"
      >
        <span
          class={cn("text-[0.8125rem] @max-xs:col-span-full", {
            "font-semibold": part.borough === picked,
          })}>{part.borough}</span
        >
        <div class="relative h-5 rounded-xs bg-foreground/6">
          <div
            class="absolute inset-y-0 left-0 rounded-xs transition-[width,background-color] glide"
            style:width="{reveal ? (part.share / span) * 100 : 0}%"
            style:background-color={over ? tone(0.85) : tone(0.15)}
          ></div>
          <div
            class="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-foreground transition-[left] glide"
            style:left="{(table.share[part.borough]! / span) * 100}%"
          ></div>
        </div>
        <span class="text-right numeric text-[0.78125rem] text-muted-foreground"
          >{reveal ? percent(part.share) : ""}</span
        >
      </div>
    {/each}
  </div>
{/snippet}

{#snippet title()}
  <h2
    id="story-title"
    class="font-display text-[1.85rem] leading-none font-bold tracking-tight @min-[55rem]:text-[clamp(2.1rem,4.4vw,3.2rem)] @min-[55rem]:leading-[0.98]"
  >
    A dog’s name can give away its borough
  </h2>
  <p
    class="mt-2 font-display text-[1rem] leading-snug text-foreground/80 @min-[55rem]:mt-3 @min-[55rem]:text-[1.125rem]"
  >
    Most names spread across New York in step with its dogs. A few gather in one
    borough.
  </p>
  <p
    class="mt-2.5 text-[0.8125rem] leading-snug text-muted-foreground @min-[55rem]:mt-4 @min-[55rem]:text-[0.875rem]"
  >
    The black notch on each bar is the borough’s share of all the city’s
    licensed dogs. A bar that passes its notch means the name is more common
    there.
  </p>
{/snippet}

{#snippet signature(k: number)}
  {const sig = $derived(spotlight[k])}
  {#if sig != null}
    <Sentence
      parts={weave(
        `{{place}} holds {{share}} of the city’s licensed dogs, and {{here}} of its dogs named {{name}}. That makes {{name2}} {{over}} times as common there as across the city.`,
        {
          place: figure(
            boroughWord(sig.borough).replace(/^./, (c) => c.toUpperCase()),
          ),
          share: figure(percent(table.share[sig.borough]!)),
          here: figure(percent(sig.here / sig.total)),
          name: chip("names", sig.name, () => goName(sig.name)),
          name2: figure(sig.name),
          over: figure(sig.over.toFixed(1)),
        },
      )}
    />
  {/if}
{/snippet}

{#snippet first()}
  {@render signature(0)}
{/snippet}

{#snippet second()}
  {@render signature(1)}
{/snippet}

{#snippet third()}
  {@render signature(2)}
{/snippet}

{#snippet leaderStep()}
  {#if rebel != null}
    <Sentence
      parts={weave(
        `The city’s most common name, {{luna}}, leads in {{loyal}} of the {{all}} boroughs. {{place}} is the one where {{other}} leads instead.`,
        {
          luna: chip("names", cityLeader, () => goName(cityLeader)),
          loyal: figure(String(loyal)),
          all: figure(String(table.boroughs.length)),
          place: figure(boroughWord(rebel.borough)),
          other: chip("names", rebel.name, () => goName(rebel.name)),
        },
      )}
    />
  {:else}
    <p>The most common name leads in every borough.</p>
  {/if}
  <p class="mt-3">Now try it yourself, below.</p>
{/snippet}

{#snippet graphic(at: number)}
  {const lit = $derived(
    at >= 1 && at <= spotlight.length
      ? spotlight[at - 1]!.borough
      : at === spotlight.length + 1
        ? (rebel?.borough ?? null)
        : null,
  )}
  <div class="relative flex size-full flex-col">
    <div
      class="scene min-h-0 flex-1 @max-[55rem]:absolute @max-[55rem]:inset-0"
      data-on={wide || focused == null}
    >
      <City
        {hoods}
        {parks}
        fill={(slug: string) => {
          const b = boroughOf.get(slug);
          if (lit == null) {
            return tone(0.12);
          }

          return b === lit ? tone(0.8) : "var(--color-story-ground)";
        }}
      />
    </div>
    <div
      class="scene mx-auto w-full max-w-md shrink-0 px-4 pb-4 @max-[55rem]:absolute @max-[55rem]:inset-x-0 @max-[55rem]:top-1/2 @max-[55rem]:-translate-y-1/2 @min-[55rem]:pb-10"
      data-on={focused != null}
    >
      {#if showing != null}
        {#key showing.name}
          <p class="mb-2 animate-in slab text-[0.875rem] duration-500 fade-in">
            Dogs named {showing.name}
          </p>
        {/key}
        {@render bars(showing, focused != null, focus?.borough ?? null)}
      {/if}
    </div>
  </div>
{/snippet}

<Scrolly
  steps={[title, first, second, third, leaderStep]}
  {graphic}
  caption={(i: number) =>
    i >= 1 && i <= spotlight.length
      ? `Where the city’s dogs named ${spotlight[i - 1]!.name} live, by borough.`
      : "New York’s 197 neighborhoods."}
  onstep={(i: number) => {
    active = i;
  }}
/>

<section
  aria-labelledby="borough-game"
  class="border-t rule px-4 py-14 @min-[55rem]:px-10"
>
  <div class="mx-auto max-w-xl">
    <h3
      id="borough-game"
      class="font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight"
    >
      Guess the borough
    </h3>
    <p class="mt-2 text-[0.9375rem] leading-relaxed text-foreground/85">
      Pick the borough where the name is most common for its number of dogs.
    </p>

    {#if shown != null}
      <div
        class="mt-6 rounded-lg paper px-5 py-5 shadow-[0_1px_0_rgb(58_48_38/0.16),0_10px_28px_rgb(58_48_38/0.14)] ring-1 ring-foreground/10 dark:shadow-none"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <div
            class="-rotate-2 rounded-[12px] px-4 pt-3.5 pb-2 text-center brass"
          >
            <span
              class="mx-auto mb-1 block size-2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1.5px_rgb(0_0_0/0.6)]"
            ></span>
            <span class="block slab text-[1.5rem] leading-none stamped"
              >{shown.name}</span
            >
          </div>
          {#if score.played > 0}
            <p
              class="numeric text-[0.8125rem] text-muted-foreground"
              aria-live="polite"
            >
              {score.right} of {score.played} right
            </p>
          {/if}
        </div>

        <div
          class="mt-5 flex flex-wrap gap-2"
          role="group"
          aria-label="Boroughs"
        >
          {#each table.boroughs as borough (borough)}
            <button
              type="button"
              disabled={guess != null}
              class={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] ring-1 transition-[transform,background-color] duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-100",
                {
                  "bg-foreground text-background ring-foreground":
                    guess === borough,
                  "ring-foreground/25": guess !== borough,
                  "ring-2 ring-primary":
                    guess != null && borough === shown.best.borough,
                },
              )}
              onclick={() => {
                choose(borough);
              }}>{borough}</button
            >
          {/each}
        </div>

        <div class="mt-5">
          {@render bars(shown, guess != null, guess)}
        </div>

        <p
          class="mt-4 min-h-12 text-[0.90625rem] leading-relaxed"
          aria-live="polite"
        >
          {#if guess != null}
            {guess === shown.best.borough ? "Right." : "Not quite."}
            Dogs named {shown.name} are {shown.best.over.toFixed(1)} times as common
            in {boroughWord(shown.best.borough)} as across the city.
          {/if}
        </p>

        <div class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            class="group flex cursor-pointer items-baseline gap-1.5 py-1 slab text-[0.8125rem] transition-colors duration-200 hover:text-primary"
            onclick={another}
          >
            Another name
            <ArrowRightIcon
              aria-hidden="true"
              class="size-3.5 translate-y-px text-primary transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2.25}
            />
          </button>
          <form
            class="flex items-center gap-2 @max-xs:flex-wrap"
            onsubmit={(event) => {
              event.preventDefault();
              const hit = [...table.names.keys()].find(
                (n) => n.toLowerCase() === typed.trim().toLowerCase(),
              );
              if (hit != null) {
                asked = hit;
                guess = null;
                typed = "";
              }
            }}
          >
            <label
              for="borough-name"
              class="text-[0.8125rem] text-muted-foreground"
              >Or try a name</label
            >
            <input
              id="borough-name"
              list="borough-names"
              bind:value={typed}
              autocomplete="off"
              class="h-8 w-36 rounded-[3px] bg-background px-2 text-[0.875rem] ring-1 ring-foreground/20 outline-none focus-visible:ring-primary any-pointer-coarse:text-base"
            />
            <datalist id="borough-names">
              {#each [...table.names.keys()].toSorted() as name (name)}
                <option value={name}></option>
              {/each}
            </datalist>
          </form>
        </div>
        <p class="mt-4 text-[0.8125rem] text-muted-foreground">
          <button
            type="button"
            class="cursor-pointer underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
            onclick={() => {
              goName(shown.name);
            }}>See where dogs named {shown.name} live</button
          >
          on the map. The game draws names with at least {SIGNATURE_FLOOR.name} dogs,
          and the box takes any of the {table.names.size} names on the map.
        </p>
      </div>
    {/if}
  </div>
</section>
