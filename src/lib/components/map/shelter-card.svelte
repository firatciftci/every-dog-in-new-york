<script lang="ts" module>
  const WAITING = "Pit Bull (or Mix)";
</script>

<script lang="ts">
  import type { Shelter } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import Dialog from "#lib/components/chrome/dialog.svelte";
  import { DOORWAY, KENNEL } from "#lib/kennel.js";
  import { explorer } from "#lib/state.svelte.js";

  let { place }: { place: Shelter } = $props();

  const maps = $derived(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.maps ?? `${place.lat},${place.lon}`)}`,
  );

  const street = $derived(place.address.slice(0, place.address.indexOf(",")));
  const rest = $derived(place.address.slice(place.address.indexOf(",") + 2));

  const dialed = $derived(
    place.phone.replace(/^\+1-(\d{3})-(\d{3})-(\d{4})$/, "($1) $2-$3"),
  );
</script>

<Dialog
  label={place.name}
  onclose={() => {
    explorer.shelter = null;
  }}
>
  <div class="flex items-end justify-between gap-3">
    <div class="min-w-0 flex-1 pb-1">
      <h2
        class="-ml-0.5 font-display text-[26px] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
      >
        {place.name}
      </h2>
      <p
        class="mt-1 flex items-baseline gap-1.5 text-[13px] text-muted-foreground"
      >
        <svg
          viewBox="0 0 26 25"
          class="size-3 shrink-0 translate-y-px text-foreground/50"
          aria-hidden="true"
        >
          <path
            d={KENNEL}
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linejoin="round"
          />
          <path d={DOORWAY} fill="currentColor" />
        </svg>
        <span class="min-w-0"
          >{place.borough}{#if place.org !== place.name}, run by {place.org}{/if}</span
        >
      </p>
    </div>

    {#key place.slug}
      <Plate
        breed={WAITING}
        height={70}
        class="max-w-[34%] origin-bottom motion-safe:animate-[wag_0.6s_cubic-bezier(0.22,1,0.36,1)]"
      />
    {/key}
  </div>

  <div class="h-1.25 rounded-[50%] bg-primary/80"></div>

  <p class="mt-4 text-[14px] leading-relaxed text-foreground/85">
    {place.note}
  </p>

  <div class="mt-6">
    <a
      href={maps}
      target="_blank"
      rel="noreferrer external"
      class="slab text-[15.5px] text-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
      >{street}<span class="sr-only"> (opens in a new tab)</span></a
    >
    <p class="mt-0.5 text-[12.5px] text-muted-foreground">{rest}</p>
    <p class="mt-2 text-[13.5px] text-foreground/85">
      <a
        href="tel:{place.phone}"
        class="numeric underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        >{dialed}</a
      >{#if place.site != null}<span
          aria-hidden="true"
          class="px-2 text-muted-foreground/60">·</span
        ><a
          href={place.site}
          target="_blank"
          rel="noreferrer external"
          class="underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
          >{new URL(place.site).host.replace(/^www\./, "")}<span
            class="sr-only"
          >
            (opens in a new tab)</span
          ></a
        >{/if}
    </p>
  </div>

  <p
    class="mt-6 border-t rule pt-3 text-[12px] leading-relaxed text-muted-foreground"
  >
    Every shelter needs fosters, volunteers, and money. Hours change, so call
    before you go.
  </p>
</Dialog>
