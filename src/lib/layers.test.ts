import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Filter } from "$lib/query";
import type { HoodCollection, HoodProperties, Matrix, View } from "$lib/types";
import { cut, layerDef } from "$lib/layers";

const topo = JSON.parse(
  readFileSync("static/data/neighborhoods.topo.json", "utf8"),
) as {
  objects: Record<
    string,
    { geometries: Array<{ properties: HoodProperties }> }
  >;
};

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

const matrix = JSON.parse(
  readFileSync("static/data/matrix.json", "utf8"),
) as Matrix;

const breeds: View = { kind: "layer", layer: "breed" };

describe("cut", () => {
  it("paints every neighborhood and keeps them all standing", () => {
    const painted = cut(hoods, matrix, breeds, [], "light");

    expect(painted.marks).toHaveLength(props.length);
    expect(painted.marks.every((p) => p.fill.startsWith("#"))).toBe(true);
    expect(painted.standing).toHaveLength(props.length);
    expect(painted.legend.length).toBeGreaterThan(1);
  });

  it("sorts the standing set by the reading", () => {
    const painted = cut(hoods, matrix, breeds, [], "light");
    const ranks = painted.standing.map((p) => painted.rank(p));

    expect(ranks).toStrictEqual([...ranks].toSorted((a, b) => b - a));
  });

  it("grays what the filters exclude and leaves the color scale alone", () => {
    const filters: Array<Filter> = [
      { kind: "in", field: "borough", values: ["Manhattan"], negate: false },
    ];
    const open = cut(hoods, matrix, breeds, [], "light");
    const held = cut(hoods, matrix, breeds, filters, "light");

    const dimmed = held.marks.filter((p) => p.dim);

    expect(dimmed.length).toBeGreaterThan(0);
    expect(held.standing.length).toBe(props.length - dimmed.length);
    expect(held.standing.every((p) => p.borough === "Manhattan")).toBe(true);
    expect(held.legend.map((row) => row.color)).toStrictEqual(
      open.legend.map((row) => row.color),
    );
  });

  it("reads a focus as a rate against the city", () => {
    const painted = cut(
      hoods,
      matrix,
      { kind: "focus", focus: { facet: "breeds", label: "Jindo" } },
      [],
      "light",
    );

    expect(painted.kind).toBe("sequential");
    expect(painted.marks.some((p) => painted.rank(p) > 0)).toBe(true);
  });

  it("falls back to the default reading when a link carries a breed nobody has", () => {
    const painted = cut(
      hoods,
      matrix,
      { kind: "focus", focus: { facet: "breeds", label: "Labradore" } },
      [],
      "light",
    );

    expect(painted.kind).toBe("categorical");
    expect(painted.caption).toBe(layerDef("breed").caption);
    expect(painted.marks.every((p) => p.fill.startsWith("#"))).toBe(true);
  });

  it("changes its signature only when the reading or the filters change", () => {
    const first = cut(hoods, matrix, breeds, [], "light");
    const again = cut(hoods, matrix, breeds, [], "dark");
    const other = cut(
      hoods,
      matrix,
      { kind: "layer", layer: "dogs" },
      [],
      "light",
    );

    expect(again.signature).toBe(first.signature);
    expect(other.signature).not.toBe(first.signature);
  });
});
