<script lang="ts">
  import { Slider as SliderPrimitive } from "bits-ui";
  import type { WithoutChildrenOrChild } from "$lib/utils";
  import { cn } from "$lib/utils";

  let {
    ref = $bindable(null),
    value = $bindable(),
    orientation = "horizontal",
    class: className,
    thumbLabels,
    thumbTexts,
    ...restProps
  }: WithoutChildrenOrChild<SliderPrimitive.RootProps> & {
    thumbLabels?: Array<string>;
    thumbTexts?: Array<string>;
  } = $props();
</script>

<!-- Discriminated unions and $bindable destructuring conflict, so value is cast to never. -->
<SliderPrimitive.Root
  bind:ref
  bind:value={value as never}
  data-slot="slider"
  {orientation}
  class={cn(
    "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
    className,
  )}
  {...restProps}
>
  {#snippet children({ thumbItems })}
    <span
      data-slot="slider-track"
      data-orientation={orientation}
      class="relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
    >
      <SliderPrimitive.Range
        data-slot="slider-range"
        class="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full"
      />
    </span>
    {#each thumbItems as thumb, i (thumb.index)}
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        index={thumb.index}
        aria-label={thumbLabels?.[i]}
        aria-valuetext={thumbTexts?.[i]}
        class="relative block size-3 shrink-0 rounded-full border border-ring bg-card ring-ring/50 transition-[color,box-shadow] duration-200 select-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
      />
    {/each}
  {/snippet}
</SliderPrimitive.Root>
