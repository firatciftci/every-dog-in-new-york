<script lang="ts">
  import { fade } from "svelte/transition";
  import { explorer } from "$lib/state.svelte";

  let shown = $state<string | null>(null);
  let first = true;

  $effect(() => {
    const label = explorer.viewLabel;

    if (first) {
      first = false;

      return;
    }

    shown = label;
    const timer = setTimeout(() => (shown = null), 1400);

    return () => clearTimeout(timer);
  });
</script>

{#if shown != null}
  <div
    aria-hidden="true"
    transition:fade={{ duration: 260 }}
    class="pointer-events-none absolute inset-x-0 top-1/2 z-40 flex -translate-y-1/2 justify-center px-6"
  >
    <p
      class="max-w-full truncate-clip rounded-full bg-foreground px-7 py-3 slab text-[clamp(1.3rem,3.4vw,2rem)] leading-none text-background shadow-[0_10px_30px_rgb(30_26_20/0.35)]"
    >
      {shown}
    </p>
  </div>
{/if}
