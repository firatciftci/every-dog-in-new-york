import type { Facet, HoodProperties, Matrix } from "$lib/types";
import { metricReader } from "$lib/query";
import { cityRate, FACET_DENOMINATOR, liftOf, totals } from "$lib/rate";

export const MAX_RIVALS = 4;

export type Rival =
  | { kind: "breeds"; label: string }
  | { kind: "names"; label: string }
  | { kind: "hood"; label: string; slug: string }
  | { kind: "borough"; label: string };

export type Bout = "subject" | "place";

export function rivalKey(rival: Rival) {
  return rival.kind === "hood"
    ? `hood:${rival.slug}`
    : `${rival.kind}:${rival.label}`;
}

export function rivalName(
  rival: Rival,
  city: ReadonlyArray<HoodProperties>,
): string {
  if (rival.kind !== "hood") {
    return rival.label;
  }

  return city.find((p) => p.slug === rival.slug)?.name ?? rival.label;
}

export function boutOf(rivals: ReadonlyArray<Rival>): Bout | null {
  if (rivals.length === 0) {
    return null;
  }

  return rivals.every((r) => r.kind === "breeds" || r.kind === "names")
    ? "subject"
    : rivals.every((r) => r.kind === "hood" || r.kind === "borough")
      ? "place"
      : null;
}

export function boutFor(rival: Rival): Bout {
  return rival.kind === "breeds" || rival.kind === "names"
    ? "subject"
    : "place";
}

export type Round = {
  slug: string;
  name: string;
  borough: string;
  dogs: number;
  rates: Array<number>;
  won: number;
  gap: number;
  total: number;
};

export type Tale = {
  rivals: Array<Rival>;
  rounds: Array<Round>;
  city: Array<number>;
  leads: Array<number>;
  home: Array<{ slug: string; name: string; rate: number } | null>;
  spread: number;
};

function ranked(rates: ReadonlyArray<number>) {
  let won = -1;
  let best = 0;
  let second = 0;

  for (const [i, rate] of rates.entries()) {
    if (rate > best) {
      second = best;
      best = rate;
      won = i;
    } else if (rate > second) {
      second = rate;
    }
  }

  return { won, best, second };
}

export function tale(
  standing: ReadonlyArray<HoodProperties>,
  city: ReadonlyArray<HoodProperties>,
  matrix: Matrix,
  rivals: ReadonlyArray<Rival>,
): Tale {
  const subjects = rivals.filter(
    (r): r is Rival & { kind: Facet } =>
      r.kind === "breeds" || r.kind === "names",
  );
  const read = subjects.map((r) =>
    metricReader({ kind: "rate", facet: r.kind, label: r.label }, matrix),
  );

  const rounds: Array<Round> = [];
  const leads = subjects.map(() => 0);
  const home: Tale["home"] = subjects.map(() => null);

  for (const p of standing) {
    const rates = read.map((f) => f(p));
    for (const [i, rate] of rates.entries()) {
      const seat = home[i];
      if (rate > 0 && (seat == null || rate > seat.rate)) {
        home[i] = { slug: p.slug, name: p.name, rate };
      }
    }

    const { won, best, second } = ranked(rates);

    if (won >= 0) {
      leads[won] = (leads[won] ?? 0) + 1;
    }

    let total = 0;
    for (const rate of rates) {
      total += rate;
    }

    rounds.push({
      slug: p.slug,
      name: p.name,
      borough: p.borough,
      dogs: p.dogs,
      rates,
      won,
      gap: best - second,
      total,
    });
  }

  const decided = rounds.filter((r) => r.won >= 0).length;
  let top = 0;
  for (const n of leads) {
    top = Math.max(top, n);
  }

  return {
    rivals: [...rivals],
    rounds,
    city: read.map((f) => cityRate(city, f)),
    leads,
    home,
    spread:
      decided > 0 && subjects.length > 1
        ? Math.max(
            0,
            (top / decided - 1 / subjects.length) / (1 - 1 / subjects.length),
          )
        : 0,
  };
}

export function lopsided(tale: Tale, limit: number) {
  return tale.rounds
    .filter((r) => r.won >= 0 && r.total > 0)
    .toSorted((a, b) => b.gap - a.gap || b.total - a.total)
    .slice(0, limit);
}

export type Ledger = {
  key: string;
  label: string;
  hoods: number;
  dogs: number;
  people: number;
  homes: number;
  areaMi2: number;
  perHome: number;
  perThousand: number;
  density: number;
  breeds: Array<{ label: string; dogs: number; lift: number }>;
  names: Array<{ label: string; dogs: number; lift: number }>;
  lifts: Record<Facet, Map<string, number>>;
};

