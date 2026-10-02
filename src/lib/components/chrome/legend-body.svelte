<script lang="ts">
  import { ChevronDownIcon, PawPrintIcon } from "@lucide/svelte";
  import type { Painted } from "#lib/layers.js";
  import type { CatKey } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";

  let {
    painted,
    compactCaption = false,
  }: { painted: Painted; compactCaption?: boolean } = $props();

  const uid = $props.id();

  let crowd = $state<CatKey | null>(null);
  const open = $derived(painted.key != null && crowd === painted.key);

  function places(n: number) {
    return n === 1 ? "1 neighborhood" : `${count(n)} neighborhoods`;
  }

  function keeping(key: CatKey, label: string) {
    const filter = explorer.filterAt(`in:${key}`);

    return (
      filter?.kind === "in" &&
      !filter.negate &&
      filter.values.length === 1 &&
      filter.values[0] === label
    );
  }

  function only(key: CatKey, label: string) {
    if (keeping(key, label)) {
      explorer.removeFilter(`in:${key}`);

      return;
    }

    explorer.addFilter({
      kind: "in",
      field: key,
      values: [label],
      negate: false,
    });
    explorer.capSheet("peek");
    explorer.zoomIfNarrow();
  }
</script>

{#if painted.kind === "sequential"}
  <div class="flex h-2.5 overflow-clip rounded-xs ring-1 ring-border">
    {#each painted.legend as entry (entry.color)}
      <span class="flex-1" style:background={entry.color}></span>
    {/each}
  </div>
  <div
    class="mt-1.5 flex justify-between numeric text-[10.5px] text-muted-foreground"
  >
    <span>{painted.legend[0]?.label.split("–")[0]}</span>
    <span>{painted.legend.at(-1)?.label}</span>
  </div>
{:else}
  <ul class="-mx-1 grid">
    {#each painted.legend as entry, i (entry.label)}
      {const key = $derived(painted.key)}
      {const inside = $derived(entry.members)}
      {const named = $derived(inside == null && entry.areas != null)}
      {const on = $derived(key != null && named && keeping(key, entry.label))}
      {const keeps = $derived(entry.keeps ?? entry.areas)}
      {const empty = $derived(keeps === 0)}
      <li class="min-w-0">
        <button
          type="button"
          disabled={key == null || (!named && inside == null) || (empty && !on)}
          aria-pressed={inside == null ? on : undefined}
          aria-expanded={inside == null ? undefined : open}
          aria-controls={inside == null ? undefined : `${uid}-inside`}
          class={cn(
            "flex w-full items-end gap-2.5 rounded-[3px] px-1 py-0.5 text-left transition-colors duration-200 enabled:hover:bg-foreground/[0.035] disabled:cursor-default disabled:opacity-100",
            { "bg-foreground/6": on },
          )}
          onclick={() => {
            if (inside != null) {
              crowd = open ? null : key;
            } else if (key != null && named) {
              only(key, entry.label);
            }
          }}
          onpointerenter={() => {
            if (key != null && named) {
              explorer.point(key, entry.label);
            }
          }}
          onpointerleave={() => explorer.point("slug", null)}
          onfocus={() => {
            if (key != null && named) {
              explorer.point(key, entry.label);
            }
          }}
          onblur={() => explorer.point("slug", null)}
        >
          <span
            class={cn("relative grid h-8.5 w-10 shrink-0 place-items-end", {
              "opacity-60": empty && !on,
            })}
          >
            <span
              class="absolute bottom-0 left-1/2 h-1.5 w-8.5 -translate-x-1/2 rounded-[50%]"
              style:background={entry.color}
              style:opacity={named ? 1 : 0.85}
            ></span>
            {#if named}
              <Plate
                breed={entry.label}
                height={32}
                flip={i % 2 === 1}
                class="relative mx-auto max-w-10 origin-bottom wag-hover"
              />
            {:else}
              <PawPrintIcon
                class="relative mb-1.5 size-4 text-muted-foreground/60"
                fill="currentColor"
              />
            {/if}
          </span>

          <span class="flex min-w-0 flex-1 items-baseline gap-1 pb-0.5">
            <span
              class={cn(
                "min-w-0 text-[13.5px] leading-tight text-pretty transition-colors duration-200",
                {
                  "font-semibold text-foreground": on,
                  "text-foreground/90": !on && !empty,
                  "text-foreground/60": empty && !on,
                },
              )}
            >
              {entry.label}
            </span>
            {#if inside != null}
              <ChevronDownIcon
                class={cn(
                  "size-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200",
                  { "rotate-180": open },
                )}
                strokeWidth={2.25}
              />
              <span class="sr-only">
                {inside.length.toLocaleString("en-US")} of them, sharing the one color.
              </span>
            {/if}

            {#if keeps != null}
              <span
                class="ml-auto shrink-0 numeric text-[11px] text-muted-foreground tabular-nums"
              >
                {places(keeps)}
              </span>
            {/if}
          </span>
        </button>

        {#if inside != null && open}
          <ul
            id="{uid}-inside"
            class="mt-1 mb-2 ml-3.5 grid border-l-2 pl-2.5"
            style:border-color={entry.color}
          >
            {#each inside as member, j (member.label)}
              {const held = $derived(member.keeps ?? member.areas)}
              {const gone = $derived(held === 0)}
              {const lit = $derived(key != null && keeping(key, member.label))}
              <li class="min-w-0">
                <button
                  type="button"
                  disabled={key == null || (gone && !lit)}
                  aria-pressed={lit}
                  class={cn(
                    "flex w-full items-end gap-2 rounded-[3px] px-1 py-px text-left transition-colors duration-200 enabled:hover:bg-foreground/[0.035] disabled:cursor-default disabled:opacity-100",
                    { "bg-foreground/6": lit },
                  )}
                  onclick={() => {
                    if (key != null) {
                      only(key, member.label);
                    }
                  }}
                  onpointerenter={() => {
                    if (key != null) {
                      explorer.point(key, member.label);
                    }
                  }}
                  onpointerleave={() => explorer.point("slug", null)}
                  onfocus={() => {
                    if (key != null) {
                      explorer.point(key, member.label);
                    }
                  }}
                  onblur={() => explorer.point("slug", null)}
                >
                  <span
                    class={cn("grid h-6 w-7 shrink-0 place-items-end", {
                      "opacity-60": gone && !lit,
                    })}
                  >
                    <Plate
                      breed={member.label}
                      height={22}
                      flip={j % 2 === 1}
                      class="mx-auto max-w-7 origin-bottom wag-hover"
                    />
                  </span>

                  <span class="flex min-w-0 flex-1 items-baseline gap-2 pb-0.5">
                    <span
                      class={cn(
                        "min-w-0 text-[12.5px] leading-tight text-pretty transition-colors duration-200",
                        {
                          "font-semibold text-foreground": lit,
                          "text-foreground/85": !lit && !gone,
                          "text-foreground/60": gone && !lit,
                        },
                      )}
                    >
                      {member.label}
                    </span>

                    {#if held != null}
                      <span
                        class="ml-auto shrink-0 numeric text-[11px] text-muted-foreground tabular-nums"
                      >
                        <span aria-hidden="true">{count(held)}</span>
                        <span class="sr-only">{places(held)}</span>
                      </span>
                    {/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<p
  class="mt-2.5 border-t rule pt-4 text-[11.5px] leading-snug text-muted-foreground"
  class:sr-only={compactCaption}
>
  {painted.caption}
</p>
