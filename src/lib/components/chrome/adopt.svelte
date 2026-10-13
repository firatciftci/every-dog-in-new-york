<script lang="ts">
  import type { Collar } from "#lib/pet.svelte.js";
  import type { Everyone, HoodCollection, Matrix } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import Dialog from "#lib/components/chrome/dialog.svelte";
  import Picker from "#lib/components/chrome/picker.svelte";
  import {
    COLLARS,
    everyone,
    FIRST_BORN,
    NAME_LONGEST,
    nameKey,
    newId,
    pet,
  } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";

  let { hoods, matrix }: { hoods: HoodCollection; matrix: Matrix } = $props();

  const NOW = new Date().getFullYear();

  const was = explorer.adopting === "edit" ? pet.dog : null;

  let name = $state(was?.name ?? "");
  let breed = $state<string | null>(was?.breed ?? null);
  let slug = $state<string | null>(was?.slug ?? null);
  let born = $state(was?.born ?? NOW - 4);
  let collar = $state<Collar>(
    was?.collar ?? COLLARS[pet.dogs.length % COLLARS.length]?.key ?? "red",
  );
  let parting = $state(false);

  let city = $state<Everyone | null>(null);

  $effect(() => {
    let live = true;
    void everyone().then((found) => {
      if (live) {
        city = found;
      }
    });

    return () => {
      live = false;
    };
  });

  const breeds = $derived(
    Object.entries(matrix.breeds)
      .map(([label, row]) => {
        let total = 0;
        for (const n of row) {
          total += n;
        }

        return { key: label, label, breed: label, total };
      })
      .toSorted((a, b) => b.total - a.total),
  );

  const places = $derived(
    hoods.features
      .map((f) => ({
        key: f.properties.slug,
        label: f.properties.name,
        sub: f.properties.borough,
        dogs: f.properties.dogs,
      }))
      .toSorted((a, b) => b.dogs - a.dogs),
  );

  const trimmed = $derived(name.trim());
  const shown = $derived(trimmed.length > 0 ? trimmed : "Your dog");
  const hood = $derived(places.find((p) => p.key === slug) ?? null);
  const ready = $derived(trimmed.length > 0 && breed != null && slug != null);

  const namesake = $derived.by(() => {
    if (city == null || trimmed.length < 2) {
      return null;
    }

    const n = city.names[nameKey(trimmed)] ?? 0;
    if (n === 0) {
      return `At most one licensed dog in the city is named ${nameKey(trimmed)}.`;
    }

    return `${count(n)} licensed dogs in the city are named ${nameKey(trimmed)}.`;
  });

  const years = $derived(
    Array.from({ length: NOW - FIRST_BORN + 1 }, (_, i) => {
      const year = FIRST_BORN + i;
      const at = city?.years.indexOf(year) ?? -1;

      return { year, n: at < 0 ? 0 : (city?.born[at] ?? 0) };
    }),
  );
  const tallest = $derived(Math.max(1, ...years.map((y) => y.n)));
  const age = $derived(NOW - born);
  const ageWords = $derived(
    age <= 0
      ? "a puppy this year"
      : age === 1
        ? "about a year old"
        : `about ${age} years old`,
  );
  const cohort = $derived(years.find((y) => y.year === born)?.n ?? 0);

  function pickYear(event: PointerEvent & { currentTarget: HTMLElement }) {
    const box = event.currentTarget.getBoundingClientRect();
    const t = (event.clientX - box.left) / Math.max(1, box.width);
    born = Math.min(
      NOW,
      Math.max(FIRST_BORN, FIRST_BORN + Math.floor(t * years.length)),
    );
  }

  function save() {
    if (!ready || breed == null || slug == null) {
      return;
    }

    pet.keep({
      id: was?.id ?? newId(),
      name: trimmed,
      breed,
      slug,
      born,
      collar,
    });
    explorer.adopting = null;
    explorer.showPet();
  }
</script>

<Dialog
  size="lg"
  label={was == null ? "Put your dog on the map" : `Edit ${was.name}`}
  onclose={() => {
    explorer.adopting = null;
  }}
