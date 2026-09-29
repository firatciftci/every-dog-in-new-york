<script lang="ts">
  import { ArrowRightIcon } from "@lucide/svelte";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import { weave } from "$lib/sentence";
  import { explorer } from "$lib/state.svelte";

  const hook = weave(
    `Your neighborhood does not agree with the rest of New York about dogs, and neither does the next one. Look up your dog’s name or breed.`,
    {},
  );
</script>

<p class="text-[13px] leading-relaxed text-foreground/85">
  <Sentence parts={hook} />
</p>
<p class="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px]">
  <button
    type="button"
    class="group flex cursor-pointer items-baseline gap-1.5 py-1 slab text-[13px] text-foreground transition-colors duration-200 hover:text-primary"
    onclick={() => {
      explorer.startWalk();
    }}
  >
    Walk me through it
    <ArrowRightIcon
      aria-hidden="true"
      class="size-3.5 translate-y-px text-primary transition-transform duration-200 group-hover:translate-x-0.5"
      strokeWidth={2.25}
    />
  </button>
  <button
    type="button"
    class="cursor-pointer py-1 font-medium text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
    onclick={() => {
      explorer.about = true;
    }}>How I built it</button
  >
</p>
