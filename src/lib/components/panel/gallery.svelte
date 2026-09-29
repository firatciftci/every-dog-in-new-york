<script lang="ts" module>
  const TITLES = {
    searched: "In the album",
    common: "The most common dog here",
    distinct: "The most distinctive dog here",
  } as const;

  const COPIES = [0, 1, 2];
</script>

<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import type { Snapshot } from "$lib/photos";
  import type { Part } from "$lib/sentence";
  import { hasPlate, plateUrl } from "$lib/breeds";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import DragScroller from "$lib/components/panel/drag-scroller.svelte";
  import { photosOf } from "$lib/photos";
  import { chip } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";

  let {
    breed,
    why,
    plate = true,
    class: className,
  }: {
    breed: string;
    why: keyof typeof TITLES;
    plate?: boolean;
    class?: string;
  } = $props();

  let shots = $state<Array<Snapshot>>([]);

  $effect(() => {
    const wanted = breed;
    let live = true;
    void photosOf(wanted).then((found) => {
      if (live) {
        shots = found;
      }
    });

    return () => {
      live = false;
      shots = [];
    };
  });

  const drawn = $derived(plate && hasPlate(breed));
  const showing = $derived(shots.length > 0 || drawn || !plate);
  const an = $derived(/^[aeiou]/i.test(breed) ? "an" : "a");

  const said = $derived.by<Array<Part>>(() => {
    const tag = chip("breeds", breed, () => {
      explorer.setFocus("breeds", breed);
    });
    const tail = "The drawing leads, then the real ones.";

    if (shots.length === 0) {
      return [
        `No photographs of ${an}`,
        tag,
        "to show, so the drawing is all there is.",
      ];
    }

    if (!plate) {
      return ["Real ones, photographed by whoever owns them."];
    }

    if (why === "distinct") {
      return [
        tag,
        "runs further above its citywide rate here than any other breed.",
        tail,
      ];
    }

    if (why === "common") {
      return ["More dogs here are", tag, "than anything else.", tail];
    }

    return [
      "The drawing leads, then the dogs it stands for. Every one of them is a real",
      tag,
      ", photographed by whoever owns it.",
    ];
  });

  const SECONDS_EACH = 6;

  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  let paused = $state(false);

  function reel(node: HTMLElement) {
    const track = node.firstElementChild;
    if (!(track instanceof HTMLElement)) {
      return;
    }

    let span = 0;
    // Chrome quantizes scrollLeft to device pixels; a 120Hz step is under 0.2px, so track position here.
    let at = 0;
    let wrote = -1;
    let frame = 0;
    let last = 0;

    const sizes = new ResizeObserver(() => {
      const next = track.getBoundingClientRect().width / COPIES.length;
      if (next <= 0 || next === span) {
        return;
      }

      const first = span === 0;
      span = next;
      if (first) {
        at = span;
        node.scrollLeft = span;
      }
    });
    sizes.observe(track);

    const held = () =>
      node.matches(":hover") ||
      node.contains(document.activeElement) ||
      document.body.classList.contains("drag-scrolling");

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      if (span > 0) {
        if (Math.abs(node.scrollLeft - at) > 1) {
          at = node.scrollLeft;
        }

        const each = shots.length + (plate ? 1 : 0);
        if (last > 0 && !held() && !calm.current && !paused) {
          at +=
            ((now - last) / 1000) * (span / Math.max(1, each) / SECONDS_EACH);
        }

        if (at >= span * 2) {
          at -= span;
        } else if (at < span) {
          at += span;
        }

        if (at !== wrote) {
          node.scrollLeft = at;
          wrote = at;
        }
      }

      last = now;
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
    };
  }
</script>

