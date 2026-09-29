<script lang="ts" module>
  const STRANDS = [
    {
      d: "M14 0C9 9 17 15 12 25C7 35 15 41 11 52",
      blades: [
        { up: 7, len: 15, droop: 9 },
        { up: 17, len: 19, droop: 11 },
        { up: 28, len: 14, droop: 8 },
        { up: 38, len: 18, droop: 12 },
        { up: 47, len: 12, droop: 7 },
      ],
      lean: -7,
      slow: 4.6,
      at: 0,
    },
    {
      d: "M14 0C19 8 12 14 17 23C22 32 15 37 19 45",
      blades: [
        { up: 6, len: 13, droop: 8 },
        { up: 15, len: 17, droop: 11 },
        { up: 25, len: 15, droop: 9 },
        { up: 34, len: 11, droop: 6 },
      ],
      lean: 5,
      slow: 5.8,
      at: 0.9,
    },
    {
      d: "M14 0C12 7 18 11 15 18C12 25 17 29 14 35",
      blades: [
        { up: 5, len: 12, droop: 7 },
        { up: 12, len: 16, droop: 10 },
        { up: 21, len: 13, droop: 8 },
        { up: 29, len: 10, droop: 6 },
      ],
      lean: 12,
      slow: 5.1,
      at: 1.7,
    },
  ];

  function frond(up: number, len: number, droop: number, side: number) {
    const way = side % 2 === 0 ? 1 : -1;

    return (
      `M14 ${up}` +
      `c${way * 5} ${-1.2} ${way * (len * 0.7)} ${droop * 0.2} ${way * len} ${droop}` +
      `c${way * -(len * 0.6)} ${-droop * 0.28} ${way * -(len * 0.9)} ${-droop * 0.62} ${way * -len} ${-droop}`
    );
  }
</script>

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className }: { class?: string } = $props();
</script>

<span
  aria-hidden="true"
  class={cn("pointer-events-none absolute origin-top", className)}
>
  <!-- Two elements per strand: the lean and the sway animation both set transform. -->
  {#each STRANDS as strand, at (at)}
    <span
      class="absolute top-0 left-0 h-full w-full origin-top"
      style:transform="rotate({strand.lean}deg)"
    >
      <svg
        viewBox="0 0 28 56"
        class="h-full w-full origin-top overflow-visible motion-safe:animate-[sway_1s_ease-in-out_infinite]"
        style:animation-duration="calc(var(--1s) * {strand.slow})"
        style:animation-delay="{strand.at}s"
      >
        <g
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.6"
        >
          <path d={strand.d} />
          {#each strand.blades as blade, side (blade.up)}
            <path
              d={frond(blade.up, blade.len, blade.droop, side)}
              fill="currentColor"
              stroke="none"
            />
          {/each}
        </g>
      </svg>
    </span>
  {/each}
</span>
