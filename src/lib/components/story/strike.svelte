<script lang="ts">
  import { watch } from "runed";
  import { cn } from "#lib/utils.js";

  let { value, class: className }: { value: string; class?: string } = $props();

  let before = $state<string | null>(null);
  let turn = $state(0);
  let clock: ReturnType<typeof setTimeout> | undefined;

  watch(
    () => value,
    (next, last) => {
      if (last === undefined || next === last) {
        return;
      }

      before = last.length === next.length ? last : null;
      turn += 1;
      clearTimeout(clock);
      clock = setTimeout(() => {
        before = null;
      }, 1400);
    },
  );

  $effect(() => () => {
    clearTimeout(clock);
  });

  const cells = $derived(
    [...value].map((char, i) => {
      const old = before?.[i];

      return {
        char,
        gone: old == null || old === char ? null : old,
        fresh: before == null && turn > 0,
      };
    }),
  );
</script>

<span class={cn("relative inline-flex", className)} style:--way="1">
  <span class="sr-only">{value}</span>
  {#each cells as cell, i (i)}
    <span aria-hidden="true" class="relative grid" style:--i={i}>
      {#key turn}
        {#if cell.gone != null}
          <span class="col-start-1 row-start-1 lift-off">{cell.gone}</span>
        {/if}
        <span
          class={cn("col-start-1 row-start-1", {
            struck: cell.gone != null || cell.fresh,
          })}>{cell.char}</span
        >
      {/key}
    </span>
  {/each}
</span>
