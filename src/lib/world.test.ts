import { describe, expect, it } from "vitest";
import type { Loaded } from "#lib/world.js";
import { SUNK_BOROUGH, worldOf } from "#lib/world.js";

function hood(slug: string, borough: string, lon: number) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [lon, 40],
          [lon + 0.1, 40],
          [lon + 0.1, 40.1],
          [lon, 40],
        ],
      ],
    },
    properties: {
      slug,
      name: slug,
      nta: slug,
      area_mi2: 1,
      borough,
      dogs: 100,
      people: 1000,
      homes: 400,
      dogs_per_1k: 100,
      dogs_per_100_homes: 25,
      density: 100,
      complaints: 10,
      complaints_barking: 4,
      complaints_waste: 3,
      complaints_leash: 3,
      complaints_per_100_dogs: 10,
      median_age: 6,
      top_breed: "Beagle",
      top_breed_share: 0.1,
      top_name: "Luna",
      top_name_share: 0.1,
      distinct_name: "Luna",
      distinct_name_lift: 1.2,
      distinct_breed: "Beagle",
      distinct_breed_lift: 1.4,
      lon,
      lat: 40.05,
    },
  };
}

function park(name: string, lon: number) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [lon, 40],
          [lon + 0.05, 40],
          [lon + 0.05, 40.05],
          [lon, 40],
        ],
      ],
    },
    properties: { name, kind: "park", mi2: 2, lon, lat: 40.02 },
  };
}

const loaded: Loaded = {
  hoods: {
    type: "FeatureCollection",
    features: [
      hood("greenpoint", "Brooklyn", -73.9),
      hood("tottenville", SUNK_BOROUGH, -74.2),
    ],
  },
  parks: {
    type: "FeatureCollection",
    features: [park("Prospect Park", -73.9), park("Great Kills", -74.2)],
  },
  subway: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [-73.9, 40],
            [-73.8, 40.1],
          ],
        },
        properties: { route: "G", name: "Crosstown" },
      },
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [-74.2, 40],
            [-74.1, 40.1],
          ],
        },
        properties: { route: "SIR", name: "Staten Island Railway" },
      },
    ],
  },
  stations: { type: "FeatureCollection", features: [] },
  rail: { type: "FeatureCollection", features: [] },
  railStops: { type: "FeatureCollection", features: [] },
  dogs: { type: "FeatureCollection", features: [] },
  details: {},
  matrix: {
    slugs: ["greenpoint", "tottenville"],
    names: {},
    breeds: {},
    dogs: [100, 100],
  },
  summary: {
    city_top_names: [{ label: "Luna", est: 100 }],
    city_top_breeds: [{ label: "Beagle", est: 100 }],
  } as Loaded["summary"],
  shelters: [
    { slug: "acc-brooklyn", borough: "Brooklyn" } as Loaded["shelters"][number],
    { slug: "acc-si", borough: SUNK_BOROUGH } as Loaded["shelters"][number],
  ],
};

describe("the world above water", () => {
  it("keeps every borough", () => {
    const world = worldOf(loaded, false);

    expect(world.hoods.features).toHaveLength(2);
    expect(world.parks.features).toHaveLength(2);
    expect(world.subway.features).toHaveLength(2);
    expect(world.shelters).toHaveLength(2);
    expect(world.sunk.under).toBe(false);
  });
});

describe("the world with a borough under water", () => {
  const world = worldOf(loaded, true);

  it("drops it from every set the map draws", () => {
    expect(world.hoods.features.map((f) => f.properties.slug)).toStrictEqual([
      "greenpoint",
    ]);
    expect(world.parks.features.map((f) => f.properties.name)).toStrictEqual([
      "Prospect Park",
    ]);
    expect(
      world.parkNames.features.map((f) => f.properties.name),
    ).toStrictEqual(["Prospect Park"]);
    expect(world.subway.features.map((f) => f.properties.route)).toStrictEqual([
      "G",
    ]);
    expect(world.shelters.map((s) => s.slug)).toStrictEqual(["acc-brooklyn"]);
    expect(world.riders.every((r) => r.slug !== "tottenville")).toBe(true);
  });

  it("refits the camera to what is left", () => {
    expect(worldOf(loaded, true).bounds[0]).toBeGreaterThan(
      worldOf(loaded, false).bounds[0],
    );
  });

  it("keeps the drowned land to draw as an island", () => {
    expect(world.sunk.under).toBe(true);
    expect(world.sunk.shapes.features.length).toBeGreaterThan(0);
    expect(world.sunk.center[0]).toBeLessThan(-74);
  });
});
