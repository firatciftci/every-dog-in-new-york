<script lang="ts">
  import type { Painted } from "#lib/layers.js";
  import { explorer } from "#lib/state.svelte.js";
  import { count } from "#lib/utils.js";

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
      class="slab text-[0.9375rem] text-foreground transition-colors duration-200 group-hover:text-primary"
      >{filtering ? "On the map" : "The whole city"}</span
    >
    <span
      aria-hidden="true"
      class="text-[0.8125rem] text-primary transition-transform duration-200 group-hover:translate-x-0.5"
      >→</span
    >
  </span>
  <span class="mt-0.5 block text-[0.75rem] leading-snug text-muted-foreground">
    {#if filtering}
      All {count(painted.standing.length)} that survived the rules, ranked, and the
      ways to cut them further.
    {:else}
      Back to the map key, all {count(painted.standing.length)} neighborhoods ranked,
      and the rules for cutting them down.
    {/if}
  </span>
</button>
