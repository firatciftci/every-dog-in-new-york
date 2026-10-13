<script lang="ts">
  import { PawPrintIcon } from "@lucide/svelte";
  import type { Kind } from "#lib/crowd.js";

  let { kind }: { kind: Kind } = $props();
</script>

<span
  aria-hidden="true"
  class="pointer-events-none absolute bottom-0 left-1/2 z-20 block size-0"
>
  {#if kind === "sniff"}
    {#each [0, 1, 2] as step (step)}
      <span
        class="absolute block text-[#1d1b18] opacity-0 drop-shadow-[0_0_1.5px_#f7f4ec] motion-safe:animate-[sniff_calc(var(--1s)*1.1)_ease-out_both] motion-reduce:opacity-100"
        style:left="{-46 + step * 11}px"
        style:top="{-8 - (step % 2) * 9}px"
        style:animation-delay="{step * 0.28}s"
        style:rotate="{70 + step * 6}deg"
      >
        <PawPrintIcon class="size-3" strokeWidth={2.6} />
      </span>
    {/each}
  {:else if kind === "ball"}
    <svg
      viewBox="0 0 14 14"
      class="absolute -top-3.5 left-5 block size-3.5 motion-safe:animate-[toss_calc(var(--1s)*1.5)_both]"
    >
      <circle cx="7" cy="7" r="6.2" fill="#cfe04a" stroke="#1d1b18" />
      <path
        d="M2.2 3.4c2.4 1.6 2.4 5.6 0 7.2M11.8 3.4c-2.4 1.6-2.4 5.6 0 7.2"
        fill="none"
        stroke="#f7f4ec"
        stroke-width="1.2"
      />
    </svg>
  {:else}
    <span
      class="absolute bottom-9 left-3 block origin-bottom-left rounded-[10px] rounded-bl-xs border-[1.5px] border-[#1d1b18] bg-[#f7f4ec] px-1.5 py-0.5 slab text-[0.8125rem] leading-none text-[#1d1b18] shadow-[0_3px_8px_rgb(20_16_10/0.35)] motion-safe:animate-[woof_calc(var(--1s)*1.6)_both]"
    >
      Woof!
    </span>
  {/if}
</span>
