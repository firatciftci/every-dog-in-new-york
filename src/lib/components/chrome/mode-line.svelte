<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    id,
    options,
    size = "md",
  }: {
    id: string;
    options: ReadonlyArray<{
      key: string;
      word: string;
      gloss: string;
      on: boolean;
      dead?: boolean;
      count?: string;
      pick: () => void;
    }>;
    size?: "md" | "lg";
  } = $props();

  let over = $state<string | null>(null);

  const shown = $derived(
    options.find((o) => o.key === over) ??
      options.find((o) => o.on) ??
      options[0],
  );
</script>

<p
  class={cn("text-muted-foreground", {
    "-my-1 text-[12px] leading-relaxed": size === "md",
    "flex flex-wrap items-baseline gap-x-4 gap-y-1": size === "lg",
  })}
>
  {#each options as option, i (option.key)}
    {#if i > 0 && size !== "lg"}<span
        aria-hidden="true"
        class="mx-1.5 text-muted-foreground/45">·</span
      >{/if}<button
      type="button"
      aria-pressed={option.on}
      aria-describedby="{id}-{option.key}"
      disabled={option.dead === true}
      class={cn(
        "transition-colors duration-200",
        {
          "py-1 underline-offset-[3px]": size === "md",
          "py-0.5 font-display text-[20px] leading-tight font-bold tracking-tight":
            size === "lg",
        },
        {
          "font-semibold text-foreground underline decoration-primary decoration-2":
            size === "md" && option.on,
          "cursor-pointer text-foreground/70 underline decoration-primary/45 decoration-dotted hover:text-foreground hover:decoration-primary":
            size === "md" && !option.on && option.dead !== true,
        },
        {
          "text-foreground underline decoration-primary decoration-2 underline-offset-[6px]":
            size === "lg" && option.on,
          // 55%: 3.84:1 on paper; the 40% the picker used measured 2.49:1, under the 3:1 floor for large bold text.
          "cursor-pointer text-foreground/55 hover:text-foreground/85 hover:underline hover:decoration-primary/35 hover:decoration-2 hover:underline-offset-[6px]":
            size === "lg" && !option.on && option.dead !== true,
        },
        {
          "cursor-default text-foreground/60 disabled:opacity-100":
            option.dead === true,
        },
      )}
      onpointerenter={() => {
        over = option.key;
      }}
      onpointerleave={() => {
        over = null;
      }}
      onfocus={() => {
        over = option.key;
      }}
      onblur={() => {
        over = null;
      }}
      onclick={option.pick}
      >{option.word}{#if option.count != null}<span
          class="ml-1 inline-block numeric text-[10.5px] font-normal"
          >{option.count}</span
        >{/if}</button
    >{/each}
</p>

<!-- Full muted, not 85%: 85% measured 3.67:1, under the 4.5:1 floor for text this small. -->
<p
  aria-hidden="true"
  class="mt-2 truncate-clip text-[11.5px] leading-snug text-muted-foreground"
>
  {shown?.gloss ?? ""}
</p>

{#each options as option (option.key)}
  <span id="{id}-{option.key}" class="sr-only">{option.gloss}</span>
{/each}
