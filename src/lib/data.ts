import type { Topology } from "topojson-specification";
import { feature } from "topojson-client";
import type {
  HoodCollection,
  HoodDetail,
  HoodLabels,
  LabelCollection,
  Matrix,
  PaintedCollection,
  PaintedProperties,
  ParkCollection,
  ParkLabels,
  Rider,
  Summary,
} from "$lib/types";
import { plateOf } from "$lib/breeds";

export async function fetchJson<T>(
  fetcher: typeof fetch,
  url: string,
): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status}).`);
  }

  return (await response.json()) as T;
}

export async function fetchTopology<T>(
  fetcher: typeof fetch,
  url: string,
  name?: string,
) {
  const topology = await fetchJson<Topology>(fetcher, url);
  const object =
    name == null ? Object.values(topology.objects)[0] : topology.objects[name];
  if (object === undefined) {
    throw new Error(`${url} has no ${name ?? "layers"}.`);
  }

  return feature(topology, object) as T;
}

// MapLibre labels every polygon of a MultiPolygon, so labels come from one anchor point per feature.
function anchorPoints<
  F extends { properties: { lon: number; lat: number } },
  P,
>(features: ReadonlyArray<F>, pick: (f: F) => P): LabelCollection<P> {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature" as const,
      properties: pick(f),
      geometry: {
        type: "Point" as const,
        coordinates: [f.properties.lon, f.properties.lat],
      },
    })),
  };
}

const LABEL_APART = 0.045;

const LONGITUDE = 0.76;

function labelOrder(
  marks: ReadonlyArray<PaintedProperties>,
): Map<string, number> {
  const left = [...marks];
  const apart = left.map(() => LABEL_APART);
  const rank = new Map<string, number>();

  while (left.length > 0) {
    let pick = 0;
    let best = -1;
    for (const [i, mark] of left.entries()) {
      const score = Math.sqrt(mark.dogs) * (apart[i] ?? 0);
      if (score > best) {
        best = score;
        pick = i;
      }
    }

    const won = left[pick];
    if (won == null) {
      break;
    }

    rank.set(won.slug, rank.size);
    left.splice(pick, 1);
    apart.splice(pick, 1);
    for (const [i, mark] of left.entries()) {
      apart[i] = Math.min(
        apart[i] ?? 0,
        Math.hypot((mark.lon - won.lon) * LONGITUDE, mark.lat - won.lat),
      );
    }
  }

  return rank;
}

const JOINED = /-(?=[A-Z])/;

function shortNames(
  marks: ReadonlyArray<PaintedProperties>,
): Map<string, string> {
  const heads = new Map<string, number>();
  for (const mark of marks) {
    const head = mark.name.split(JOINED)[0] ?? mark.name;
    heads.set(head, (heads.get(head) ?? 0) + 1);
  }

  const short = new Map<string, string>();
  for (const mark of marks) {
    const head = mark.name.split(JOINED)[0] ?? mark.name;
    short.set(mark.slug, heads.get(head) === 1 ? head : mark.name);
  }

  return short;
}

export function hoodLabels(
  hoods: PaintedCollection,
  dogOf: (p: PaintedProperties) => string | null,
): HoodLabels {
  const marks = hoods.features.map((f) => f.properties);
  const rank = labelOrder(marks);
  const short = shortNames(marks);

  return anchorPoints(hoods.features, (f) => {
    const breed = dogOf(f.properties);

    return {
      slug: f.properties.slug,
      name: f.properties.name,
      short: short.get(f.properties.slug) ?? f.properties.name,
      rank: rank.get(f.properties.slug) ?? marks.length,
      value: f.properties.valueLabel,
      plate: breed == null ? "" : plateOf(breed),
    };
  });
}

export function riderPool(
  hoods: HoodCollection,
  details: Record<string, HoodDetail>,
  matrix: Matrix,
  summary: Summary,
): Array<Rider> {
  const mappable = new Set(Object.keys(matrix.names));
  const common = summary.city_top_names
    .map((tally) => tally.label)
    .filter((label) => mappable.has(label))
    .slice(0, 8);
  const citywide =
    common.length > 0 ? common : Object.keys(matrix.names).slice(0, 8);

  return hoods.features.map((f) => {
    const local = (details[f.properties.slug]?.names.common ?? [])
      .map((tally) => tally.label)
      .filter((label) => mappable.has(label))
      .slice(0, 8);

    return {
      slug: f.properties.slug,
      hood: f.properties.name,
      borough: f.properties.borough,
      lon: f.properties.lon,
      lat: f.properties.lat,
      breed: f.properties.top_breed ?? "Labrador (or Crossbreed)",
      plate: plateOf(f.properties.top_breed ?? ""),
      names: local.length > 0 ? local : citywide,
    };
  });
}

export function parkLabels(parks: ParkCollection, minMi2: number): ParkLabels {
  return anchorPoints(
    parks.features.filter((f) => f.properties.mi2 >= minMi2),
    (f) => ({
      name: f.properties.name,
      kind: f.properties.kind,
      mi2: f.properties.mi2,
    }),
  );
}

export function boundsOf(
  hoods: HoodCollection,
): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const f of hoods.features) {
    const rings =
      f.geometry.type === "Polygon"
        ? f.geometry.coordinates
        : f.geometry.coordinates.flat();

    for (const ring of rings) {
      for (const position of ring) {
        const x = position[0];
        const y = position[1];
        if (x === undefined || y === undefined) {
          continue;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return [minX, minY, maxX, maxY];
}
