<script lang="ts" module>
  const BUBBLES = [
    { x: 27, at: "0.16s", slow: 1.15, drift: "0.09em", wide: "0.24em" },
    { x: 54, at: "0s", slow: 0.95, drift: "-0.07em", wide: "0.3em" },
    { x: 76, at: "0.3s", slow: 1.3, drift: "0.13em", wide: "0.2em" },
  ];

  const PLAY = 2100;
</script>

<script lang="ts">
  import { watch } from "runed";
  import Brine from "$lib/components/brand/brine.svelte";
  import { cn, count } from "$lib/utils";

  let {
    licenses,
    year,
    size = "rail",
    hung = true,
  }: {
    licenses: number;
    year: string;
    size?: "hero" | "rail" | "sheet";
    // Faded rather than unmounted: the shell measures the collar height for the shortest rest.
    hung?: boolean;
  } = $props();

  const now = $derived(count(licenses));

  let before = $state<string | null>(null);
  let playing = $state(false);
  let way = $state(1);
  let turn = $state(0);
  let clock: ReturnType<typeof setTimeout> | undefined;

  watch(
    () => licenses,
    (next, last) => {
      if (last === undefined || next === last) {
        return;
      }

      // Character for character only while the line is the same length; a shorter figure has no pairs.
      const was = count(last);
      before = was.length === now.length ? was : null;
      way = next < last ? 1 : -1;
      playing = true;
      turn += 1;

      clearTimeout(clock);
      clock = setTimeout(() => {
        before = null;
        playing = false;
      }, PLAY);
    },
  );

  $effect(() => () => {
    clearTimeout(clock);
  });

  const cells = $derived(
    [...now].map((char, i) => {
      const old = before?.[i];

      return { char, gone: old == null || old === char ? null : old };
    }),
  );
</script>

<div class="relative shrink-0 select-none">
  <div
    class={cn(
      "relative h-4 w-full bg-[oklch(0.34_0.045_58)] shadow-[inset_0_-2px_3px_rgb(0_0_0/0.35),inset_0_2px_2px_oklch(0.62_0.06_60/0.5)] tag-ease dark:bg-[oklch(0.28_0.04_56)]",
      { "tall:h-5": size === "hero" },
    )}
  >
    <div
      class={cn(
        "absolute inset-x-0 h-px border-t border-dashed border-[oklch(0.72_0.07_70/0.5)]",
        { "top-1": size === "hero", "top-0.75": size !== "hero" },
      )}
    ></div>
    <div
      class={cn(
        "absolute inset-x-0 h-px border-t border-dashed border-[oklch(0.72_0.07_70/0.5)]",
        { "bottom-1": size === "hero", "bottom-0.75": size !== "hero" },
      )}
    ></div>
  </div>

  <div
    class={cn("transition-opacity duration-300", { "opacity-0": !hung })}
    inert={!hung}
  >
    <div class="flex justify-center pt-px">
      <svg
        viewBox="0 0 22 16"
        class={cn("h-3.5 w-5 tag-ease", {
          "tall:h-4.5 tall:w-6.5": size === "hero",
        })}
        aria-hidden="true"
      >
        <path
          d="M11 1.5 a6.5 6.5 0 1 0 0.01 0"
          class="fill-none stroke-[oklch(0.75_0.055_82)]"
          stroke-width="2.4"
        />
      </svg>
    </div>

    <div
      class={cn("-mt-2 flex justify-center tag-ease", {
        "tall:-mt-2.5": size === "hero",
      })}
    >
      <div
        class={cn("relative swing text-center brass tag-ease", {
          "rounded-[12px] px-4.5 pt-2.5 pb-1.5 tall:rounded-[16px] tall:px-6 tall:pt-4 tall:pb-3":
            size === "hero",
          "rounded-[13px] px-5 pt-3.5 pb-2.5": size === "rail",
          "rounded-[12px] px-4 pt-2.5 pb-1.5": size === "sheet",
        })}
      >
        <span
          class={cn(
            "absolute top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-[oklch(0.48_0.05_70)] shadow-[inset_0_1px_1.5px_rgb(0_0_0/0.6),0_1px_0_oklch(0.95_0.04_92/0.55)] tag-ease",
            { "tall:top-2 tall:size-2.5": size === "hero" },
          )}
        ></span>

        <p
          class={cn(
            "font-sans font-semibold tracking-[0.19em] uppercase tag-ease stamped",
            {
              "text-[7.5px] tall:text-[9px]": size === "hero",
              "text-[8.5px]": size === "rail",
              "text-[8px]": size === "sheet",
            },
          )}
        >
          New York City
        </p>
        <p
          class={cn(
            "relative mt-0.5 flex justify-center slab leading-none tag-ease stamped",
            {
              "text-[clamp(1.05rem,4vw,1.35rem)] tall:text-[clamp(1.35rem,5vw,1.85rem)]":
                size === "hero",
              "text-[1.5rem]": size === "rail",
              "text-[1.2rem]": size === "sheet",
            },
            { heave: playing, sodden: playing && way < 0 },
          )}
          style:--way={way}
        >
          <span class="sr-only">{now}</span>
          {#each cells as cell, i (i)}
            <span aria-hidden="true" class="relative grid" style:--i={i}>
              {#key turn}
                {#if cell.gone != null}
                  <span class="col-start-1 row-start-1 undertow"
                    >{cell.gone}</span
                  >
                {/if}
                <span
                  class={cn("col-start-1 row-start-1", {
                    struck: cell.gone != null,
                  })}>{cell.char}</span
                >
              {/key}
            </span>
          {/each}

          {#if playing && way > 0}
            {#each BUBBLES as bubble (bubble.x)}
              <span
                aria-hidden="true"
                class="bead rising"
                style:left="{bubble.x}%"
                style:--at={bubble.at}
                style:--slow={bubble.slow}
                style:--drift={bubble.drift}
                style:--wide={bubble.wide}
              ></span>
            {/each}
          {:else if playing}
            <Brine drop={13} from={3} class="-bottom-1" />
          {/if}
        </p>
        <p
          class={cn(
            "font-sans font-semibold tracking-[0.19em] uppercase tag-ease stamped",
            {
              "mt-0.5 text-[7.5px] tall:mt-1 tall:text-[9px]": size === "hero",
              "mt-1 text-[8.5px]": size === "rail",
              "mt-0.5 text-[8px]": size === "sheet",
            },
          )}
        >
          Dog licenses · {year}
        </p>
      </div>
    </div>
  </div>
</div>
