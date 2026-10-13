import { browser } from "$app/env";
import type { Everyone } from "#lib/types.js";

const STORE = "edny:dog";

export const COLLARS = [
  { key: "red", color: "#c4412f" },
  { key: "blue", color: "#2f6ea6" },
  { key: "green", color: "#3f7d4b" },
  { key: "pink", color: "#d2708f" },
  { key: "gold", color: "#d6a21f" },
] as const;

export type Collar = (typeof COLLARS)[number]["key"];

export type Pet = {
  id: string;
  name: string;
  breed: string;
  slug: string;
  born: number;
  collar: Collar;
};

export const FIRST_BORN = 2006;

export const NAME_LONGEST = 20;

export function newId() {
  return `dog-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function collarOf(key: Collar) {
  return COLLARS.find((c) => c.key === key)?.color ?? COLLARS[0].color;
}

/**
 * The pipeline's clean_name: the license file stores names in capitals.
 */
export function nameKey(name: string) {
  const upper = name.trim().toUpperCase();

  return upper.slice(0, 1) + upper.slice(1).toLowerCase();
}

function check(raw: unknown, at: number): Pet | null {
  if (typeof raw !== "object" || raw == null) {
    return null;
  }

  const { id, name, breed, slug, born, collar } = raw as Record<
    string,
    unknown
  >;
  if (
    typeof name !== "string" ||
    typeof breed !== "string" ||
    typeof slug !== "string" ||
    typeof born !== "number" ||
    name.trim().length === 0
  ) {
    return null;
  }

  return {
    id: typeof id === "string" ? id : `dog-${at}`,
    name: name.trim().slice(0, NAME_LONGEST),
    breed,
    slug,
    born,
    collar: COLLARS.find((c) => c.key === collar)?.key ?? "red",
  };
}

// The first build kept one dog as a bare object; a list reads both.
function read(): Array<Pet> {
  if (!browser) {
    return [];
  }

  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    const rows: Array<unknown> = Array.isArray(raw) ? raw : [raw];
    const out: Array<Pet> = [];
    for (const [at, row] of rows.entries()) {
      const dog = check(row, at);
      if (dog != null) {
        out.push(dog);
      }
    }

    return out;
  } catch {
    return [];
  }
}

class Kennel {
  #dogs = $state<Array<Pet>>(read());
  #active = $state<string | null>(null);

  #write() {
    if (!browser) {
      return;
    }

    try {
      localStorage.setItem(STORE, JSON.stringify(this.#dogs));
    } catch {
      // Storage access throws in private mode and locked-down browsers.
    }
  }

  get dogs(): ReadonlyArray<Pet> {
    return this.#dogs;
  }

  /**
   * The dog whose card is open, or the first one.
   */
  get dog(): Pet | null {
    return (
      this.#dogs.find((d) => d.id === this.#active) ?? this.#dogs[0] ?? null
    );
  }

  choose(id: string) {
    this.#active = id;
  }

  keep(dog: Pet) {
    this.#dogs = this.#dogs.some((d) => d.id === dog.id)
      ? this.#dogs.map((d) => (d.id === dog.id ? dog : d))
      : [...this.#dogs, dog];
    this.#active = dog.id;
    this.#write();
  }

  release(id: string) {
    this.#dogs = this.#dogs.filter((d) => d.id !== id);
    if (this.#active === id) {
      this.#active = null;
    }
    this.#write();
  }
}

export const pet = new Kennel();

const names: { pending: Promise<Everyone | null> | null } = { pending: null };

async function load() {
  try {
    const r = await fetch("/data/names.json");

    return r.ok ? ((await r.json()) as Everyone) : null;
  } catch {
    return null;
  }
}

export async function everyone() {
  names.pending ??= load();

  return names.pending;
}
