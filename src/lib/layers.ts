import type { Rival } from "#lib/compare.js";
import type { MapTheme } from "#lib/map-style.js";
import type { Filter, Metric } from "#lib/query.js";
import type {
  CatKey,
  Facet,
  Focus,
  HoodCollection,
  HoodProperties,
  LayerId,
  Matrix,
  PaintedCollection,
  PaintedProperties,
  Readout,
  View,
} from "#lib/types.js";
import {
  filterKey,
  matching,
  metricReader,
  quantileOf,
  rateFormat,
} from "#lib/query.js";
import { FACET_FIELDS } from "#lib/types.js";
import { count, lift } from "#lib/utils.js";

// Hex, because MapLibre cannot parse oklch().
const CATEGORY = {
  breeds: {
    light: [
      "#498ac5",
      "#cf7046",
      "#8cb26d",
      "#a964a0",
      "#cfab50",
      "#288a91",
      "#da7678",
      "#7467a7",
      "#6bb08f",
      "#8a5f37",
    ],
    dark: [
      "#619fd9",
      "#e4875f",
      "#a2c885",
      "#be7bb4",
      "#e4c26c",
      "#479fa6",
      "#f08e8e",
      "#887cbb",
      "#84c6a5",
      "#9f744e",
    ],
  },
  names: {
    light: [
      "#b17730",
      "#009ec9",
      "#ba91d3",
      "#40945c",
      "#8fadfb",
      "#a96563",
      "#00aeb6",
      "#74782d",
      "#c58aae",
      "#3e6f93",
    ],
    dark: [
      "#c58c4b",
      "#24b3dd",
      "#d0a8e8",
      "#5ba973",
      "#a7c3ff",
      "#be7b78",
      "#2cc4cc",
      "#888d46",
      "#dba1c4",
      "#5484a8",
    ],
  },
} as const satisfies Record<Facet, Record<MapTheme, ReadonlyArray<string>>>;

// Light swatches darkened to clear 3.5:1 as text on the card; dark already clears 4:1.
const CATEGORY_INK = {
  breeds: {
    light: [
      "#498ac5",
      "#cc6d43",
      "#6e934f",
      "#a964a0",
      "#a68321",
      "#288a91",
      "#cc6a6c",
      "#7467a7",
      "#4f9474",
      "#8a5f37",
    ],
    dark: CATEGORY.breeds.dark,
  },
  names: {
    light: [
      "#b17730",
      "#0091bc",
      "#a179b9",
      "#40945c",
      "#6984cf",
      "#a96563",
      "#0098a0",
      "#74782d",
      "#ae7598",
      "#3e6f93",
    ],
    dark: CATEGORY.names.dark,
  },
} as const satisfies Record<Facet, Record<MapTheme, ReadonlyArray<string>>>;

const OTHER = { light: "#bdb8ad", dark: "#56524b" } as const;
const NO_DATA = { light: "#e2ddd4", dark: "#2d2a25" } as const;
const FILTERED_OUT = { light: "#ece7dd", dark: "#23211c" } as const;

const RAMP = {
  light: [
    "#f9f4e7",
    "#f6e4c3",
    "#f7ce99",
    "#f4b073",
    "#e88a55",
    "#d26441",
    "#a54332",
  ],
  dark: [
    "#281d15",
    "#46291a",
    "#683721",
    "#8d462b",
    "#b3583a",
    "#d67047",
    "#f1965c",
  ],
} as const satisfies Record<MapTheme, ReadonlyArray<string>>;

function palette(theme: MapTheme) {
  return {
    other: OTHER[theme],
    noData: NO_DATA[theme],
    ramp: RAMP[theme],
    filteredOut: FILTERED_OUT[theme],
  };
}

type LegendEntry = {
  color: string;
  label: string;
  areas?: number;
  keeps?: number;
  members?: Array<LegendEntry>;
};

