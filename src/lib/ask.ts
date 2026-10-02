import type { Rival } from "#lib/compare.js";
import type { Filter, NumericField, SuggestContext } from "#lib/query.js";
import type { Part } from "#lib/sentence.js";
import type { Focus } from "#lib/types.js";
import { boutOf } from "#lib/compare.js";
import { BOROUGHS, filterParts, loudness, score } from "#lib/query.js";
import { place } from "#lib/sentence.js";

const VERSUS = /\s+(?:vs\.?|versus|v\.?)\s+/i;

const IN = /(?:^|\s)(?:in|inside|within)\s(\S.*)$/i;

const JOIN = /\s*(?:,|\band\b|\bor\b|\bplus\b)\s*/i;

const DENY = /^(?:outside|not|except|excluding|without|but not)\s+/i;

const MEASURES: Array<{ field: NumericField; words: Array<string> }> = [
  {
    field: "dogs_per_100_homes",
    words: [
      "dogs per 100 homes",
      "dogs per home",
      "per 100 homes",
      "per home",
      "dogs a home",
    ],
  },
  {
    field: "density",
    words: [
      "dogs per square mile",
      "per square mile",
      "dogs a square mile",
      "density",
      "per mile",
    ],
  },
  {
    field: "complaints_per_100_dogs",
    words: [
      "complaints per 100 dogs",
      "311 complaints",
      "complaints",
      "311 calls",
      "311",
    ],
  },
  {
    field: "median_age",
    words: ["years old", "average age", "median age", "age"],
  },
  { field: "people", words: ["people", "residents", "population"] },
  { field: "dogs", words: ["dogs", "licenses", "licences"] },
];

export type Plan = {
  rivals: Array<Rival>;
  filters: Array<Filter>;
  focus: Focus | null;
  goTo: { slug: string; label: string } | null;
  rest: string;
  tail: string;
};

function bestOf<T>(
  items: ReadonlyArray<T>,
  text: (item: T) => string,
  needle: string,
) {
  let best: T | null = null;
  let top = 0;

  for (const item of items) {
    const hit = score(text(item), needle);
    if (hit > top) {
      top = hit;
      best = item;
    }
  }

  return best;
}

function subjectOf(phrase: string, ctx: SuggestContext): Rival | null {
  const needle = phrase.trim().toLowerCase();
  if (needle.length === 0) {
    return null;
  }

  let best: Rival | null = null;
  let top = 0;

  const facets = ["breeds", "names"] as const;
  for (const facet of facets) {
    const table = Object.entries(ctx.matrix[facet]);
    for (const [label, column] of table) {
      const hit = score(label, needle);
      if (hit > 0 && hit + loudness(column) > top) {
        top = hit + loudness(column);
        best = { kind: facet, label };
      }
    }
  }

  return best;
}

function placeOf(phrase: string, ctx: SuggestContext): Rival | null {
  const needle = phrase
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "");
  if (needle.length === 0) {
    return null;
  }

  const standing = new Set(ctx.hoods.features.map((f) => f.properties.borough));
  const borough = bestOf(
    BOROUGHS.filter((b) => standing.has(b)),
    (b) => b,
    needle,
  );
  const hood = bestOf(ctx.hoods.features, (f) => f.properties.name, needle);

  const boroughHit = borough == null ? 0 : score(borough, needle);
  const hoodHit = hood == null ? 0 : score(hood.properties.name, needle);
  if (boroughHit === 0 && hoodHit === 0) {
    return null;
  }

  return borough != null && boroughHit >= hoodHit
    ? { kind: "borough", label: borough }
    : hood == null
      ? null
      : {
          kind: "hood",
          slug: hood.properties.slug,
          label: hood.properties.name,
        };
}

function boroughsIn(phrase: string, ctx: SuggestContext) {
  const bare = phrase.trim().replace(DENY, "");
  const isDenied = bare.length !== phrase.trim().length;
  const parts = bare
    .split(JOIN)
    .map((part) => part.trim().replace(/^the\s+/i, ""))
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  const standing = new Set(ctx.hoods.features.map((f) => f.properties.borough));
  const live = BOROUGHS.filter((b) => standing.has(b));
  const values: Array<string> = [];

  for (const part of parts) {
    const found = bestOf(live, (b) => b, part.toLowerCase());
    if (found == null || score(found, part.toLowerCase()) <= 0) {
      return null;
    }
    if (!values.includes(found)) {
      values.push(found);
    }
  }

  return { values, isDenied };
}

