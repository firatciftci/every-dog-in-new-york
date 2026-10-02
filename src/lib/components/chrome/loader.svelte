<script lang="ts" module>
  const BLOCK = 480;
  const PAVING = 48;
  const PRINTS = 96;

  const SLOTS = 6;
  const COPIES = [0, 1];

  const PROPS: ReadonlyArray<{
    d: string;
    w: number;
    h: number;
    up: number;
    hops?: boolean;
  }> = [
    {
      d: "M2.6 22H10.4V19.6H9V11H10.2V8.6H2.8V11H4V19.6H2.6ZM3.4 8.6H9.6V7H3.4ZM4.6 7V5.9A1.9 1.9 0 0 1 8.4 5.9V7ZM6 5.5V3.8H7V5.5ZM0.4 12H2.8V15H0.4ZM10.2 12H12.6V15H10.2Z",
      w: 13,
      h: 22,
      up: 40,
    },
    {
      d: "M5.2 40V13C5.2 6 9.6 3.2 13 6M11.2 6.2H14.8L14 11.4H12ZM2.8 40H7.6M3.8 35.6H6.6",
      w: 16,
      h: 40,
      up: 90,
    },
    {
      d: "M2 17L3.2 4.6H9.8L11 17ZM0.9 4.6H12.1V3H0.9ZM5.4 3V1.4H7.6V3Z",
      w: 13,
      h: 17,
      up: 46,
    },
    {
      d: "M1.6 15.4V6.6A5.9 5.9 0 0 1 13.4 6.6V15.4ZM2.8 17V15.4H4.6V17ZM10.4 17V15.4H12.2V17ZM4 8.4H11V9.8H4Z",
      w: 15,
      h: 17,
      up: 44,
    },
    {
      d: "M11.4 34V17H14.6V34ZM13 2.6C6.4 2.6 3.2 7.4 4.8 12C2 15.6 5.2 19.8 9.2 19.2C11.2 21.8 14.8 21.8 16.8 19.2C20.8 19.8 24 15.6 21.2 12C22.8 7.4 19.6 2.6 13 2.6ZM8.4 34H17.6V32.6H8.4Z",
      w: 26,
      h: 34,
      up: 78,
    },
    {
      d: "M3.2 26V10H4.8V26ZM1.2 10H6.8V3.6H1.2ZM2.4 5H5.6V7.6H2.4Z",
      w: 8,
      h: 26,
      up: 52,
    },
    {
      d: "M3.2 6.4A3.4 2.6 0 1 0 10 6.4A3.4 2.6 0 1 0 3.2 6.4ZM9 3.5A1.9 1.9 0 1 0 12.8 3.5A1.9 1.9 0 1 0 9 3.5ZM8.6 5.6H11.4V3.4H8.6ZM12.7 3.1L14 3.9L12.7 4.6ZM3.4 7L0.3 5.8L3.6 5ZM5.4 8.8H6.2V10.6H5.4ZM7.8 8.8H8.6V10.6H7.8Z",
      w: 14,
      h: 11,
      up: 22,
      hops: true,
    },
    {
      d: "M5.2 34V12H6.8V34ZM3 12H9V1.4H3ZM4.6 3.8A1.4 1.4 0 1 0 7.4 3.8A1.4 1.4 0 1 0 4.6 3.8ZM4.6 6.7A1.4 1.4 0 1 0 7.4 6.7A1.4 1.4 0 1 0 4.6 6.7ZM4.6 9.6A1.4 1.4 0 1 0 7.4 9.6A1.4 1.4 0 1 0 4.6 9.6ZM3.6 34H8.4",
      w: 12,
      h: 34,
      up: 76,
    },
    {
      d: "M1.6 15V4.6H9.4V15ZM3.2 10.4H7.8V6.2H3.2ZM1.6 4.6L2.6 2.4H8.4L9.4 4.6Z",
      w: 11,
      h: 15,
      up: 40,
    },
  ];

  const WALKERS = [
    "Labrador (or Crossbreed)",
    "Yorkshire Terrier",
    "Shih Tzu",
    "Pit Bull (or Mix)",
    "Chihuahua",
    "Poodle",
    "Maltese",
    "French Bulldog",
    "Pomeranian",
    "Havanese",
    "German Shepherd Dog",
    "Beagle",
    "Dachshund",
    "Pug",
  ];
