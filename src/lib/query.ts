import type { Rival } from "#lib/compare.js";
import type { Part } from "#lib/sentence.js";
import type {
  CategoryField,
  Facet,
  Focus,
  HoodCollection,
  HoodProperties,
  LayerId,
  Matrix,
  Shelter,
} from "#lib/types.js";
import { cityRate } from "#lib/rate.js";
import { chip, figure, place } from "#lib/sentence.js";
import { change } from "#lib/stories.js";
import { FACET_FIELDS, FACETS } from "#lib/types.js";
import { count } from "#lib/utils.js";

export const BOROUGHS = [
  "Manhattan",
  "Brooklyn",
  "Queens",
  "Bronx",
  "Staten Island",
] as const;

export type NumericField =
  | "dogs"
  | "density"
  | "people"
  | "dogs_per_100_homes"
  | "complaints_per_100_dogs"
  | "median_age"
  | "share_change"
  | "class_2020";

export type Metric =
  | { kind: "field"; field: NumericField }
  | { kind: "rate"; facet: Facet; label: string };

export type Filter =
  | { kind: "in"; field: CategoryField; values: Array<string>; negate: boolean }
  | { kind: "range"; metric: Metric; min: number | null; max: number | null };

export const FIELDS = {
  dogs: { token: "dogs", format: count, step: 1 },
  density: { token: "density", format: count, step: 1 },
  people: { token: "people", format: count, step: 1 },
  dogs_per_100_homes: {
    token: "perhome",
    format: (v: number) => v.toFixed(1),
    step: 0.1,
  },
  complaints_per_100_dogs: {
    token: "on311",
    format: (v: number) => v.toFixed(1),
    step: 0.1,
  },
  median_age: { token: "age", format: (v: number) => v.toFixed(1), step: 0.1 },
  share_change: { token: "since2016", format: change, step: 0.01 },
  class_2020: { token: "class2020", format: change, step: 0.01 },
} as const satisfies Record<
  NumericField,
  { token: string; format: (v: number) => string; step: number }
>;

export const CATEGORY_FIELDS = {
  borough: { token: "borough" },
  top_breed: { token: "topbreed" },
  top_name: { token: "topname" },
  distinct_breed: { token: "signaturebreed" },
  distinct_name: { token: "signaturename" },
} as const satisfies Record<CategoryField, { token: string }>;

export function rateFormat(v: number) {
  return v < 10 ? v.toFixed(1) : v.toFixed(0);
}

export function metricFormat(metric: Metric): (v: number) => string {
  return metric.kind === "field" ? FIELDS[metric.field].format : rateFormat;
}

export function metricStep(metric: Metric) {
  return metric.kind === "field" ? FIELDS[metric.field].step : 1;
}

export function metricReader(
  metric: Metric,
  matrix: Matrix,
): (p: HoodProperties) => number {
  if (metric.kind === "field") {
    const { field } = metric;

    return (p) => p[field] ?? 0;
  }

  const column = matrix[metric.facet][metric.label];
  const index = new Map(matrix.slugs.map((slug, i) => [slug, i]));

  return (p) => {
    const at = index.get(p.slug);
    if (at === undefined) {
      return 0;
    }

    const total = matrix.dogs[at] ?? 0;

    return total > 0 ? ((column?.[at] ?? 0) / total) * 1000 : 0;
  };
}

export function filterKey(filter: Filter) {
  if (filter.kind === "in") {
    return `in:${filter.field}`;
  }

  const { metric } = filter;

  return metric.kind === "field"
    ? `range:${metric.field}`
    : `range:${metric.facet}:${metric.label}`;
}

const IN_WORDS = {
  borough: { facet: null, lead: "in", deny: "outside" },
  top_breed: { facet: "breeds", lead: "led by", deny: "not led by" },
  top_name: { facet: "names", lead: "led by", deny: "not led by" },
  distinct_breed: {
    facet: "breeds",
    lead: "standing out for",
    deny: "not standing out for",
  },
  distinct_name: {
    facet: "names",
    lead: "standing out for",
    deny: "not standing out for",
  },
} as const satisfies Record<
  CategoryField,
  { facet: Facet | null; lead: string; deny: string }
