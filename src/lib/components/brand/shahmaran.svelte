<script lang="ts">
  import { cn } from "$lib/utils";

  let { height = 40, class: className }: { height?: number; class?: string } =
    $props();
</script>

<span
  aria-hidden="true"
  style:height="{height}px"
  style:width="{((height * 277.9) / 301.2).toFixed(1)}px"
  style:mask="url(/shahmaran.svg) center / contain no-repeat"
  class={cn("inline-block shrink-0 bg-current", className)}
></span>