const OPENERS = [
  {
    side: "min",
    words: ["over", "above", "more than", "greater than", "at least"],
  },
  {
    side: "max",
    words: ["under", "below", "less than", "fewer than", "at most"],
  },
] as const;

const BOUND_MARKS = OPENERS.flatMap((opener) =>
  opener.words.map((word) => ({
    side: opener.side,
    mark: new RegExp(String.raw`(?:^|\s)${word}\s*([\d,.]+)`, "i"),
  })),
);

// Return the remainder, not a length; a trimmed length sliced off the untrimmed string leaves a space.
function measureAt(text: string) {
  const head = text.trimStart();
  const lower = head.toLowerCase();
  for (const measure of MEASURES) {
    for (const word of measure.words) {
      if (lower.startsWith(word)) {
        return { field: measure.field, rest: head.slice(word.length) };
      }
    }
  }

  return null;
}

function measureBefore(text: string) {
  const tail = text.trimEnd();
  const lower = tail.toLowerCase();
  for (const measure of MEASURES) {
    for (const word of measure.words) {
      if (lower.endsWith(word)) {
        return { field: measure.field, head: tail.slice(0, -word.length) };
      }
    }
  }

  return null;
}

function boundAt(text: string) {
  let found: {
    side: "min" | "max";
    at: number;
    through: number;
    value: number;
  } | null = null;

  for (const { side, mark } of BOUND_MARKS) {
    const hit = mark.exec(text);
    if (hit == null) {
      continue;
    }

    const value = Number(hit[1]!.replaceAll(",", ""));
    if (Number.isNaN(value)) {
      continue;
    }

    const at = hit.index + (hit[0].startsWith(" ") ? 1 : 0);
    if (found == null || at < found.at) {
      found = { side, at, through: hit.index + hit[0].length, value };
    }
  }

  return found;
}

// Merge into the held range: state keeps one rule per field, so a second would replace the first.
function hold(
  filters: Array<Filter>,
  field: NumericField,
  side: "min" | "max",
  value: number,
) {
  const held = filters.find(
    (f) =>
      f.kind === "range" &&
      f.metric.kind === "field" &&
      f.metric.field === field,
  );
  if (held?.kind === "range") {
    held[side] = value;

    return;
  }

  filters.push({
    kind: "range",
    metric: { kind: "field", field },
    min: side === "min" ? value : null,
    max: side === "max" ? value : null,
  });
}

function bounds(text: string) {
  const filters: Array<Filter> = [];
  let rest = text;

  for (;;) {
    const found = boundAt(rest);
    if (found == null) {
      break;
    }

    const after = rest.slice(found.through);
    const before = rest.slice(0, found.at);
    const trailing = measureAt(after);
    const leading = trailing == null ? measureBefore(before) : null;

    const field = trailing?.field ?? leading?.field ?? "dogs";
    hold(filters, field, found.side, found.value);

    rest = `${leading?.head ?? before} ${trailing?.rest ?? after}`
      .replaceAll(/\s+/g, " ")
      .trim();
  }

  return { filters, rest };
}

const REFUSAL = /\b(?:not|except|excluding|without)$/i;

function placeIn(text: string, ctx: SuggestContext) {
  const where = IN.exec(text);
  if (where == null) {
    const union =
      JOIN.test(text) || DENY.test(text) ? boroughsIn(text, ctx) : null;

    return { union, place: null, body: union == null ? text : "" };
  }

  const head = text.slice(0, where.index).trim();
  const isRefused = REFUSAL.test(head);
  const found = boroughsIn(where[1]!, ctx);
  const union =
    found != null && isRefused ? { ...found, isDenied: true } : found;
  const place = union == null ? placeOf(where[1]!, ctx) : null;
  if (union == null && place == null) {
    return { union, place, body: text };
  }

  return {
    union,
    place,
    body: isRefused ? head.replace(REFUSAL, "").trim() : head,
  };
}