>;

export function facetOfField(field: CategoryField): Facet | null {
  return IN_WORDS[field].facet;
}

const RANGE_WORDS = {
  dogs: {
    over: "with more than",
    under: "with fewer than",
    span: "with",
    tail: "dogs",
  },
  density: {
    over: "with more than",
    under: "with fewer than",
    span: "with",
    tail: "dogs per square mile",
  },
  people: {
    over: "home to more than",
    under: "home to fewer than",
    span: "home to",
    tail: "people",
  },
  dogs_per_100_homes: {
    over: "with more than",
    under: "with fewer than",
    span: "with",
    tail: "dogs per 100 homes",
  },
  complaints_per_100_dogs: {
    over: "drawing more than",
    under: "drawing fewer than",
    span: "drawing",
    tail: "complaints to 311 per 100 dogs",
  },
  median_age: {
    over: "where the average dog is older than",
    under: "where the average dog is younger than",
    span: "where the average dog is",
    tail: "years old",
  },
  share_change: {
    over: "whose share of the city’s dogs changed by more than",
    under: "whose share of the city’s dogs changed by less than",
    span: "whose share of the city’s dogs changed by",
    tail: "since 2016",
  },
  class_2020: {
    over: "where dogs born in 2020 run more than",
    under: "where dogs born in 2020 run less than",
    span: "where dogs born in 2020 run",
    tail: "against the years around them",
  },
} as const satisfies Record<
  NumericField,
  { over: string; under: string; span: string; tail: string }
>;

export const ARTICLED: ReadonlySet<string> = new Set(["Bronx"]);

function listed(
  values: ReadonlyArray<string>,
  facet: Facet | null,
  join = "or",
) {
  const piece = (value: string): Part =>
    facet == null
      ? place(value, undefined, { field: "borough", value })
      : chip(facet, value);
  const out: Array<Part> = [];

  for (const [i, value] of values.entries()) {
    if (i > 0 && (i < values.length - 1 || values.length > 2)) {
      out.push(",");
    }
    if (i > 0 && i === values.length - 1) {
      out.push(join);
    }
    if (facet == null && ARTICLED.has(value)) {
      out.push("the");
    }
    out.push(piece(value));
  }

  return out;
}

export function filterParts(filter: Filter): Array<Part> {
  if (filter.kind === "in") {
    const words = IN_WORDS[filter.field];

    return [
      filter.negate ? words.deny : words.lead,
      ...listed(filter.values, words.facet, filter.negate ? "and" : "or"),
    ];
  }

  const { metric, min, max } = filter;
  const fmt = metricFormat(metric);
  const words =
    metric.kind === "field"
      ? RANGE_WORDS[metric.field]
      : {
          over: "runs above",
          under: "runs below",
          span: "runs",
          tail: "per 1,000 dogs",
        };

  const head: Array<Part> =
    metric.kind === "field" ? [] : ["where", chip(metric.facet, metric.label)];
  const tail: Array<Part> = words.tail.length > 0 ? [words.tail] : [];

  if (min != null && max != null) {
    return [...head, words.span, figure(`${fmt(min)}–${fmt(max)}`), ...tail];
  }
  if (min != null) {
    return [...head, words.over, figure(fmt(min)), ...tail];
  }
  if (max != null) {
    return [...head, words.under, figure(fmt(max)), ...tail];
  }

  return [...head, "of any size"];
}

function predicate(
  filter: Filter,
  matrix: Matrix,
): (p: HoodProperties) => boolean {
  if (filter.kind === "in") {
    const wanted = new Set(filter.values);
    const { field, negate } = filter;

    return (p) => {
      const value = p[field];

      return (value != null && wanted.has(value)) !== negate;
    };
  }

  const read = metricReader(filter.metric, matrix);
  const { min, max } = filter;

  return (p) => {
    const value = read(p);

    return (min == null || value >= min) && (max == null || value <= max);
  };
}

