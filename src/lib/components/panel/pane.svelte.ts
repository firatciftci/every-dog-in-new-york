import { mode } from "mode-watcher";
import type { Painted } from "$lib/layers";
import type { HoodDetail, PaintedProperties, Shelter } from "$lib/types";
import { explorer } from "$lib/state.svelte";

export function paneOf(
  read: () => {
    painted: Painted;
    selected: PaintedProperties | null;
    detail: HoodDetail | null;
    shelters: Array<Shelter>;
  },
) {
  const painted = $derived(read().painted);
  const selected = $derived(read().selected);
  const detail = $derived(read().detail);

  const here = $derived(
    read().shelters.filter((place) => place.hood === selected?.slug),
  );

  const isFiltering = $derived(
    explorer.filters.length > 0 ||
      explorer.focus != null ||
      explorer.rivals.length > 0,
  );

  const isVersus = $derived(explorer.bout === "subject");
  const isComparing = $derived(explorer.bout != null);
  const theme = $derived<"light" | "dark">(
    mode.current === "dark" ? "dark" : "light",
  );

  const isOpen = $derived(selected != null && detail != null);
  const isShowing = $derived(isOpen && explorer.tab === "place");
  const pane = $derived(
    isShowing && selected != null
      ? `hood:${selected.slug}`
      : isFiltering
        ? "city:asked"
        : "city",
  );

  const place = $derived.by(() => {
    if (!isShowing || selected == null) {
      return -1;
    }

    const at = painted.standing.findIndex((p) => p.slug === selected.slug);

    return at === -1 ? painted.standing.length : at;
  });

  let depth = $state(-1);
  let isBack = $state(false);
  let isSameCard = $state(false);

  // $effect.pre: a plain $effect runs after the pane rebuilds, so the entry transition reads the old value.
  $effect.pre(() => {
    const next = place;
    isBack = next < depth;
    isSameCard = next < 0 && depth < 0;
    depth = next;
  });

  const enter = $derived(isBack ? -34 : 34);

  const turn = $derived(
    isSameCard
      ? { x: 0, out: 250, in: 250, delay: 0 }
      : { x: enter, out: 200, in: 260, delay: 60 },
  );

  let lost: string | null = null;

  const refocus = (node: HTMLElement) => {
    if (lost == null) {
      return;
    }

    const want = lost;
    lost = null;
    const again = [
      ...node.querySelectorAll<HTMLElement>("button, a[href], input"),
    ].find(
      (el) => (el.getAttribute("aria-label") ?? el.textContent.trim()) === want,
    );
    (again ?? node).focus({ preventScroll: true });
  };

  $effect.pre(() => {
    void pane;
    const now = document.activeElement;
    const isInside =
      document.querySelector("#rail-pane")?.contains(now) ?? false;
    lost =
      isInside && now instanceof HTMLElement
        ? (now.getAttribute("aria-label") ?? now.textContent.trim())
        : null;
  });

  return {
    get here() {
      return here;
    },
    get filtering() {
      return isFiltering;
    },
    get versus() {
      return isVersus;
    },
    get comparing() {
      return isComparing;
    },
    get theme() {
      return theme;
    },
    get open() {
      return isOpen;
    },
    get showing() {
      return isShowing;
    },
    get pane() {
      return pane;
    },
    get turn() {
      return turn;
    },
    refocus,
  };
}
