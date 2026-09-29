import { Context } from "runed";
import type { Facet } from "$lib/types";
import { layerDef } from "$lib/layers";
import { explorer } from "$lib/state.svelte";

export type Swatches = Record<Facet, Map<string, string>>;

const SWATCHES = new Context<() => Swatches>("edny:swatches");

export function setSwatches(read: () => Swatches) {
  SWATCHES.set(read);
}

export function swatchFor(facet: Facet, label: string) {
  return SWATCHES.getOr(null)?.()[facet].get(label);
}

/** Read once at component init; getContext is not available later. */
export function swatches() {
  return SWATCHES.getOr(null);
}

/**
 * A breed or a name under the pointer lights the neighborhoods the map paints in its color, the way a legend
 * row does. Nothing lights while the map paints something else, where that color sits on no neighborhood.
 */
export function lighting(facet: () => Facet) {
  const key = $derived.by(() => {
    const view = explorer.view;
    if (view.kind !== "layer") {
      return null;
    }

    const def = layerDef(view.layer);

    return def.kind === "categorical" && def.facet === facet() ? def.key : null;
  });

  let held: string | null = null;

  // Held on the way in, not read on the way out: the label can leave with the rule that named it.
  $effect(() => {
    const field = key;
    if (field == null) {
      return;
    }

    return () => {
      if (held != null && explorer.isPointing(field, held)) {
        explorer.point("slug", null);
      }
    };
  });

  return {
    get key() {
      return key;
    },
    lit(label: string) {
      return key != null && explorer.isPointing(key, label);
    },
    light(label: string | null) {
      if (key == null) {
        return;
      }

      held = label;
      explorer.point(key, label);
    },
  };
}
