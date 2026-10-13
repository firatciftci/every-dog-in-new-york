import { browser } from "$app/env";
import { createSubscriber } from "svelte/reactivity";

const subscribe = createSubscriber((update) => {
  const resize = new ResizeObserver(update);
  const rootStyle = new MutationObserver(update);
  resize.observe(document.body);
  rootStyle.observe(document.documentElement, { attributeFilter: ["style"] });

  return () => {
    resize.disconnect();
    rootStyle.disconnect();
  };
});

export function rootFontSize(): number {
  if (!browser) {
    return 16;
  }

  subscribe();

  return Number(
    getComputedStyle(document.documentElement).fontSize.slice(0, -2),
  );
}

/** Matches the @max-[55rem]: container query on body, which follows the text size. */
export function isNarrowLayout(): boolean {
  if (!browser) {
    return true;
  }

  return document.body.clientWidth < 55 * rootFontSize();
}
