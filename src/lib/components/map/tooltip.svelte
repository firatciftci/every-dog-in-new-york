<script lang="ts">
  import { innerHeight, innerWidth } from "svelte/reactivity/window";
  import type { PaintedProperties } from "$lib/types";
  import Brine from "$lib/components/brand/brine.svelte";
  import Plate from "$lib/components/brand/plate.svelte";
  import { readout } from "$lib/layers";
  import { explorer } from "$lib/state.svelte";
  import { cn, count } from "$lib/utils";

  let { props, x, y }: { props: PaintedProperties; x: number; y: number } =
    $props();

  const value = $derived(readout(explorer.view, props));

  const dog = $derived(explorer.dogHere(props));

  const wet = $derived(explorer.soaked(props.borough));
  const flipX = $derived(x > (innerWidth.current ?? 0) - 260);
  const flipY = $derived(y > (innerHeight.current ?? 0) - 200);

  const tint = $derived(props.tone ?? "var(--color-primary)");

  const lift = $derived(
    `0 8px 24px rgb(30 26 20 / 0.24), inset 0 0 0 1.5px color-mix(in oklab, ${tint} 45%, transparent)`,
  );
</script>

<div
  aria-hidden="true"
  class={cn("pointer-events-none absolute z-40 w-60", {
    "-translate-x-full": flipX,
    "-translate-y-full": flipY,
  })}
  style:left="{x + (flipX ? -14 : 14)}px"
  style:top="{y + (flipY ? -14 : 14)}px"
>
  <div class="relative">
    {#if dog != null}
      <span
        class={cn(
          "absolute -top-11 z-10 drop-shadow-[0_2px_4px_rgb(30_26_20/0.3)]",
          { "right-0": flipX, "left-0": !flipX },
          { sodden: wet },
        )}
      >
        <span class={cn("relative block origin-bottom", { shivers: wet })}>
          <Plate breed={dog} height={50} flip={flipX} halo />
        </span>
        {#if wet}
          <Brine drop={11} from={3} />
        {/if}
      </span>
    {/if}

    <div
      class={cn("relative overflow-clip bg-card px-3.5 py-2.5", {
        "rounded-[18px] rounded-tl-lg": !flipX && !flipY,
        "rounded-[18px] rounded-tr-lg": flipX && !flipY,
        "rounded-[18px] rounded-bl-lg": !flipX && flipY,
        "rounded-[18px] rounded-br-lg": flipX && flipY,
      })}
      style:box-shadow={lift}
    >
      <p
        class="font-display text-[15px] leading-tight font-bold tracking-tight text-foreground"
      >
        {props.name}<span class="font-normal text-muted-foreground">
          , {props.borough}</span
        >
      </p>

      <p
        class="mt-1.5 line-clamp-2 figure-sm leading-tight"
        style:color={props.tone ?? "var(--color-foreground)"}
      >
        {value.headline}
      </p>
      <p class="mt-1 text-[11px] leading-snug text-muted-foreground">
        {value.sub}
      </p>

      <p
        class="mt-2 border-t rule pt-1.5 numeric text-[11px] text-muted-foreground"
      >
        {count(props.dogs)} dogs, {count(Number(props.density.toFixed(0)))} per mi²
      </p>

      {#if wet}
        <span aria-hidden="true" class="watermark"></span>
      {/if}
    </div>
  </div>
</div>
