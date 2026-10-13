<script lang="ts">
  import { fade } from "svelte/transition";
  import type { Painted } from "#lib/layers.js";
  import type { PaintedProperties } from "#lib/types.js";
  import Brine from "#lib/components/brand/brine.svelte";
  import Kelp from "#lib/components/brand/kelp.svelte";
  import Plate from "#lib/components/brand/plate.svelte";
  import { cityRate } from "#lib/rate.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  let {
    props,
    painted,
    size = 78,
  }: { props: PaintedProperties; painted: Painted; size?: number } = $props();

  const dog = $derived(explorer.dogHere(props));

  const wet = $derived(explorer.soaked(props.borough));

  const scale = $derived.by(() => {
    const focus = explorer.focus;
    if (focus == null || props.dim) {
      return null;
    }

    let peak = 0;
    for (const mark of painted.marks) {
      peak = Math.max(peak, painted.rank(mark));
    }

    if (peak <= 0) {
      return null;
    }

    const city = cityRate(painted.marks, painted.rank);

    return {
      here: Math.min(100, Math.max(2, (painted.rank(props) / peak) * 100)),
      city: Math.min(100, (city / peak) * 100),
    };
  });
</script>

<div>
  <div class="flex items-end justify-between gap-2">
    <div class="min-w-0 flex-1 pb-1">
      <h2
        class="-ml-0.5 font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
      >
        {props.name}
      </h2>
      <p class="mt-0.5 text-[0.8125rem] text-muted-foreground">
        {props.borough}
      </p>

      {#if wet}
        <p
          role="status"
          transition:fade={{ duration: 300 }}
          class="relative mt-1 inline-block sodden text-[0.75rem] leading-snug text-brine"
        >
          Just up from the harbor floor. Mind the puddle.
          <Brine drop={11} from={5} class="-bottom-0.5" />
        </p>
      {/if}
    </div>

    {#if dog != null}
      <!-- Separate element: wag-hover and the arrival both set animation, and one element cannot hold both. -->
      {#key `${props.slug} ${dog}`}
        <span
          class={cn(
            "relative block max-w-[44%] origin-bottom motion-safe:animate-[fetch_0.66s_linear]",
            { sodden: wet },
          )}
        >
          {#if wet}
            <span
              aria-hidden="true"
              class="absolute -bottom-1 left-1/2 h-2 w-[92%] -translate-x-1/2 puddle"
            ></span>
          {/if}

          <!-- Separate element: the arrival above and the shake here both set animation. -->
          <span class={cn("relative block origin-bottom", { shivers: wet })}>
            <Plate breed={dog} height={size} class="origin-bottom wag-hover" />
          </span>

          {#if wet}
            <span
              aria-hidden="true"
              class="pointer-events-none absolute top-full left-0 w-full -translate-y-0.5 mask-[linear-gradient(to_bottom,black_0%,transparent_78%)] opacity-30 blur-[1.2px]"
            >
              <Plate breed={dog} height={size} class="-scale-y-100" />
            </span>

            <Brine drop={15} from={5} />

            <Kelp
              class="top-[2%] left-[6%] z-20 h-[52%] w-[24%] text-[oklch(0.45_0.048_168)] opacity-85 dark:text-[oklch(0.63_0.055_168)]"
            />
          {/if}
        </span>
      {/key}
    {/if}
  </div>

  {#if scale == null}
    <div class="h-1.25 rounded-[50%]" style:background={props.fill}></div>
  {:else}
    <div class="relative h-1.25" aria-hidden="true">
      <div class="absolute inset-0 rounded-[50%] bg-foreground/8"></div>
      <div
        class="absolute inset-y-0 left-0 rounded-[50%] transition-[width] duration-500 ease-out"
        style:width="{scale.here}%"
        style:background={props.fill}
      ></div>
      <div
        class="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-foreground/45"
        style:left="{scale.city}%"
      ></div>
    </div>
  {/if}

  <p class="mt-2 text-[0.78125rem] leading-snug text-muted-foreground">
    <button
      type="button"
      class="text-left font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
      onclick={() => {
        explorer.openCompare({
          kind: "hood",
          slug: props.slug,
          label: props.name,
        });
      }}
    >
      Hold {props.name} up against another neighborhood
    </button>
  </p>
</div>