type Painting = {
  data: PaintedCollection;
  legend: Array<LegendEntry>;
  kind: "categorical" | "sequential";
  facet: Facet | null;
  key: CatKey | null;
  caption: string;
  rank: (p: PaintedProperties) => number;
  unit: (v: number) => string;
  matched: number | null;
};

export type Painted = Painting & {
  marks: Array<PaintedProperties>;
  standing: Array<PaintedProperties>;
  signature: string;
};

const TOO_FEW = "Too few dogs to say";

function quantileBreaks(values: Array<number>, bins: number) {
  const held = values.filter((v) => v > 0);
  const breaks: Array<number> = [];
  for (let i = 1; i < bins; i += 1) {
    breaks.push(quantileOf(held, i / bins));
  }

  return [...new Set(breaks)].filter((v) => v > 0);
}

function bucketOf(value: number, breaks: Array<number>) {
  let i = 0;
  while (i < breaks.length && value > (breaks[i] ?? 0)) {
    i += 1;
  }

  return i;
}

type DistinctKey = (typeof FACET_FIELDS)[Facet]["distinct"];
type LiftKey = (typeof FACET_FIELDS)[Facet]["lift"];
type ShareKey = (typeof FACET_FIELDS)[Facet]["share"];

function rankCategories(props: Array<HoodProperties>, key: CatKey) {
  const wins = new Map<string, number>();
  for (const p of props) {
    const label = p[key];
    if (label != null) {
      wins.set(label, (wins.get(label) ?? 0) + 1);
    }
  }

  return [...wins].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function facetColors(
  props: Array<HoodProperties>,
  facet: Facet,
  theme: MapTheme,
) {
  const swatches = CATEGORY[facet][theme];
  const best = new Map<string, number>();
  const keys = [FACET_FIELDS[facet].top, FACET_FIELDS[facet].distinct];

  for (const key of keys) {
    const wins = rankCategories(props, key);
    let total = 0;
    for (const [, n] of wins) {
      total += n;
    }

    if (total === 0) {
      continue;
    }

    for (const [label, n] of wins) {
      best.set(label, Math.max(best.get(label) ?? 0, n / total));
    }
  }

  return new Map(
    [...best]
      .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, swatches.length)
      .map(([label], i) => [label, swatches[i]!] as const),
  );
}

function facetInk(props: Array<HoodProperties>, facet: Facet, theme: MapTheme) {
  const swatches = CATEGORY_INK[facet][theme];
  const order = facetColors(props, facet, theme).keys().toArray();

  return new Map(order.map((label, i) => [label, swatches[i]!] as const));
}

function paintCategorical(
  base: HoodCollection,
  theme: MapTheme,
  key: CatKey,
  facet: Facet,
  noun: string,
  caption: string,
): Painting {
  const ink = palette(theme);
  const props = base.features.map((f) => f.properties);
  const colorFor = facetColors(props, facet, theme);
  const inkFor = facetInk(props, facet, theme);

  const features = base.features.map((f) => {
    const label = f.properties[key];

    return {
      ...f,
      properties: {
        ...f.properties,
        fill: label == null ? ink.noData : (colorFor.get(label) ?? ink.other),
        valueLabel: label ?? TOO_FEW,
        tone: label == null ? null : (inkFor.get(label) ?? null),
        dim: false,
      } satisfies PaintedProperties,
    };
  });

  const here = rankCategories(props, key);
  const legend: Array<LegendEntry> = here
    .filter(([label]) => colorFor.has(label))
    .map(([label, areas]) => ({
      color: colorFor.get(label)!,
      label,
      areas,
      keeps: areas,
    }));

  const strays = here.filter(([label]) => !colorFor.has(label));
  if (strays.length > 0) {
    let areas = 0;
    for (const [, n] of strays) {
      areas += n;
    }

    legend.push({
      color: ink.other,
      label: `Another ${noun}`,
      areas,
      keeps: areas,
      members: strays.map(([label, n]) => ({
        color: ink.other,
        label,
        areas: n,
        keeps: n,
      })),
    });
  }

  legend.push({ color: ink.noData, label: TOO_FEW });

  return {
    data: { ...base, features },
    legend,
    kind: "categorical",
    facet,
    key,
    caption,
    rank: (p) => p.dogs,
    unit: count,
    matched: null,
  };
}

