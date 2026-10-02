<script lang="ts" module>
  const STUB =
    "linear-gradient(to top, color-mix(in oklab, var(--color-foreground) 15%, transparent) 4px, transparent 4px)";

  // Delay before clearing; crossing the 2px gap between rows in one frame made the readout strobe.
  const HOLD = 160;

  // Bubble x: just off the right edge of the rail.
  const OFF_RAIL = 368;
</script>

<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import type { Painted } from "#lib/layers.js";
  import Tooltip from "#lib/components/map/tooltip.svelte";
  import { BOROUGHS } from "#lib/query.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";

  let {
    painted,
    class: className,
    tip = false,
  }: { painted: Painted; class?: string; tip?: boolean } = $props();

  const fine = new MediaQuery("(pointer: fine)");

  const over = $derived(explorer.pointing);
  let at = $state<{ x: number; y: number } | null>(null);
  let idle: ReturnType<typeof setTimeout> | undefined;

  function release() {
    clearTimeout(idle);
    idle = setTimeout(() => {
      explorer.point("slug", null);
      at = null;
    }, HOLD);
  }

  function point(event: PointerEvent) {
    const target = event.target as HTMLElement;

    const slug = target.dataset.slug;
    if (slug != null) {
      clearTimeout(idle);
      explorer.point("slug", slug);
      at = { x: OFF_RAIL, y: event.clientY };

      return;
    }

    const borough =
      target.closest<HTMLElement>("[data-borough]")?.dataset.borough;
    if (borough != null) {
      clearTimeout(idle);
      explorer.point("borough", borough);
      at = null;

      return;
    }

    release();
  }

  function open(event: MouseEvent) {
    if (!fine.current) {
      return;
    }

    const held = explorer.pointing;
    const slug =
      (event.target as HTMLElement).dataset.slug ??
      (held?.field === "slug" ? held.value : null);
    if (slug != null) {
      explorer.goTo(slug);
    }
  }

  // A mark removed from under the pointer never fires pointerleave; clear on unmount.
  $effect(() => () => {
    clearTimeout(idle);
    explorer.point("slug", null);
  });

  const rows = $derived.by(() => {
    const marks = painted.data.features.map((f) => f.properties);

    return BOROUGHS.map((borough) => {
      const band = marks.filter((p) => p.borough === borough);

      return {
        borough,
        kept: band.filter((p) => !p.dim).length,
        all: band.length,
        cells: band.toSorted(
          (a, b) =>
            Number(a.dim) - Number(b.dim) || painted.rank(b) - painted.rank(a),
        ),
      };
    })
      .filter((row) => row.all > 0)
      .filter((row) => row.kept > 0 || explorer.boroughs.length === 0);
  });

  const track = $derived(Math.max(1, ...rows.map((row) => row.cells.length)));

  const held = $derived(
    over?.field !== "slug"
      ? null
      : (painted.data.features.find((f) => f.properties.slug === over.value)
          ?.properties ?? null),
  );

  const band = $derived(rows.find((row) => row.borough === held?.borough));

  const zone = $derived(
    over?.field === "borough" ? over.value : (held?.borough ?? null),
  );
</script>

<figure
  class={cn(
    "-mx-5 mt-2.5 border-y border-primary/25 bg-primary/4.5 px-3.5 py-2.5",
    className,
  )}
  onpointerover={point}
  onpointermove={point}
  onpointerleave={release}
>
  <p class="sr-only">
    {#each rows as row (row.borough)}{row.borough}: {count(row.kept)} of {count(
        row.all,
      )} still on the map.{" "}{/each}
  </p>

  <div class="grid grid-cols-[76px_1fr] items-center gap-x-2">
    {#each rows as row (row.borough)}
      {const on = $derived(explorer.boroughs.includes(row.borough))}
      <button
        type="button"
        aria-pressed={on}
        aria-label={painted.matched == null
          ? `Keep only ${row.borough}`
          : `Keep only ${row.borough}, ${count(row.kept)} of ${count(row.all)} on the map`}
        data-borough={row.borough}
        class={cn(
          "relative flex cursor-pointer items-baseline justify-end gap-1 self-stretch py-2 text-[9px] leading-none transition-colors duration-200 min-[880px]:py-px min-[880px]:after:absolute min-[880px]:after:inset-x-0 min-[880px]:after:-inset-y-1.5",
          {
            "text-foreground": on || row.borough === zone,
            "text-muted-foreground hover:text-foreground":
              !on && row.borough !== zone,
          },
        )}
        onclick={() => {
          explorer.toggleBorough(row.borough);
        }}
      >
        <!-- Underline goes on the span; truncate-clip starts a new formatting context that blocks it. -->
        <span
          class="truncate-clip whitespace-nowrap"
          class:underline={on}
          class:decoration-primary={on}
          class:underline-offset-2={on}>{row.borough}</span
        >
        {#if painted.matched != null}
          <span
            class="w-4 shrink-0 text-right numeric"
            class:text-foreground={row.kept > 0}
            class:text-muted-foreground={row.kept === 0}>{row.kept}</span
          >
        {/if}
      </button>

      <!-- Gap is a transparent border so the pointer stays in the row; background shorthand resets background-clip. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class="grid self-center py-px"
        class:cursor-pointer={fine.current}
        style:width="{(row.all / track) * 100}%"
        style:grid-template-columns="repeat({row.all}, minmax(0, 1fr))"
        onclick={open}
      >
        {#each row.cells as p (p.slug)}
          <span
            data-slug={p.slug}
            class={cn(
              "relative h-2.5 rounded-[1px] border-r border-transparent bg-clip-padding hover:z-20 hover:outline hover:outline-offset-[1.5px] hover:outline-foreground/55",
              {
                "border-b-[1.5px] border-b-foreground/20": !p.dim,
                "z-10 outline-[1.5px] outline-offset-[1.5px] outline-foreground":
                  explorer.selected === p.slug,
                "z-20 outline outline-offset-[1.5px] outline-foreground/55":
                  explorer.isPointing("slug", p.slug),
              },
            )}
            style:background-color={p.dim ? undefined : p.fill}
            style:background-image={p.dim ? STUB : undefined}
          ></span>
        {/each}
      </div>
    {/each}
  </div>

  <figcaption
    class="mt-1.75 truncate-clip pb-px text-[10.5px] leading-none text-muted-foreground"
  >
    {#if held != null}
      <span class="font-medium text-foreground">{held.name}</span>
      <span aria-hidden="true">·</span>
      {#if held.dim}
        cut by the rules
      {:else}
        {held.valueLabel}
      {/if}
      {#if band != null && band.kept < band.all}
        <span aria-hidden="true">·</span>
        {count(band.kept)} of {count(band.all)} in {band.borough}
      {/if}
    {:else}
      One mark per neighborhood.
    {/if}
  </figcaption>
</figure>

{#if tip && fine.current && held != null && at != null}
  <Tooltip props={held} x={at.x} y={at.y} />
{/if}
