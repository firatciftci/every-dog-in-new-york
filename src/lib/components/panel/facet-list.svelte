<script lang="ts">
  import type { Facet, Ordered } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import { liftOffset, liftWeight } from "#lib/rate.js";
  import { explorer } from "#lib/state.svelte.js";
  import { lighting, swatchFor } from "#lib/swatches.svelte.js";
  import { cn, count, lift } from "#lib/utils.js";

  let {
    title,
    facet,
    rows,
    mappable,
    asks,
    limit = 8,
  }: {
    title: string;
    facet: Facet;
    rows: Ordered;
    mappable: Record<string, Array<number>>;
    asks: keyof Ordered;
    limit?: number;
  } = $props();

  const lamp = lighting(() => facet);

  let order = $state<keyof Ordered>("common");
  let expanded = $state(false);
  const listId = $props.id();

  // Not $derived(asks): the local pick stands until the prop changes; pre avoids building the list twice.
  $effect.pre(() => {
    order = asks;
    expanded = false;
  });

  const list = $derived(rows[order]);
  const shown = $derived(expanded ? list : list.slice(0, limit));

  const peak = $derived(
    Math.max(
      1,
      ...rows.common.map((row) => row.est),
      ...list.map((r) => r.est),
    ),
  );
</script>

<section>
  <div class="flex items-baseline justify-between gap-3">
    <h3 class="slab text-[0.9375rem] text-foreground">{title}</h3>
    <p class="shrink-0 text-[0.71875rem] text-muted-foreground">
      {#each ["common", "distinct"] as const as choice, i (choice)}
        {#if i > 0}<span aria-hidden="true" class="mx-1">·</span>{/if}<button
          type="button"
          aria-pressed={order === choice}
          aria-describedby="{facet}-order-{choice}"
          class={cn(
            "min-h-6 py-1 underline-offset-[3px] transition-colors duration-200",
            {
              "font-semibold text-foreground underline decoration-primary decoration-2":
                order === choice,
              "text-foreground/70 underline decoration-primary/45 decoration-dotted hover:text-foreground hover:decoration-primary":
                order !== choice,
            },
          )}
          onclick={() => {
            order = choice;
            expanded = false;
          }}>{choice === "common" ? "common" : "distinctive"}</button
        >{/each}
    </p>
    <span id="{facet}-order-common" class="sr-only">
      Most dogs here first.
    </span>
    <span id="{facet}-order-distinct" class="sr-only">
      Furthest above the citywide rate first.
    </span>
  </div>

  {#if shown.length === 0}
    <p class="mt-1 text-[0.75rem] leading-snug text-muted-foreground">
      {order === "common"
        ? "Too few dogs here to rank anything."
        : "Nothing here runs far enough above the city to count as a signature."}
    </p>
  {:else}
    <ul id={listId} class="mt-1.5 grid gap-0.75">
      {#each shown as row (row.label)}
        {const active = $derived(explorer.isActiveFocus(facet, row.label))}
        {const swatch = $derived(swatchFor(facet, row.label))}
        {const off = $derived(liftOffset(row.lift))}
        {const over = $derived(row.lift >= 1)}
        {const lit = $derived(lamp.lit(row.label))}
        <li class="min-w-0">
          <button
            type="button"
            disabled={mappable[row.label] === undefined}
            aria-pressed={active}
            class="group relative flex w-full items-center gap-1.5 overflow-clip rounded-[3px] px-2 py-1.25 text-left select-none disabled:cursor-default disabled:opacity-100"
            onclick={() => explorer.setFocus(facet, active ? null : row.label)}
            onpointerenter={() => lamp.light(row.label)}
            onpointerleave={() => lamp.light(null)}
            onfocus={() => lamp.light(row.label)}
            onblur={() => lamp.light(null)}
          >
            <span
              class={cn(
                "absolute inset-y-0 left-0 rounded-[3px] transition-opacity duration-300",
                {
                  "opacity-55": active,
                  "opacity-45": !active && lit,
                  "opacity-30 group-enabled:group-hover:opacity-45":
                    !active && !lit,
                },
                { "bg-muted-foreground": swatch === undefined },
              )}
              style:background={swatch}
              style:width="{Math.max(4, (row.est / peak) * 100)}%"
            ></span>

            {#if facet === "breeds"}
              <Plate
                breed={row.label}
                height={22}
                class="relative z-10 max-w-7"
              />
            {/if}

            <span
              class={cn(
                "relative z-10 min-w-0 flex-1 truncate-clip text-[0.78125rem] group-disabled:text-foreground/60",
                {
                  "font-semibold text-foreground": active,
                  "text-foreground": !active,
                },
              )}
            >
              {row.label}
            </span>

            <span
              class="relative z-10 shrink-0 numeric text-[0.6875rem] text-muted-foreground"
            >
              {count(row.est)}
            </span>

            <span
              class="relative z-10 ml-1 h-3 w-11 shrink-0"
              aria-hidden="true"
            >
              <span
                class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/12"
              ></span>
              <span
                class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/45"
              ></span>
              <span
                class="absolute top-1/2 h-px -translate-y-1/2 bg-foreground/35"
                style:left="{Math.min(50, 50 + off * 44)}%"
                style:width="{Math.abs(off) * 44}%"
              ></span>
              <span
                class={cn(
                  "absolute top-1/2 size-1.25 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  { "bg-foreground": swatch === undefined },
                  { "opacity-55": !over },
                )}
                style:background={swatch}
                style:left="{50 + off * 44}%"
              ></span>
            </span>

            {const weight = $derived(liftWeight(row.lift))}
            <span
              class={cn(
                "relative z-10 shrink-0 text-right numeric text-[0.6875rem] whitespace-nowrap",
                {
                  "text-foreground": weight === "over",
                  "text-muted-foreground": weight !== "over",
                },
              )}
            >
              {lift(row.lift)}
            </span>
          </button>
        </li>
      {/each}
    </ul>

    {#if list.length > limit}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        class="mt-1.5 min-h-6 py-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
        onclick={() => {
          expanded = !expanded;
        }}
      >
        {expanded ? "Show fewer" : `Show all ${list.length}`}
      </button>
    {/if}
  {/if}
</section>
