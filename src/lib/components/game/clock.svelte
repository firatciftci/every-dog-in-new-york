<script lang="ts">
  import type { OffLeash } from "#lib/game/off-leash.js";

  let { gameSeconds, clock }: { gameSeconds: number; clock: OffLeash } =
    $props();

  const label = $derived(`leashes on at ${clock.endHour}`);
  const minutes = $derived(clock.startMinute + gameSeconds / 60);
  const hourAngle = $derived(((clock.startHour + minutes / 60) / 12) * 360);
  const minuteAngle = $derived((minutes / 60) * 360);
  const secondAngle = $derived(((gameSeconds % 60) / 60) * 360);
  const left = $derived(Math.max(0, 1 - gameSeconds / clock.gameSeconds));
  const arc = $derived(2 * Math.PI * 26 * left);
</script>

<div class="flex flex-col items-center" aria-hidden="true">
  <svg viewBox="0 0 64 64" class="size-16 sm:size-18">
    <circle
      cx="32"
      cy="32"
      r="29"
      class="fill-background stroke-foreground/25"
      stroke-width="1"
    />
    <circle
      cx="32"
      cy="32"
      r="26"
      class="fill-none stroke-primary"
      stroke-width="3"
      stroke-linecap="round"
      stroke-dasharray="{arc} 999"
      transform="rotate(-90 32 32)"
    />
    {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
      <line
        x1="32"
        y1="8"
        x2="32"
        y2={i === 0 ? "13" : "11"}
        class={i === 0 ? "stroke-primary" : "stroke-foreground/60"}
        stroke-width={i === 0 ? "2.4" : "1.2"}
        transform="rotate({i * 30} 32 32)"
      />
    {/each}
    <line
      x1="32"
      y1="32"
      x2="32"
      y2="18"
      class="stroke-foreground"
      stroke-width="2.6"
      stroke-linecap="round"
      transform="rotate({hourAngle} 32 32)"
    />
    <line
      x1="32"
      y1="34"
      x2="32"
      y2="12"
      class="stroke-foreground"
      stroke-width="1.8"
      stroke-linecap="round"
      transform="rotate({minuteAngle} 32 32)"
    />
    <line
      x1="32"
      y1="36"
      x2="32"
      y2="10"
      class="stroke-primary"
      stroke-width="0.9"
      transform="rotate({secondAngle} 32 32)"
    />
    <circle cx="32" cy="32" r="1.6" class="fill-primary" />
  </svg>
  <p
    class="-mt-1 font-sans text-[0.5rem] font-semibold tracking-[0.14em] whitespace-nowrap text-foreground/70 uppercase"
  >
    {label}
  </p>
</div>
