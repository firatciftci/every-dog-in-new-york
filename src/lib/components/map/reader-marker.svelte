<script lang="ts">
  import { PawPrintIcon, XIcon } from "@lucide/svelte";
  import { Marker } from "svelte-maplibre";
  import { on } from "svelte/events";
  import type { Kind, Shown } from "#lib/crowd.js";
  import { aBreed } from "#lib/breeds.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import { crowd } from "#lib/crowd.svelte.js";
  import { collarOf, MIXED, pet } from "#lib/pet.svelte.js";
  import { cn } from "#lib/utils.js";
  import PingBurst from "./ping-burst.svelte";

  let {
    peer,
    nth,
    dog,
    hood,
    borough,
    at,
    grow,
    open,
    ontoggle,
    onclose,
  }: {
    peer: string;
    nth: number;
    dog: Shown;
    hood: string;
    borough: string;
    at: [number, number];
    grow: number;
    open: boolean;
    ontoggle: () => void;
    onclose: () => void;
  } = $props();

  const KINDS: ReadonlyArray<{ kind: Kind; label: string; noun: string }> = [
    { kind: "sniff", label: "Sniff", noun: "sniff" },
    { kind: "ball", label: "Toss a ball", noun: "ball" },
    { kind: "bark", label: "Bark", noun: "bark" },
  ];

  const collar = $derived(collarOf(dog.collar));
  const title = $derived(
    dog.name ?? (dog.breed === MIXED ? "Mixed breed" : dog.breed),
  );
  const kindOf = $derived(aBreed(dog.breed));
  const scale = $derived(0.35 + 0.65 * grow);

  let echo = $state<{ n: number; kind: Kind } | null>(null);
  let resting = $state(false);
  let over = $state(false);

  $effect(() => {
    if (echo == null) {
      return;
    }

    resting = true;
    const done = setTimeout(() => {
      resting = false;
    }, 1600);

    return () => clearTimeout(done);
  });

  $effect(() => {
    if (!open) {
      return;
    }

    // preventDefault marks it handled so the page's own Escape does not also clear the map.
    return on(document, "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onclose();
      }
    });
  });

  function send(kind: Kind) {
    const from = pet.dog == null ? null : pet.dogs.indexOf(pet.dog);
    crowd.ping(peer, nth, kind, from);
    echo = { n: (echo?.n ?? 0) + 1, kind };
  }

  // Native listeners, and capture-phase clicks inside: Svelte delegates to the document root, above the map.
  function swallow(node: HTMLElement) {
    const stop = (event: Event) => {
      event.stopPropagation();
    };
    const off = [
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "dblclick",
      "touchstart",
      "touchend",
      "mousemove",
      "mouseover",
      "pointermove",
      "pointerover",
      "click",
    ].map((type) => on(node, type as "click", stop));

    return () => {
      for (const end of off) {
        end();
      }
    };
  }
</script>

<Marker
  lngLat={at}
  anchor="bottom"
  zIndex={open || over ? 21 : 11}
  class="cursor-auto!"
