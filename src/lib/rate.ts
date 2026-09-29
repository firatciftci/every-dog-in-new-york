import type { Facet, HoodProperties } from "$lib/types";

/**
 * Must match NAME_PRIOR and BREED_PRIOR in pipeline/build_data.py, or a panel
 * figure and a bout figure disagree about the same breed.
 */
const PRIOR: Record<Facet, number> = { breeds: 8, names: 4 };

export const FACET_DENOMINATOR = {
  breeds: "columns",
  names: "dogs",
} as const satisfies Record<Facet, "columns" | "dogs">;

const SPAN = Math.log(3);

export function totals(over: ReadonlyArray<HoodProperties>) {
  let dogs = 0;
  let people = 0;
  let homes = 0;
  let areaMi2 = 0;
  let complaints = 0;

  for (const p of over) {
    dogs += p.dogs;
    people += p.people;
    homes += p.homes;
    areaMi2 += p.area_mi2;
    complaints += p.complaints;
  }

  return {
    dogs,
    people,
    homes,
    areaMi2,
    complaints,
    perHome: homes > 0 ? (dogs / homes) * 100 : 0,
    perThousand: people > 0 ? (dogs / people) * 1000 : 0,
    density: areaMi2 > 0 ? dogs / areaMi2 : 0,
    perHundredDogs: dogs > 0 ? (complaints / dogs) * 100 : 0,
  };
}

export function cityRate<P extends HoodProperties>(
  over: ReadonlyArray<P>,
  read: (p: P) => number,
) {
  let dogs = 0;
  let scaled = 0;

  for (const p of over) {
    dogs += p.dogs;
    scaled += read(p) * p.dogs;
  }

  return dogs > 0 ? scaled / dogs : 0;
}

export function liftOf(
  facet: Facet,
  counts: { here: number; hereTotal: number; city: number; cityTotal: number },
) {
  const prior = PRIOR[facet];
  const { here, hereTotal, city, cityTotal } = counts;
  const share = cityTotal > 0 ? city / cityTotal : 0;

  return hereTotal > 0 && share > 0
    ? (here + prior) / (hereTotal * share + prior)
    : 0;
}

export function liftOffset(lift: number) {
  return lift <= 0 ? -1 : Math.max(-1, Math.min(1, Math.log(lift) / SPAN));
}

export function liftWeight(lift: number) {
  return lift >= 1.15 ? "over" : lift >= 0.85 ? "level" : "under";
}

export function rankIn(values: ReadonlyArray<number>, here: number) {
  let above = 0;
  for (const value of values) {
    if (value > here) {
      above += 1;
    }
  }

  return above + 1;
}