function sideOf(side: string, ctx: SuggestContext): Rival | null {
  const dog = subjectOf(side, ctx);
  const spot = placeOf(side, ctx);
  if (dog == null) {
    return spot;
  }
  if (spot == null) {
    return dog;
  }

  const needle = side.trim().toLowerCase();

  return score(spot.label, needle) >= score(dog.label, needle) ? spot : dog;
}

export function read(raw: string, ctx: SuggestContext): Plan | null {
  const text = raw.trim();
  if (text.length < 2) {
    return null;
  }

  const { filters, rest: unbounded } = bounds(text);
  const { union, place, body: located } = placeIn(unbounded, ctx);

  if (union != null) {
    filters.push({
      kind: "in",
      field: "borough",
      values: union.values,
      negate: union.isDenied,
    });
  } else if (place?.kind === "borough") {
    filters.push({
      kind: "in",
      field: "borough",
      values: [place.label],
      negate: false,
    });
  }

  const goTo =
    place?.kind === "hood" ? { slug: place.slug, label: place.label } : null;

  const body = located
    .replace(/^(?:,|and|or|plus|not|except|excluding|without)\b\s*/i, "")
    .replace(/\s*(?:,|and|or|plus)$/i, "")
    .trim();

  const sides = body.split(VERSUS).filter((part) => part.trim().length > 0);
  const picked =
    sides.length > 1
      ? sides
          .map((side) => sideOf(side, ctx))
          .filter((r): r is Rival => r != null)
      : [];
  const rivals = boutOf(picked) == null ? [] : picked;

  const alone = rivals.length > 1 ? null : subjectOf(body, ctx);
  const focus: Focus | null =
    alone == null || (alone.kind !== "breeds" && alone.kind !== "names")
      ? null
      : { facet: alone.kind, label: alone.label };

  const isAsked = rivals.length > 1 || filters.length > 0 || goTo != null;

  const tail = (sides.length > 1 ? sides.at(-1) : body) ?? "";

  return isAsked ? { rivals, filters, focus, goTo, rest: body, tail } : null;
}

function rivalParts(rivals: Array<Rival>): Array<Part> {
  const out: Array<Part> = ["Compare"];

  for (const [i, rival] of rivals.entries()) {
    if (i > 0 && rivals.length === 2) {
      out.push("with");
    } else if (i > 0) {
      out.push(",");
      if (i === rivals.length - 1) {
        out.push("and");
      }
    }
    out.push(place(rival.label));
  }

  return out;
}

export function saying(plan: Plan): Array<Part> {
  const out: Array<Part> = [];

  if (plan.rivals.length > 1) {
    out.push(...rivalParts(plan.rivals));
  } else if (plan.focus != null) {
    out.push("Color the map by", place(plan.focus.label));
  }

  if (plan.goTo != null) {
    out.push(out.length > 0 ? "and open" : "Open", place(plan.goTo.label));
  }

  if (plan.filters.length > 0) {
    out.push(
      out.length > 0
        ? ", keeping only neighborhoods"
        : "Keep only neighborhoods",
    );

    const sorted = [
      ...plan.filters.filter((f) => f.kind === "in"),
      ...plan.filters.filter((f) => f.kind === "range"),
    ];
    for (const [i, filter] of sorted.entries()) {
      if (i > 0) {
        out.push(",");
      }
      out.push(...filterParts(filter));
    }
  }

  out.push(".");

  return out;
}

export function nextWords(raw: string) {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (text.length === 0) {
    return [
      { show: "Labrador vs Poodle", add: "Labrador vs Poodle" },
      { show: "Brooklyn vs Queens", add: "Brooklyn vs Queens" },
      { show: "Brooklyn and Queens", add: "Brooklyn and Queens" },
    ];
  }

  const out: Array<{ show: string; add: string }> = [];

  if (!VERSUS.test(` ${lower} `)) {
    out.push({ show: "vs another", add: " vs " });
  }
  if (!IN.test(lower)) {
    out.push({ show: "in Brooklyn", add: " in Brooklyn" });
  }
  if (!/\d/.test(lower)) {
    out.push({ show: "over 2,000 dogs", add: " over 2000 dogs" });
  }

  if (IN.test(lower) && !JOIN.test(lower)) {
    out.push({ show: "and Queens", add: " and Queens" });
  }

  return out.slice(0, 3);
}