function paintSequential(
  base: HoodCollection,
  theme: MapTheme,
  read: (p: HoodProperties) => number,
  unit: (v: number) => string,
  caption: string,
): Painting {
  const ink = palette(theme);
  const breaks = quantileBreaks(
    base.features.map((f) => read(f.properties)),
    ink.ramp.length,
  );

  const features = base.features.map((f) => {
    const value = read(f.properties);

    return {
      ...f,
      properties: {
        ...f.properties,
        fill: value > 0 ? ink.ramp[bucketOf(value, breaks)]! : ink.noData,
        valueLabel: unit(value),
        tone: null,
        dim: false,
      } satisfies PaintedProperties,
    };
  });

  const legend: Array<LegendEntry> = ink.ramp.map((color, i) => {
    const low = i === 0 ? 0 : (breaks[i - 1] ?? 0);
    const high = breaks[i];

    return {
      color,
      label: high == null ? `${unit(low)}+` : `${unit(low)}–${unit(high)}`,
    };
  });

  return {
    data: { ...base, features },
    legend,
    kind: "sequential",
    facet: null,
    key: null,
    caption,
    rank: read,
    unit,
    matched: null,
  };
}

function commonReadout(key: CatKey, shareKey: ShareKey) {
  return (p: PaintedProperties): Readout => {
    const label = p[key];

    return {
      headline: label ?? "Too few dogs",
      sub:
        label == null
          ? "under the reporting threshold"
          : `${(p[shareKey] * 100).toFixed(1)}% of the dogs here`,
    };
  };
}

function distinctReadout(key: DistinctKey, liftKey: LiftKey) {
  return (p: PaintedProperties): Readout => {
    const label = p[key];

    return {
      headline: label ?? "Too few dogs",
      sub:
        label == null
          ? "under the reporting threshold"
          : `${lift(p[liftKey])} the citywide rate`,
    };
  };
}

type LayerBase = {
  id: LayerId;
  label: string;
  short: string;
  /**
   * Must stay under fifty characters to fit one line in a 280px sheet.
   */
  gloss: string;
  caption: string;
  readout: (p: PaintedProperties) => Readout;
};

export type LayerDef =
  | (LayerBase & {
      kind: "categorical";
      key: CatKey;
      facet: Facet;
      noun: string;
    })
  | (LayerBase & {
      kind: "sequential";
      read: (p: HoodProperties) => number;
      unit: (v: number) => string;
    });

