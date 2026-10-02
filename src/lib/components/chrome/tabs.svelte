<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import type { Painted } from "#lib/layers.js";
  import type { PaintedProperties } from "#lib/types.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";

  let { painted, selected }: { painted: Painted; selected: PaintedProperties } =
    $props();

  const onCity = $derived(explorer.tab === "city");

  function arrows(event: KeyboardEvent) {
    if (event.key === "Delete" && !onCity) {
      event.preventDefault();
      explorer.clearSelection(false);

      return;
    }

    const left =
      event.key === "ArrowLeft" || event.key === "Home"
        ? true
        : event.key === "ArrowRight" || event.key === "End"
          ? false
          : null;
    if (left == null) {
      return;
    }

    event.preventDefault();
    const next = left ? "city" : "place";
    if (next === "city") {
      explorer.showCity();
    } else {
      explorer.showPlace();
    }

    document.querySelector<HTMLElement>(`#rail-tab-${next}`)?.focus();
  }

  const swatches = $derived.by(() => {
    const rows = painted.legend.filter((entry) => entry.areas !== 0);
    const step = Math.max(1, (rows.length - 1) / 4);

    return Array.from(
      { length: Math.min(5, rows.length) },
      (_, i) => rows[Math.round(i * step)]?.color ?? "transparent",
    );
  });
</script>

<div class="relative z-20 flex items-end gap-1.5 px-5">
  <!-- aria-owns: the place tab shares a card with its close button, so the tablist claims it by id. -->
  <div
    role="tablist"
    aria-label="Cards"
    aria-owns="rail-tab-city rail-tab-place"
    class="contents"
  >
    <button
      type="button"
      role="tab"
      id="rail-tab-city"
      aria-selected={onCity}
      aria-controls="rail-pane"
      tabindex={onCity ? 0 : -1}
      class={cn(
        "relative flex min-w-0 shrink-0 items-center gap-1.5 rounded-t-[7px] border px-2.5 slab text-[12.5px] whitespace-nowrap transition-colors duration-200",
        {
          "top-px border-b-0 rule paper pt-1.5 pb-2 text-foreground": onCity,
          "rule bg-foreground/4.5 pt-1 pb-1.5 text-muted-foreground hover:text-foreground":
            !onCity,
        },
      )}
      onclick={() => {
        explorer.showCity();
      }}
      onkeydown={arrows}
    >
      <span
        class="flex shrink-0 overflow-clip rounded-[1px]"
        aria-hidden="true"
      >
        {#each swatches as color, i (i)}
          <span class="h-2.5 w-[3.5px]" style:background={color}></span>
        {/each}
      </span>
      {explorer.filters.length > 0
        ? "On the map"
        : "The whole city"}&#8239;<span
        class="numeric text-[10.5px] text-muted-foreground"
        >{count(painted.standing.length)}</span
      >
    </button>
  </div>

  <div
    role="presentation"
    class={cn(
      "relative flex min-w-0 items-center gap-1.5 rounded-t-[7px] border px-2.5 pr-1 slab text-[12.5px] whitespace-nowrap transition-colors duration-200",
      onCity
        ? "rule bg-foreground/4.5 pt-1 pb-1.5 text-muted-foreground hover:text-foreground"
        : "top-px border-b-0 rule paper pt-1.5 pb-2 text-foreground",
    )}
  >
    <button
      type="button"
      role="tab"
      id="rail-tab-place"
      aria-selected={!onCity}
      aria-controls="rail-pane"
      tabindex={onCity ? -1 : 0}
      class="min-w-0 cursor-pointer truncate-clip"
      onclick={() => {
        explorer.showPlace();
      }}
      onkeydown={arrows}>{selected.name}</button
    >
    <button
      type="button"
      aria-label="Close {selected.name}"
      class="-my-1.5 -ml-1 shrink-0 cursor-pointer p-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
      onclick={() => {
        explorer.clearSelection(false);
      }}
    >
      <XIcon class="size-3" strokeWidth={2.25} />
    </button>
  </div>
</div>
