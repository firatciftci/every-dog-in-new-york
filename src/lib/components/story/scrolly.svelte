<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "#lib/utils.js";

  let {
    steps,
    graphic,
    caption,
    onstep,
  }: {
    steps: Array<Snippet>;
    graphic: Snippet<[number]>;
    caption: (at: number) => string;
    onstep?: (at: number) => void;
  } = $props();

  let active = $state(0);
  const said = $derived(caption(active));

  function watchStep(index: number) {
    return (node: HTMLElement) => {
      const root = node.closest<HTMLElement>("[data-story-scroll]");
      const seen = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && active !== index) {
              active = index;
              onstep?.(index);
            }
          }
        },
        { root, rootMargin: "-45% 0px -45% 0px" },
      );
      seen.observe(node);

      return () => {
        seen.disconnect();
      };
    };
  }
</script>

<div
  class="relative mx-auto w-full max-w-315 @min-[55rem]:grid @min-[55rem]:grid-cols-[minmax(18rem,25rem)_minmax(0,1fr)] @min-[55rem]:gap-x-[clamp(2.5rem,5vw,5.5rem)] @min-[55rem]:px-[clamp(1.5rem,4vw,4rem)]"
>
  <figure
    aria-hidden="true"
    class="sticky top-14 z-0 flex h-[52dvh] flex-col self-start px-3 pt-3 pb-2 @min-[55rem]:order-2 @min-[55rem]:h-[calc(100dvh-3.5rem)] @min-[55rem]:justify-center @min-[55rem]:px-0 @min-[55rem]:py-[5vh]"
  >
    <div class="relative min-h-0 w-full flex-1 @min-[55rem]:max-h-176">
      {@render graphic(active)}
    </div>
    <figcaption
      class="relative mt-2 h-9 shrink-0 text-[0.78125rem] leading-snug text-muted-foreground @min-[55rem]:mt-4"
    >
      {#key said}
        <span class="absolute inset-0 animate-in duration-500 fade-in"
          >{said}</span
        >
      {/key}
    </figcaption>
  </figure>

  <div
    class="pointer-events-none relative z-10 mt-[-52dvh] @min-[55rem]:order-1 @min-[55rem]:mt-0"
  >
    {#each steps as step, i (i)}
      <section
        {@attach watchStep(i)}
        class={cn(
          "flex min-h-[96dvh] items-end px-3 pb-4 @min-[55rem]:items-center @min-[55rem]:px-0 @min-[55rem]:pb-0",
          { "min-h-[calc(100dvh-3.5rem)]": i === 0 },
        )}
      >
        <div
          class={cn(
            "pointer-events-auto w-full rounded-[5px] paper px-4 py-3.5 text-[0.90625rem] leading-[1.55] text-foreground/90 shadow-[0_1px_0_rgb(58_48_38/0.14),0_14px_34px_-6px_rgb(58_48_38/0.28)] ring-1 ring-foreground/8 transition-[opacity,translate] duration-[calc(var(--1s)*0.55)] ease-[cubic-bezier(0.22,1,0.36,1)] @min-[55rem]:rounded-none @min-[55rem]:bg-none @min-[55rem]:px-0 @min-[55rem]:py-0 @min-[55rem]:text-[1.03125rem] @min-[55rem]:leading-[1.62] @min-[55rem]:shadow-none @min-[55rem]:ring-0 dark:shadow-[0_14px_34px_-6px_rgb(0_0_0/0.6)] @min-[55rem]:dark:shadow-none",
            {
              "@min-[55rem]:translate-y-1.5 @min-[55rem]:opacity-30":
                active !== i,
            },
          )}
        >
          {@render step()}
        </div>
      </section>
    {/each}
    <div class="h-[24dvh]"></div>
  </div>
</div>
