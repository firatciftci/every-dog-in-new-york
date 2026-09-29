<script lang="ts" module>
  import type { Facet, LayerId } from "$lib/types";

  const GROUPS = [
    {
      label: "Breeds",
      facet: "breeds",
      modes: [
        { label: "most common", layer: "breed" },
        { label: "most distinctive", layer: "distinct-breed" },
      ],
    },
    {
      label: "Names",
      facet: "names",
      modes: [
        { label: "most common", layer: "name" },
        { label: "most distinctive", layer: "distinct-name" },
      ],
    },
    {
      label: "Dogs",
      facet: null,
      modes: [
        { label: "how many", layer: "dogs" },
        { label: "how packed", layer: "density" },
        { label: "per home", layer: "per-home" },
        { label: "per person", layer: "per-person" },
        { label: "on 311", layer: "complaints" },
      ],
    },
  ] as const satisfies ReadonlyArray<{
    label: string;
    facet: Facet | null;
    modes: ReadonlyArray<{ label: string; layer: LayerId }>;
  }>;
</script>

<script lang="ts">
  import { layerDef, layerOfField } from "$lib/layers";
  import { explorer } from "$lib/state.svelte";
  import { FACET_FIELDS } from "$lib/types";
  import { cn } from "$lib/utils";
  import ModeLine from "./mode-line.svelte";

  const asked = $derived(
    Math.max(
      0,
      GROUPS.findIndex((group) =>
        group.modes.some((mode) => mode.layer === explorer.layer),
      ),
    ),
  );
  const mode = $derived(
    Math.max(
      0,
      GROUPS[asked]!.modes.findIndex((m) => m.layer === explorer.layer),
    ),
  );
  const modes = $derived(GROUPS[asked]!.modes);

  function alike(a: (typeof GROUPS)[number], b: (typeof GROUPS)[number]) {
    return (
      a.modes.length === b.modes.length &&
      a.modes.every((m, i) => m.label === b.modes[i]!.label)
    );
  }

  function target(group: (typeof GROUPS)[number]): LayerId {
    const subject = explorer.subject;

    if (subject?.facet === group.facet) {
      const { top, distinct } = FACET_FIELDS[subject.facet];
      for (const field of [top, distinct] as const) {
        if (explorer.filterAt(`in:${field}`) != null) {
          return layerOfField(field);
        }
      }
    }

    const carried = alike(GROUPS[asked]!, group)
      ? group.modes[mode]
      : undefined;

    return (carried ?? group.modes[0]).layer;
  }
</script>

<div role="group" aria-label="What the map shows">
  <!-- py-1.5: at py-1 the button measured 23.625px, under the 24px WCAG target size. -->
  <div class="-my-1.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
    {#each GROUPS as group (group.label)}
      {const layer = $derived(target(group))}
      {const on = $derived(explorer.isActiveLayer(layer))}
      <button
        type="button"
        aria-pressed={on}
        class={cn(
          "cursor-pointer py-1.5 slab text-[12.5px] leading-tight tracking-[0.11em] uppercase transition-colors duration-200",
          {
            "text-foreground underline decoration-primary/70 decoration-[1.5px] underline-offset-[5px]":
              on,
            // 65%: 5.31:1, over the 4.5:1 floor for normal-size text.
            "text-foreground/65 hover:text-foreground/90 hover:underline hover:decoration-primary/45 hover:decoration-[1.5px] hover:underline-offset-[5px]":
              !on,
          },
        )}
        onclick={() => explorer.setLayer(layer)}
      >
        {group.label}
      </button>
    {/each}
  </div>

  <div class="mt-1.5">
    <ModeLine
      id="view"
      size="lg"
      options={modes.map((choice) => ({
        key: choice.layer,
        word: choice.label,
        gloss: layerDef(choice.layer).gloss,
        on: explorer.isActiveLayer(choice.layer),
        pick: () => explorer.setLayer(choice.layer),
      }))}
    />
  </div>
</div>
