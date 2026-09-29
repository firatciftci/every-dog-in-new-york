<script lang="ts">
  import { PawPrintIcon } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { MediaQuery } from "svelte/reactivity";
  import { fade, fly } from "svelte/transition";
  import type { Part } from "$lib/sentence";
  import type { Focus, LayerId, Summary } from "$lib/types";
  import Collar from "$lib/components/brand/collar.svelte";
  import Plate from "$lib/components/brand/plate.svelte";
  import { chip, place } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";
  import { count } from "$lib/utils";
  import Chip from "./chip.svelte";
  import Daylight from "./daylight.svelte";
  import Sentence from "./sentence.svelte";

  let { summary }: { summary: Summary } = $props();

  // 781px: iOS Safari at 402x678 with both bars up leaves 263px less than the layout wants.
  const tall = new MediaQuery("(min-height: 781px)");

  // Every finding is a door: the poster lifts and the map opens on the place or the dog it named.
  function door(next: {
    layer?: LayerId;
    focus?: Focus | null;
    at?: string | null;
  }) {
    return () => {
      explorer.dismissIntro();
      explorer.leap({
        layer: next.layer ?? explorer.layer,
        focus: next.focus ?? null,
        filters: [],
        rivals: [],
        at: next.at ?? null,
      });
    };
  }

  const JINDO: Focus = { facet: "breeds", label: "Jindo" };
  const DOODLE: Focus = { facet: "breeds", label: "Labradoodle" };

  const highlights: Array<Array<Part>> = [
    [
      place("Greenpoint", door({ focus: JINDO, at: "greenpoint" })),
      "keeps the",
      chip("breeds", "Jindo", door({ focus: JINDO })),
      ", a Korean breed, at nearly three times the city’s rate.",
    ],
    [
      place(
        "The Upper East Side",
        door({ focus: DOODLE, at: "upper-east-side-yorkville" }),
      ),
      "has more than twice its share of the",
      chip("breeds", "Labradoodle", door({ focus: DOODLE })),
      ".",
    ],
    [
      chip("names", "Luna", door({ focus: { facet: "names", label: "Luna" } })),
      "is the most common dog name in New York, but not in the",
      place(
        "Financial District",
        door({ layer: "name", at: "financial-district-battery-park-city" }),
      ),
      ", where it is",
      chip(
        "names",
        "Teddy",
        door({ focus: { facet: "names", label: "Teddy" } }),
      ),
      ".",
    ],
  ];

  const PAW_TILT = ["-rotate-12", "rotate-6", "-rotate-3"];

  const parade = $derived(summary.city_top_breeds.slice(0, 7));
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="intro-title"
  tabindex="-1"
  {@attach (node: HTMLElement) => {
    node.focus({ preventScroll: true });
  }}
  transition:fade={{ duration: 260 }}
  class="absolute inset-0 z-50 paper outline-none"
>
  <Daylight
    horizon
    class="absolute top-3.5 right-2 z-10 p-2.5 text-foreground/60 transition-colors duration-200 hover:text-foreground sm:right-4 tall:top-4.5"
  />

  <div class="flex h-full flex-col overflow-y-auto overscroll-contain">
    <Collar
      licenses={summary.licenses}
      year={summary.extract_year}
      size="hero"
    />

    <div
      class="grid flex-1 place-items-center px-5 pt-6 pb-4 tall:pt-5 tall:pb-8"
    >
      <div
        transition:fly={{ y: 20, duration: 460, easing: cubicOut }}
        class="w-full max-w-2xl"
      >
        <h1
          id="intro-title"
          class="rotate-[-1.4deg] text-center poster text-[clamp(2.5rem,10.5vw,5.2rem)]"
        >
          EVERY DOG<br />IN NEW YORK
        </h1>

        <div
          class="mt-5 flex items-end justify-center gap-1 sm:gap-2 tall:mt-7"
        >
          {#each parade as breed, i (breed.label)}
            <Plate
              breed={breed.label}
              height={tall.current
                ? i % 2 === 0
                  ? 58
                  : 50
                : i % 2 === 0
                  ? 52
                  : 45}
              flip={i % 3 === 1}
              class="max-w-[13%] origin-bottom wag-hover tag-ease"
            />
          {/each}
        </div>
        <div class="h-1.5 rounded-[50%] bg-primary/85"></div>

        <p
          class="mt-4 text-center text-[15.5px] leading-[1.52] text-balance text-foreground/85 tall:mt-6"
        >
          New York knows your dog’s name. It has {count(summary.licenses)} of them
          written down. Put that list on a map and the city splits into {summary.neighborhoods}
          small towns, each with its own taste in dogs.
        </p>

        <p
          class="mt-2.5 text-center text-[13.5px] leading-[1.55] text-balance text-foreground/75 tall:mt-3.5"
        >
          Breeds get a box, like <Chip facet="breeds" label="Maltese" />. Names
          get a ring, like <Chip facet="names" label="Coco" />.
        </p>

        <ul class="mx-auto mt-3 grid max-w-xl gap-2.5 tall:mt-6 tall:gap-3">
          {#each highlights as parts, i (i)}
            <li class="flex gap-2.5 text-[14px] leading-snug">
              <PawPrintIcon
                class="mt-0.5 size-3.5 shrink-0 text-primary {PAW_TILT[i]}"
                fill="currentColor"
              />
              <span class="text-foreground/85"><Sentence {parts} /></span>
            </li>
          {/each}
        </ul>

        <div
          class="sticky bottom-0 z-10 -mx-5 mt-6 flex justify-center px-5 pt-7 pb-4 tall:mt-9"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10 paper mask-t-from-56%"
          ></span>
          <button
            type="button"
            class="shout px-7 py-2.5 text-[21px]"
            onclick={() => {
              explorer.dismissIntro();
              explorer.greet();
            }}
          >
            SHOW ME THE DOGS
          </button>
        </div>

        <div
          class="mx-auto mt-8 h-px max-w-xs border-t border-dashed border-foreground/20"
        ></div>

        <p
          class="mx-auto mt-4 max-w-md text-center text-[11.5px] leading-relaxed text-muted-foreground"
        >
          A license lists only a ZIP code, so every neighborhood figure is an
          estimate, split by the homes on each side of the line. The drawings
          are public-domain plates from the Pearson Scott Foresman archive, plus
          new ones drawn to match.
        </p>
      </div>
    </div>
  </div>
</div>
