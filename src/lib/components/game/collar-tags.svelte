<script lang="ts">
  import type { Tag } from "#lib/game/parks.js";
  import { cn } from "#lib/utils.js";

  let {
    tags,
    earned,
    fresh,
  }: {
    tags: Array<Tag>;
    earned: ReadonlySet<string>;
    fresh: ReadonlySet<string>;
  } = $props();

  const wearing = $derived(
    tags.filter((t) => earned.has(t.id) || fresh.has(t.id)),
  );
  const left = $derived(
    tags.filter((t) => !earned.has(t.id) && !fresh.has(t.id)),
  );

  function list(names: Array<string>) {
    if (names.length <= 1) {
      return names.join("");
    }

    if (names.length === 2) {
      return `${names[0]} and ${names[1]}`;
    }

    return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
  }
</script>

<div class="relative -mx-4 select-none sm:-mx-5">
  <div
    class="relative h-3.5 w-full bg-[oklch(0.34_0.045_58)] shadow-[inset_0_-2px_3px_rgb(0_0_0/0.35),inset_0_2px_2px_oklch(0.62_0.06_60/0.5)] dark:bg-[oklch(0.28_0.04_56)]"
  >
    <div
      class="absolute inset-x-0 top-0.5 h-px border-t border-dashed border-[oklch(0.72_0.07_70/0.5)]"
    ></div>
    <div
      class="absolute inset-x-0 bottom-0.5 h-px border-t border-dashed border-[oklch(0.72_0.07_70/0.5)]"
    ></div>
  </div>

  {#if wearing.length > 0}
    <ul
      class="flex min-h-14 flex-wrap items-start justify-center gap-x-2 px-3"
      aria-label="Tags on the collar"
    >
      {#each wearing as tag, i (tag.id)}
        <li
          title={tag.how}
          class={cn("flex flex-col items-center", { "mt-4": i % 2 === 1 })}
          style:transform="rotate({((i % 3) - 1) * 2}deg)"
        >
          <svg
            viewBox="0 0 22 16"
            class="h-3.5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path
              d="M11 1.5 a6.5 6.5 0 1 0 0.01 0"
              class="fill-none stroke-[oklch(0.75_0.055_82)]"
              stroke-width="2.4"
            />
          </svg>
          <span
            class={cn(
              "-mt-1.5 rounded-[6px] px-1.5 pt-1.5 pb-1 text-center font-sans text-[7.5px] leading-[1.15] font-semibold tracking-widest brass uppercase stamped",
              {
                "swing motion-safe:animate-[drop-in_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]":
                  fresh.has(tag.id),
              },
            )}
          >
            {tag.name}
          </span>
          <span class="sr-only"
            >{fresh.has(tag.id) ? "earned this time" : "earned"}. {tag.how}.</span
          >
        </li>
      {/each}
    </ul>
  {/if}

  <p class="mt-2 px-4 text-[12px] leading-snug text-muted-foreground sm:px-5">
    {#if fresh.size > 0}
      <span class="text-primary"
        >New on the collar: {list(
          [...fresh].map((f) => tags.find((t) => t.id === f)?.name ?? f),
        )}.</span
      >
    {/if}
    {#if left.length === 0}
      Every tag is on the collar.
    {:else if wearing.length === 0}
      Nothing on the collar yet. First to earn: {list(
        left.slice(0, 3).map((t) => t.name),
      )}.
    {:else}
      Still to earn: {list(left.map((t) => t.name))}.
    {/if}
  </p>
</div>
