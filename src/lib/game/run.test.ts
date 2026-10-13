import { describe, expect, it } from "vitest";
import type { GameEvent } from "#lib/game/events.js";
import { DashGame } from "#lib/game/dash.js";
import { offLeash } from "#lib/game/off-leash.js";
import { PARKS } from "#lib/game/parks.js";
import { WalkerGame } from "#lib/game/walker.js";

function record() {
  const log: Array<GameEvent> = [];

  return {
    log,
    emit: (event: GameEvent) => {
      log.push(event);
    },
  };
}

function play(game: { update: (dt: number) => void; over: boolean }, of = 200) {
  for (let i = 0; i < of && !game.over; i += 1) {
    game.update(1 / 60);
  }
}

describe("a run, stepped with no canvas", () => {
  it("walks the pack until it is over, and never past the hour", () => {
    const { log, emit } = record();
    const clock = offLeash(PARKS.central, false);
    const game = new WalkerGame(
      7,
      [{ breed: "Beagle", name: "Luna" }],
      ["Coco", "Teddy"],
      () => null,
      emit,
      clock,
    );

    expect(game.gameSeconds).toBe(0);

    play(game, 60 * 120);

    expect(game.over).toBe(true);
    expect(game.gameSeconds).toBeLessThanOrEqual(clock.gameSeconds);
    expect(log.some((e) => e.type === "over")).toBe(true);
    expect(game.miles).toBeGreaterThan(0);
  });

  it("stamps each minute of the walk once, in order", () => {
    const { log, emit } = record();
    const game = new WalkerGame(
      7,
      [
        { breed: "Beagle", name: "Luna" },
        { breed: "Beagle", name: "Coco" },
        { breed: "Beagle", name: "Teddy" },
      ],
      ["Bo"],
      () => null,
      emit,
      offLeash(PARKS.central, false),
    );

    play(game, 60 * 120);

    const stamps = log
      .filter((e) => e.type === "banner")
      .map((e) => e.text.split(" · ", 1)[0]);

    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps).toStrictEqual(["8:58", "8:59"].slice(0, stamps.length));
  });

  it("runs the dash to the hour and scores what it collected", () => {
    const { emit } = record();
    const clock = offLeash(PARKS.prospect, true);
    const game = new DashGame("Luna", 12, emit, clock);

    play(game, 60 * 120);

    expect(game.over).toBe(true);
    expect(game.gameSeconds).toBe(clock.gameSeconds);
    expect(game.spare).toBe(0);
    expect(Number.isFinite(game.score)).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const clock = offLeash(PARKS.prospect, false);
    const runs = [12, 12, 13].map((seed) => {
      const game = new DashGame("Luna", seed, () => {}, clock);
      play(game, 60 * 40);

      return { score: game.score, miles: game.miles };
    });

    expect(runs[0]).toStrictEqual(runs[1]);
    expect(runs[2]).not.toStrictEqual(runs[0]);
  });
});