>
  <div class="relative" {@attach swallow}>
    <button
      type="button"
      aria-label="{dog.name == null
        ? `${kindOf} from ${hood}`
        : `${dog.name}, ${kindOf} from ${hood}`}, another reader’s dog"
      aria-expanded={open}
      class="group relative -m-1.5 block cursor-pointer p-1.5 outline-none"
      onclickcapture={ontoggle}
      onpointerenter={() => {
        over = true;
      }}
      onpointerleave={() => {
        over = false;
      }}
    >
      <span
        class="relative block h-12 w-13 origin-bottom transition-[scale] duration-150"
        style:scale
      >
        <span
          aria-hidden="true"
          class="absolute bottom-0 left-1/2 size-10 -translate-x-1/2 rounded-full bg-[#f7f4ec] shadow-[0_0_0_2.5px_var(--collar),0_0_0_3.5px_rgb(255_255_255/0.8),0_4px_10px_rgb(20_16_10/0.4)] transition-[scale] duration-200 group-hover:scale-105"
          style:--collar={collar}
        ></span>
        <span
          class="absolute inset-x-0 bottom-0 mx-auto block w-max origin-bottom group-hover:animate-[wag_calc(var(--1s)*0.55)_ease-in-out]"
        >
          <Plate breed={dog.breed} height={40} halo />
        </span>
        {#if echo != null}
          {#key echo.n}
            <PingBurst kind={echo.kind} />
          {/key}
        {/if}
      </span>
    </button>

    {#if open}
      <div
        role="group"
        aria-label="{title}, another reader’s dog"
        tabindex="-1"
        {@attach (node: HTMLElement) => {
          node.focus({ preventScroll: true });
        }}
        class="absolute left-1/2 w-60 -translate-x-1/2 rounded-[10px] paper p-3 text-left font-display text-foreground shadow-[0_10px_30px_rgb(20_16_10/0.45)] outline outline-foreground/15 focus:outline-foreground/15"
        style:bottom="{10 + 48 * scale}px"
        style:--collar={collar}
      >
        <button
          type="button"
          onclickcapture={onclose}
          aria-label="Close"
          title="Close"
          class="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <XIcon aria-hidden="true" class="size-3.5" />
        </button>

        <p
          class="pr-5 text-[1.375rem] leading-[1.05] font-bold tracking-tight text-pretty wrap-break-word"
        >
          {title}
        </p>
        <p class="mt-1 text-[0.75rem] leading-snug text-foreground/85">
          {dog.name == null
            ? `From ${hood}, ${borough}.`
            : `${kindOf.slice(0, 1).toUpperCase()}${kindOf.slice(1)} from ${hood}, ${borough}.`}
          Added by a reader who has the map open now.
        </p>

        <div class="mt-2.5 border-t rule pt-2">
          <p class="text-[0.71875rem] leading-snug text-muted-foreground">
            {#if echo != null}
              {dog.name ?? `This ${dog.breed === MIXED ? "dog" : dog.breed}`} got
              your {KINDS.find((k) => k.kind === echo?.kind)?.noun}.
            {:else if pet.dog != null && !crowd.hidden}
              Say hello from {pet.dog.name}.
            {:else}
              Say hello.
            {/if}
          </p>
          <p class="mt-2 grid grid-cols-3 gap-2">
            {#each KINDS as { kind, label } (kind)}
              <button
                type="button"
                disabled={resting}
                onclickcapture={() => send(kind)}
                class="group/hi flex cursor-pointer flex-col items-center gap-1 rounded-[9px] bg-[#f7f4ec] px-1 pt-2 pb-1.5 text-[#1d1b18] shadow-[0_2.5px_0_#1d1b18] ring-[1.5px] ring-[#1d1b18] transition-[translate,box-shadow,background-color] duration-100 enabled:hover:bg-[color-mix(in_oklab,var(--collar)_20%,#f7f4ec)] enabled:active:translate-y-0.5 enabled:active:shadow-[0_0.5px_0_#1d1b18] disabled:cursor-default"
              >
                <span
                  aria-hidden="true"
                  class={cn("grid size-6 place-items-center", {
                    "motion-safe:group-enabled/hi:group-hover/hi:animate-[snuffle_calc(var(--1s)*0.7)_ease-in-out_infinite]":
                      kind === "sniff",
                    "motion-safe:group-enabled/hi:group-hover/hi:animate-[bounce_calc(var(--1s)*0.9)_ease-in-out_infinite]":
                      kind === "ball",
                    "motion-safe:group-enabled/hi:group-hover/hi:animate-[yap_calc(var(--1s)*0.6)_ease-in-out_infinite]":
                      kind === "bark",
                  })}
                >
                  {#if kind === "sniff"}
                    <PawPrintIcon
                      class="size-5 rotate-20"
                      fill="var(--collar)"
                      strokeWidth={1.75}
                    />
                  {:else if kind === "ball"}
                    <svg viewBox="0 0 14 14" class="block size-5">
                      <circle
                        cx="7"
                        cy="7"
                        r="6.2"
                        fill="#cfe04a"
                        stroke="#1d1b18"
                      />
                      <path
                        d="M2.2 3.4c2.4 1.6 2.4 5.6 0 7.2M11.8 3.4c-2.4 1.6-2.4 5.6 0 7.2"
                        fill="none"
                        stroke="#f7f4ec"
                        stroke-width="1.2"
                      />
                    </svg>
                  {:else}
                    <svg viewBox="0 0 24 24" class="block size-5.5">
                      <path
                        d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                        fill="var(--collar)"
                        stroke="#1d1b18"
                        stroke-width="1.75"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M12 7v4.5"
                        stroke="#1d1b18"
                        stroke-width="2.25"
                        stroke-linecap="round"
                      />
                      <circle cx="12" cy="13.6" r="1.15" fill="#1d1b18" />
                    </svg>
                  {/if}
                </span>
                <span class="text-[0.6875rem] leading-none font-semibold">
                  {label}
                </span>
              </button>
            {/each}
          </p>
        </div>
      </div>
    {/if}
  </div>
</Marker>
