import { describe, expect, it } from "vitest";
import type { HoodProperties } from "$lib/types";
import { cityRate, rankIn, totals } from "$lib/rate";

const HOOD: HoodProperties = {
  slug: "x",
  name: "X",
  borough: "Manhattan",
  lon: 0,
  lat: 0,
  dogs: 0,
  people: 0,
  homes: 0,
  area_mi2: 0,
  complaints: 0,
} as HoodProperties;

describe("totals", () => {
  it("sums the parts and divides once", () => {
    const sum = totals([
      {
        ...HOOD,
        dogs: 100,
        people: 2000,
        homes: 500,
        area_mi2: 2,
        complaints: 10,
      },
      {
        ...HOOD,
        dogs: 50,
        people: 1000,
        homes: 250,
        area_mi2: 1,
        complaints: 5,
      },
    ]);

    expect(sum.dogs).toBe(150);
    expect(sum.perHome).toBeCloseTo(20, 10);
    expect(sum.perThousand).toBeCloseTo(50, 10);
    expect(sum.density).toBeCloseTo(50, 10);
    expect(sum.perHundredDogs).toBeCloseTo(10, 10);
  });

  it("reads an empty denominator as zero rather than dividing", () => {
    const sum = totals([HOOD]);

    expect(sum.perHome).toBe(0);
    expect(sum.perThousand).toBe(0);
    expect(sum.density).toBe(0);
    expect(sum.perHundredDogs).toBe(0);
  });
});

describe("cityRate", () => {
  it("weights each neighborhood by its dogs", () => {
    const rate = cityRate(
      [
        { ...HOOD, dogs: 90 },
        { ...HOOD, dogs: 10 },
      ],
      (p) => (p.dogs === 90 ? 1 : 11),
    );

    expect(rate).toBeCloseTo(2, 10);
  });
});

describe("rankIn", () => {
  it("counts the values strictly above", () => {
    expect(rankIn([5, 4, 3], 5)).toBe(1);
    expect(rankIn([5, 4, 3], 3)).toBe(3);
  });

  it("gives tied values the same rank", () => {
    expect(rankIn([5, 4, 4, 1], 4)).toBe(2);
  });
});
