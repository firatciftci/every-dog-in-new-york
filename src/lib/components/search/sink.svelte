<script lang="ts" module>
  const BEADS = [
    { x: 5, at: 0, slow: 1.05, drift: "0.14em", wide: "0.2em" },
    { x: 14, at: 0.5, slow: 1.4, drift: "-0.1em", wide: "0.3em" },
    { x: 24, at: 0.19, slow: 0.9, drift: "0.07em", wide: "0.16em" },
    { x: 34, at: 0.83, slow: 1.25, drift: "0.16em", wide: "0.26em" },
    { x: 44, at: 0.32, slow: 1.5, drift: "-0.13em", wide: "0.34em" },
    { x: 54, at: 1.02, slow: 1, drift: "0.09em", wide: "0.18em" },
    { x: 64, at: 0.62, slow: 1.32, drift: "-0.07em", wide: "0.28em" },
    { x: 75, at: 0.14, slow: 1.12, drift: "0.12em", wide: "0.22em" },
    { x: 87, at: 0.74, slow: 0.95, drift: "-0.15em", wide: "0.17em" },
  ];

  const DRIPS = [
    { x: 12, at: 0, wide: "0.17em" },
    { x: 38, at: 0.52, wide: "0.21em" },
    { x: 63, at: 0.24, wide: "0.15em" },
    { x: 86, at: 0.78, wide: "0.19em" },
  ];

  // 620ms of map camera before the water moves, then 2000ms of sea.
  const SETTLING = 2600;

  let acted = false;

  function pickUp(node: HTMLElement) {
    if (acted) {
      acted = false;
      node.focus({ preventScroll: true });
    }
  }

  function submerge(
    _node: Element,
    { over = SETTLING }: { over?: number } = {},
  ) {
    return {
      duration: over,
      css: (t: number, u: number) =>
        `opacity:${t};` +
        `color:color-mix(in oklab, #3d7fa3 ${u * 100}%, var(--color-muted-foreground));` +
        `filter:blur(${u * 5}px);` +
        `transform:translateY(${u * 22}px) scale(${1 - u * 0.06});`,
    };
  }

  function surface(
    _node: Element,
    { wait = 500, over = 700 }: { wait?: number; over?: number } = {},
  ) {
    return {
      delay: wait,
      duration: over,
      // pointer-events off until visible; both lines share one grid cell and the hidden one took presses.
      css: (t: number, u: number) =>
        `pointer-events:${t > 0.5 ? "auto" : "none"};` +
        `opacity:${t};` +
        `filter:blur(${u * 2.5}px);` +
        `transform:translateY(${u * 14}px);`,
    };
  }
</script>

<script lang="ts">
  import Brine from "$lib/components/brand/brine.svelte";
  import { explorer } from "$lib/state.svelte";
  import { cn } from "$lib/utils";

  const wet = $derived(explorer.dripping);
</script>

<div class="mt-1.5 grid">
  {#if explorer.settled}
    <p
      in:surface={{ wait: 0, over: 520 }}
      out:submerge={{ over: 380 }}
      class="col-start-1 row-start-1 text-[12.5px] text-muted-foreground"
    >
      Down it went.{" "}<button
        type="button"
        class="haul relative inline-block cursor-pointer font-medium underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-foreground"
        {@attach pickUp}
        onclick={() => {
          acted = true;
          explorer.unsink();
        }}
        >Fish Staten Island back out{#each DRIPS as drop (drop.x)}<span
            aria-hidden="true"
            class="drip"
            style:left="{drop.x}%"
            style:--at="{drop.at}s"
            style:--wide={drop.wide}
          ></span>{/each}</button
      >.
    </p>
  {:else if !explorer.gone}
    <p
      in:surface
      out:submerge
      class={cn("col-start-1 row-start-1 text-[12.5px]", { sodden: wet })}
    >
      {#if wet}
        <span class="relative inline-block text-brine"
          >Staten Island is dripping on the panel.<Brine
            drop={10}
            from={4}
            class="-bottom-0.5"
          /></span
        >{" "}
      {/if}
      <button
        type="button"
        class="relative isolate tide cursor-pointer"
        {@attach pickUp}
        onclick={() => {
          acted = true;
          explorer.sink();
        }}
      >
        <span class="hull"
          >{wet
            ? "Put it back in?"
            : "Alternatively, sink Staten Island."}</span
        >
        <span class="sea" aria-hidden="true"></span>
        <span class="foam" aria-hidden="true"></span>
        {#each BEADS as bead (bead.x)}
          <span
            aria-hidden="true"
            class="bead"
            style:left="{bead.x}%"
            style:--at="{bead.at}s"
            style:--slow={bead.slow}
            style:--drift={bead.drift}
            style:--wide={bead.wide}
          ></span>
        {/each}
      </button>
    </p>
  {/if}
</div>
