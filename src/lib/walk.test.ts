import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  HoodCollection,
  HoodProperties,
  Matrix,
  Summary,
} from "$lib/types";
import type { Doors } from "$lib/walk";
import { partsText, weave } from "$lib/sentence";
import { buildStops } from "$lib/walk";

const read = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;

const topo = read<{
  objects: Record<
    string,
    { geometries: Array<{ properties: HoodProperties }> }
  >;
}>("static/data/neighborhoods.topo.json");

const props = Object.values(topo.objects)[0]!.geometries.map(
  (g) => g.properties,
);

const hoods: HoodCollection = {
  type: "FeatureCollection",
  features: props.map((properties) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [] },
    properties,
  })),
};

const matrix = read<Matrix>("static/data/matrix.json");
const summary = read<Summary>("static/data/summary.json");

function doors(): Doors {
  return { goTo: vi.fn(), show: vi.fn(), narrow: vi.fn(), openMethod: vi.fn() };
}

const isAnyDog = () => true;
const noRange = () => null;

describe("the walk", () => {
  const stops = buildStops(hoods, matrix, summary, isAnyDog, noRange, doors());

  it("has a stop for every step of the tour", () => {
    expect(stops.length).toBeGreaterThan(3);
    expect(stops.every((stop) => stop.title.length > 0)).toBe(true);
  });

  it("fills every slot its prose asks for", () => {
    for (const stop of stops) {
      const parts = weave(stop.template, stop.slots);

      expect(partsText(parts).length).toBeGreaterThan(20);
      expect(partsText(parts)).not.toContain("{{");
    }
  });

  it("picks its place-by-place dogs only from the ones the map colors", () => {
    const colored = new Set(["Jindo", "Luna"]);
    const narrow = buildStops(
      hoods,
      matrix,
      summary,
      (_facet, label) => colored.has(label),
      noRange,
      doors(),
    );

    const perPlace = narrow.flatMap((stop) =>
      Object.entries(stop.slots)
        .filter(([key]) => /^[bn]\d+$/.test(key))
        .map(([, part]) => part),
    );

    expect(perPlace.length).toBeGreaterThan(0);
    for (const part of perPlace) {
      expect(typeof part === "string" ? "" : part.label).toSatisfy(
        (label: string) => colored.has(label),
      );
    }
  });

  it("opens a door behind a place", () => {
    const acts = doors();
    const built = buildStops(hoods, matrix, summary, isAnyDog, noRange, acts);
    const place = built
      .flatMap((stop) => Object.values(stop.slots))
      .find((part) => typeof part !== "string" && part.kind === "place");

    if (typeof place !== "string" && place?.go != null) {
      place.go();
    }

    expect(acts.goTo).toHaveBeenCalledOnce();
  });

  it("leaps to a reading the map can paint", () => {
    for (const stop of stops) {
      expect(stop.leap.layer.length).toBeGreaterThan(0);
      expect(Array.isArray(stop.leap.filters)).toBe(true);
    }
  });
});
