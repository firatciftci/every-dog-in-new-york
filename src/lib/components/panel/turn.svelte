<script lang="ts">
  import type { Painted } from "$lib/layers";
  import { explorer } from "$lib/state.svelte";
  import { count } from "$lib/utils";

  let { painted }: { painted: Painted } = $props();

  const filtering = $derived(explorer.filters.length > 0);
</script>

<button
  type="button"
  class="group mt-5 block w-full cursor-pointer border-t rule pt-3 text-left"
  onclick={() => {
    explorer.showCity();
  }}
>
  <span class="flex items-baseline gap-1.5">
    <span
      class="slab text-[15px] text-foreground transition-colors duration-200 group-hover:text-primary"
      >{filtering ? "Still on the map" : "The whole city"}</span
    >
    <span
      aria-hidden="true"
      class="text-[13px] text-primary transition-transform duration-200 group-hover:translate-x-0.5"
      >→</span
    >
  </span>
  <span class="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
    {#if filtering}
      All {count(painted.standing.length)} that survived the rules, ranked, and the
      ways to cut them further.
    {:else}
      Back to the map key, all {count(painted.standing.length)} neighborhoods ranked,
      and the rules for cutting them down.
    {/if}
  </span>
</button>
