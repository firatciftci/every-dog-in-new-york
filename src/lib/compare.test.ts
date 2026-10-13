import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HoodProperties, Matrix } from "#lib/types.js";
import { ledgers } from "#lib/compare.js";
import { FACET_FIELDS, FACETS } from "#lib/types.js";

const shipped = JSON.parse(
  readFileSync("static/data/neighborhoods.topo.json", "utf8"),
) as {
  objects: Record<
    string,
    { geometries: Array<{ properties: HoodProperties }> }
  >;
};

const city = Object.values(shipped.objects)[0]!.geometries.map(
  (g) => g.properties,
);

const matrix = JSON.parse(
  readFileSync("static/data/matrix.json", "utf8"),
) as Matrix;

const weightOf = (lift: number) =>
  lift >= 1.15 ? "over" : lift >= 0.85 ? "level" : "under";

const book = ledgers(
  city,
  city,
  matrix,
  city.map((p) => ({ kind: "hood", slug: p.slug, label: p.slug }) as const),
  0,
);

describe("the bout agrees with the pipeline about a lift", () => {
  for (const facet of FACETS) {
    const { distinct, lift: liftField } = FACET_FIELDS[facet];

    it(`reproduces every shipped ${facet} lift within 0.05`, () => {
      let worst = 0;
      let sum = 0;
      let n = 0;

      for (const [at, p] of city.entries()) {
        const label = p[distinct];
        const mine = book[at]?.lifts[facet].get(label ?? "");
        if (label == null || mine === undefined) {
          continue;
        }

        const gap = Math.abs(mine - p[liftField]);
        worst = Math.max(worst, gap);
        sum += gap;
        n += 1;
      }

      expect(n).toBeGreaterThan(100);
      expect(worst).toBeLessThan(0.05);
      expect(sum / n).toBeLessThan(0.015);
    });
  }

  it("keeps every breed in the weight class the pipeline gave it", () => {
    const missed = city.filter((p, at) => {
      const mine = book[at]?.lifts.breeds.get(p.distinct_breed ?? "");

      return (
        mine !== undefined && weightOf(mine) !== weightOf(p.distinct_breed_lift)
      );
    });

    expect(missed).toHaveLength(0);
  });

  it("divides a breed by the dogs with a breed on file, never by every dog", () => {
    const one = ledgers(
      city,
      city,
      matrix,
      [{ kind: "hood", slug: "greenpoint", label: "greenpoint" }],
      0,
    )[0]!;
    const jindo = one.lifts.breeds.get("Jindo");

    expect(jindo).toBeGreaterThan(2.5);
  });
});

describe("a rival that the filters excluded", () => {
  it("still carries its proper name", () => {
    const kept = city.filter((p) => p.slug !== "greenpoint");
    const [ledger] = ledgers(
      kept,
      city,
      matrix,
      [{ kind: "hood", slug: "greenpoint", label: "greenpoint" }],
      0,
    );

    expect(ledger?.label).toBe("Greenpoint");
  });
});
