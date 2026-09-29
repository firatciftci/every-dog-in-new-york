import type { Rival } from "$lib/compare";
import type { Filter } from "$lib/query";
import type { Focus, LayerId, View } from "$lib/types";
import { boutOf } from "$lib/compare";
import { layerDef, layerOfField } from "$lib/layers";
import { facetOfField, filterKey } from "$lib/query";
import { FACET_FIELDS } from "$lib/types";

export type Asked = {
  layer: LayerId;
  focus: Focus | null;
  filters: ReadonlyArray<Filter>;
  rivals: ReadonlyArray<Rival>;
};

/**
 * A rule on the other winner field of the same facet reads as a request for that
 * layer, so a stale link resyncs instead of painting the wrong column.
 */
function readingOf(
  layer: LayerId,
  filters: ReadonlyArray<Filter>,
): LayerId | null {
  const def = layerDef(layer);
  if (def.kind !== "categorical") {
    return null;
  }

  const { top, distinct } = FACET_FIELDS[def.facet];
  const other = def.key === top ? distinct : top;
  const hasRule = (field: string) =>
    filters.some((f) => filterKey(f) === `in:${field}`);

  return hasRule(other) && !hasRule(def.key) ? layerOfField(other) : null;
}

function subjectOf(asked: Asked): Focus | null {
  if (asked.focus != null) {
    return asked.focus;
  }

  for (const filter of asked.filters) {
    if (filter.kind !== "in" || filter.negate || filter.values.length !== 1) {
      continue;
    }

    const facet = facetOfField(filter.field);
    const label = filter.values[0];
    if (facet != null && label != null) {
      return { facet, label };
    }
  }

  return null;
}

export function resolveView(asked: Asked) {
  const layer = readingOf(asked.layer, asked.filters) ?? asked.layer;
  const bout = asked.rivals.length >= 2 ? boutOf(asked.rivals) : null;

  const view: View =
    bout === "subject"
      ? { kind: "bout", rivals: asked.rivals }
      : asked.focus == null
        ? { kind: "layer", layer }
        : { kind: "focus", focus: asked.focus };

  return { view, layer, bout, subject: subjectOf(asked) };
}