function facetTop(
  matrix: Matrix,
  facet: Facet,
  rows: ReadonlySet<number>,
  cityRows: ReadonlySet<number>,
  dogs: number,
  cityDogs: number,
) {
  const counted: Array<{ label: string; here: number; city: number }> = [];
  let hereColumns = 0;
  let cityColumns = 0;

  const columns = Object.entries(matrix[facet]);
  for (const [label, column] of columns) {
    let here = 0;
    let city = 0;
    for (const [i, n] of column.entries()) {
      if (cityRows.has(i)) {
        city += n;
      }
      if (rows.has(i)) {
        here += n;
      }
    }

    hereColumns += here;
    cityColumns += city;
    if (here > 0) {
      counted.push({ label, here, city });
    }
  }

  const isColumns = FACET_DENOMINATOR[facet] === "columns";
  const hereTotal = isColumns ? hereColumns : dogs;
  const cityTotal = isColumns ? cityColumns : cityDogs;

  return counted
    .map(({ label, here, city }) => ({
      label,
      dogs: here,
      lift: liftOf(facet, { here, hereTotal, city, cityTotal }),
    }))
    .toSorted((a, b) => b.dogs - a.dogs);
}

function held(rival: Rival, standing: ReadonlyArray<HoodProperties>) {
  return rival.kind === "hood"
    ? standing.filter((p) => p.slug === rival.slug)
    : standing.filter((p) => p.borough === rival.label);
}

export function ledgers(
  standing: ReadonlyArray<HoodProperties>,
  city: ReadonlyArray<HoodProperties>,
  matrix: Matrix,
  rivals: ReadonlyArray<Rival>,
  limit = 5,
): Array<Ledger> {
  const seat = new Map(matrix.slugs.map((slug, i) => [slug, i]));
  const rowsOf = (over: ReadonlyArray<HoodProperties>) =>
    new Set(
      over
        .map((p) => seat.get(p.slug))
        .filter((i): i is number => i !== undefined),
    );

  const cityRows = rowsOf(city);
  const cityDogs = totals(city).dogs;

  return rivals.map((rival) => {
    const mine = held(rival, standing);
    const rows = rowsOf(mine);
    const sum = totals(mine);

    const allBreeds = facetTop(
      matrix,
      "breeds",
      rows,
      cityRows,
      sum.dogs,
      cityDogs,
    );
    const allNames = facetTop(
      matrix,
      "names",
      rows,
      cityRows,
      sum.dogs,
      cityDogs,
    );

    return {
      key: rivalKey(rival),
      label: rivalName(rival, city),
      hoods: mine.length,
      dogs: sum.dogs,
      people: sum.people,
      homes: sum.homes,
      areaMi2: sum.areaMi2,
      perHome: sum.perHome,
      perThousand: sum.perThousand,
      density: sum.density,
      breeds: allBreeds.slice(0, limit),
      names: allNames.slice(0, limit),
      lifts: {
        breeds: new Map(allBreeds.map((r) => [r.label, r.lift])),
        names: new Map(allNames.map((r) => [r.label, r.lift])),
      },
    };
  });
}

export function crosstab(
  books: ReadonlyArray<Ledger>,
  facet: Facet,
  limit = 7,
) {
  const worth = new Set<string>();
  for (const book of books) {
    const short = book[facet];
    for (const row of short) {
      worth.add(row.label);
    }
  }

  return [...worth]
    .map((label) => {
      const lifts = books.map((book) => book.lifts[facet].get(label) ?? 0);

      return {
        label,
        lifts,
        spread: Math.max(...lifts) - Math.min(...lifts),
        top: Math.max(...lifts),
      };
    })
    .toSorted((a, b) => b.spread - a.spread || b.top - a.top)
    .slice(0, limit);
}

export const MEASURES = [
  { key: "dogs", label: "Dogs", of: (l: Ledger) => l.dogs, whole: true },
  {
    key: "hoods",
    label: "Neighborhoods",
    of: (l: Ledger) => l.hoods,
    whole: true,
  },
  { key: "people", label: "People", of: (l: Ledger) => l.people, whole: true },
  { key: "homes", label: "Homes", of: (l: Ledger) => l.homes, whole: true },
  {
    key: "perHome",
    label: "Dogs per 100 homes",
    of: (l: Ledger) => l.perHome,
    whole: false,
  },
  {
    key: "perThousand",
    label: "Dogs per 1,000 people",
    of: (l: Ledger) => l.perThousand,
    whole: false,
  },
  {
    key: "density",
    label: "Dogs per square mile",
    of: (l: Ledger) => l.density,
    whole: true,
  },
] as const;
