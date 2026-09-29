<script lang="ts" module>
  import type { Detent, SheetGrip } from "$lib/types";

  export const DETENTS: ReadonlyArray<Detent> = ["shut", "peek", "full"];

  // 42px stud height plus 10px clearance from the bottom edge of the screen.
  const SHUT = 52;

  const TOP_INSET = 56;

  const FLICK = 0.35;

  const RUBBER = 0.28;
  const STRETCH = 44;

  function give(over: number) {
    const pull = over * RUBBER;

    return pull / (1 + pull / STRETCH);
  }

  // iOS sheet curve.
  const CURVE = "cubic-bezier(0.32, 0.72, 0, 1)";

  // Below this the visual viewport shortfall is browser chrome, not a keyboard.
  const KEYS = 96;

  function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v));
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, untrack } from "svelte";
  import { on } from "svelte/events";
  import { MediaQuery } from "svelte/reactivity";

  let {
    detent,
    onrest,
    head,
    children,
  }: {
    detent: Detent;
    onrest?: (next: Detent) => void;
    head: Snippet<[SheetGrip]>;
    children: Snippet;
  } = $props();

  let root = $state<HTMLElement | null>(null);
  let mast = $state<HTMLElement | null>(null);
  let box = $state(0);
  // iOS shrinks the visual viewport for the keyboard but not the layout viewport.
  let lift = $state(0);
  let safe = $state(0);
  let headH = $state(184);
  let height = $state(0);
  let dragging = $state(false);
  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  const room = $derived(Math.max(0, box - lift));

  const stops = $derived.by(() => {
    const full = Math.max(260, room - TOP_INSET);

    return {
      shut: SHUT + safe,
      peek: clamp(headH + safe, 116, Math.round(room * 0.55)),
      full,
    };
  });

  $effect(() => {
    if (root == null) {
      return;
    }

    safe = Math.max(
      0,
      Number.parseFloat(getComputedStyle(root).paddingBottom) -
        untrack(() => lift),
    );
  });

  let draggedAt = 0;

  const shut = $derived(detent === "shut");
  const ease = $derived(dragging || calm.current ? "0ms" : "380ms");
  const label = $derived(
    detent === "full"
      ? "Collapse the panel"
      : shut
        ? "Open the panel"
        : "Expand the panel",
  );

  let following = 0;
  let lifted = 0;

  $effect(() => {
    const to = stops[detent];
    if (dragging) {
      return;
    }

    const node = root;
    const from = untrack(() => height);
    height = to;

    const keyboard = lift !== lifted;
    lifted = lift;

    cancelAnimationFrame(following);
    const list = node?.querySelector<HTMLElement>("[data-sheet-scroll]");
    if (node == null || list == null || to > from - 1 || shut || keyboard) {
      return;
    }

    const base = list.scrollTop;
    const follow = () => {
      const now = node.getBoundingClientRect().height - lift;
      list.scrollTop = base + (from - now);
      if (Math.abs(now - to) > 0.5) {
        following = requestAnimationFrame(follow);
      }
    };
    following = requestAnimationFrame(follow);

    return () => {
      cancelAnimationFrame(following);
    };
  });

  function onwards(h: number, up: boolean): Detent {
    if (up) {
      return DETENTS.find((d) => stops[d] > h + 1) ?? "full";
    }

    return DETENTS.findLast((d) => stops[d] < h - 1) ?? "shut";
  }

  $effect(() => {
    const parent = root?.parentElement;
    if (parent == null) {
      return;
    }

    parent.style.setProperty("--sheet", `${Math.round(height)}px`);
    parent.style.setProperty("--sheet-ms", ease);

    return () => {
      parent.style.removeProperty("--sheet");
      parent.style.removeProperty("--sheet-ms");
    };
  });

  function nearest(h: number): Detent {
    let best: Detent = "peek";
    for (const name of DETENTS) {
      if (Math.abs(stops[name] - h) < Math.abs(stops[best] - h)) {
        best = name;
      }
    }

    return best;
  }

  function settle(next: Detent) {
    dragging = false;
    height = stops[next];
    onrest?.(next);
  }

  // $effect.pre: after the DOM update the focus is already gone.
  $effect.pre(() => {
    if (!shut) {
      return;
    }

    const held = document.activeElement;
    if (root?.contains(held) === true && mast?.contains(held) !== true) {
      mast
        ?.querySelector<HTMLElement>("button")
        ?.focus({ preventScroll: true });
    }
  });

  function step() {
    // A drag on the masthead ends in a click; a time window survives a swallowed click, a flag would not.
    if (performance.now() - draggedAt < 400) {
      return;
    }

    settle(detent === "peek" ? "full" : "peek");
  }

  // The scroller remounts on every pane turn, so it is looked up per gesture.
  function scrollerNow() {
    return root?.querySelector<HTMLElement>("[data-sheet-scroll]") ?? null;
  }

  const HOLDS = '[role="slider"], input, select, textarea, [data-holds-scroll]';

  type Grab = {
    x: number;
    y: number;
    h: number;
    // Decided on the first move only; re-deciding mid-drag makes the sheet and the list fight.
    own: "sheet" | "scroll" | null;
    lastY: number;
    lastT: number;
    vy: number;
  };

  let grab: Grab | null = null;

  function begin(x: number, y: number, from: EventTarget | null) {
    const on = from instanceof Element ? from : null;
    const held = on?.closest(HOLDS) != null;
    const inList = on?.closest("[data-sheet-scroll]") != null;
    grab = {
      x,
      y,
      h: height,
      own: held ? "scroll" : inList ? null : "sheet",
      lastY: y,
      lastT: performance.now(),
      vy: 0,
    };

    if (grab.own === "sheet") {
      dragging = true;
    }
  }

  function move(x: number, y: number) {
    if (grab == null) {
      return false;
    }

    const dy = y - grab.y;

    if (grab.own == null) {
      const dx = x - grab.x;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) {
        return false;
      }

      const atTop = (scrollerNow()?.scrollTop ?? 0) <= 0;
      grab.own =
        Math.abs(dx) > Math.abs(dy) ||
        (height >= stops.full - 1 && !(dy > 0 && atTop))
          ? "scroll"
          : "sheet";
      dragging = grab.own === "sheet";
    }

    if (grab.own === "scroll") {
      return false;
    }

    const now = performance.now();
    if (now > grab.lastT) {
      grab.vy = (y - grab.lastY) / (now - grab.lastT);
      grab.lastY = y;
      grab.lastT = now;
    }

    if (Math.abs(dy) > 4) {
      draggedAt = now;
    }

    const raw = grab.h - dy;
    height =
      raw > stops.full
        ? stops.full + give(raw - stops.full)
        : raw < stops.shut
          ? stops.shut - give(stops.shut - raw)
          : raw;

    return true;
  }

  function release() {
    if (grab == null) {
      return;
    }

    const { own, vy } = grab;
    grab = null;
    if (own !== "sheet") {
      return;
    }

    if (Math.abs(vy) > FLICK) {
      settle(onwards(height, vy < 0));

      return;
    }

    settle(nearest(height));
  }

  onMount(() => {
    const node = root;
    if (node == null) {
      return;
    }

    const parent = node.parentElement;
    const sized = new ResizeObserver(() => {
      box = parent?.clientHeight ?? window.innerHeight;
    });
    if (parent != null) {
      sized.observe(parent);
    }
    box = parent?.clientHeight ?? window.innerHeight;

    // Svelte-delegated touchmove is passive at the document root; attach by hand so preventDefault works.
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length === 1 && touch != null) {
        begin(touch.clientX, touch.clientY, e.target);
      }
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch != null && move(touch.clientX, touch.clientY) && e.cancelable) {
        e.preventDefault();
      }
    };

    const off = [
      on(node, "touchstart", onStart, { passive: true }),
      on(node, "touchmove", onMove, { passive: false }),
      on(node, "touchend", release, { passive: true }),
      on(node, "touchcancel", release, { passive: true }),
    ];

    const onGrip = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
      }

      begin(event.clientX, event.clientY, event.target);
      const stop = [
        on(window, "pointermove", (e) => {
          move(e.clientX, e.clientY);
        }),
        on(window, "pointerup", () => {
          release();
          for (const end of stop) {
            end();
          }
        }),
      ];
    };
    if (mast != null) {
      off.push(on(mast, "pointerdown", onGrip));
    }

    // iOS scrolls the page for the keyboard; undo that and take the keyboard's room off the box instead.
    const port = window.visualViewport;
    const measure = () => {
      if (port == null || parent == null) {
        return;
      }

      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }

      const foot = parent.getBoundingClientRect().bottom;
      const under = Math.round(foot - port.offsetTop - port.height);
      lift = under < KEYS ? 0 : under;
    };
    if (port != null) {
      off.push(
        on(port, "resize", measure),
        on(port, "scroll", measure),
        on(window, "scroll", measure),
      );
    }

    return () => {
      sized.disconnect();
      for (const end of off) {
        end();
      }
    };
  });
</script>

<!-- overflow-clip, not hidden: a scroll container here lets iOS scroll the head out of frame to reveal a focused input, and nothing can scroll it back. -->
<section
  bind:this={root}
  aria-label="Panel"
  style:height="{height + lift}px"
  style:padding-bottom="calc({lift}px + env(safe-area-inset-bottom))"
  style:transition="height {ease}
  {CURVE}"
  class="absolute inset-x-0 bottom-0 z-40 flex touch-none flex-col overflow-clip paper shadow-[0_-10px_28px_rgb(58_48_38/0.18)] dark:shadow-[0_-10px_28px_rgb(0_0_0/0.6)]"
>
  <div bind:this={mast} bind:clientHeight={headH} class="relative shrink-0">
    {@render head({ step, detent, label })}
  </div>

  <div class="flex min-h-0 flex-1 flex-col" inert={shut}>
    {@render children()}
  </div>
</section>
