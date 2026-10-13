<script lang="ts">
  import { PawPrintIcon } from "@lucide/svelte";
  import type { Kind } from "#lib/crowd.js";
  import { cn } from "#lib/utils.js";

  let {
    kind,
    label,
    disabled = false,
    onpress,
  }: {
    kind: Kind;
    label: string;
    disabled?: boolean;
    onpress: () => void;
  } = $props();
</script>

<button
  type="button"
  {disabled}
  onclickcapture={onpress}
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
        <circle cx="7" cy="7" r="6.2" fill="#cfe04a" stroke="#1d1b18" />
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
