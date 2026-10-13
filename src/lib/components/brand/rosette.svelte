<script lang="ts" module>
  const CX = 64;
  const CY = 63;
  const WIDE = 128;
  const TALL = 216;

  function pleat(hub: number, rim: number, half: number, dome: number) {
    const swing = (half * half + dome * dome) / (2 * dome);
    const shoulder = CY - rim + dome;

    return `M${CX} ${CY - hub} L${CX - half} ${shoulder} A${swing} ${swing} 0 0 1 ${CX + half} ${shoulder} Z`;
  }

  const TIERS = [
    { at: 16, d: pleat(12, 61, 11.5, 3), turn: 180 / 16, lit: false },
    { at: 26, d: pleat(10, 47, 6, 1.6), turn: 0, lit: true },
  ] as const;

  const FOLD = "color-mix(in oklab, var(--color-primary) 70%, black)";
  const FACE = "var(--color-primary)";
  const LIT = "color-mix(in oklab, var(--color-primary) 84%, white)";

  const TAILS = {
    back: "M52 82 C50 122 45 166 34 212 L47 202 L56 216 C60 168 63 116 64 84 Z",
    front:
      "M76 82 C78 122 83 166 94 212 L81 202 L72 216 C68 168 65 116 64 84 Z",
    crease: "M57 120 C54 152 49 182 41 209",
    print: "M74 128 C77 157 82 184 89 210",
  } as const;

  const MILL = 44;
</script>

<script lang="ts">
  import Plate from "#lib/components/brand/plate.svelte";
  import { cn, count } from "#lib/utils.js";

  let {
    breed = "Labrador (or Crossbreed)",
    licenses,
    size = 162,
    class: className,
    onclick,
  }: {
    breed?: string;
    licenses: number;
    size?: number;
    class?: string;
    onclick?: () => void;
  } = $props();

  const uid = $props.id();
  const ring = $derived(`BEST IN SHOW · ${count(licenses)} DOGS · `);

  const HUB = `${((CY / TALL) * 100).toFixed(1)}%`;

  const CARD = 0.54;
  const DOG = 0.47;
</script>

<button
  type="button"
  {onclick}
  aria-label="New York best in show · {count(
    licenses,
  )} dogs · {breed}. How I built it."
  class={cn(
    "group relative block select-none motion-safe:animate-[swing_6s_ease-in-out_infinite] motion-safe:hover:animation-duration-[1.5s]",
    className,
  )}
  style:transform-origin="50% {HUB}"
  style:width="{size}px"
  style:height="{(size * TALL) / WIDE}px"
>
  <svg
    viewBox="0 0 {WIDE} {TALL}"
    class="absolute inset-0 size-full overflow-visible"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="fold-{uid}" x1="0.5" y1="1" x2="0.5" y2="0">
        <stop offset="0.42" style:stop-color={FOLD} />
        <stop offset="0.88" style:stop-color={FACE} />
        <stop offset="1" style:stop-color={FOLD} />
      </linearGradient>
      <linearGradient id="lit-{uid}" x1="0.5" y1="1" x2="0.5" y2="0">
        <stop offset="0.42" style:stop-color={FOLD} />
        <stop offset="0.88" style:stop-color={LIT} />
        <stop offset="1" style:stop-color={FACE} />
      </linearGradient>
      <linearGradient id="tail-{uid}" x1="0" y1="0" x2="1" y2="0.2">
        <stop offset="0" style:stop-color={FOLD} />
        <stop offset="0.45" style:stop-color={FACE} />
        <stop offset="1" style:stop-color={FOLD} />
      </linearGradient>
    </defs>

    <g class="drop-shadow-[0_2px_2px_rgb(40_24_14/0.3)]">
      <path d={TAILS.back} style:fill={FOLD} />
      <path d={TAILS.front} fill="url(#tail-{uid})" />
    </g>

    <path
      d={TAILS.crease}
      fill="none"
      stroke="rgb(40 24 14)"
      stroke-opacity="0.22"
      stroke-width="0.8"
    />
    <path id="print-{uid}" d={TAILS.print} fill="none" />
    <text
      class="fill-[oklch(0.9_0.055_88)] font-sans text-[0.3625rem] font-bold tracking-[0.14em] uppercase"
    >
      <textPath href="#print-{uid}" startOffset="20%">{"New York "}</textPath>
    </text>

    {#each TIERS as tier (tier.at)}
      <g class="drop-shadow-[0_1.5px_1.5px_rgb(40_24_14/0.34)]">
        {#each { length: tier.at } as _, i (i)}
          <path
            d={tier.d}
            fill={tier.lit ? `url(#lit-${uid})` : `url(#fold-${uid})`}
            style:stroke={FOLD}
            stroke-width="0.5"
            transform="rotate({(360 / tier.at) * i + tier.turn} {CX} {CY})"
          />
        {/each}
      </g>
    {/each}
  </svg>

  <span
    class="absolute left-1/2 aspect-square w-[61.7%] -translate-x-1/2 -translate-y-1/2 rounded-full brass ring-1 ring-[oklch(0.44_0.05_68)]/55"
    style:top={HUB}
  >
    <svg viewBox="0 0 80 80" class="size-full" aria-hidden="true">
      {#each { length: MILL } as _, i (i)}
        <line
          x1="40"
          y1="2.5"
          x2="40"
          y2="4.9"
          stroke="oklch(0.42 0.05 68)"
          stroke-opacity="0.38"
          stroke-width="0.8"
          transform="rotate({(360 / MILL) * i} 40 40)"
        />
      {/each}
    </svg>
  </span>

  <span
    class="absolute left-1/2 grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full paper shadow-[inset_0_1.5px_3px_rgb(40_24_14/0.28),inset_0_-1px_0_oklch(0.98_0.03_92/0.8)]"
    style:top={HUB}
    style:width="{CARD * 100}%"
  >
    <svg
      viewBox="0 0 64 64"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <g
        class="origin-[32px_32px] motion-safe:animate-[spin-slow_30s_linear_infinite] motion-safe:group-hover:animation-duration-[5s]"
      >
        <path
          id="ring-{uid}"
          d="M32 32 m-27 0 a27 27 0 1 1 54 0 a27 27 0 1 1 -54 0"
          fill="none"
        />
        <text
          class="fill-foreground font-sans text-[0.31875rem] font-bold tracking-[0.14em] uppercase"
        >
          <textPath href="#ring-{uid}" startOffset="0">{ring}</textPath>
        </text>
      </g>
    </svg>

    {#key breed}
      <Plate
        {breed}
        height={size * CARD * DOG}
        class="relative max-w-[58%] origin-bottom motion-safe:group-hover:animate-[wag_0.55s_ease-in-out]"
      />
    {/key}
  </span>
</button>
