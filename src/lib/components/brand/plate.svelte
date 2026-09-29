<script lang="ts">
  import { plateUrl } from "$lib/breeds";
  import { cn } from "$lib/utils";

  let {
    breed,
    height = 40,
    flip = false,
    halo = false,
    class: className,
  }: {
    breed: string;
    height?: number;
    flip?: boolean;
    halo?: boolean;
    class?: string;
  } = $props();
</script>

<img
  src={plateUrl(breed)}
  alt=""
  loading="lazy"
  decoding="async"
  style:height="{height}px"
  style:--plate-ring="{Math.max(1, height * 0.012).toFixed(2)}px"
  class={cn(
    "w-auto shrink-0 object-contain",
    { "plate-cut": halo, "dark:plate-cut": !halo },
    className,
    { "-scale-x-100": flip },
  )}
/>
