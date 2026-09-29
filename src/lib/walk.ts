import type { Filter, NumericField } from "$lib/query";
import type { Part } from "$lib/sentence";
import type {
  Facet,
  HoodCollection,
  HoodProperties,
  LayerId,
  Matrix,
  Summary,
} from "$lib/types";
import { wouldKeep } from "$lib/query";
import { chip, dial, figure, place } from "$lib/sentence";
import { count, lift } from "$lib/utils";

const HOMES = { min: 0.5, max: 7, step: 0.5 };
const GRIPES = { min: 5, max: 115, step: 5 };

/** What a word in the walk does when the reader presses it. */
export type Doors = {
  goTo: (slug: string) => void;
  show: (facet: Facet, label: string, as: "live" | "lead") => void;
  narrow: (filter: Filter) => void;
  openMethod: () => void;
};

export type Stop = {
  title: string;
  leap: { layer: LayerId; filters: Array<Filter> };
  template: string;
  slots: Record<string, Part>;
};

function wins(all: Array<HoodProperties>, key: "top_breed" | "top_name") {
  const tally: Record<string, number> = {};
  for (const p of all) {
    const label = p[key];
    if (label != null) {
      tally[label] = (tally[label] ?? 0) + 1;
    }
  }

  return Object.entries(tally).toSorted((a, b) => b[1] - a[1]);
}

// Only dogs the map colors, each at the place where it runs strongest, so the chips match the map beside them.
function onePlaceEach(
  rows: Array<HoodProperties>,
  dogOf: (p: HoodProperties) => string | null,
  rank: (p: HoodProperties) => number,
) {
  const best: Record<string, HoodProperties> = {};
  for (const p of rows) {
    const dog = dogOf(p);
    if (dog == null) {
      continue;
    }

    const held = best[dog];
    if (held == null || rank(p) > rank(held)) {
      best[dog] = p;
    }
  }

  return Object.values(best)
    .toSorted((a, b) => rank(b) - rank(a))
    .slice(0, 3);
}

function atLeast(
  field: "dogs_per_100_homes" | "complaints_per_100_dogs",
  min: number,
): Filter {
  return { kind: "range", metric: { kind: "field", field }, min, max: null };
}

function toPlace(p: HoodProperties, doors: Doors): Part {
  return place(p.name, () => doors.goTo(p.slug), {
    field: "slug",
    value: p.slug,
  });
}

function dogChip(
  facet: Facet,
  label: string,
  as: "live" | "lead",
  doors: Doors,
): Part {
  return chip(facet, label, () => doors.show(facet, label, as));
}

