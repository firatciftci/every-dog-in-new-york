<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import type { Painted } from "#lib/layers.js";
  import type { PaintedProperties } from "#lib/types.js";
  import { collarOf, pet } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";

  let {
    painted,
    selected,
  }: { painted: Painted; selected: PaintedProperties | null } = $props();

  const dog = $derived(explorer.petOpen ? pet.dog : null);

  const order = $derived<Array<"city" | "place" | "pet">>([
    "city",
    ...(selected == null ? [] : ["place" as const]),
    ...(dog == null ? [] : ["pet" as const]),
  ]);

  function go(tab: "city" | "place" | "pet") {
    if (tab === "city") {
      explorer.showCity();
    } else if (tab === "place") {
      explorer.showPlace();
    } else {
      explorer.showPet();
    }
  }

  function arrows(event: KeyboardEvent) {
    const now = explorer.tab;
    if (event.key === "Delete" && now !== "city") {
      event.preventDefault();
      if (now === "pet") {
        explorer.closePet();
      } else {
        explorer.clearSelection(false);
      }

      return;
    }

    const at = order.indexOf(now);
    const next =
      event.key === "Home"
        ? order[0]
        : event.key === "End"
          ? order.at(-1)
          : event.key === "ArrowLeft"
            ? order[Math.max(0, at - 1)]
            : event.key === "ArrowRight"
              ? order[Math.min(order.length - 1, at + 1)]
              : null;
    if (next == null) {
      return;
    }

    event.preventDefault();
    go(next);
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

{#snippet closable(
  tab: "place" | "pet",
  label: string,
  close: string,
  onclose: () => void,
  dot: string | null,
)}
  {const on = $derived(explorer.tab === tab)}
  <div
    role="presentation"
    class={cn(
      "relative flex min-w-0 items-stretch rounded-t-[7px] border pr-1 slab text-[0.78125rem] whitespace-nowrap transition-colors duration-200",
      {
        "top-px border-b-0 rule paper text-foreground": on,
        "rule bg-foreground/4.5 text-muted-foreground hover:text-foreground":
          !on,
      },
    )}
  >
    <button
      type="button"
      role="tab"
      id="rail-tab-{tab}"
      aria-selected={on}
      aria-controls="rail-pane"
      tabindex={on ? 0 : -1}
      class={cn(
        "flex min-w-0 cursor-pointer items-center gap-1.5 rounded-tl-[7px] pr-1.5 pl-2.5",
        { "pt-1.5 pb-2": on, "pt-1 pb-1.5": !on },
      )}
      onclick={() => {
        go(tab);
      }}
      onkeydown={arrows}
    >
      {#if dot != null}
        <span
          aria-hidden="true"
          class="size-2 shrink-0 rounded-full ring-1 ring-black/15"
          style:background={dot}
        ></span>
      {/if}
      <span class="min-w-0 truncate-clip">{label}</span>
    </button>
    <button
      type="button"
      aria-label={close}
      class="-ml-1 grid shrink-0 cursor-pointer place-items-center px-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
      onclick={onclose}
    >
      <XIcon class="size-3" strokeWidth={2.25} />
    </button>
  </div>
{/snippet}

<div class="relative z-20 flex items-end gap-1.5 px-5">
  <!-- aria-owns: each closable tab shares a card with its close button, so the tablist claims it by id. -->
  <div
    role="tablist"
    aria-label="Cards"
    aria-owns={order.map((tab) => `rail-tab-${tab}`).join(" ")}
    class="contents"
  >
    <button
      type="button"
      role="tab"
      id="rail-tab-city"
      aria-selected={explorer.tab === "city"}
      aria-controls="rail-pane"
      tabindex={explorer.tab === "city" ? 0 : -1}
      class={cn(
        "relative flex min-w-0 shrink-0 items-center gap-1.5 rounded-t-[7px] border px-2.5 slab text-[0.78125rem] whitespace-nowrap transition-colors duration-200",
        {
          "top-px border-b-0 rule paper pt-1.5 pb-2 text-foreground":
            explorer.tab === "city",
          "rule bg-foreground/4.5 pt-1 pb-1.5 text-muted-foreground hover:text-foreground":
            explorer.tab !== "city",
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
      {#if order.length > 2}
        {explorer.filters.length > 0 ? "Map" : "City"}
      {:else}
        {explorer.filters.length > 0
          ? "On the map"
          : "The whole city"}&#8239;<span
          class="numeric text-[0.65625rem] text-muted-foreground"
          >{count(painted.standing.length)}</span
        >
      {/if}
    </button>
  </div>

  {#if selected != null}
    {@render closable(
      "place",
      selected.name,
      `Close ${selected.name}`,
      () => {
        explorer.clearSelection(false);
      },
      null,
    )}
  {/if}

  {#if dog != null}
    {@render closable(
      "pet",
      dog.name,
      `Close ${dog.name}’s card`,
      () => {
        explorer.closePet();
      },
      collarOf(dog.collar),
    )}
  {/if}
</div>
