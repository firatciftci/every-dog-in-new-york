<script lang="ts" module>
  import { cubicOut } from "svelte/easing";

  const SWIPE = 48;

  function page(_node: Element, { dir, calm }: { dir: number; calm: boolean }) {
    if (calm) {
      return { duration: 120, css: (t: number) => `opacity:${t}` };
    }

    return {
      duration: 300,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `opacity:${t};transform:translateX(${dir * u * 7}%)`,
    };
  }
</script>

<script lang="ts">
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import type { Snapshot } from "$lib/photos";
  import type { Lightbox } from "$lib/types";
  import Dialog from "$lib/components/chrome/dialog.svelte";
  import { photosOf } from "$lib/photos";
  import { explorer } from "$lib/state.svelte";
  import { cn } from "$lib/utils";

  let { open }: { open: Lightbox } = $props();

  let shots = $state<Array<Snapshot>>([]);

  $effect(() => {
    const wanted = open.breed;
    let live = true;
    void photosOf(wanted).then((found) => {
      if (live) {
        shots = found;
      }
    });

    return () => {
      live = false;
    };
  });

  const shot = $derived<Snapshot | undefined>(shots[open.at]);
  const by = $derived(
    shot == null || shot.by === "" ? "Photographer unknown" : shot.by,
  );

  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  let back = $state(false);

  $effect(() => {
    for (const near of [shots[open.at - 1], shots[open.at + 1]]) {
      if (near != null) {
        new Image().src = near.thumb;
      }
    }
  });

  function step(delta: number) {
    const next = open.at + delta;
    if (next >= 0 && next < shots.length) {
      back = delta < 0;
      open.at = next;
    }
  }

  function keys(event: KeyboardEvent) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  let thumb: { x: number; y: number } | null = null;

  function grab(event: TouchEvent) {
    const touch = event.touches[0];
    thumb = touch == null ? null : { x: touch.clientX, y: touch.clientY };
  }

  function release(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (thumb == null || touch == null) {
      return;
    }

    const dx = touch.clientX - thumb.x;
    const dy = touch.clientY - thumb.y;
    thumb = null;

    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx < 0 ? 1 : -1);
    }
  }
</script>

<svelte:window onkeydown={keys} />

<Dialog
  size="xl"
  label="A {open.breed}, photographed"
  from={open.from}
  onclose={() => {
    explorer.lightbox = null;
  }}
>
  <figure class="min-w-0" ontouchstart={grab} ontouchend={release}>
    <div class="relative mount p-2.5 pb-3 ring-1 ring-black/8">
      <div class="relative aspect-4/3 w-full overflow-clip bg-paper-300">
        <!-- img stays the key's direct child: transitions are block-local, so keyed under an if nothing plays. -->
        {#if shot != null}
          {#key open.at}
            <img
              src={shot.thumb}
              alt="A {open.breed}"
              decoding="async"
              in:page={{ dir: back ? -1 : 1, calm: calm.current }}
              out:page={{ dir: back ? 1 : -1, calm: calm.current }}
              class="absolute inset-0 size-full object-contain"
            />
          {/key}
        {/if}
      </div>

      <span
        class="absolute top-2.5 left-2.5 size-7 bg-paper-100/85 ring-1 ring-black/12 [clip-path:polygon(0_0,100%_0,0_100%)] ring-inset"
      ></span>
      <span
        class="absolute right-2.5 bottom-3 size-7 bg-paper-100/85 ring-1 ring-black/12 [clip-path:polygon(100%_0,100%_100%,0_100%)] ring-inset"
      ></span>
    </div>

    <figcaption class="mt-3 flex h-22 flex-col">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        tabindex={shot?.caption == null ? undefined : 0}
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain text-[13px] leading-relaxed text-pretty text-foreground/85"
      >
        {shot?.caption ?? ""}
      </div>

      <p
        class="shrink-0 pt-1.5 text-[11.5px] leading-relaxed text-muted-foreground"
      >
        {by}{#if shot != null}{" "}· {shot.license} ·{" "}<a
            href={shot.page}
            target="_blank"
            rel="noreferrer external"
            class="underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
            >on Wikimedia Commons<span class="sr-only">
              (opens in a new tab)</span
            ></a
          >{/if}
      </p>
    </figcaption>
  </figure>

  {#if shots.length > 1}
    <div
      class="mt-2 flex items-center justify-between gap-3 border-t rule pt-3"
    >
      {@render turn(-1, "Back", ChevronLeftIcon)}
      <span
        role="status"
        class="shrink-0 numeric text-[11.5px] text-muted-foreground"
      >
        {open.at + 1} of {shots.length}
      </span>
      {@render turn(1, "Next", ChevronRightIcon)}
    </div>
  {/if}
</Dialog>

{#snippet turn(delta: number, word: string, Icon: typeof ChevronLeftIcon)}
  {const dead = $derived(
    open.at + delta < 0 || open.at + delta >= shots.length,
  )}
  <button
    type="button"
    disabled={dead}
    aria-label={dead
      ? delta < 0
        ? "No earlier photograph"
        : "No later photograph"
      : `${word}: photograph ${open.at + delta + 1} of ${shots.length}`}
    class={cn(
      "flex shrink-0 items-center gap-1 rounded-[3px] px-2 py-1 text-[12.5px] font-medium transition-colors duration-200",
      {
        "cursor-pointer text-foreground hover:text-primary": !dead,
        "cursor-default text-foreground/30": dead,
      },
    )}
    onclick={() => {
      step(delta);
    }}
  >
    {#if delta < 0}<Icon
        class="size-3.5"
        strokeWidth={2.25}
      />{/if}{word}{#if delta > 0}<Icon
        class="size-3.5"
        strokeWidth={2.25}
      />{/if}
  </button>
{/snippet}
