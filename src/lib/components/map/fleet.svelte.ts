import type { Car } from "#lib/trains.js";

export const fleet = $state<Array<Car>>([]);

export function carUnder(at: { x: number; y: number }) {
  for (let i = fleet.length - 1; i >= 0; i--) {
    const car = fleet[i]!;
    if (!car.live || car.w === 0) {
      continue;
    }

    const turn = (-car.lean * Math.PI) / 180;
    const dx = (at.x - car.sx) / car.scale;
    const dy = (at.y - car.sy) / car.scale;
    const x = dx * Math.cos(turn) - dy * Math.sin(turn);
    const y = dx * Math.sin(turn) + dy * Math.cos(turn);

    if (Math.abs(x) < car.w / 2 + 4 && y < 4 && y > -car.h - 4) {
      return car;
    }
  }

  return null;
}