const LAYERS: ReadonlyArray<LayerDef> = [
  {
    id: "breed",
    kind: "categorical",
    label: "Most common breed",
    short: "Common breed",
    gloss: "The breed with the most dogs here.",
    key: "top_breed",
    facet: "breeds",
    noun: "breed",
    caption:
      "A neighborhood with fewer than 20 estimated dogs doesn’t get a winner.",
    readout: commonReadout("top_breed", "top_breed_share"),
  },
  {
    id: "distinct-breed",
    kind: "categorical",
    label: "Most distinctive breed",
    short: "Distinct breed",
    gloss: "The breed furthest above its citywide rate.",
    key: "distinct_breed",
    facet: "breeds",
    noun: "breed",
    caption:
      "Ranked by how far a breed runs above its citywide rate. Small counts are pulled toward the city average, and a breed needs at least 8 dogs here to count.",
    readout: distinctReadout("distinct_breed", "distinct_breed_lift"),
  },
  {
    id: "name",
    kind: "categorical",
    label: "Most common name",
    short: "Common name",
    gloss: "The name the most dogs here answer to.",
    key: "top_name",
    facet: "names",
    noun: "name",
    caption:
      "A neighborhood with fewer than 20 estimated dogs doesn’t get a winner.",
    readout: commonReadout("top_name", "top_name_share"),
  },
  {
    id: "distinct-name",
    kind: "categorical",
    label: "Most distinctive name",
    short: "Distinct name",
    gloss: "The name furthest above its citywide rate.",
    key: "distinct_name",
    facet: "names",
    noun: "name",
    caption:
      "Ranked by how far a name runs above its citywide rate. Small counts are pulled toward the city average, and a name needs at least 4 dogs here to count.",
    readout: distinctReadout("distinct_name", "distinct_name_lift"),
  },
  {
    id: "density",
    kind: "sequential",
    label: "Dogs per square mile",
    short: "Density",
    gloss: "Dogs per square mile of land.",
    read: (p) => p.density,
    unit: count,
    caption:
      "Parks, cemeteries, and airports are left out of the land area. Each shade holds a seventh of the neighborhoods.",
    readout: (p) => ({ headline: count(p.density), sub: "dogs per mi²" }),
  },
  {
    id: "dogs",
    kind: "sequential",
    label: "Total dogs",
    short: "Total",
    gloss: "How many dogs live here in total.",
    read: (p) => p.dogs,
    unit: count,
    caption:
      "Estimated from ZIP code counts, split across the neighborhoods each ZIP covers. Each shade holds a seventh of the neighborhoods.",
    readout: (p) => ({ headline: count(p.dogs), sub: "dogs (estimated)" }),
  },
  {
    id: "per-home",
    kind: "sequential",
    label: "Dogs per 100 homes",
    short: "Per home",
    gloss: "Dogs for every 100 occupied homes.",
    read: (p) => p.dogs_per_100_homes,
    unit: (v) => v.toFixed(1),
    caption:
      "Occupied homes come from the 2020 census. Raw counts mostly follow population. Per home, brownstone Brooklyn rises and the far edges of Queens fall back.",
    readout: (p) => ({
      headline: p.dogs_per_100_homes.toFixed(1),
      sub: "dogs per 100 homes",
    }),
  },
  {
    id: "per-person",
    kind: "sequential",
    label: "Dogs per 1,000 people",
    short: "Per person",
    gloss: "Dogs for every 1,000 residents.",
    read: (p) => p.dogs_per_1k,
    unit: (v) => v.toFixed(1),
    caption:
      "Residents come from the 2020 census. This map differs from the per-home one where households are small. The West Village ranks 4th per person but 18th per home.",
    readout: (p) => ({
      headline: p.dogs_per_1k.toFixed(1),
      sub: "dogs per 1,000 people",
    }),
  },
  {
    id: "complaints",
    kind: "sequential",
    label: "Complaints to 311 per 100 dogs",
    short: "On 311",
    gloss: "Complaints per 100 licensed dogs.",
    read: (p) => p.complaints_per_100_dogs,
    unit: (v) => v.toFixed(1),
    caption:
      "Complaints about barking, dog waste, and dogs off leash from the twelve months ending August 2026, placed by their coordinates and divided by the estimated licensed dogs living there. Each shade holds a seventh of the neighborhoods.",
    readout: (p) => ({
      headline: p.complaints_per_100_dogs.toFixed(1),
      sub: "complaints to 311 per 100 dogs",
    }),
  },
];

function paintLayer(
  def: LayerDef,
  base: HoodCollection,
  theme: MapTheme,
): Painting {
  return def.kind === "categorical"
    ? paintCategorical(base, theme, def.key, def.facet, def.noun, def.caption)
    : paintSequential(base, theme, def.read, def.unit, def.caption);
}

const BY_ID = new Map(LAYERS.map((l) => [l.id, l]));

export const DEFAULT_LAYER: LayerId = LAYERS[0]!.id;

export function layerDef(id: LayerId): LayerDef {
  return BY_ID.get(id) ?? LAYERS[0]!;
}

export function isLayerId(v: string): v is LayerId {
  return BY_ID.has(v as LayerId);
}

const LAYER_OF_KEY = new Map<CatKey, LayerId>(
  LAYERS.filter(
    (l): l is Extract<LayerDef, { kind: "categorical" }> =>
      l.kind === "categorical",
  ).map((l) => [l.key, l.id]),
);

