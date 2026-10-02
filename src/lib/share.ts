import type { ReturnUseSearchParams } from "runed/kit";
import { createSearchParamsSchema } from "runed/kit";
import type { Rival } from "#lib/compare.js";
import type { Filter, Metric, NumericField } from "#lib/query.js";
import type { CategoryField, Facet, Focus, LayerId } from "#lib/types.js";
import { DEFAULT_LAYER, isLayerId } from "#lib/layers.js";
import { CATEGORY_FIELDS, FIELDS } from "#lib/query.js";

const FACET_CODE = { breeds: "b", names: "n" } as const;
const FACET_OF: Record<string, Facet> = { b: "breeds", n: "names" };

const TOKEN_OF_FIELD = new Map<NumericField, string>(
  (Object.keys(FIELDS) as Array<NumericField>).map((f) => [f, FIELDS[f].token]),
);
const FIELD_OF_TOKEN = new Map<string, NumericField>(
  [...TOKEN_OF_FIELD].map(([field, token]) => [token, field]),
);

const TOKEN_OF_CATEGORY = new Map<CategoryField, string>(
  (Object.keys(CATEGORY_FIELDS) as Array<CategoryField>).map((f) => [
    f,
    CATEGORY_FIELDS[f].token,
  ]),
);
const CATEGORY_OF_TOKEN = new Map<string, CategoryField>(
  [...TOKEN_OF_CATEGORY].map(([field, token]) => [token, field]),
);

export const QUERY = createSearchParamsSchema({
  v: { type: "string", default: "" },
  breed: { type: "string", default: "" },
  name: { type: "string", default: "" },
  f: { type: "string", default: "" },
  at: { type: "string", default: "" },
  vs: { type: "string", default: "" },
});

export type Query = ReturnUseSearchParams<typeof QUERY>;

// Neither separator appears in any breed, name, or neighborhood in the data.
const RULE_GAP = "*";
const VALUE_GAP = "|";

export type Shared = {
  layer: LayerId;
  focus: Focus | null;
  filters: Array<Filter>;
  selected: string | null;
  rivals: ReadonlyArray<Rival>;
};

const RIVAL_CODE = {
  breeds: "b",
  names: "n",
  hood: "h",
  borough: "g",
} as const;
const RIVAL_OF_CODE: Record<string, Rival["kind"]> = {
  b: "breeds",
  n: "names",
  h: "hood",
  g: "borough",
};

function rivalToken(rival: Rival) {
  const body = rival.kind === "hood" ? rival.slug : rival.label;

  return `${RIVAL_CODE[rival.kind]}.${body}`;
}

export function readRivals(text: string): Array<Rival> {
  const out: Array<Rival> = [];

  for (const token of text.split(VALUE_GAP)) {
    const dot = token.indexOf(".");
    if (dot < 1) {
      continue;
    }

    const kind = RIVAL_OF_CODE[token.slice(0, dot)];
    const body = token.slice(dot + 1);
    if (kind === undefined || body.length === 0) {
      continue;
    }

    out.push(
      kind === "hood"
        ? { kind, slug: body, label: body }
        : { kind, label: body },
    );
  }

  return out;
}

function metricToken(metric: Metric) {
  return metric.kind === "field"
    ? TOKEN_OF_FIELD.get(metric.field)
    : `${FACET_CODE[metric.facet]}.${metric.label}`;
}

function metricOfToken(token: string): Metric | null {
  const field = FIELD_OF_TOKEN.get(token);
  if (field !== undefined) {
    return { kind: "field", field };
  }

  const dot = token.indexOf(".");
  if (dot < 1) {
    return null;
  }

  const facet = FACET_OF[token.slice(0, dot)];

  return facet === undefined
    ? null
    : { kind: "rate", facet, label: token.slice(dot + 1) };
}

function num(raw: string) {
  const value = Number(raw);

  return raw.length > 0 && !Number.isNaN(value) ? value : null;
}

function ruleOf(filter: Filter) {
  if (filter.kind === "in") {
    const token = TOKEN_OF_CATEGORY.get(filter.field);
    const values = filter.values.join(VALUE_GAP);

    return `${token}~${filter.negate ? "!" : ""}${values}`;
  }

  return `${metricToken(filter.metric)}~${filter.min ?? ""}..${filter.max ?? ""}`;
}

export function readFilters(text: string): Array<Filter> {
  const filters: Array<Filter> = [];

  for (const rule of text.split(RULE_GAP)) {
    const at = rule.indexOf("~");
    if (at < 1) {
      continue;
    }

    const token = rule.slice(0, at);
    const spec = rule.slice(at + 1);
    const category = CATEGORY_OF_TOKEN.get(token);

    if (category !== undefined) {
      const isNegate = spec.startsWith("!");
      const values = (isNegate ? spec.slice(1) : spec)
        .split(VALUE_GAP)
        .filter(Boolean);
      if (values.length > 0) {
        filters.push({ kind: "in", field: category, values, negate: isNegate });
      }

      continue;
    }

    const metric = metricOfToken(token);
    const span = spec.split("..");
    if (metric != null && span.length === 2) {
      filters.push({
        kind: "range",
        metric,
        min: num(span[0] ?? ""),
        max: num(span[1] ?? ""),
      });
    }
  }

  return filters;
}

export function readLayer(v: string): LayerId {
  return isLayerId(v) ? v : DEFAULT_LAYER;
}

export function readFocus(breed: string, name: string): Focus | null {
  if (breed.length > 0) {
    return { facet: "breeds", label: breed };
  }

  return name.length > 0 ? { facet: "names", label: name } : null;
}

export function readSelected(at: string) {
  return at.length > 0 ? at : null;
}

export function writeShared(state: Shared) {
  return {
    v: state.layer === DEFAULT_LAYER ? "" : state.layer,
    breed: state.focus?.facet === "breeds" ? state.focus.label : "",
    name: state.focus?.facet === "names" ? state.focus.label : "",
    f: state.filters.map((filter) => ruleOf(filter)).join(RULE_GAP),
    at: state.selected ?? "",
    vs: state.rivals.map((rival) => rivalToken(rival)).join(VALUE_GAP),
  };
}

export function askQuery(state: Shared): string {
  const written = writeShared({ ...state, selected: null });
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(written)) {
    if (value.length === 0) {
      continue;
    }

    params.set(
      key,
      key === "f"
        ? value
            .split(RULE_GAP)
            .toSorted((a, b) => a.localeCompare(b))
            .join(RULE_GAP)
        : value,
    );
  }

  return params.toString();
}

export function readAsk(query: string): Shared {
  const params = new URLSearchParams(query);

  return {
    layer: readLayer(params.get("v") ?? ""),
    focus: readFocus(params.get("breed") ?? "", params.get("name") ?? ""),
    filters: readFilters(params.get("f") ?? ""),
    selected: null,
    rivals: readRivals(params.get("vs") ?? ""),
  };
}
