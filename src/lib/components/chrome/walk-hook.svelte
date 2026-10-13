<script lang="ts">
  import { ArrowRightIcon, PlusIcon } from "@lucide/svelte";
  import Plate from "#lib/components/brand/plate.svelte";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import { collarOf, pet } from "#lib/pet.svelte.js";
  import { weave } from "#lib/sentence.js";
  import { explorer } from "#lib/state.svelte.js";

  const hook = weave(
    `Is your dog a typical New Yorker? Look up their name or breed to see where in the city they would blend in, and where they would stand out.`,
    {},
  );

  const dogs = $derived(pet.dogs);
</script>

<p class="text-[0.8125rem] leading-relaxed text-foreground/85">
  <Sentence parts={hook} />
</p>

{#if dogs.length === 0}
  <button
    type="button"
    class="group mt-2.5 flex w-full cursor-pointer items-center gap-2.5 rounded-[5px] bg-foreground/[0.035] py-1.5 pr-3 pl-2 text-left ring-1 ring-foreground/8 transition-[background-color,box-shadow] duration-200 hover:bg-foreground/6 hover:ring-foreground/15"
    onclick={() => {
      explorer.adopting = "new";
    }}
  >
    <span
      class="relative grid h-10 w-12 shrink-0 place-items-end justify-center"
      aria-hidden="true"
    >
      <span
        class="opacity-45 transition-opacity duration-200 group-hover:opacity-70"
      >
        <Plate breed="Labrador (or Crossbreed)" height={34} />
      </span>
      <span
        class="absolute -top-0.5 -right-0.5 grid size-4.5 place-items-center rounded-full brass shadow-none! transition-transform duration-200 group-hover:rotate-90"
      >
        <PlusIcon class="size-3" strokeWidth={3} />
      </span>
    </span>
    <span class="min-w-0 flex-1">
      <span class="block slab text-[0.8125rem] text-foreground"
        >Put your dog on the map</span
      >
      <span class="block text-[0.71875rem] leading-snug text-muted-foreground">
        Name, breed, neighborhood, and birth year. Saved only here.
      </span>
    </span>
    <ArrowRightIcon
      aria-hidden="true"
      class="size-3.5 shrink-0 text-primary transition-transform duration-200 group-hover:translate-x-0.5"
      strokeWidth={2.25}
    />
  </button>
{:else}
  <ul class="mt-2.5 flex flex-wrap gap-1.5" aria-label="Your dogs">
    {#each dogs as dog (dog.id)}
      <li>
        <button
          type="button"
          class="group flex cursor-pointer items-end gap-1.5 rounded-[5px] bg-foreground/[0.035] py-1 pr-2.5 pl-1.5 ring-1 ring-foreground/8 transition-[background-color,box-shadow] duration-200 hover:bg-foreground/6 hover:ring-foreground/15"
          onclick={() => {
            pet.choose(dog.id);
            explorer.showPet();
          }}
        >
          <span
            aria-hidden="true"
            class="origin-bottom group-hover:animate-[wag_calc(var(--1s)*0.55)_ease-in-out]"
          >
            <Plate breed={dog.breed} height={28} />
          </span>
          <span class="flex items-center gap-1 pb-0.5 slab text-[0.78125rem]">
            <span
              aria-hidden="true"
              class="size-2 rounded-full ring-1 ring-black/15"
              style:background={collarOf(dog.collar)}
            ></span>
            {dog.name}
          </span>
        </button>
      </li>
    {/each}
    <li>
      <button
        type="button"
        class="group flex h-full cursor-pointer items-center gap-1.5 rounded-[5px] border border-dashed border-foreground/25 px-2.5 py-1 text-[0.78125rem] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
        onclick={() => {
          explorer.adopting = "new";
        }}
      >
        <PlusIcon
          aria-hidden="true"
          class="size-3.5 text-primary transition-transform duration-200 group-hover:rotate-90"
          strokeWidth={2.5}
        />
        Add a dog
      </button>
    </li>
  </ul>
{/if}

<p
  class="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.78125rem]"
>
  <button
    type="button"
    class="group flex cursor-pointer items-baseline gap-1.5 py-1 slab text-[0.8125rem] text-foreground transition-colors duration-200 hover:text-primary"
    onclick={() => {
      explorer.startWalk();
    }}
  >
    Walk me through it
    <ArrowRightIcon
      aria-hidden="true"
      class="size-3.5 translate-y-px text-primary transition-transform duration-200 group-hover:translate-x-0.5"
      strokeWidth={2.25}
    />
  </button>
  <button
    type="button"
    class="cursor-pointer py-1 font-medium text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
    onclick={() => {
      explorer.about = true;
    }}>How I built it</button
  >
</p>