{#snippet corners()}
  <span
    class="absolute top-1.5 left-1.5 size-4 bg-paper-100/85 ring-1 ring-black/12 [clip-path:polygon(0_0,100%_0,0_100%)] ring-inset"
  ></span>
  <span
    class="absolute right-1.5 bottom-4.5 size-4 bg-paper-100/85 ring-1 ring-black/12 [clip-path:polygon(100%_0,100%_100%,0_100%)] ring-inset"
  ></span>
{/snippet}

{#if showing}
  {#key breed}
    <section class={className}>
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="slab text-[15px] text-foreground">{TITLES[why]}</h3>
        {#if shots.length > 0}
          <span class="flex shrink-0 items-baseline gap-2 text-[11px]">
            <span class="numeric text-muted-foreground"
              >{shots.length} photos</span
            >
            <button
              type="button"
              aria-pressed={paused}
              class="min-h-6 font-medium text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-foreground hover:decoration-primary"
              onclick={() => {
                paused = !paused;
              }}
            >
              {paused ? "Play" : "Pause"}<span class="sr-only"> the reel</span>
            </button>
          </span>
        {/if}
      </div>

      <p class="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
        <Sentence parts={said} />
      </p>

      {#if shots.length === 0}
        <div class="mt-2 flex justify-center" class:hidden={!drawn}>
          <div
            class="relative mr-0 block w-40 shrink-0 rotate-[-1.2deg] mount p-1.5 pb-4.5 shadow-[0_1px_2px_rgb(60_50_40/0.2)] ring-1 ring-black/8 transition-transform duration-300 ease-out odd:rotate-[-1.7deg] even:rotate-[1.5deg] motion-safe:hover:scale-[1.07] motion-safe:hover:rotate-0"
          >
            <img
              src={plateUrl(breed)}
              alt="A pen-and-ink drawing of {an} {breed}"
              class="aspect-4/3 w-full bg-paper-100 object-contain p-1"
            />
            {@render corners()}
            <span
              class="absolute inset-x-1.5 bottom-1 block truncate-clip text-center text-[10px] leading-none text-paper-800/80"
              >The plate this map draws</span
            >
          </div>
        </div>
      {:else}
        <!-- Mask on the wrapper: Chrome drops a masked scroll container off its composited path. -->
        <div
          class="-mx-5 mt-2 mask-r-from-[calc(100%-20px)] mask-l-from-[calc(100%-20px)]"
        >
          <DragScroller class="overscroll-x-contain" {@attach reel}>
            <!-- No padding or flex gap: the wrap divides the track width by COPIES, so any extra makes the reel hop. -->
            <div class="flex w-max py-2">
              {#each COPIES as pass (pass)}
                {const ghost = pass !== 1}
                {#if plate}
                  <div
                    class="relative mr-2 block w-33 shrink-0 mount p-1.5 pb-4.5 shadow-[0_1px_2px_rgb(60_50_40/0.2)] ring-1 ring-black/8 transition-transform duration-300 ease-out odd:rotate-[-1.7deg] even:rotate-[1.5deg] motion-safe:hover:scale-[1.07] motion-safe:hover:rotate-0"
                    aria-hidden={ghost ? "true" : undefined}
                  >
                    <img
                      src={plateUrl(breed)}
                      alt="A pen-and-ink drawing of {an} {breed}"
                      class="aspect-4/3 w-full bg-paper-100 object-contain p-1"
                    />
                    {@render corners()}
                    <span
                      class="absolute inset-x-1.5 bottom-1 block truncate-clip text-center text-[10px] leading-none text-paper-800/80"
                      >The plate this map draws</span
                    >
                  </div>
                {/if}
                {#each shots as shot, i (i)}
                  <button
                    type="button"
                    aria-hidden={ghost ? "true" : undefined}
                    tabindex={ghost ? -1 : undefined}
                    aria-label="See this {breed} whole, photograph {i +
                      1} of {shots.length}"
                    title="{shot.by === ''
                      ? 'Photographer unknown'
                      : shot.by} · {shot.license}"
                    class="relative mr-2 block w-33 shrink-0 mount p-1.5 pb-4.5 shadow-[0_1px_2px_rgb(60_50_40/0.2)] ring-1 ring-black/8 transition-transform duration-300 ease-out odd:rotate-[-1.7deg] even:rotate-[1.5deg] motion-safe:hover:scale-[1.07] motion-safe:hover:rotate-0"
                    onclick={(event) => {
                      explorer.lightbox = {
                        breed,
                        at: i,
                        from: event.currentTarget.getBoundingClientRect(),
                      };
                    }}
                  >
                    <img
                      src={shot.thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      class="aspect-4/3 w-full bg-paper-300 object-cover"
                    />
                    {@render corners()}
                    <span
                      class="absolute inset-x-1.5 bottom-1 block truncate-clip text-center text-[10px] leading-none text-paper-800/80"
                    >
                      {shot.caption ??
                        (shot.by === ""
                          ? "Photographer unknown"
                          : `Photo: ${shot.by}`)}
                    </span>
                  </button>
                {/each}
              {/each}
            </div>
          </DragScroller>
        </div>

        <p class="mt-1 text-[11px] leading-snug text-muted-foreground">
          Public domain and Creative Commons, from Wikimedia Commons. Open a
          frame to see it whole.
        </p>
      {/if}
    </section>
  {/key}
{/if}
