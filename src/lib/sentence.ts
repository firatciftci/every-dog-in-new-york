import type { Facet, Pointing } from "$lib/types";

export type Part =
  | string
  | { kind: "chip"; facet: Facet; label: string; go?: () => void }
  | { kind: "place"; label: string; go?: () => void; point?: Pointing }
  | { kind: "figure"; label: string; go?: () => void }
  | {
      kind: "dial";
      label: string;
      name: string;
      value: number;
      min: number;
      max: number;
      step: number;
      format: (v: number) => string;
      set: (v: number) => void;
    };

export function chip(facet: Facet, label: string, go?: () => void): Part {
  return { kind: "chip", facet, label, go };
}

export function place(label: string, go?: () => void, point?: Pointing): Part {
  return { kind: "place", label, go, point };
}

export function figure(label: string, go?: () => void): Part {
  return { kind: "figure", label, go };
}

export function dial(
  name: string,
  value: number,
  range: { min: number; max: number; step: number },
  format: (v: number) => string,
  set: (v: number) => void,
): Part {
  return {
    kind: "dial",
    label: format(value),
    name,
    value,
    ...range,
    format,
    set,
  };
}

/* "{{lab}} leads {{n}} of {{total}} neighborhoods." with a part for every slot, so the prose can be edited as one string. */
export function weave(
  template: string,
  slots: Record<string, Part>,
): Array<Part> {
  const out: Array<Part> = [];
  for (const piece of template.split(/(\{\{\w+\}\})/)) {
    const key = /^\{\{(\w+)\}\}$/.exec(piece)?.[1];
    if (key != null) {
      const part = slots[key];
      if (part === undefined) {
        throw new Error(`No part for {{${key}}}.`);
      }

      out.push(part);
    } else if (piece.trim().length > 0) {
      out.push(piece.trim());
    }
  }

  return out;
}

export function isGlued(part: Part) {
  return typeof part === "string" && /^[,.;:!?)\]}…’']/.test(part);
}

export function partsText(parts: ReadonlyArray<Part>) {
  let out = "";

  for (const part of parts) {
    const word = typeof part === "string" ? part : part.label;
    out += out.length > 0 && !isGlued(part) ? ` ${word}` : word;
  }

  return out;
}
