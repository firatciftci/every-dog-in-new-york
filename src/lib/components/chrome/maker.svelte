<script lang="ts">
  import { AudioLinesIcon, Volume2Icon } from "@lucide/svelte";
  import Shahmaran from "#lib/components/brand/shahmaran.svelte";
  import Dialog from "#lib/components/chrome/dialog.svelte";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  const address = ["firat", "firatciftci.com"].join("@");
  const mailto = `mailto:${address}?subject=${encodeURIComponent("Hello Firat, your dog map brought me here")}`;

  const SAID = "https://www.firatciftci.com/pronunciation.mp3";

  let clip: HTMLAudioElement | null = null;
  let rest: ReturnType<typeof setTimeout> | undefined;

  let hot = $state(false);
  let speaking = $state(false);
  let heard = $state(false);
  const shown = $derived(hot || heard);

  function warm() {
    if (clip != null) {
      return clip;
    }
    clip = new Audio(SAID);
    clip.onplaying = () => {
      speaking = true;
    };
    clip.onended = () => {
      speaking = false;
      rest = setTimeout(() => {
        heard = false;
      }, 2400);
    };
    return clip;
  }

  async function say() {
    const sound = warm();
    clearTimeout(rest);
    heard = true;
    try {
      sound.currentTime = 0;
      await sound.play();
    } catch {
      speaking = false;
      heard = false;
      console.error("Failed to play the pronunciation clip");
    }
  }

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1600);
    } catch {
      console.error("Failed to copy email address to clipboard");
    }
  }
</script>

<Dialog
  size="lg"
  label="Who made this"
  onclose={() => {
    explorer.maker = false;
  }}
