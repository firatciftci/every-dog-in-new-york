import { afterEach, describe, expect, it, vi } from "vitest";
import type { Line } from "#lib/trains.js";
import type { Rider } from "#lib/types.js";
import { crew, pointAt } from "#lib/trains.js";

const line: Line = {
  system: "subway",
  route: "G",
  bullet: "G",
  name: "Crosstown",
  color: "#6cbe45",
  path: [
    [-73.95, 40.7],
    [-73.94, 40.72],
  ],
  cum: [0, 2000],
  length: 2000,
  stops: [
    { name: "Greenpoint Av", at: 0, city: true },
    { name: "Nassau Av", at: 900, city: true },
    { name: "Metropolitan Av", at: 2000, city: true },
  ],
  signs: ["Court Sq", "Church Av"],
  bbox: [-73.95, 40.7, -73.94, 40.72],
};

const riders: Array<Rider> = [
  {
    slug: "greenpoint",
    hood: "Greenpoint",
    borough: "Brooklyn",
    lon: -73.95,
    lat: 40.7,
    breed: "Jindo",
    plate: "jindo",
    names: ["Luna"],
  },
];

const riding = crew(riders);

function carAt(at: number, dir: 1 | -1, next: number) {
  const car = riding.board(line, line.stops[0]!, 1, 1, { x: 0, y: 0 });
  car.at = at;
  car.dir = dir;
  car.next = next;
  car.dwell = 0;
  car.legs = 4;

  return car;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a car on the line", () => {
  it("boards with a dog from the nearest rider", () => {
    const car = riding.board(line, line.stops[0]!, 1, 7, { x: 12, y: 20 });

    expect(car.dog).toBe("Luna");
    expect(car.breed).toBe("Jindo");
    expect(car.hood).toBe("Greenpoint");
    expect(car.dest).toBe("Church Av");
    expect(car.origin).toBe("Court Sq");
    expect(car.seed).toBe("translate3d(12px, 20px, 0)");
  });

  it("waits at a platform before moving again", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const car = carAt(890, 1, 1);

    riding.step(car, 1, 20);

    expect(car.stop).toBe("Nassau Av");
    expect(car.halted).toBe(true);
    expect(car.dwell).toBeGreaterThan(0);
    expect(car.delay).toBeNull();

    const held = car.at;
    riding.step(car, 0.5, 20);

    expect(car.at).toBe(held);
  });

  it("runs late sometimes, and says why", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const car = carAt(890, 1, 1);

    riding.step(car, 1, 20);

    expect(car.delay).not.toBeNull();
    expect(car.dwell).toBeGreaterThan(6);
  });

  it("reverses at the end of the line and swaps its signs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const car = carAt(1990, 1, 2);
    const was = { dest: car.dest, origin: car.origin };

    riding.step(car, 1, 20);

    expect(car.dir).toBe(-1);
    expect(car.next).toBe(1);
    expect(car.dest).toBe(was.origin);
    expect(car.origin).toBe(was.dest);
    expect(car.dwell).toBeGreaterThanOrEqual(3);
  });

  it("never steps past the last platform it knows", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const car = carAt(1990, 1, 9);

    riding.step(car, 1, 20);

    expect(car.at).toBeGreaterThan(1990);
    expect(car.dir).toBe(1);
  });

  it("picks up a new dog at a city platform when its legs run out", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const car = carAt(890, 1, 1);
    car.legs = 1;
    car.dog = "";

    riding.step(car, 1, 20);

    expect(car.dog).toBe("Luna");
    expect(car.legs).toBeGreaterThan(0);
  });
});

describe("pointAt", () => {
  it("reads a coordinate off the run", () => {
    expect(pointAt(line, 0)).toStrictEqual([-73.95, 40.7]);
    expect(pointAt(line, 2000)[0]).toBeCloseTo(-73.94, 5);
  });
});