export function layerOfField(key: CatKey): LayerId {
  return LAYER_OF_KEY.get(key)!;
}

function paintFocus(
  base: HoodCollection,
  theme: MapTheme,
  matrix: Matrix,
  focus: Focus,
): Painting {
  const metric: Metric = {
    kind: "rate",
    facet: focus.facet,
    label: focus.label,
  };
  const noun =
    focus.facet === "breeds" ? focus.label : `dogs called ${focus.label}`;

  return paintSequential(
    base,
    theme,
    metricReader(metric, matrix),
    rateFormat,
    `How many ${noun} you would find per 1,000 dogs in each area. Gray means none on record.`,
  );
}

function dimUnmatched(
  painting: Painting,
  matches: Set<string>,
  tally: Set<string> | null,
  theme: MapTheme,
): Painting {
  const ink = palette(theme);
  const features = painting.data.features.map((f) =>
    matches.has(f.properties.slug)
      ? f
      : {
          ...f,
          properties: {
            ...f.properties,
            fill: ink.filteredOut,
            tone: null,
            dim: true,
          } satisfies PaintedProperties,
        },
  );

  // `keeps` counts against `tally`, not `matches`: a rule replaces the one on its field, it does not stack.
  const { key } = painting;

  function recount(entry: LegendEntry, field: CatKey): LegendEntry {
    if (entry.members != null) {
      const members = entry.members.map((m) => recount(m, field));
      let areas = 0;
      let keeps = 0;
      for (const m of members) {
        areas += m.areas ?? 0;
        keeps += m.keeps ?? 0;
      }

      return { ...entry, members, areas, keeps };
    }

    if (entry.areas == null) {
      return entry;
    }

    return {
      ...entry,
      areas: features.filter(
        (f) => !f.properties.dim && f.properties[field] === entry.label,
      ).length,
      keeps: features.filter(
        (f) =>
          (tally == null || tally.has(f.properties.slug)) &&
          f.properties[field] === entry.label,
      ).length,
    };
  }

  const legend =
    key == null
      ? painting.legend
      : painting.legend.map((entry) => recount(entry, key));

  return {
    ...painting,
    legend,
    data: { ...painting.data, features },
    matched: matches.size,
  };
}

const RIVAL_INK = {
  light: ["#3d7fbf", "#cc5f3a", "#4f9a63", "#9a5fa8"],
  dark: ["#68a8e0", "#e8825a", "#6cbb85", "#b985c8"],
} as const satisfies Record<MapTheme, ReadonlyArray<string>>;

export function rivalColor(theme: MapTheme, at: number) {
  return RIVAL_INK[theme][at % RIVAL_INK[theme].length]!;
}

const NOBODY = "None of them";

function paintBout(
  base: HoodCollection,
  theme: MapTheme,
  matrix: Matrix,
  rivals: ReadonlyArray<Rival>,
): Painting {
  const ink = palette(theme);
  const subjects = rivals.filter(
    (r): r is Rival & { kind: Facet } =>
      r.kind === "breeds" || r.kind === "names",
  );
  const read = subjects.map((r) =>
    metricReader({ kind: "rate", facet: r.kind, label: r.label }, matrix),
  );

  const leads = subjects.map(() => 0);

  const features = base.features.map((f) => {
    const p = f.properties;
    let won = -1;
    let best = 0;
    let second = 0;

    for (const [i, at] of read.entries()) {
      const rate = at(p);
      if (rate > best) {
        second = best;
        best = rate;
        won = i;
      } else if (rate > second) {
        second = rate;
      }
    }

    if (won >= 0) {
      leads[won] = (leads[won] ?? 0) + 1;
    }

    return {
      ...f,
      properties: {
        ...p,
        fill: won < 0 ? ink.noData : rivalColor(theme, won),
        valueLabel: won < 0 ? NOBODY : (subjects[won]?.label ?? NOBODY),
        tone: won < 0 ? null : rivalColor(theme, won),
        dim: false,
      } satisfies PaintedProperties,
    };
  });

  const legend: Array<LegendEntry> = subjects.map((r, i) => ({
    color: rivalColor(theme, i),
    label: r.label,
    areas: leads[i] ?? 0,
    keeps: leads[i] ?? 0,
  }));
  legend.push({ color: ink.noData, label: NOBODY });

  const facet = subjects.every((r) => r.kind === "breeds")
    ? "breeds"
    : subjects.every((r) => r.kind === "names")
      ? "names"
      : null;

  return {
    data: { ...base, features },
    legend,
    kind: "categorical",
    facet,
    key: null,
    caption: `Each neighborhood takes the color of whichever of these ${subjects.length} has the most per 1,000 dogs there.`,
    rank: (p) => p.dogs,
    unit: count,
    matched: null,
  };
}