>
  <div class="flex items-end justify-between gap-4">
    <div class="min-w-0 flex-1 pb-1">
      <p class="slab text-[10px] tracking-[0.13em] text-signet uppercase">
        Made by
      </p>
      <h2
        class="mt-1 -ml-0.5 font-display text-[27px] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
      >
        <button
          type="button"
          aria-label="Firat Ciftci, hear how it is pronounced"
          class="inline-flex items-center gap-2 text-left"
          onclick={say}
          onpointerenter={(event) => {
            if (event.pointerType === "mouse") {
              hot = true;
              warm();
            }
          }}
          onpointerleave={() => {
            hot = false;
          }}
          onfocus={(event) => {
            hot = event.currentTarget.matches(":focus-visible");
            if (hot) {
              warm();
            }
          }}
          onblur={() => {
            hot = false;
          }}
        >
          Firat Ciftci
          {#if speaking}
            <AudioLinesIcon class="size-4 shrink-0 text-signet" />
          {:else}
            <Volume2Icon
              class={cn("size-4 shrink-0 transition-colors duration-200", {
                "text-signet": shown,
                "text-foreground/60": !shown,
              })}
            />
          {/if}
        </button>
      </h2>
      <p
        class="mt-1 grid text-[13px] *:transition-opacity *:duration-200 *:[grid-area:1/1]"
      >
        <span class={cn("text-muted-foreground", { "opacity-0": shown })}>
          Software engineer in Brooklyn, New York.
        </span>
        <span
          aria-hidden="true"
          class={cn(
            "font-['Times_New_Roman',Times,'DejaVu_Serif',serif] text-[14px] text-foreground/85",
            { "opacity-0": !shown },
          )}
        >
          <span class="text-muted-foreground">/</span>fɨˈɾätʰ t͡ʃift͡ʃɪ<span
            class="text-muted-foreground">/</span
          >
        </span>
      </p>
    </div>

    <div class="relative mr-1.5 mb-2 shrink-0">
      <span
        class="relative block w-28 rotate-2 mount p-1.5 pb-4.5 shadow-[0_1px_2px_rgb(60_50_40/0.2)] ring-1 ring-black/8"
      >
        <img
          src="/firat.jpg"
          alt="Firat Ciftci"
          width="320"
          height="320"
          decoding="async"
          class="aspect-square w-full bg-paper-300 object-cover"
        />
        <span
          class="absolute top-1.5 left-1.5 size-3.5 bg-paper-100/85 ring-1 ring-black/12 [clip-path:polygon(0_0,100%_0,0_100%)] ring-inset"
        ></span>
        <span
          class="absolute right-1.5 bottom-4.5 size-3.5 bg-paper-100/85 ring-1 ring-black/12 [clip-path:polygon(100%_0,100%_100%,0_100%)] ring-inset"
        ></span>
      </span>
      <span
        class="absolute -bottom-3 -left-10 block text-signet plate-cut [--plate-ring:1.2px] dark:[--plate-paper:var(--color-background)]"
      >
        <Shahmaran height={78} />
      </span>
    </div>
  </div>
  <div class="mt-2 h-1.25 rounded-[50%] bg-signet/80"></div>

  <div class="mt-4 grid gap-3.5 text-[14px] leading-relaxed text-foreground/85">
    <p>
      I built Every Dog in New York on my own, in SvelteKit and MapLibre, with a
      Python pipeline behind the numbers.
    </p>
    <p>
      I live in Brooklyn and work as a software engineer at the University of
      Chicago on the CORPUS team, building software for the digital humanities,
      mostly on the front end. The work I like best turns a dataset into
      something a person can read and explore. I also taught Data Publication
      for the Humanities there, a graduate course that began with static HTML
      and ended with a final project in Svelte.
    </p>
    <p>
      Outside of work, most of my projects are about Turkish words, places, and
      names. Since 2020 I have maintained Nişanyan Sözlük, an etymological
      dictionary of Turkish. I also work on Nişanyan Yeradları, a database of
      more than 72,000 historic place names in Turkey and neighboring countries,
      all of them on a map, and Nişanyan Adlar, a dictionary of Turkish personal
      names that shows how common each one is and where.
    </p>
    <p>
      The rest of the time I learn languages, play backgammon, try restaurants
      and bars around the city, and read, mostly nonfiction.
    </p>
  </div>

  <div
    data-pinned
    class="sticky bottom-0 z-10 -mx-6 mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 px-6 pt-5 pb-4"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 -top-5 bottom-0 -z-10 paper mask-t-from-45%"
    ></div>
    <a
      href={mailto}
      class="shout px-5 py-2 text-[16px] [--color-primary:var(--color-signet)]"
    >
      GET IN TOUCH
    </a>
    <p class="text-[13px] leading-none">
      <a
        href={mailto}
        class="font-medium text-signet underline decoration-signet/40 underline-offset-2 transition-colors duration-200 hover:decoration-signet"
        >{address}</a
      >
      <span role="status" class="sr-only">{copied ? "Copied" : ""}</span>
      <button
        type="button"
        onclick={copy}
        aria-label="Copy email address"
        class="rounded-full px-2 py-1.5 slab text-[10px] tracking-widest text-foreground/65 uppercase ring-1 ring-foreground/20 transition-colors duration-200 hover:text-foreground hover:ring-foreground/40"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </p>
  </div>

  <p class="mt-3 text-[12.5px] leading-snug text-muted-foreground">
    <a
      href="https://www.firatciftci.com"
      target="_blank"
      rel="noreferrer external"
      class="font-medium text-signet underline decoration-signet/40 underline-offset-2 transition-colors duration-200 hover:decoration-signet"
      >Personal website</a
    >
    ·
    <a
      href="https://github.com/firatciftci"
      target="_blank"
      rel="noreferrer external"
      class="font-medium text-signet underline decoration-signet/40 underline-offset-2 transition-colors duration-200 hover:decoration-signet"
      >GitHub</a
    >
    ·
    <a
      href="https://linkedin.com/in/ciftcifirat"
      target="_blank"
      rel="noreferrer external"
      class="font-medium text-signet underline decoration-signet/40 underline-offset-2 transition-colors duration-200 hover:decoration-signet"
      >LinkedIn</a
    >
  </p>

  <p class="mt-2 pb-9 text-[11.5px] leading-snug text-muted-foreground">
    The figure at top right is the Shahmaran, half woman and half snake, from
    the folklore of Anatolia, Mesopotamia, and Iran. It is said to ward off the
    evil eye. This version is by my friend
    <a
      href="https://www.ceyhun.info/"
      target="_blank"
      rel="noreferrer external"
      class="font-medium underline decoration-signet/40 underline-offset-2 transition-colors duration-200 hover:text-signet hover:decoration-signet"
      >Ceyhun</a
    >.
  </p>
</Dialog>
