<script lang="ts" module>
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
</script>

<script lang="ts">
  import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import type {
    HoodCollection,
    Matrix,
    ParkCollection,
    Stories,
    StoryId,
  } from "#lib/types.js";
  import { explorer } from "#lib/state.svelte.js";
  import { STORIES } from "#lib/stories.js";
  import { cn } from "#lib/utils.js";
  import Borough from "./borough.svelte";
  import Built from "./built.svelte";
  import Class from "./class.svelte";
  import Fashion from "./fashion.svelte";
  import Paw from "./paw.svelte";

  let {
    id,
    hoods,
    parks,
    matrix,
    stories,
  }: {
    id: StoryId;
    hoods: HoodCollection;
    parks: ParkCollection;
    matrix: Matrix;
    stories: Stories;
  } = $props();

  let scroller = $state<HTMLDivElement | null>(null);
  let progress = $state(0);

  const at = $derived(STORIES.findIndex((s) => s.id === id));
  const next = $derived(STORIES[(at + 1) % STORIES.length]!);

  function leave(act: () => void) {
    explorer.story = null;
    act();
  }

  function open(story: StoryId) {
    explorer.story = story;
    scroller?.scrollTo({ top: 0 });
    progress = 0;
  }

  function hold(node: HTMLDivElement) {
    const before = document.activeElement;
    node.focus({ preventScroll: true });

    return () => {
      if (before instanceof HTMLElement && before.isConnected) {
        before.focus({ preventScroll: true });
      }
    };
  }

  const shared = $derived({ stories, hoods, parks, matrix, leave });
</script>

<svelte:window
  onkeydown={(event: KeyboardEvent) => {
    if (event.key !== "Tab" || scroller == null) {
      return;
    }

    const stops = [...scroller.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const edge = event.shiftKey ? stops[0] : stops.at(-1);
    const wrap = event.shiftKey ? stops.at(-1) : stops[0];
    if (edge != null && wrap != null && document.activeElement === edge) {
      event.preventDefault();
      wrap.focus();
    }
  }}
/>

<div
  bind:this={scroller}
  role="dialog"
  aria-modal="true"
  aria-labelledby="story-title"
  tabindex="-1"
  data-story-scroll
  {@attach hold}
  in:fly={{ y: 36, duration: 420, easing: cubicOut }}
  out:fade={{ duration: 180 }}
  onscroll={(event) => {
    const el = event.currentTarget;
    const room = el.scrollHeight - el.clientHeight;
    progress = room > 0 ? el.scrollTop / room : 0;
  }}
  class="fixed inset-0 z-50 overflow-x-clip overflow-y-auto overscroll-contain paper text-foreground outline-none"
>
  <header
    class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b rule paper px-3 @max-xs:gap-1.5 @max-xs:px-2 @min-[55rem]:px-6"
  >
    <button
      type="button"
      class="group flex shrink-0 cursor-pointer items-center gap-1.5 py-1 slab text-[0.8125rem] transition-colors duration-200 hover:text-primary"
      onclick={() => {
        explorer.story = null;
      }}
    >
      <ArrowLeftIcon
        aria-hidden="true"
        class="size-3.5 text-primary transition-transform duration-200 group-hover:-translate-x-0.5"
        strokeWidth={2.25}
      />
      <span class="@max-[30rem]:sr-only">Back to the map</span>
    </button>

    <nav
      aria-label="Stories"
      class="mx-auto flex items-center gap-2 @max-xs:gap-1"
    >
      {#each STORIES as story, i (story.id)}
        <button
          type="button"
          aria-current={story.id === id ? "true" : undefined}
          aria-label="Story {i + 1}: {story.title}"
          title={story.title}
          class={cn(
            "grid h-7 w-6 cursor-pointer place-items-center rounded-[7px] pt-1 slab text-[0.75rem] transition-transform duration-200",
            {
              "brass stamped": story.id === id,
              "bg-foreground/6 text-foreground/60 hover:-translate-y-0.5 hover:text-foreground":
                story.id !== id,
            },
          )}
          style:rotate="{i % 2 === 0 ? -3 : 3}deg"
          onclick={() => {
            open(story.id);
          }}>{i + 1}</button
        >
      {/each}
    </nav>

    <button
      type="button"
      class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-foreground/70 ring-1 ring-foreground/15 transition-colors duration-200 hover:text-foreground"
      aria-label="Close the story"
      onclick={() => {
        explorer.story = null;
      }}
    >
      <XIcon class="size-4" strokeWidth={2.25} />
    </button>

    <div
      aria-hidden="true"
      class="absolute inset-x-0 -bottom-px h-px border-b border-dotted border-foreground/25"
    ></div>
    <div aria-hidden="true" class="absolute inset-x-2 -bottom-2 h-4">
      <div
        class="absolute inset-y-0.5 left-0 bg-primary/30 paw-trail"
        style:width="calc({progress} * (100% - 1rem))"
      ></div>
      <span
        class="absolute top-0 size-4"
        style:left="calc({progress} * (100% - 1rem))"
      >
        <Paw class="size-4 text-primary" step={progress} />
      </span>
    </div>
  </header>

  {#key id}
    <article in:fade={{ duration: 260 }}>
      {#if id === "class"}
        <Class {...shared} />
      {:else if id === "built"}
        <Built {...shared} />
      {:else if id === "fashion"}
        <Fashion {...shared} />
      {:else}
        <Borough {...shared} />
      {/if}

      <footer class="border-t rule px-4 py-14 @min-[55rem]:px-10">
        <div class="mx-auto flex max-w-2xl flex-col items-start gap-5">
          <button
            type="button"
            class="group w-full max-w-lg -rotate-1 cursor-pointer rounded-lg paper px-6 py-5 text-left shadow-[0_1px_0_rgb(58_48_38/0.16),0_10px_28px_rgb(58_48_38/0.16)] ring-1 ring-foreground/10 transition-transform duration-[calc(var(--1s)*0.25)] ease-out hover:rotate-0 dark:shadow-none"
            onclick={() => {
              open(next.id);
            }}
          >
            <span class="block slab text-[0.8125rem] text-primary"
              >Next story</span
            >
            <span
              class="mt-1 flex items-center gap-2 font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight"
            >
              {next.title}
              <ArrowRightIcon
                aria-hidden="true"
                class="size-5 shrink-0 text-primary transition-transform duration-200 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </span>
          </button>
          <button
            type="button"
            class="cursor-pointer py-1 text-[0.84375rem] font-medium text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
            onclick={() => {
              explorer.story = null;
            }}>Back to the map</button
          >
        </div>
      </footer>
    </article>
  {/key}
</div>
