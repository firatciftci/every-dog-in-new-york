<script lang="ts" module>
  import { cubicOut, expoOut } from "svelte/easing";

  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function open(
    node: Element,
    { from, calm }: { from: DOMRect | null; calm: boolean },
  ) {
    if (calm) {
      return { duration: 160, css: (t: number) => `opacity:${t}` };
    }

    if (from == null) {
      return {
        duration: 300,
        easing: cubicOut,
        css: (t: number, u: number) =>
          `transform:translateY(${u * 18}px);opacity:${t}`,
      };
    }

    const to = node.getBoundingClientRect();
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + (to.height * scale) / 2 - (to.top + to.height / 2);

    return {
      duration: 420,
      easing: expoOut,
      css: (t: number, u: number) =>
        `transform:translate(${u * dx}px,${u * dy}px) scale(${1 - u * (1 - scale)});` +
        `opacity:${Math.min(1, t * 2.4)}`,
    };
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { XIcon } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { fade, fly } from "svelte/transition";
  import { scrollEdges } from "$lib/scroll";
  import { cn } from "$lib/utils";

  let {
    label,
    size = "sm",
    from = null,
    onclose,
    children,
  }: {
    label: string;
    size?: "sm" | "lg" | "xl";
    from?: DOMRect | null;
    onclose: () => void;
    children: Snippet;
  } = $props();

  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  let card: HTMLDivElement | null = null;

  function hold(node: HTMLDivElement) {
    card = node;
    const before = document.activeElement;
    node.focus({ preventScroll: true });

    return () => {
      card = null;
      // Restore only if nothing else took focus; a card that hands off to the search box must not pull it back.
      const now = document.activeElement;
      const loose = now == null || now === document.body || node.contains(now);
      if (loose && before instanceof HTMLElement && before.isConnected) {
        before.focus({ preventScroll: true });
      }
    };
  }

  function trap(event: KeyboardEvent) {
    const overlay = card?.parentElement;
    if (event.key !== "Tab" || overlay == null) {
      return;
    }

    const stops = [...overlay.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const edge = event.shiftKey ? stops[0] : stops.at(-1);
    const wrap = event.shiftKey ? stops.at(-1) : stops[0];

    if (edge != null && wrap != null && document.activeElement === edge) {
      event.preventDefault();
      wrap.focus();
    }
  }
</script>

<svelte:window onkeydown={trap} />

<div
  transition:fade={{ duration: 180 }}
  class="absolute inset-0 z-50 grid place-items-center bg-black/50 px-4 py-8 backdrop-blur-[3px]"
>
  <button
    type="button"
    tabindex="-1"
    class="absolute inset-0 cursor-default"
    aria-label="Close"
    onclick={onclose}
  ></button>

  <div
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabindex="-1"
    {@attach hold}
    in:open={{ from, calm: calm.current }}
    out:fly={{ y: 18, duration: 220, easing: cubicOut }}
    class={cn(
      "relative flex max-h-[86dvh] w-full rotate-[-0.9deg] flex-col drop-shadow-[0_16px_26px_rgb(30_26_20/0.45)] outline-none",
      {
        "max-w-sm": size === "sm",
        "max-w-lg": size === "lg",
        "max-w-2xl": size === "xl",
      },
    )}
  >
    <button
      type="button"
      class="absolute -top-3.5 right-2 z-10 grid size-7 place-items-center rounded-full paper text-foreground/70 shadow-[0_2px_6px_rgb(30_26_20/0.35)] ring-1 ring-foreground/20 transition-colors duration-200 hover:text-foreground"
      aria-label="Close {label}"
      onclick={onclose}
    >
      <XIcon class="size-3.5" strokeWidth={2.5} />
    </button>

    <div
      style:clip-path={"polygon(0 0,100% 0,100% calc(100% - 7px),92% 100%,84% calc(100% - 6px),76% 100%,68% calc(100% - 6px),60% 100%,52% calc(100% - 6px),44% 100%,36% calc(100% - 6px),28% 100%,20% calc(100% - 6px),12% 100%,4% calc(100% - 6px),0 100%)"}
      class="flex min-h-0 flex-col paper shadow-[inset_0_0_0_1px_var(--color-border)]"
    >
      <!-- Mask on a static wrapper, not the scroller: a masked scroll container loses Chrome's composited scrolling. -->
      <div class="flex min-h-0 scroll-fade-y flex-col">
        <div
          {@attach scrollEdges()}
          class="min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-9 has-data-pinned:pb-0"
        >
          {@render children()}
        </div>
      </div>
    </div>
  </div>
</div>
