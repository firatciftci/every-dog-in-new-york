<script lang="ts">
  import type { Part } from "$lib/sentence";
  import { isGlued } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { cn } from "$lib/utils";
  import Chip from "./chip.svelte";
  import Dial from "./dial.svelte";

  let { parts }: { parts: Array<Part> } = $props();

  const over = (part: Part) =>
    typeof part !== "string" && part.kind === "place" && part.point != null
      ? {
          onpointerenter: () =>
            explorer.point(part.point!.field, part.point!.value),
          onpointerleave: () => explorer.point("slug", null),
          onfocus: () => explorer.point(part.point!.field, part.point!.value),
          onblur: () => explorer.point("slug", null),
        }
      : {};
</script>

{#each parts as part, i (i)}{#if i > 0 && !isGlued(part)}{" "}{/if}{#if typeof part === "string"}{part}{:else if part.kind === "chip"}<Chip
      facet={part.facet}
      label={part.label}
      onclick={part.go}
    />{:else if part.kind === "dial"}<Dial
      name={part.name}
      value={part.value}
      min={part.min}
      max={part.max}
      step={part.step}
      format={part.format}
      set={part.set}
    />{:else}{#if part.go == null}<span
        class={cn("text-foreground", {
          "font-display font-semibold": part.kind === "place",
          "numeric font-bold": part.kind !== "place",
        })}
        {...over(part)}>{part.label}</span
      >{:else}<button
        type="button"
        class={cn(
          "cursor-pointer text-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary",
          {
            "font-display font-semibold": part.kind === "place",
            "numeric font-bold": part.kind !== "place",
          },
        )}
        onclick={part.go}
        {...over(part)}>{part.label}</button
      >{/if}{/if}{/each}