export function matching(
  hoods: HoodCollection,
  matrix: Matrix,
  filters: ReadonlyArray<Filter>,
): Set<string> | null {
  if (filters.length === 0) {
    return null;
  }

  const tests = filters.map((f) => predicate(f, matrix));
  const hits = new Set<string>();

  for (const feature of hoods.features) {
    if (tests.every((test) => test(feature.properties))) {
      hits.add(feature.properties.slug);
    }
  }

  return hits;
}

export function failing(
  filters: ReadonlyArray<Filter>,
  matrix: Matrix,
  props: HoodProperties,
): Array<Filter> {
  return filters.filter((filter) => !predicate(filter, matrix)(props));
}

export function wouldKeep(
  hoods: HoodCollection,
  matrix: Matrix,
  filters: ReadonlyArray<Filter>,
  next: Filter,
) {
  const key = filterKey(next);
  const merged = [...filters.filter((f) => filterKey(f) !== key), next];

  return matching(hoods, matrix, merged)?.size ?? hoods.features.length;
}

export function quantileOf(values: ReadonlyArray<number>, at: number) {
  const sorted = values.toSorted((a, b) => a - b);

  return sorted.length === 0
    ? 0
    : (sorted[Math.floor(at * (sorted.length - 1))] ?? 0);
}

export type Distribution = {
  min: number;
  max: number;
  bins: Array<number>;
  quantile: (q: number) => number;
};

export function distribution(
  metric: Metric,
  hoods: HoodCollection,
  matrix: Matrix,
  binCount = 26,
): Distribution {
  const read = metricReader(metric, matrix);
  const values = hoods.features
    .map((f) => read(f.properties))
    .toSorted((a, b) => a - b);

  const min = values[0] ?? 0;
  const max = values.at(-1) ?? 0;
  const span = max - min;
  const tally = new Map<number, number>();

  for (const value of values) {
    const at =
      span > 0
        ? Math.min(binCount - 1, Math.floor(((value - min) / span) * binCount))
        : 0;
    tally.set(at, (tally.get(at) ?? 0) + 1);
  }

  const bins = Array.from({ length: binCount }, (_, i) => tally.get(i) ?? 0);

  return { min, max, bins, quantile: (q) => quantileOf(values, q) };
}

