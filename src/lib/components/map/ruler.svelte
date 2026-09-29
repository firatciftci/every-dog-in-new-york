<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { MediaQuery } from "svelte/reactivity";
  import { slide } from "svelte/transition";
  import type { Painted } from "$lib/layers";
  import { explorer } from "$lib/state.svelte";
  import { cn, count } from "$lib/utils";

  let { map, painted }: { map: MapLibreMap; painted: Painted } = $props();

  const BAR = 112;

  let meters = $state(0);
  let open = $state(false);
  let tag = $state<HTMLElement | null>(null);

  $effect(() => {
    const read = () => {
      const canvas = map.getCanvas();
      const y = canvas.clientHeight / 2;

      meters = map.unproject([0, y]).distanceTo(map.unproject([BAR, y]));
    };

    read();
    map.on("move", read);
    map.on("resize", read);

    return () => {
      map.off("move", read);
      map.off("resize", read);
    };
  });

  const wide = new MediaQuery("(min-width: 880px)");
  const buried = $derived(!wide.current && explorer.sheet === "full");

  $effect(() => {
    if (buried) {
      open = false;
    }
  });

  function reading(per: number, short: string, long: string) {
    const most = meters / per;
    const pow = 10 ** Math.floor(Math.log10(most));
    const lead = most / pow;
    const round = pow * (lead >= 5 ? 5 : lead >= 3 ? 3 : lead >= 2 ? 2 : 1);

    return {
      width: BAR * (round / most),
      figure: `${count(round)} ${short}`,
      spoken: `${count(round)} ${long}`,
    };
  }

  const imperial = $derived(
    meters / 0.3048 > 5280
      ? reading(1609.344, "mi", "miles")
      : reading(0.3048, "ft", "feet"),
  );

  const metric = $derived(
    meters >= 1000
      ? reading(1000, "km", "kilometers")
      : reading(1, "m", "meters"),
  );

  const brief = $derived(explorer.viewBrief);
  const ramp = $derived(painted.kind === "sequential");

  const low = $derived(painted.legend[0]?.label.split("–")[0] ?? "");
  const high = $derived(painted.legend.at(-1)?.label ?? "");

  const label = $derived.by(() => {
    const colors = ramp
      ? `Colored by ${brief.short}, from ${low} to ${high}.`
      : `Colored by ${brief.short}.`;
    const meaning = brief.gloss == null ? "" : ` ${brief.gloss}`;

    return open
      ? `Map legend. ${colors}${meaning} The scale bar is ${imperial.spoken}, or ${metric.spoken}. Fold the legend away.`
      : `Map legend. ${colors} The scale bar is ${imperial.spoken}. Open it for what the colors mean and the metric scale.`;
  });

  function away(event: PointerEvent) {
    if (!open || tag?.contains(event.target as Node) === true) {
      return;
    }

    open = false;
  }

  function dismiss(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open || explorer.dialogUp) {
      return;
    }

    event.preventDefault();
    open = false;
  }
</script>

<svelte:document onkeydown={dismiss} />
<svelte:window onpointerdown={away} />

{#snippet bar(width: number, figure: string)}
  <span class="relative block h-1.5" style:width="{BAR}px">
    <span class="absolute inset-x-0 bottom-0 h-px bg-foreground/15"></span>
    <span
      class="absolute bottom-0 left-0 h-px bg-foreground/60"
      style:width="{width}px"
    ></span>
    <span class="absolute bottom-0 left-0 h-1.5 w-px bg-foreground/60"></span>
    <span
      class="absolute bottom-0 h-1 w-px bg-foreground/40"
      style:left="{width / 2}px"
    ></span>
    <span
      class="absolute bottom-0 h-1.5 w-px bg-foreground/60"
      style:left="{width - 1}px"
    ></span>
  </span>
  <span class="mt-1 block slab text-[12.5px] leading-none">{figure}</span>
{/snippet}

{#if meters > 0}
  <div
    bind:this={tag}
    inert={buried}
    class={cn(
      "absolute top-safe-offset-3 left-safe-offset-3 z-30 transition-opacity duration-200 min-[880px]:top-auto min-[880px]:bottom-6 min-[880px]:left-101",
      { "pointer-events-none opacity-0": buried },
    )}
  >
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      style:box-shadow={"0 2px 1px rgb(58 48 38/0.14), 0 9px 24px rgb(30 26 20/0.26)"}
      class="block rotate-[-1.2deg] cursor-pointer rounded-[10px] paper px-2.5 py-2 text-left text-foreground outline outline-foreground/12"
      onclick={() => {
        open = !open;
      }}
    >
      <span class="block" style:width="{BAR}px" aria-hidden="true">
        <span class="flex items-center gap-1.5">
          <span
            class="min-w-0 flex-1 truncate-clip slab text-[8.5px] tracking-[0.09em] text-muted-foreground uppercase"
            >{brief.short}</span
          >
          <svg
            viewBox="0 0 14 8"
            class={cn(
              "h-1.5 w-2.5 shrink-0 text-foreground/40 transition-transform duration-300 ease-out",
              { "rotate-180": open },
            )}
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M1 2L7 6.5L13 2" />
          </svg>
        </span>

        <span
          class={cn(
            "mt-1.5 flex h-1.5 overflow-clip rounded-xs ring-1 ring-border",
            { "gap-px": !ramp },
          )}
        >
          {#each painted.legend as entry (entry.color)}
            <span class="flex-1" style:background={entry.color}></span>
          {/each}
        </span>

        {#if ramp}
          <span
            class="mt-0.5 flex justify-between numeric text-[9.5px] leading-none text-muted-foreground"
          >
            <span>{low}</span>
            <span>{high}</span>
          </span>
        {/if}

        {#if open && brief.gloss != null}
          <span
            class="mt-1.5 block overflow-clip text-[10px] leading-snug text-muted-foreground"
            transition:slide={{ duration: 210 }}>{brief.gloss}</span
          >
        {/if}

        <span class="mt-2 block border-t rule pt-1">
          {@render bar(imperial.width, imperial.figure)}
        </span>

        {#if open}
          <span
            class="mt-1.5 block overflow-clip"
            transition:slide={{ duration: 210 }}
          >
            {@render bar(metric.width, metric.figure)}
          </span>
        {/if}
      </span>
    </button>
  </div>
{/if}
