<script lang="ts">
  import { ChevronDownIcon, XIcon } from "@lucide/svelte";
  import { watch } from "runed";
  import { expoOut } from "svelte/easing";
  import { MediaQuery } from "svelte/reactivity";
  import { slide } from "svelte/transition";
  import type { HoodCollection, Matrix } from "$lib/types";
  import Sentence from "$lib/components/chrome/sentence.svelte";
  import { matching } from "$lib/query";
  import { askParts, shelf } from "$lib/saved.svelte";
  import { scrollEdges } from "$lib/scroll";
  import { partsText } from "$lib/sentence";
  import { askQuery, readAsk } from "$lib/share";
  import { explorer } from "$lib/state.svelte";
  import { cn } from "$lib/utils";

  let { hoods, matrix }: { hoods: HoodCollection; matrix: Matrix } = $props();

  const list = $props.id();
  const all = $derived(hoods.features.map((feature) => feature.properties));

  const mine = $derived(
    askQuery({
      layer: explorer.layer,
      focus: explorer.focus,
      filters: explorer.filters,
      selected: null,
      rivals: explorer.rivals,
    }),
  );
  const saved = $derived(shelf.has(mine));
  const kept = $derived(shelf.views.length);

  const rows = $derived(
    shelf.views.map((view) => {
      const ask = readAsk(view.q);
      const parts = askParts(ask, all);

      return {
        q: view.q,
        ask,
        parts,
        text: partsText(parts),
        live: view.q === mine,
        empty:
          ask.filters.length > 0 &&
          (matching(hoods, matrix, ask.filters)?.size ?? 0) === 0,
      };
    }),
  );

  const ARMED = 6000;

  let arming = $state(false);
  let standing: ReturnType<typeof setTimeout> | undefined;

  function ask() {
    clearTimeout(standing);
    arming = true;
    standing = setTimeout(() => {
      arming = false;
    }, ARMED);
  }

  function stand() {
    clearTimeout(standing);
    arming = false;
  }

  $effect(() => () => {
    clearTimeout(standing);
  });

  watch(
    () => kept,
    () => {
      stand();
    },
  );

  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");
  const opening = $derived({
    duration: calm.current ? 0 : 250,
    easing: expoOut,
  });
</script>

{#if kept > 0 || mine.length > 0}
  <div
    transition:slide={opening}
    class="shrink-0 overflow-hidden border-t rule px-5 py-1.5"
  >
    <div class="flex items-baseline gap-3 text-[11.5px]">
      {#if kept > 0}
        <button
          type="button"
          aria-expanded={explorer.shelfOpen}
          aria-controls={list}
          class="group flex cursor-pointer items-baseline gap-1 text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-foreground hover:decoration-primary"
          onclick={() => {
            stand();
            explorer.shelfOpen = !explorer.shelfOpen;
          }}
        >
          <span
            >{#key kept}<span
                class="numeric font-semibold text-foreground/80 motion-safe:animate-rise"
                >{kept.toLocaleString("en-US")}</span
              >{/key}{" "}saved {kept === 1 ? "view" : "views"}</span
          >
          <ChevronDownIcon
            aria-hidden="true"
            class={cn(
              "size-3 shrink-0 self-center text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
              { "rotate-180": explorer.shelfOpen },
            )}
          />
        </button>
      {/if}
      {#if mine.length > 0}
        <button
          type="button"
          aria-pressed={saved}
          class={cn(
            "ml-auto shrink-0 cursor-pointer underline decoration-dotted underline-offset-[3px] transition-colors duration-200",
            {
              "font-medium text-primary decoration-primary hover:line-through":
                saved,
              "text-primary/80 decoration-primary/45 hover:text-primary hover:decoration-primary":
                !saved,
            },
          )}
          aria-label={saved
            ? "Remove this view from your saved views"
            : "Save this view, kept in this browser"}
          onclick={() => {
            if (!saved && kept === 0) {
              explorer.shelfOpen = true;
            }

            shelf.toggle(mine);
          }}
        >
          {saved ? "Saved" : "Save this view"}
        </button>
      {/if}
    </div>

    {#if explorer.shelfOpen && kept > 0}
      <div id={list} transition:slide={opening}>
        <div class="mt-1 scroll-fade-y [--scroll-fade:1.25rem]">
          <div
            {@attach scrollEdges()}
            data-holds-scroll
            class="max-h-38 overflow-y-auto overscroll-contain"
          >
            <ul class="grid gap-0.5">
              {#each rows as row (row.q)}
                <li class="group relative flex items-center">
                  <button
                    type="button"
                    aria-pressed={row.live}
                    class={cn(
                      "min-w-0 flex-1 cursor-pointer rounded-[3px] py-1 pr-7 pl-1.5 text-left text-[12.5px] leading-snug transition-colors duration-200",
                      {
                        "bg-foreground/6 text-foreground": row.live,
                        "text-foreground/85 hover:bg-foreground/[0.035]":
                          !row.live,
                      },
                    )}
                    aria-label={row.live
                      ? `Showing ${row.text}`
                      : `Show ${row.text}`}
                    onclick={() => {
                      explorer.leap({
                        layer: row.ask.layer,
                        focus: row.ask.focus,
                        filters: row.ask.filters,
                        rivals: [...row.ask.rivals],
                        at: null,
                      });
                    }}
                  >
                    <span class="block text-pretty first-letter:uppercase">
                      <Sentence parts={row.parts} />{#if row.empty}{" "}<span
                          class="text-muted-foreground">(keeps none)</span
                        >{/if}
                    </span>
                  </button>

                  <button
                    type="button"
                    class="absolute top-1/2 right-0.5 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-[3px] text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:text-foreground"
                    aria-label="Remove {row.text} from your saved views"
                    onclick={() => {
                      shelf.drop(row.q);
                    }}
                  >
                    <XIcon
                      aria-hidden="true"
                      class="size-3"
                      strokeWidth={2.5}
                    />
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        </div>
        <div
          class="mt-1 flex items-baseline justify-between gap-3 text-[10.5px] leading-snug"
        >
          <p class="min-w-0 text-muted-foreground">
            Kept in this browser. Nothing is sent anywhere.
          </p>
          {#if kept > 1}
            <button
              type="button"
              class={cn(
                "shrink-0 cursor-pointer underline decoration-dotted underline-offset-[3px] transition-colors duration-200",
                {
                  "font-medium text-primary decoration-primary": arming,
                  "text-muted-foreground decoration-primary/45 hover:text-foreground hover:decoration-primary":
                    !arming,
                },
              )}
              aria-label={arming
                ? `Press again to clear all ${kept.toLocaleString("en-US")} saved views`
                : "Clear all saved views"}
              onpointerleave={stand}
              onblur={stand}
              onclick={() => {
                if (!arming) {
                  ask();

                  return;
                }

                stand();
                shelf.clear();
              }}
            >
              {arming ? "Are you sure?" : "Clear all"}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