export function buildStops(
  hoods: HoodCollection,
  matrix: Matrix,
  summary: Summary,
  isColored: (facet: Facet, label: string) => boolean,
  rangeMin: (field: NumericField) => number | null,
  doors: Doors,
): Array<Stop> {
  const all = hoods.features.map((f) => f.properties);
  const total = all.length;
  const cityBreed =
    summary.city_top_breeds[0]?.label ?? "Labrador (or Crossbreed)";
  const cityName = summary.city_top_names[0]?.label ?? "Luna";
  const breedWins = wins(all, "top_breed");
  const nameWins = wins(all, "top_name");
  const labWins = breedWins.find(([label]) => label === cityBreed)?.[1] ?? 0;
  const [second, secondWins] = breedWins.find(
    ([label]) => label !== cityBreed,
  ) ?? [cityBreed, 0];
  const lunaWins = nameWins.find(([label]) => label === cityName)?.[1] ?? 0;
  const distinctBreeds = new Set(
    all.map((p) => p.distinct_breed).filter((b) => b != null),
  ).size;

  const signatures = onePlaceEach(
    all.filter(
      (p) => p.distinct_breed != null && isColored("breeds", p.distinct_breed),
    ),
    (p) => p.distinct_breed,
    (p) => p.distinct_breed_lift,
  );
  const otherNames = onePlaceEach(
    all.filter(
      (p) =>
        p.top_name != null &&
        p.top_name !== cityName &&
        isColored("names", p.top_name),
    ),
    (p) => p.top_name,
    (p) => p.dogs,
  );
  const leader = all.toSorted(
    (a, b) => b.dogs_per_100_homes - a.dogs_per_100_homes,
  )[0];
  const byGripes = all.toSorted(
    (a, b) => b.complaints_per_100_dogs - a.complaints_per_100_dogs,
  );
  const most = byGripes[0];
  const least = byGripes.at(-1);

  const homesMin = rangeMin("dogs_per_100_homes") ?? 3;
  const gripesMin = rangeMin("complaints_per_100_dogs") ?? 30;

  return [
    {
      title: "The flat map",
      leap: { layer: "breed", filters: [] },
      template: `By raw count, only {{winners}} breeds lead a neighborhood anywhere in the city. {{lab}} leads {{labWins}} of the {{total}}, and {{second}} follows with {{secondWins}}.`,
      slots: {
        winners: figure(count(breedWins.length)),
        lab: dogChip("breeds", cityBreed, "lead", doors),
        labWins: figure(count(labWins), () =>
          doors.show("breeds", cityBreed, "lead"),
        ),
        total: figure(count(total)),
        second: dogChip("breeds", second, "lead", doors),
        secondWins: figure(count(secondWins), () =>
          doors.show("breeds", second, "lead"),
        ),
      },
    },
    {
      title: "The distinctive map",
      leap: { layer: "distinct-breed", filters: [] },
      template: `Rank by how far each breed runs above its citywide rate instead, and {{distinct}} breeds spread across the map. {{b1}} runs strongest in {{p1}} at {{l1}} its citywide rate, {{b2}} in {{p2}} at {{l2}}, and {{b3}} in {{p3}} at {{l3}}.`,
      slots: {
        distinct: figure(count(distinctBreeds)),
        ...Object.fromEntries(
          signatures.flatMap((p, i) => [
            [`p${i + 1}`, toPlace(p, doors)],
            [
              `b${i + 1}`,
              dogChip("breeds", p.distinct_breed ?? "", "live", doors),
            ],
            [`l${i + 1}`, figure(lift(p.distinct_breed_lift))],
          ]),
        ),
      },
    },
    {
      title: "Names",
      leap: { layer: "name", filters: [] },
      template: `{{luna}} leads {{lunaWins}} of the {{total}} neighborhoods. Elsewhere, {{n1}} leads {{p1}}, {{n2}} leads {{p2}}, and {{n3}} leads {{p3}}.`,
      slots: {
        luna: dogChip("names", cityName, "lead", doors),
        lunaWins: figure(count(lunaWins), () =>
          doors.show("names", cityName, "lead"),
        ),
        total: figure(count(total)),
        ...Object.fromEntries(
          otherNames.flatMap((p, i) => [
            [`n${i + 1}`, dogChip("names", p.top_name ?? "", "live", doors)],
            [`p${i + 1}`, toPlace(p, doors)],
          ]),
        ),
      },
    },
    {
      title: "Divide by the homes",
      leap: {
        layer: "per-home",
        filters: [atLeast("dogs_per_100_homes", homesMin)],
      },
      template: `Raw dog counts mostly follow population. Per 100 homes, {{leader}} leads at {{rate}}. Drag the number {{dial}} to set a floor, and {{kept}} neighborhoods stay lit.`,
      slots: {
        leader: leader == null ? "nowhere" : toPlace(leader, doors),
        rate: figure((leader?.dogs_per_100_homes ?? 0).toFixed(1)),
        dial: dial(
          "Fewest dogs per 100 homes to keep",
          homesMin,
          HOMES,
          (v) => v.toFixed(1),
          (v) => doors.narrow(atLeast("dogs_per_100_homes", v)),
        ),
        kept: figure(
          count(
            wouldKeep(
              hoods,
              matrix,
              [],
              atLeast("dogs_per_100_homes", homesMin),
            ),
          ),
        ),
      },
    },
    {
      title: "The 311 line",
      leap: {
        layer: "complaints",
        filters: [atLeast("complaints_per_100_dogs", gripesMin)],
      },
      template: `Divide dog complaints to 311 by the licensed dogs living there, and {{most}} leads at {{mostRate}} per 100 dogs while {{least}} is lowest at {{leastRate}}. Drag the number {{dial}} to set a floor, and {{kept}} neighborhoods stay lit.`,
      slots: {
        most: most == null ? "nowhere" : toPlace(most, doors),
        mostRate: figure((most?.complaints_per_100_dogs ?? 0).toFixed(1)),
        least: least == null ? "nowhere" : toPlace(least, doors),
        leastRate: figure((least?.complaints_per_100_dogs ?? 0).toFixed(1)),
        dial: dial(
          "Fewest complaints per 100 dogs to keep",
          gripesMin,
          GRIPES,
          (v) => count(v),
          (v) => doors.narrow(atLeast("complaints_per_100_dogs", v)),
        ),
        kept: figure(
          count(
            wouldKeep(
              hoods,
              matrix,
              [],
              atLeast("complaints_per_100_dogs", gripesMin),
            ),
          ),
        ),
      },
    },
    {
      title: "The license file",
      leap: { layer: "dogs", filters: [] },
      template: `The {{year}} file holds {{licenses}} licenses. Matching dogs across earlier files shows that {{ratio}} dogs pass through licensing for every one in it, so the map shows about half of them.`,
      slots: {
        licenses: figure(count(summary.licenses)),
        year: figure(summary.extract_year),
        ratio: figure(summary.lapse_ratio.toFixed(2), () => {
          doors.openMethod();
        }),
      },
    },
  ];
}
