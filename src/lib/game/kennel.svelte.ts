import { browser } from "$app/env";
import type { Kennel, ParkId } from "#lib/game/parks.js";
import { todayKey, yesterdayKey } from "#lib/game/parks.js";

const STORE = "edny:kennel";

const EMPTY: Kennel = {
  best: { central: 0, prospect: 0 },
  tags: { central: [], prospect: [] },
  plays: { central: 0, prospect: 0 },
  streak: { last: "", count: 0 },
  dog: "",
};

function read(): Kennel {
  if (!browser) {
    return structuredClone(EMPTY);
  }

  try {
    const raw = localStorage.getItem(STORE);
    if (raw == null) {
      return structuredClone(EMPTY);
    }

    const held = JSON.parse(raw) as Partial<Kennel>;

    return {
      best: { ...EMPTY.best, ...held.best },
      tags: { ...EMPTY.tags, ...held.tags },
      plays: { ...EMPTY.plays, ...held.plays },
      streak: { ...EMPTY.streak, ...held.streak },
      dog: held.dog ?? "",
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

/**
 * The one holder of what a player has done. Both the arena and the park notice read
 * this book, so a run recorded in one shows up in the other without a remount.
 */
class Book {
  #held = $state<Kennel>(read());

  #keep() {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.#held));
    } catch {
      // Storage access throws in private mode and locked-down browsers.
    }
  }

  get dog() {
    return this.#held.dog;
  }

  set dog(breed: string) {
    this.#held.dog = breed;
    this.#keep();
  }

  best(id: ParkId) {
    return this.#held.best[id];
  }

  plays(id: ParkId) {
    return this.#held.plays[id];
  }

  earned(id: ParkId): ReadonlySet<string> {
    return new Set(this.#held.tags[id]);
  }

  get streak() {
    return this.#held.streak.count;
  }

  record(
    id: ParkId,
    score: number,
    earned: Iterable<string>,
    isDaily: boolean,
  ) {
    const book = this.#held;
    const isNewBest = score > book.best[id];
    book.best[id] = Math.max(book.best[id], score);
    book.plays[id] += 1;

    const before = new Set(book.tags[id]);
    const fresh = [...earned].filter((tag) => !before.has(tag));
    book.tags[id] = [...before, ...fresh];

    if (isDaily) {
      const today = todayKey();
      if (book.streak.last !== today) {
        book.streak = {
          last: today,
          count:
            book.streak.last === yesterdayKey() ? book.streak.count + 1 : 1,
        };
      }
    }

    this.#keep();

    return { isNewBest, fresh, streak: book.streak.count };
  }
}

export const kennel = new Book();
