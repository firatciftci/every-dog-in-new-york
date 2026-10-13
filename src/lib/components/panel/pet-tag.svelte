<script lang="ts">
  import { ArrowRightIcon } from "@lucide/svelte";
  import type { Pet } from "#lib/pet.svelte.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import { collarOf, pet } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  let {
    dog,
    words,
    class: className,
  }: { dog: Pet; words: string; class?: string } = $props();
</script>

<button
  type="button"
  class={cn(
    "group relative flex w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-[5px] py-1.5 pr-3 pl-2 text-left ring-1 ring-foreground/10 transition-[box-shadow,translate] duration-200 hover:-translate-y-px hover:ring-foreground/20",
    className,
  )}
  style:background="color-mix(in oklab, {collarOf(dog.collar)} 11%, transparent)"
  onclick={() => {
    pet.choose(dog.id);
    explorer.showPet();
  }}
>
  <span
    aria-hidden="true"
    class="absolute inset-y-0 left-0 w-1"
    style:background={collarOf(dog.collar)}
  ></span>
  <span
    aria-hidden="true"
    class="block shrink-0 origin-bottom group-hover:animate-[wag_calc(var(--1s)*0.55)_ease-in-out] motion-safe:animate-[fetch_0.66s_linear]"
  >
    <Plate breed={dog.breed} height={30} />
  </span>
  <span
    class="min-w-0 flex-1 text-[0.78125rem] leading-snug text-foreground/85"
  >
    <strong class="slab text-[0.8125rem] font-normal text-foreground"
      >{dog.name}</strong
    >
    {words}
  </span>
  <ArrowRightIcon
    aria-hidden="true"
    class="size-3.5 shrink-0 text-primary transition-transform duration-200 group-hover:translate-x-0.5"
    strokeWidth={2.25}
  />
</button>
