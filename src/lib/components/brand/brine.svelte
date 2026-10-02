<script lang="ts" module>
  const DROPS = [
    { x: 9, at: 0, wide: "0.2em" },
    { x: 26, at: 0.62, wide: "0.28em" },
    { x: 41, at: 0.21, wide: "0.16em" },
    { x: 58, at: 0.94, wide: "0.24em" },
    { x: 74, at: 0.44, wide: "0.18em" },
    { x: 89, at: 1.18, wide: "0.22em" },
  ];
</script>

<script lang="ts">
  import { cn } from "#lib/utils.js";

  let {
    drop = 15,
    from = 6,
    class: className,
  }: { drop?: number; from?: number; class?: string } = $props();
</script>

<span
  aria-hidden="true"
  class={cn("pointer-events-none absolute inset-0 z-10", className)}
  style:font-size="{drop}px"
>
  {#each DROPS.slice(0, from) as water (water.x)}
    <span
      class="drip"
      style:left="{water.x}%"
      style:--at="{water.at}s"
      style:--wide={water.wide}
    ></span>
  {/each}
</span>