>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    <p class="slab text-[0.625rem] tracking-[0.13em] text-signet uppercase">
      {was == null
        ? pet.dogs.length > 0
          ? "Another dog"
          : "One more dog"
        : "Your dog"}
    </p>
    <h2
      class="mt-1 -ml-0.5 font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
    >
      {was == null ? "Put your dog on the map" : `Edit ${was.name}`}
    </h2>

    <div
      class="relative mt-4 flex items-end justify-center gap-5 rounded-[6px] bg-foreground/[0.035] px-4 pt-5 pb-4 ring-1 ring-foreground/8 @max-xs:flex-wrap @max-xs:px-2"
    >
      <div class="relative flex h-24 min-w-24 items-end justify-center">
        {#if breed != null}
          {#key breed}
            <span
              class="block origin-bottom motion-safe:animate-[fetch_0.66s_linear]"
            >
              <Plate {breed} height={92} class="origin-bottom wag-hover" />
            </span>
          {/key}
        {:else}
          <span
            class="grid h-20 w-24 place-items-center rounded-[50%] border-[1.5px] border-dashed border-foreground/25 text-center text-[0.6875rem] leading-tight text-muted-foreground"
            >Pick a breed</span
          >
        {/if}
      </div>

      <div class="flex shrink-0 flex-col items-center pb-1">
        <svg viewBox="0 0 22 16" class="h-3.5 w-5" aria-hidden="true">
          <path
            d="M11 1.5 a6.5 6.5 0 1 0 0.01 0"
            class="fill-none stroke-[oklch(0.75_0.055_82)]"
            stroke-width="2.4"
          />
        </svg>
        <div
          class="relative -mt-2 min-w-28 swing rotate-2 rounded-[12px] px-4 pt-3 pb-2 text-center brass"
        >
          <span
            aria-hidden="true"
            class="absolute top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1.5px_rgb(0_0_0/0.6),0_1px_0_oklch(0.95_0.04_92/0.55)]"
          ></span>
          <span
            class="block font-sans text-[0.5rem] font-semibold tracking-[0.19em] uppercase stamped"
            >{hood?.label ?? "New York City"}</span
          >
          <span
            class="mt-0.5 flex max-w-44 justify-center overflow-hidden slab text-[1.3rem] leading-none whitespace-nowrap stamped @max-xs:max-w-20"
            aria-hidden="true"
          >
            {#each [...shown] as ch, i (`${i}${ch}`)}
              <span
                class={cn("inline-block whitespace-pre", {
                  "motion-safe:animate-[stamp_0.22s_ease-out]":
                    trimmed.length > 0,
                  "opacity-45": trimmed.length === 0,
                })}>{ch}</span
              >
            {/each}
          </span>
          <span
            class="mt-1 block font-sans text-[0.5rem] font-semibold tracking-[0.19em] uppercase stamped"
            >Born {born}</span
          >
        </div>
        <span
          aria-hidden="true"
          class="mt-1.5 h-1.5 w-20 rounded-full shadow-[inset_0_-1px_0_rgb(0_0_0/0.25)] transition-colors duration-300"
          style:background={COLLARS.find((c) => c.key === collar)?.color}
        ></span>
      </div>
    </div>

    <div class="mt-5 grid gap-4">
      <div>
        <label
          for="pet-name"
          class="slab text-[0.625rem] tracking-[0.13em] uppercase">Name</label
        >
        <input
          id="pet-name"
          type="text"
          autocomplete="off"
          spellcheck="false"
          maxlength={NAME_LONGEST}
          placeholder="What do you call them?"
          bind:value={name}
          class="mt-1 h-10 w-full rounded-[5px] bg-background/70 px-3 text-[0.875rem] text-foreground ring-1 ring-foreground/20 transition-shadow duration-200 contain-inline-size outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/60"
        />
        <p
          class="mt-1 min-h-lh text-[0.71875rem] leading-snug text-muted-foreground"
          aria-live="polite"
        >
          {namesake ?? ""}
        </p>
      </div>

      <Picker
        id="pet-breed"
        label="Breed"
        placeholder="Start typing a breed"
        options={breeds}
        value={breed}
        onpick={(key: string) => {
          breed = key;
        }}
      />

      <Picker
        id="pet-hood"
        label="Neighborhood"
        placeholder="Where do you live?"
        options={places}
        value={slug}
        onpick={(key: string) => {
          slug = key;
        }}
      />

      <div>
        <p
          id="pet-born-label"
          class="slab text-[0.625rem] tracking-[0.13em] uppercase"
        >
          Born
        </p>
        <p class="mt-1 text-[0.8125rem] leading-snug text-foreground/85">
          <strong class="numeric font-bold text-foreground">{born}</strong>, so
          {ageWords}.
          {#if cohort > 0}
            <span class="text-muted-foreground"
              >{count(cohort)} licensed dogs share the year.</span
            >
          {/if}
        </p>
        <div
          role="slider"
          tabindex="0"
          aria-labelledby="pet-born-label"
          aria-valuemin={FIRST_BORN}
          aria-valuemax={NOW}
          aria-valuenow={born}
          aria-valuetext="{born}, {ageWords}"
          class="mt-2 flex h-14 cursor-pointer touch-none items-end gap-0.5 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onpointerdown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pickYear(event);
          }}
          onpointermove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              pickYear(event);
            }
          }}
          onkeydown={(event) => {
            const step =
              event.key === "ArrowRight" || event.key === "ArrowUp"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? -1
                  : 0;
            if (step !== 0) {
              event.preventDefault();
              born = Math.min(NOW, Math.max(FIRST_BORN, born + step));
            }
          }}
        >
          {#each years as y (y.year)}
            <span
              class={cn(
                "relative flex-1 rounded-t-xs transition-[background-color,height] duration-300 ease-out",
                {
                  "bg-primary": y.year === born,
                  "bg-foreground/18": y.year !== born,
                },
              )}
              style:height="{Math.max(6, (y.n / tallest) * 100)}%"
            >
              {#if y.year === born}
                <span
                  aria-hidden="true"
                  class="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2"
                >
                  <svg
                    viewBox="0 0 30 30"
                    class="size-3 fill-primary motion-safe:animate-[stamp_0.25s_ease-out]"
                  >
                    <circle cx="7.4" cy="10.6" r="3.4" />
                    <circle cx="13.1" cy="7.6" r="3.7" />
                    <circle cx="19.2" cy="8.4" r="3.6" />
                    <circle cx="24.1" cy="13.4" r="3.1" />
                    <ellipse cx="14.6" cy="20.6" rx="7.1" ry="6.2" />
                  </svg>
                </span>
              {/if}
            </span>
          {/each}
        </div>
        <div
          class="mt-1 flex justify-between numeric text-[0.65625rem] text-muted-foreground"
          aria-hidden="true"
        >
          <span>{FIRST_BORN}</span>
          <span>licensed dogs by birth year</span>
          <span>{NOW}</span>
        </div>
      </div>

      <fieldset>
        <legend class="slab text-[0.625rem] tracking-[0.13em] uppercase"
          >Collar</legend
        >
        <div class="mt-1.5 flex gap-2.5 @max-xs:flex-wrap">
          {#each COLLARS as option (option.key)}
            <label
              class={cn(
                "relative grid size-8 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-background transition-[box-shadow,scale] duration-200 has-focus-visible:ring-2 has-focus-visible:ring-primary/60",
                {
                  "scale-110 ring-2 ring-foreground/70": collar === option.key,
                  "hover:scale-105": collar !== option.key,
                },
              )}
              style:background={option.color}
            >
              <input
                type="radio"
                name="collar"
                value={option.key}
                bind:group={collar}
                class="sr-only"
                aria-label="{option.key} collar"
              />
              <span
                aria-hidden="true"
                class="size-2.5 rounded-full brass shadow-none!"
              ></span>
            </label>
          {/each}
        </div>
      </fieldset>
    </div>

    <div
      class="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <button
        type="submit"
        disabled={!ready}
        class="cursor-pointer rounded-[10px] px-4 pt-2.5 pb-2 slab text-[0.875rem] brass transition-[translate,filter] duration-200 stamped hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-100 disabled:grayscale-[0.7]"
      >
        {was == null
          ? trimmed.length > 0
            ? `Put ${trimmed} on the map`
            : "Put your dog on the map"
          : "Save"}
      </button>

      {#if was != null}
        {#if parting}
          <span class="flex items-baseline gap-3 text-[0.78125rem]">
            <button
              type="button"
              class="cursor-pointer py-1 font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              onclick={() => {
                explorer.closePet();
                pet.release(was.id);
                explorer.adopting = null;
              }}>Yes, take {was.name} off</button
            >
            <button
              type="button"
              class="cursor-pointer py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground"
              onclick={() => {
                parting = false;
              }}>Keep them</button
            >
          </span>
        {:else}
          <button
            type="button"
            class="cursor-pointer py-1 text-[0.78125rem] font-medium text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
            onclick={() => {
              parting = true;
            }}>Take {was.name} off the map</button
          >
        {/if}
      {/if}
    </div>

    <p class="mt-4 text-[0.71875rem] leading-snug text-muted-foreground">
      Your dog stays in this browser. Nothing is sent anywhere, and the city’s
      counts do not change.
    </p>
  </form>
</Dialog>