</script>

<script lang="ts">
  import { browser } from "$app/env";
  import { fade } from "svelte/transition";
  import type { Scene } from "#lib/skyline.js";
  import { plateUrl } from "#lib/breeds.js";
  import { SCENES } from "#lib/skyline.js";
  import { cn, count } from "#lib/utils.js";

  let {
    styled,
    hoods,
    error,
  }: { styled: boolean; hoods: number; error: string | null } = $props();

  const pace = browser ? 46 + Math.random() * 18 : 52;

  const secs = (tile: number, of = 1) => (tile / (pace * of)).toFixed(2);

  const walking = $derived(error == null);

  const stage = $derived(
    error ??
      (styled
        ? `Inking ${count(hoods)} neighborhoods`
        : "Unrolling the basemap"),
  );

  let walk = $state<{
    scene: Scene;
    line: string;
    corner: number;
    street: Array<{ prop: (typeof PROPS)[number]; at: number }>;
  } | null>(null);
  let dog = $state<string | null>(null);
  let started = $state(false);

  // Rolled client-side only: a roll during prerender is baked into the sheet for every reader.
  $effect(() => {
    const roll = (n: number) => Math.floor(Math.random() * n);
    const scene = SCENES[roll(SCENES.length)]!;

    walk = {
      scene,
      line: scene.lines[roll(scene.lines.length)]!,
      corner: roll(scene.tile),
      street: Array.from({ length: SLOTS }, (_, slot) => ({
        prop: PROPS[scene.kit[roll(scene.kit.length)]!]!,
        at: (slot * BLOCK) / SLOTS + roll(BLOCK / SLOTS - 40),
      })),
    };
    dog = WALKERS[roll(WALKERS.length)]!;

    // A frame late, so the bar transitions from 5% instead of starting at its target width.
    const frame = requestAnimationFrame(() => {
      started = true;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  });
</script>

<div
  out:fade={{ duration: 420 }}
  class="absolute inset-0 z-20 grid place-items-center paper"
>
  <div class="flex w-full flex-col items-center px-6">
    <div
      aria-hidden="true"
      class="relative h-44 w-full max-w-120 overflow-clip mask-[linear-gradient(to_right,transparent,black_9%,black_91%,transparent)]"
    >
      {#if walk != null}
        <div class="absolute inset-0" in:fade={{ duration: 340 }}>
          <div
            class={cn("absolute left-0 text-foreground", {
              "motion-safe:animate-[drift-x_1s_linear_infinite]": walking,
            })}
            style:bottom="{walk.scene.up}px"
            style:height="{walk.scene.h}px"
            style:--tile="-{walk.scene.tile}px"
            style:width="{walk.scene.tile * COPIES.length}px"
            style:margin-left="-{walk.corner}px"
            style:animation-duration="{secs(
              walk.scene.tile,
              walk.scene.crawl,
            )}s"
          >
            {#each COPIES as copy (copy)}
              <svg
                viewBox="0 0 {walk.scene.tile} {walk.scene.h}"
                class="absolute top-0"
                style:left="{copy * walk.scene.tile}px"
                style:width="{walk.scene.tile}px"
                style:height="{walk.scene.h}px"
              >
                {#each walk.scene.marks as mark, at (at)}
                  <path
                    d={mark.d}
                    fill={mark.pen == null
                      ? mark.paper === true
                        ? "var(--color-background)"
                        : "currentColor"
                      : "none"}
                    fill-rule={mark.even === true ? "evenodd" : "nonzero"}
                    stroke={mark.pen == null ? "none" : "currentColor"}
                    stroke-width={mark.pen}
                    stroke-linecap="round"
                    opacity={mark.at}
                  />
                {/each}
              </svg>
            {/each}
          </div>

          <div
            class={cn("absolute bottom-7 left-0", {
              "motion-safe:animate-[drift-x_1s_linear_infinite]": walking,
            })}
            style:--tile="-{BLOCK}px"
            style:width="{BLOCK * COPIES.length}px"
            style:animation-duration="{secs(BLOCK)}s"
          >
            {#each COPIES as copy (copy)}
              {#each walk.street as thing, slot (slot)}
                <svg
                  viewBox="0 0 {thing.prop.w} {thing.prop.h}"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class={cn(
                    "absolute bottom-0 origin-bottom text-foreground/45",
                    {
                      "motion-safe:animate-[hop_2.6s_ease-in-out_infinite]":
                        thing.prop.hops === true && walking,
                    },
                  )}
                  style:left="{copy * BLOCK + thing.at}px"
                  style:height="{thing.prop.up}px"
                  style:animation-delay="{slot * 0.7}s"
                  style:width="{(thing.prop.up * thing.prop.w) /
                    thing.prop.h}px"
                >
                  <path d={thing.prop.d} vector-effect="non-scaling-stroke" />
                </svg>
              {/each}
            {/each}
          </div>
        </div>
      {/if}

      <div class="absolute inset-x-0 bottom-7 h-px bg-foreground/32"></div>

      <div
        class={cn("absolute bottom-0 left-0 h-7 bg-foreground/16 paving", {
          "motion-safe:animate-[drift-x_1s_linear_infinite]": walking,
        })}
        style:--tile="-{PAVING}px"
        style:width="calc(100% + {PAVING}px)"
        style:animation-duration="{secs(PAVING)}s"
      ></div>

      <div
        class="absolute inset-x-0 bottom-3 h-4.5 overflow-clip mask-[linear-gradient(to_right,transparent_2%,black_30%,black_50%,transparent_55%)]"
      >
        <div
          class={cn("absolute inset-y-0 left-0 bg-foreground/38 paw-trail", {
            "motion-safe:animate-[drift-x_1s_linear_infinite]": walking,
          })}
          style:--tile="-{PRINTS}px"
          style:width="calc(100% + {PRINTS}px)"
          style:animation-duration="{secs(PRINTS)}s"
        ></div>
      </div>

      <div
        class={cn(
          "absolute bottom-6 left-1/2 h-2 w-20 -translate-x-1/2 rounded-[50%] bg-foreground/16 blur-[3px]",
          { "motion-safe:animate-[tread_1s_ease-in-out_infinite]": walking },
        )}
        style:animation-duration="{secs(34)}s"
      ></div>

      <div
        class={cn("absolute bottom-7 left-1/2 origin-bottom -translate-x-1/2", {
          "motion-safe:animate-[amble_1s_ease-in-out_infinite]": walking,
        })}
        style:animation-duration="{secs(34)}s"
      >
        <img
          src={dog == null ? undefined : plateUrl(dog)}
          alt=""
          decoding="async"
          class="h-17 w-auto object-contain dark:plate-cut"
        />
      </div>
    </div>

    <div role="status" class="flex flex-col items-center">
      <p class="mt-4 min-h-[22.5px] slab text-[15px] text-foreground">
        {#if error != null}
          The map did not turn up
        {:else if walk != null}
          <span in:fade={{ duration: 340 }}>{walk.line}</span>
        {/if}
      </p>

      {#if error == null}
        <div
          class="mt-2.5 h-0.75 w-full max-w-52 overflow-clip rounded-full bg-foreground/12"
        >
          <div
            class="h-full rounded-full bg-primary transition-[width] ease-out"
            style:width="{started ? (styled ? 90 : 44) : 5}%"
            style:transition-duration="calc(var(--1s) * {styled ? 7 : 3.2})"
          ></div>
        </div>
      {/if}

      <p
        class="mt-2 max-w-xs text-center text-[11px] leading-snug text-muted-foreground"
      >
        {stage}
      </p>
    </div>

    <div class="flex flex-col items-center">
      {#if error != null}
        <button
          type="button"
          class="mt-5 shout px-7 py-2.5 text-[21px]"
          onclick={() => {
            location.reload();
          }}
        >
          TRY AGAIN
        </button>
      {/if}
    </div>
  </div>
</div>