/**
 * Legend counts exclude the active categorical rule; against the live cut every
 * other row would read 0. A rule replaces the one on its field, it does not stack.
 */
function tallyFor(
  hoods: HoodCollection,
  matrix: Matrix,
  view: View,
  filters: ReadonlyArray<Filter>,
  matches: Set<string> | null,
) {
  if (view.kind !== "layer") {
    return matches;
  }

  const def = layerDef(view.layer);
  if (def.kind !== "categorical") {
    return matches;
  }

  const key = `in:${def.key}`;
  const rest = filters.filter((f) => filterKey(f) !== key);

  return rest.length === filters.length
    ? matches
    : matching(hoods, matrix, rest);
}

export function cut(
  base: HoodCollection,
  matrix: Matrix,
  view: View,
  filters: ReadonlyArray<Filter>,
  theme: MapTheme,
): Painted {
  // A link can carry a breed the file has never heard of; that is a dead view, not an empty map.
  const asked =
    view.kind === "focus" &&
    matrix[view.focus.facet][view.focus.label] === undefined
      ? ({ kind: "layer", layer: DEFAULT_LAYER } as const)
      : view;

  const matches = matching(base, matrix, filters);
  const tally = tallyFor(base, matrix, asked, filters, matches);

  const raw =
    asked.kind === "bout"
      ? paintBout(base, theme, matrix, asked.rivals)
      : asked.kind === "focus"
        ? paintFocus(base, theme, matrix, asked.focus)
        : paintLayer(layerDef(asked.layer), base, theme);
  const painting =
    matches == null ? raw : dimUnmatched(raw, matches, tally, theme);

  const marks = painting.data.features.map((f) => f.properties);

  return {
    ...painting,
    marks,
    standing: marks
      .filter((p) => !p.dim)
      .toSorted((a, b) => painting.rank(b) - painting.rank(a)),
    signature: JSON.stringify([asked, filters.map((f) => filterKey(f))]),
  };
}

export function readout(view: View, p: PaintedProperties): Readout {
  if (view.kind === "focus") {
    return {
      headline: p.valueLabel,
      sub: `per 1,000 dogs, ${view.focus.label}`,
    };
  }

  if (view.kind === "bout") {
    return { headline: p.valueLabel, sub: "leads here, per 1,000 dogs" };
  }

  return layerDef(view.layer).readout(p);
}

export function question(layer: LayerId): "common" | "distinct" {
  const def = layerDef(layer);

  return def.kind === "categorical" &&
    def.key === FACET_FIELDS[def.facet].distinct
    ? "distinct"
    : "common";
}

export function dogBreed(
  view: View,
  layer: LayerId,
  p: PaintedProperties,
): string | null {
  if (view.kind === "bout" && view.rivals.every((r) => r.kind === "breeds")) {
    return p.valueLabel === NOBODY ? null : p.valueLabel;
  }

  return question(layer) === "distinct" ? p.distinct_breed : p.top_breed;
}

export function facetSwatches(
  base: HoodCollection,
  theme: MapTheme,
): Record<Facet, Map<string, string>> {
  const props = base.features.map((f) => f.properties);

  return {
    breeds: facetColors(props, "breeds", theme),
    names: facetColors(props, "names", theme),
  };
}
