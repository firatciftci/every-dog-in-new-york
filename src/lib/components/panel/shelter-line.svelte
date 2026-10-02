<script lang="ts">
  import type { Shelter } from "#lib/types.js";
  import { DOORWAY, KENNEL } from "#lib/kennel.js";
  import { explorer } from "#lib/state.svelte.js";

  let { here }: { here: Array<Shelter> } = $props();
</script>

{#if here.length > 0}
  <div class="mt-3 border-l-2 border-primary/60 pl-3">
    <p class="flex items-baseline gap-1.5 text-[13px] leading-relaxed">
      <svg
        viewBox="0 0 26 25"
        class="size-3 shrink-0 translate-y-px text-primary"
        aria-hidden="true"
      >
        <path
          d={KENNEL}
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linejoin="round"
        />
        <path d={DOORWAY} fill="currentColor" />
      </svg>
      <span class="min-w-0 text-foreground/85">
        {here.length === 1
          ? "There is a shelter here:"
          : "Shelters here:"}{" "}{#each here as place, i (place.slug)}{#if i > 0},
          {/if}<button
            type="button"
            class="cursor-pointer font-medium text-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
            onclick={() => {
              explorer.openShelter(place.slug);
            }}>{place.name}</button
          >{/each}.
      </span>
    </p>
  </div>
{/if}
