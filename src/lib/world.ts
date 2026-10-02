import type { Bounds } from "#lib/components/map/camera.js";
import type { SunkShapes } from "#lib/components/map/tide.js";
import type {
  BoroughLabels,
  DogScatter,
  HoodCollection,
  HoodDetail,
  Matrix,
  ParkCollection,
  ParkLabels,
  RailLines,
  RailStations,
  Rider,
  Shelter,
  SubwayLines,
  SubwayStations,
  Summary,
} from "#lib/types.js";
import { boundsOf, parkLabels, riderPool } from "#lib/data.js";

export const SUNK_BOROUGH = "Staten Island";

const PARK_LABEL_MI2 = 0.93;

export type Loaded = {
  hoods: HoodCollection;
  parks: ParkCollection;
  subway: SubwayLines;
  stations: SubwayStations;
  rail: RailLines;
  railStops: RailStations;
  dogs: DogScatter;
  details: Record<string, HoodDetail>;
  matrix: Matrix;
  summary: Summary;
  shelters: Array<Shelter>;
};

export type World = {
  hoods: HoodCollection;
  parks: ParkCollection;
  parkNames: ParkLabels;
  boroughNames: BoroughLabels;
  subway: SubwayLines;
  stations: SubwayStations;
  rail: RailLines;
  railStops: RailStations;
  dogs: DogScatter;
  riders: Array<Rider>;
  shelters: Array<Shelter>;
  licenses: number;
  bounds: Bounds;
  sunk: { shapes: SunkShapes; center: [number, number]; under: boolean };
};

/**
 * One place a borough goes under. Every set the map draws is filtered here, so a
 * new one cannot forget the rule, and the page holds no geography.
 */
export function worldOf(data: Loaded, hasSank: boolean): World {
  const names = parkLabels(data.parks, PARK_LABEL_MI2);
  const riders = riderPool(data.hoods, data.details, data.matrix, data.summary);
  const marks = data.hoods.features.map((f) => f.properties);
  const boroughNear = (lon: number, lat: number) => {
    let best = Infinity;
    let borough = "";
    for (const p of marks) {
      const reach = (p.lon - lon) ** 2 + (p.lat - lat) ** 2;
      if (reach < best) {
        best = reach;
        borough = p.borough;
      }
    }

    return borough;
  };

  const drowned = new Set<string>();
  let sunkDogs = 0;
  for (const p of marks) {
    if (p.borough !== SUNK_BOROUGH) {
      continue;
    }

    drowned.add(p.slug);
    sunkDogs += p.dogs;
  }

  const drownedParks = new Set(
    data.parks.features.filter(
      (f) => boroughNear(f.properties.lon, f.properties.lat) === SUNK_BOROUGH,
    ),
  );

  const hoods = hasSank
    ? {
        ...data.hoods,
        features: data.hoods.features.filter(
          (f) => !drowned.has(f.properties.slug),
        ),
      }
    : data.hoods;
  const parks = hasSank
    ? {
        ...data.parks,
        features: data.parks.features.filter((f) => !drownedParks.has(f)),
      }
    : data.parks;

  return {
    hoods,
    parks,
    boroughNames: boroughLabels(hoods),
    parkNames: hasSank
      ? {
          ...names,
          features: names.features.filter(
            (f) =>
              boroughNear(
                f.geometry.coordinates[0] ?? 0,
                f.geometry.coordinates[1] ?? 0,
              ) !== SUNK_BOROUGH,
          ),
        }
      : names,
    subway: hasSank
      ? {
          ...data.subway,
          features: data.subway.features.filter(
            (f) => f.properties.route !== "SIR",
          ),
        }
      : data.subway,
    stations: data.stations,
    rail: data.rail,
    railStops: data.railStops,
    dogs: data.dogs,
    riders: hasSank ? riders.filter((r) => !drowned.has(r.slug)) : riders,
    shelters: hasSank
      ? data.shelters.filter((place) => place.borough !== SUNK_BOROUGH)
      : data.shelters,
    licenses: data.summary.licenses - (hasSank ? sunkDogs : 0),
    bounds: boundsOf(hoods),
    sunk: { ...island(data, drowned, drownedParks), under: hasSank },
  };
}

function boroughLabels(hoods: HoodCollection): BoroughLabels {
  const sums = new Map<string, { lon: number; lat: number; area: number }>();
  for (const f of hoods.features) {
    const p = f.properties;
    const at = sums.get(p.borough) ?? { lon: 0, lat: 0, area: 0 };
    at.lon += p.lon * p.area_mi2;
    at.lat += p.lat * p.area_mi2;
    at.area += p.area_mi2;
    sums.set(p.borough, at);
  }

  return {
    type: "FeatureCollection",
    features: [...sums].map(([name, at]) => ({
      type: "Feature" as const,
      properties: { name },
      geometry: {
        type: "Point" as const,
        coordinates: [at.lon / at.area, at.lat / at.area],
      },
    })),
  };
}

function island(
  data: Loaded,
  drowned: ReadonlySet<string>,
  drownedParks: ReadonlySet<ParkCollection["features"][number]>,
) {
  const land = [
    ...data.hoods.features.filter((f) => drowned.has(f.properties.slug)),
    ...drownedParks,
  ];
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const feature of land) {
    const parts =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const rings of parts) {
      const ring = rings[0] ?? [];
      for (const [lon = 0, lat = 0] of ring) {
        west = Math.min(west, lon);
        east = Math.max(east, lon);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }
  }

  return {
    shapes: {
      type: "FeatureCollection" as const,
      features: land.map((f) => ({ ...f, properties: {} })),
    },
    center: [(west + east) / 2, (south + north) / 2] as [number, number],
  };
}