export function score(text: string, needle: string) {
  if (needle.length === 0) {
    return 1;
  }

  const hay = text.toLowerCase();
  const at = hay.indexOf(needle);

  if (at === 0) {
    return 900 - text.length;
  }
  if (at > 0) {
    return (hay[at - 1] === " " ? 700 : 420) - text.length;
  }

  const initials = hay
    .split(/[\s,/()-]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
  if (initials.startsWith(needle)) {
    return 650 - text.length;
  }

  if (needle.length < 4) {
    return 0;
  }

  let matched = 0;
  let first = -1;
  let last = -1;
  const letters = [...hay];
  for (const [i, ch] of letters.entries()) {
    if (ch !== needle[matched]) {
      continue;
    }

    first = matched === 0 ? i : first;
    last = i;
    matched += 1;
    if (matched === needle.length) {
      break;
    }
  }

  const span = last - first + 1;
  if (matched < needle.length || span > needle.length * 2) {
    return 0;
  }

  return Math.max(1, 200 - (span - needle.length));
}

export function loudness(column: ReadonlyArray<number> | undefined) {
  const counts = column ?? [];
  let total = 0;
  for (const n of counts) {
    total += n;
  }

  return Math.round(40 * Math.log10(1 + total));
}

export type HitKind = "breed" | "name" | "hood" | "borough" | "shelter";

type HitBase = { id: string; label: string; note: string; score: number };

export type Hit =
  | (HitBase & { kind: "breed" | "name" })
  | (HitBase & { kind: "hood"; slug: string })
  | (HitBase & { kind: "borough" })
  | (HitBase & { kind: "shelter"; slug: string });

export const HEADINGS: Record<HitKind, string> = {
  breed: "Breeds",
  name: "Names",
  hood: "Neighborhoods",
  borough: "Boroughs",
  shelter: "Shelters",
};

export function facetOf(kind: "breed" | "name"): Facet {
  return kind === "breed" ? "breeds" : "names";
}

export type SuggestContext = {
  hoods: HoodCollection;
  matrix: Matrix;
  shelters: ReadonlyArray<Shelter>;
};

function thickest(
  column: ReadonlyArray<number>,
  ctx: SuggestContext,
  named: Map<string, string>,
) {
  let bestRate = 0;
  let at = -1;

  for (const [i, n] of column.entries()) {
    const dogs = ctx.matrix.dogs[i] ?? 0;
    if (n < 4 || dogs <= 0) {
      continue;
    }

    const rate = n / dogs;
    if (rate > bestRate) {
      bestRate = rate;
      at = i;
    }
  }

  return at < 0 ? null : (named.get(ctx.matrix.slugs[at] ?? "") ?? null);
}

function noteFor(
  hit: Hit,
  ctx: SuggestContext,
  named: Map<string, string>,
): string {
  if (hit.kind === "hood") {
    const found = ctx.hoods.features.find(
      (f) => f.properties.slug === hit.slug,
    );

    return found == null
      ? ""
      : `${found.properties.borough} · ${count(found.properties.dogs)} dogs`;
  }

  if (hit.kind === "borough") {
    let areas = 0;
    let dogs = 0;
    for (const f of ctx.hoods.features) {
      if (f.properties.borough !== hit.label) {
        continue;
      }

      areas += 1;
      dogs += f.properties.dogs;
    }

    return `${count(areas)} neighborhoods · ${count(dogs)} dogs`;
  }

  if (hit.kind === "shelter") {
    return hit.note;
  }

  const column = ctx.matrix[facetOf(hit.kind)][hit.label] ?? [];
  let total = 0;
  for (const n of column) {
    total += n;
  }

  const home = thickest(column, ctx, named);
  const head = `${count(total)} in the city`;

  return home == null ? head : `${head}, highest rate in ${home}`;
}

const GROUP_CAP = 6;
const TOTAL_CAP = 12;

function rank(all: Array<Hit>) {
  const groups = new Map<HitKind, Array<Hit>>();
  const byScore = all.toSorted((a, b) => b.score - a.score);

  for (const hit of byScore) {
    const bucket = groups.get(hit.kind) ?? [];
    if (bucket.length < GROUP_CAP) {
      bucket.push(hit);
      groups.set(hit.kind, bucket);
    }
  }

  return groups
    .values()
    .toArray()
    .toSorted((a, b) => (b[0]?.score ?? 0) - (a[0]?.score ?? 0))
    .flat()
    .slice(0, TOTAL_CAP);
}

function subjectHits(ctx: SuggestContext, needle: string): Array<Hit> {
  const out: Array<Hit> = [];
  const crossed = needle.replaceAll(/\b(?:mix|mixed|mutt)\b/g, "crossbreed");

  for (const facet of FACETS) {
    const kind = facet === "breeds" ? "breed" : "name";
    const table = Object.entries(ctx.matrix[facet]);
    for (const [label, column] of table) {
      const hit =
        facet === "breeds"
          ? Math.max(score(label, needle), score(label, crossed))
          : score(label, needle);
      if (hit > 0) {
        out.push({
          id: `${facet}:${label}`,
          kind,
          label,
          note: "",
          score: hit + loudness(column),
        });
      }
    }
  }

  return out;
}

export function suggest(raw: string, ctx: SuggestContext): Array<Hit> {
  const needle = raw.trim().toLowerCase();
  if (needle.length === 0) {
    return [];
  }

  const out = subjectHits(ctx, needle);

  for (const feature of ctx.hoods.features) {
    const { slug, name } = feature.properties;
    const hit = score(name, needle);
    if (hit > 0) {
      out.push({
        id: `hood:${slug}`,
        kind: "hood",
        slug,
        label: name,
        note: "",
        score: hit,
      });
    }
  }

  for (const place of ctx.shelters) {
    const hit = Math.max(
      score(place.name, needle),
      score(place.org, needle),
      score("shelter", needle),
      score("adopt", needle),
    );
    if (hit > 0) {
      out.push({
        id: `shelter:${place.slug}`,
        kind: "shelter",
        slug: place.slug,
        label: place.name,
        note: `${place.borough}, ${place.address.slice(0, place.address.indexOf(","))}`,
        score: hit,
      });
    }
  }

  const standing = new Set(ctx.hoods.features.map((f) => f.properties.borough));
  const here = BOROUGHS.filter((b) => standing.has(b));
  for (const borough of here) {
    const hit = score(borough, needle);
    if (hit > 0) {
      out.push({
        id: `borough:${borough}`,
        kind: "borough",
        label: borough,
        note: "",
        score: hit,
      });
    }
  }

  const kept = rank(out);
  const named = new Map(
    ctx.hoods.features.map((f) => [f.properties.slug, f.properties.name]),
  );

  return kept.map((hit) => ({ ...hit, note: noteFor(hit, ctx, named) }));
}

export function groupsOf(hits: ReadonlyArray<Hit>) {
  const out: Array<{ kind: HitKind; items: Array<Hit> }> = [];

  for (const hit of hits) {
    const last = out.at(-1);
    if (last?.kind === hit.kind) {
      last.items.push(hit);
    } else {
      out.push({ kind: hit.kind, items: [hit] });
    }
  }

  return out;
}

function mostCommon(ctx: SuggestContext, facet: Facet) {
  let best: string | null = null;
  let top = 0;

  const table = Object.entries(ctx.matrix[facet]);
  for (const [label, column] of table) {
    let total = 0;
    for (const n of column) {
      total += n;
    }
    if (total > top) {
      top = total;
      best = label;
    }
  }

  return best;
}

export function picks(ctx: SuggestContext): Array<Hit> {
  const named = new Map(
    ctx.hoods.features.map((f) => [f.properties.slug, f.properties.name]),
  );

  const wanted: Array<{ facet: Facet; label: string }> = [];
  for (const facet of FACETS) {
    const label = mostCommon(ctx, facet);
    if (label != null) {
      wanted.push({ facet, label });
    }
  }

  const gaps: Array<{ facet: Facet; label: string; up: number }> = [];
  for (const { properties: p } of ctx.hoods.features) {
    if (p.distinct_breed != null) {
      gaps.push({
        facet: "breeds",
        label: p.distinct_breed,
        up: p.distinct_breed_lift,
      });
    }
    if (p.distinct_name != null) {
      gaps.push({
        facet: "names",
        label: p.distinct_name,
        up: p.distinct_name_lift,
      });
    }
  }

  const seen = new Set(wanted.map((w) => `${w.facet}:${w.label}`));
  const surprising = gaps.toSorted((a, b) => b.up - a.up);
  for (const gap of surprising) {
    const key = `${gap.facet}:${gap.label}`;
    if (seen.has(key) || wanted.length >= 5) {
      continue;
    }
    seen.add(key);
    wanted.push({ facet: gap.facet, label: gap.label });
  }

  return wanted
    .filter((w) => ctx.matrix[w.facet][w.label] !== undefined)
    .map((w, i): Hit => {
      const hit: Hit = {
        id: `pick:${w.facet}:${w.label}`,
        kind: w.facet === "breeds" ? "breed" : "name",
        label: w.label,
        note: "",
        score: 1000 - i,
      };

      return { ...hit, note: noteFor(hit, ctx, named) };
    });
}

export type Leap = {
  layer: LayerId;
  focus: Focus | null;
  filters: Array<Filter>;
  rivals: Array<Rival>;
  at: string | null;
};

type Roll = () => number;

function rng(seed: number): Roll {
  let a = seed >>> 0;

  return () => {
    a = (a + 1_831_565_813) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(items: ReadonlyArray<T>, roll: Roll): T | null {
  return items.length === 0
    ? null
    : (items[Math.floor(roll() * items.length)] ?? null);
}

// Fisher-Yates: a comparator that ignores its arguments is neither uniform nor transitive.
function shuffled<T>(items: ReadonlyArray<T>, roll: Roll): Array<T> {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(roll() * (i + 1));
    const held = out[i]!;
    out[i] = out[j]!;
    out[j] = held;
  }

  return out;
}

function sign(leap: Leap) {
  const rules = leap.filters
    .map((f) =>
      f.kind === "in"
        ? `${f.field}${f.negate ? "!" : ""}=${[...f.values].toSorted((a, b) => a.localeCompare(b)).join("|")}`
        : `${f.metric.kind === "field" ? f.metric.field : `${f.metric.facet}.${f.metric.label}`}=${f.min ?? ""}..${f.max ?? ""}`,
    )
    .toSorted((a, b) => a.localeCompare(b));

  return [
    leap.layer,
    leap.focus == null ? "" : `${leap.focus.facet}.${leap.focus.label}`,
    leap.rivals.map((r) => (r.kind === "hood" ? r.slug : r.label)).join("|"),
    leap.at ?? "",
    rules.join("*"),
  ].join("~");
}

type Gap = { facet: Facet; label: string; slug: string; up: number };

type Reign = { facet: Facet; label: string; n: number };

function blank(): Leap {
  return { layer: "breed", focus: null, filters: [], rivals: [], at: null };
}

function gapsOf(props: ReadonlyArray<HoodProperties>): Array<Gap> {
  const gaps = new Map<string, Gap>();

  for (const p of props) {
    for (const facet of FACETS) {
      const label = p[FACET_FIELDS[facet].distinct];
      if (label == null) {
        continue;
      }

      const up = p[FACET_FIELDS[facet].lift];

      const key = `${facet}:${label}`;
      const held = gaps.get(key);
      if (held == null || up > held.up) {
        gaps.set(key, { facet, label, slug: p.slug, up });
      }
    }
  }

  return gaps
    .values()
    .toArray()
    .toSorted((a, b) => b.up - a.up)
    .slice(0, 30);
}

function reignsOf(props: ReadonlyArray<HoodProperties>): Array<Reign> {
  const crowns = new Map<string, Reign>();

  for (const p of props) {
    for (const facet of FACETS) {
      const label = p[FACET_FIELDS[facet].top];
      if (label == null) {
        continue;
      }

      const key = `${facet}:${label}`;
      crowns.set(key, { facet, label, n: (crowns.get(key)?.n ?? 0) + 1 });
    }
  }

  return crowns.values().toArray();
}

function cut(
  props: ReadonlyArray<HoodProperties>,
  at: number,
  of: (p: HoodProperties) => number,
) {
  return quantileOf(
    props.map((p) => of(p)).filter((v) => v > 0),
    at,
  );
}

function splitters(reigns: ReadonlyArray<Reign>, facet: Facet, floor: number) {
  return reigns
    .filter((r) => r.facet === facet && r.n >= floor)
    .toSorted((a, b) => b.n - a.n)
    .slice(0, 8);
}

function twoOf(
  reigns: ReadonlyArray<Reign>,
  facet: Facet,
  floor: number,
  roll: Roll,
) {
  const pool = splitters(reigns, facet, floor);
  const first = pick(pool, roll);
  const second = pick(
    pool.filter((r) => r.label !== first?.label),
    roll,
  );

  return first == null || second == null ? null : [first, second];
}

type Board = {
  hoods: HoodCollection;
  matrix: Matrix;
  props: ReadonlyArray<HoodProperties>;
  widest: ReadonlyArray<Gap>;
  reigns: ReadonlyArray<Reign>;
  boroughs: ReadonlyArray<string>;
  kin: ReadonlyArray<readonly [string, string]>;
  roll: Roll;
};

const GAMBITS: Array<(b: Board) => Leap | null> = [
  (b) => {
    const found = pick(b.widest, b.roll);

    return found == null
      ? null
      : {
          ...blank(),
          layer: found.facet === "breeds" ? "distinct-breed" : "distinct-name",
          focus: { facet: found.facet, label: found.label },
          at: found.slug,
        };
  },

  (b) => {
    const pair = twoOf(b.reigns, "breeds", 6, b.roll);

    return pair == null
      ? null
      : {
          ...blank(),
          rivals: pair.map((r) => ({
            kind: "breeds" as const,
            label: r.label,
          })),
        };
  },

  (b) => {
    const pair = twoOf(b.reigns, "names", 6, b.roll);

    return pair == null
      ? null
      : {
          ...blank(),
          rivals: pair.map((r) => ({ kind: "names" as const, label: r.label })),
        };
  },

  (b) => {
    const pool = splitters(b.reigns, "breeds", 4);
    const three = shuffled(pool, b.roll).slice(0, 3);

    return three.length < 3
      ? null
      : {
          ...blank(),
          rivals: three.map((r) => ({
            kind: "breeds" as const,
            label: r.label,
          })),
        };
  },

  (b) => {
    const pair = pick(b.kin, b.roll);

    return pair == null
      ? null
      : {
          ...blank(),
          rivals: [
            { kind: "breeds", label: pair[0] },
            { kind: "breeds", label: pair[1] },
          ],
        };
  },

  (b) => {
    const order = shuffled(b.boroughs, b.roll);
    const pair = order.slice(0, 2);

    return pair.length < 2
      ? null
      : {
          ...blank(),
          rivals: pair.map((label) => ({ kind: "borough" as const, label })),
        };
  },

  (b) => {
    const ranked = b.props.toSorted((a, z) => z.density - a.density);
    const top = ranked[0];
    const bottom = ranked.at(-1);

    return top == null || bottom == null || top.slug === bottom.slug
      ? null
      : {
          ...blank(),
          rivals: [
            { kind: "hood", slug: top.slug, label: top.name },
            { kind: "hood", slug: bottom.slug, label: bottom.name },
          ],
        };
  },

  (b) => {
    const borough = pick(b.boroughs, b.roll);

    return borough == null
      ? null
      : {
          ...blank(),
          layer:
            pick(["distinct-breed", "distinct-name"] as const, b.roll) ??
            "distinct-breed",
          filters: [
            { kind: "in", field: "borough", values: [borough], negate: false },
          ],
        };
  },

  (b) => {
    const borough = pick(b.boroughs, b.roll);

    return borough == null || b.boroughs.length < 3
      ? null
      : {
          ...blank(),
          layer:
            pick(["breed", "distinct-breed", "name"] as const, b.roll) ??
            "breed",
          filters: [
            { kind: "in", field: "borough", values: [borough], negate: true },
          ],
        };
  },

  (b) => {
    const order = shuffled(b.boroughs, b.roll);
    const pair = order.slice(0, 2);

    return pair.length < 2
      ? null
      : {
          ...blank(),
          layer:
            pick(["distinct-breed", "per-home", "density"] as const, b.roll) ??
            "per-home",
          filters: [
            { kind: "in", field: "borough", values: pair, negate: false },
          ],
        };
  },

  (b) => {
    const floor = cut(b.props, 0.9, (p) => p.dogs_per_100_homes);

    return floor <= 0
      ? null
      : {
          ...blank(),
          layer: "per-home",
          filters: [
            {
              kind: "range",
              metric: { kind: "field", field: "dogs_per_100_homes" },
              min: Number(floor.toFixed(1)),
              max: null,
            },
          ],
        };
  },

  (b) => {
    const ceiling = cut(b.props, 0.15, (p) => p.dogs_per_100_homes);

    return ceiling <= 0
      ? null
      : {
          ...blank(),
          layer: "per-home",
          filters: [
            {
              kind: "range",
              metric: { kind: "field", field: "dogs_per_100_homes" },
              min: null,
              max: Number(ceiling.toFixed(1)),
            },
          ],
        };
  },

  (b) => {
    const people = cut(b.props, 0.7, (p) => p.people);
    const dogs = cut(b.props, 0.3, (p) => p.dogs_per_100_homes);

    return people <= 0 || dogs <= 0
      ? null
      : {
          ...blank(),
          layer: "per-home",
          filters: [
            {
              kind: "range",
              metric: { kind: "field", field: "people" },
              min: Math.round(people),
              max: null,
            },
            {
              kind: "range",
              metric: { kind: "field", field: "dogs_per_100_homes" },
              min: null,
              max: Number(dogs.toFixed(1)),
            },
          ],
        };
  },

  (b) => {
    const facet = pick(FACETS, b.roll) ?? "breeds";
    const found = pick(
      b.reigns.filter((r) => r.facet === facet && r.n >= 2 && r.n <= 12),
      b.roll,
    );
    if (found == null) {
      return null;
    }

    const isBreed = facet === "breeds";

    return {
      ...blank(),
      layer: isBreed ? "breed" : "name",
      filters: [
        {
          kind: "in",
          field: isBreed ? "top_breed" : "top_name",
          values: [found.label],
          negate: false,
        },
      ],
    };
  },

  (b) => {
    const found = pick(b.widest.slice(0, 15), b.roll);
    if (found == null) {
      return null;
    }

    const citywide = cityRate(
      b.props,
      metricReader(
        { kind: "rate", facet: found.facet, label: found.label },
        b.matrix,
      ),
    );
    const floor = Math.round(citywide * 2);

    return floor <= 0
      ? null
      : {
          ...blank(),
          layer: found.facet === "breeds" ? "breed" : "name",
          focus: { facet: found.facet, label: found.label },
          filters: [
            {
              kind: "range",
              metric: { kind: "rate", facet: found.facet, label: found.label },
              min: floor,
              max: null,
            },
          ],
        };
  },

  (b) => {
    const floor = cut(b.props, 0.85, (p) => p.dogs);

    return floor <= 0
      ? null
      : {
          ...blank(),
          layer: "density",
          filters: [
            {
              kind: "range",
              metric: { kind: "field", field: "dogs" },
              min: Math.round(floor),
              max: null,
            },
          ],
        };
  },
];

export function strange(
  hoods: HoodCollection,
  matrix: Matrix,
  showing: Leap | null = null,
  seed: number = Math.floor(Math.random() * 4_294_967_295),
): Leap | null {
  const roll = rng(seed);
  const props = hoods.features.map((f) => f.properties);
  if (props.length === 0) {
    return null;
  }

  const board: Board = {
    hoods,
    matrix,
    props,
    widest: gapsOf(props),
    reigns: reignsOf(props),
    boroughs: [...new Set(props.map((p) => p.borough))],
    roll,
    kin: Object.keys(matrix.breeds)
      .filter((label) => matrix.breeds[`${label} Crossbreed`] !== undefined)
      .map((label) => [label, `${label} Crossbreed`] as const),
  };

  const already = showing == null ? null : sign(showing);
  for (let round = 0; round < 3; round += 1) {
    const order = shuffled(GAMBITS, roll);
    for (const gambit of order) {
      const found = gambit(board);
      if (found != null && (already == null || sign(found) !== already)) {
        return found;
      }
    }
  }

  return null;
}
