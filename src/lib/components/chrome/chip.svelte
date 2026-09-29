<script lang="ts">
  import type { Facet } from "$lib/types";
  import { lighting, swatchFor } from "$lib/swatches.svelte";
  import { cn } from "$lib/utils";

  let {
    facet,
    label,
    onclick,
    tone,
    title,
  }: {
    facet: Facet;
    label: string;
    onclick?: () => void;
    tone?: string;
    title?: string;
  } = $props();

  const plate = $derived(facet === "breeds");
  const noun = $derived(plate ? "breed" : "name");

  const tint = $derived(tone ?? swatchFor(facet, label));
  const tinted = $derived(tint != null);
  const swatch = $derived(tint ?? "var(--color-foreground)");

  const lamp = lighting(() => facet);
  const lit = $derived(lamp.lit(label));

  const hint = $derived.by(() => {
    if (title != null) {
      return title;
    }

    const head = `${label}, a ${noun}.`;
    const field = lamp.key;
    if (field == null) {
      return tinted ? `${head} The map keeps this color for it.` : head;
    }

    const won =
      field === "top_breed" || field === "top_name"
        ? "it leads"
        : "where it stands out";

    return `${head} Point at it and only the neighborhoods ${won} keep their color.`;
  });

  const fill = $derived(
    plate || lit
      ? `color-mix(in oklab, ${swatch} ${(tinted ? 24 : 9) + (lit ? 10 : 0)}%, transparent)`
      : "transparent",
  );
  const edge = $derived(
    `inset 0 0 0 ${plate ? "1px" : "1.5px"} color-mix(in oklab, ${swatch} ${(tinted ? (plate ? 55 : 70) : plate ? 26 : 32) + (lit ? 25 : 0)}%, transparent)`,
  );
</script>

<svelte:element
  this={onclick == null ? "span" : "button"}
  {...onclick == null ? {} : { type: "button", onclick }}
  title={hint}
  class={cn(
    "py-px font-semibold text-foreground transition-[background-color,box-shadow] duration-200",
    { "rounded-[3px] px-1.25": plate, "rounded-full px-1.75": !plate },
    { "cursor-pointer": onclick != null },
  )}
  style:background={fill}
  style:box-shadow={edge}
  onpointerenter={() => lamp.light(label)}
  onpointerleave={() => lamp.light(null)}
  onfocus={() => lamp.light(label)}
  onblur={() => lamp.light(null)}
>
  {label}<span class="sr-only">, a {noun}</span>
</svelte:element>
