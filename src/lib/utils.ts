import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge<"interaction-lift">({
  extend: {
    classGroups: {
      "interaction-lift": [
        "hover-none",
        "hover-xs",
        "hover-sm",
        "hover-md",
        "hover-lg",
        "raise-none",
        "raise-xs",
        "raise-sm",
        "raise-md",
        "raise-lg",
      ],
    },
  },
});

// eslint-disable-next-line ts/no-explicit-any
type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
type WithoutChildren<T> =
  // eslint-disable-next-line ts/no-explicit-any
  T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

export function tw(strings: TemplateStringsArray, ...values: Array<unknown>) {
  let classString = "";

  for (const [index, string] of strings.entries()) {
    classString += string;
    if (index < values.length) {
      classString += String(values[index] ?? "");
    }
  }

  return classString.trim();
}
const PLAIN = new Intl.NumberFormat("en-US");

export function count(n: number) {
  return PLAIN.format(Math.round(n));
}

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) {
    return `${n}th`;
  }

  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function lift(x: number) {
  return `${x.toFixed(1)} times`;
}
