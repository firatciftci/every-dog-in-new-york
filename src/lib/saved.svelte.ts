import { browser } from "$app/env";
import type { Rival } from "#lib/compare.js";
import type { Filter } from "#lib/query.js";
import type { Part } from "#lib/sentence.js";
import type { Shared } from "#lib/share.js";
import type { HoodProperties } from "#lib/types.js";
import { boutOf, rivalName } from "#lib/compare.js";
import { layerDef } from "#lib/layers.js";
import { facetOfField, filterParts } from "#lib/query.js";
import { chip, place } from "#lib/sentence.js";

const STORE = "edny:saved";

type Saved = { q: string; at: number };

function read(): Array<Saved> {
  if (!browser) {
    return [];
  }

  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    if (!Array.isArray(raw)) {
      return [];
    }

    const out: Array<Saved> = [];
    for (const row of raw) {
      if (typeof row !== "object" || row == null) {
        continue;
      }

      const { q, at } = row as Record<string, unknown>;
      if (typeof at === "number" && typeof q === "string" && q.length > 0) {
        out.push({ q, at });
      }
    }

    return out.toSorted((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

function write(views: ReadonlyArray<Saved>) {
  if (!browser) {
    return;
  }

  try {
    localStorage.setItem(STORE, JSON.stringify(views));
  } catch {
    // Storage access throws in private mode and locked-down browsers.
  }
}

class Shelf {
  #views = $state<Array<Saved>>(read());

  get views(): ReadonlyArray<Saved> {
    return this.#views;
  }

  has(q: string) {
    return this.#views.some((view) => view.q === q);
  }

  toggle(q: string) {
    if (q.length === 0) {
      return;
    }

    this.#views = this.has(q)
      ? this.#views.filter((view) => view.q !== q)
      : [{ q, at: Date.now() }, ...this.#views];
    write(this.#views);
  }

  drop(q: string) {
    this.#views = this.#views.filter((view) => view.q !== q);
    write(this.#views);
  }

  clear() {
    this.#views = [];
    write(this.#views);
  }
}

export const shelf = new Shelf();

function rivalPart(rival: Rival, all: ReadonlyArray<HoodProperties>): Part {
  const label = rivalName(rival, all);

  return rival.kind === "breeds" || rival.kind === "names"
    ? chip(rival.kind, label)
    : place(label);
}

function isReading(filter: Filter) {
  return filter.kind === "in" && facetOfField(filter.field) != null;
}

export function askParts(
  state: Shared,
  all: ReadonlyArray<HoodProperties>,
): Array<Part> {
  const parts: Array<Part> = [];

  if (state.rivals.length >= 2) {
    const word = boutOf(state.rivals) === "subject" ? "vs" : "and";

    for (const [at, rival] of state.rivals.entries()) {
      if (at > 0) {
        parts.push(word);
      }

      parts.push(rivalPart(rival, all));
    }
  } else if (state.focus != null) {
    parts.push(
      state.focus.facet === "breeds" ? "Every" : "Every dog called",
      chip(state.focus.facet, state.focus.label),
    );
  } else if (state.filters.every((filter) => !isReading(filter))) {
    parts.push(layerDef(state.layer).label);
  }

  for (const filter of state.filters) {
    if (parts.length > 0) {
      parts.push(",");
    }

    parts.push(...filterParts(filter));
  }

  return parts;
}
