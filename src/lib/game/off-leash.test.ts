import { describe, expect, it } from "vitest";
import { offLeash } from "$lib/game/off-leash";
import { PARKS } from "$lib/game/parks";

const parks = Object.values(PARKS);

describe("the off-leash window", () => {
  it("ends on the hour in every park", () => {
    for (const park of parks) {
      const clock = offLeash(park, false);

      expect(clock.at(clock.gameSeconds)).toBe("9:00:00");
      expect(offLeash(park, true).at(clock.gameSeconds)).toBe("1:00:00");
    }
  });

  it("derives the run from the start, so the two cannot drift", () => {
    expect(offLeash(PARKS.central, false).seconds).toBe(90);
    expect(offLeash(PARKS.prospect, false).seconds).toBe(60);
    expect(offLeash(PARKS.central, false).minutes).toBe(3);
    expect(offLeash(PARKS.prospect, false).minutes).toBe(2);
  });

  it("opens at the park's own minute", () => {
    expect(offLeash(PARKS.central, false).at(0)).toBe("8:57:00");
    expect(offLeash(PARKS.prospect, false).at(0)).toBe("8:58:00");
    expect(offLeash(PARKS.central, true).at(0)).toBe("12:57:00");
  });

  it("runs the second hand at twice real time and stops at the hour", () => {
    const clock = offLeash(PARKS.central, false);

    expect(clock.tick(0)).toBe(0);
    expect(clock.tick(15)).toBe(30);
    expect(clock.at(clock.tick(15))).toBe("8:57:30");
    expect(clock.tick(1000)).toBe(clock.gameSeconds);
  });

  it("stamps a whole minute and rolls the hour with it", () => {
    const clock = offLeash(PARKS.central, false);

    expect(clock.stamp(0)).toBe("8:57");
    expect(clock.stamp(2)).toBe("8:59");
    expect(clock.stamp(3)).toBe("9:00");
    expect(offLeash(PARKS.central, true).stamp(3)).toBe("1:00");
  });

  it("says the hour one way", () => {
    expect(offLeash(PARKS.central, false).spoken).toBe("Nine o'clock");
    expect(offLeash(PARKS.central, true).spoken).toBe("One o'clock");
    expect(offLeash(PARKS.central, false).words).toBe("6 to 9 am");
    expect(offLeash(PARKS.central, true).words).toBe("9 pm to 1 am");
  });
});
