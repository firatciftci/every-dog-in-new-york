<script lang="ts">
  import { CircleQuestionMarkIcon, SearchIcon, XIcon } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { Plan } from "#lib/ask.js";
  import type { Rival } from "#lib/compare.js";
  import type { Hit, HitKind } from "#lib/query.js";
  import type { HoodCollection, Matrix, Shelter } from "#lib/types.js";
  import { nextWords, read, saying } from "#lib/ask.js";
  import { boutFor, boutOf, rivalName } from "#lib/compare.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import Sentence from "#lib/components/chrome/sentence.svelte";
  import { DOORWAY, KENNEL } from "#lib/kennel.js";
  import {
    facetOf,
    groupsOf,
    HEADINGS,
    picks,
    strange,
    suggest,
  } from "#lib/query.js";
  import { scrollEdges } from "#lib/scroll.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  let {
    hoods,
    matrix,
    shelters,
  }: { hoods: HoodCollection; matrix: Matrix; shelters: Array<Shelter> } =
    $props();

  let scope = $state<HitKind | null>(null);

  const SCOPE_NAMES: Record<HitKind, Array<string>> = {
    breed: ["breed", "breeds", "dog", "dogs"],
    name: ["name", "names", "called"],
    hood: ["neighborhood", "neighbourhood", "neighborhoods", "hood", "nta"],
    borough: ["borough", "boroughs", "boro"],
    shelter: ["shelter", "shelters", "rescue"],
  };

  const scopeName = $derived(
    scope == null ? "" : (SCOPE_NAMES[scope][0] ?? scope),
  );

  let query = $state("");
  let cursor = $state(0);
  let field = $state<HTMLInputElement | null>(null);
  let root = $state<HTMLElement | null>(null);

  const asked = $derived(query.trim().length > 0);
  const seek = $derived({ hoods, matrix, shelters });

  function eatPrefix() {
    const at = query.indexOf(":");
    if (at < 1) {
      return;
    }

    const head = query.slice(0, at).trim().toLowerCase();
    const found = Object.entries(SCOPE_NAMES).find(([, words]) =>
      words.includes(head),
    );
    if (found == null) {
      return;
    }

    scope = found[0] as HitKind;
    query = query.slice(at + 1).replace(/^\s+/, "");
  }
  const plan = $derived(asked ? read(query, seek) : null);
  const says = $derived(plan == null ? [] : saying(plan));
  const offers = $derived(nextWords(query));

  const hits = $derived.by(() => {
    const all = asked ? suggest(plan?.tail ?? query, seek) : picks(seek);

    return scope == null ? all : all.filter((hit) => hit.kind === scope);
  });

  const steps = $derived(hits.length + (plan == null ? 0 : 1));
  const empty = $derived(asked && hits.length === 0 && plan == null);
  const at = $derived(Math.min(cursor, Math.max(0, steps - 1)));
  const onPlan = $derived(plan != null && at === 0);
  const hitAt = $derived(plan == null ? at : at - 1);

  $effect(() => {
    const hit = explorer.search && !onPlan ? hits[hitAt] : undefined;

    // Untracked: reading the pointer here would subscribe this effect to its own write.
    untrack(() => {
      if (hit?.kind === "hood") {
        explorer.point("slug", hit.slug);
      } else if (hit?.kind === "borough") {
        explorer.point("borough", hit.label);
      } else {
        explorer.point("slug", null);
      }
    });
  });

  $effect(() => {
    if (explorer.search) {
      field?.focus();
    }
  });

  $effect(() => {
    const asking = explorer.searchScope;
    if (asking == null) {
      return;
    }

    untrack(() => {
      scope = asking;
      explorer.searchScope = null;
    });
  });

  $effect(() => {
    const seed = explorer.searchSeed;
    if (seed == null) {
      return;
    }

    untrack(() => {
      query = seed;
      scope = null;
      cursor = 0;
      eatPrefix();
      explorer.searchSeed = null;
    });
  });

  function close() {
    explorer.search = false;
    query = "";
    scope = null;
    cursor = 0;
    explorer.point("slug", null);
    field?.blur();
  }

  const waiting = $derived.by(() => {
    const [only] = explorer.rivals;

    return explorer.rivals.length === 1 && only != null
      ? rivalName(
          only,
          hoods.features.map((f) => f.properties),
        )
      : null;
  });

  function rivalOf(hit: Hit): Rival | null {
    if (hit.kind === "breed" || hit.kind === "name") {
      return { kind: facetOf(hit.kind), label: hit.label };
    }

    if (hit.kind === "hood") {
      return { kind: "hood", slug: hit.slug, label: hit.label };
    }

    return hit.kind === "borough"
      ? { kind: "borough", label: hit.label }
      : null;
  }

  function run(hit: Hit) {
    if (
      plan != null &&
      plan.tail.length > 0 &&
      (hit.kind === "breed" || hit.kind === "name")
    ) {
      const cut = query.lastIndexOf(plan.tail);
      if (cut >= 0) {
        query = `${query.slice(0, cut)}${hit.label}${query.slice(cut + plan.tail.length)}`;
        cursor = 0;
        field?.focus();

        return;
      }
    }

    const other = rivalOf(hit);
    if (
      waiting != null &&
      other != null &&
      boutFor(other) === boutOf(explorer.rivals)
    ) {
      explorer.addRival(other);
      close();

      return;
    }

    if (hit.kind === "shelter") {
      explorer.openShelter(hit.slug);
    } else if (hit.kind === "hood") {
      explorer.goTo(hit.slug);
    } else if (hit.kind === "borough") {
      explorer.addFilter({
        kind: "in",
        field: "borough",
        values: [hit.label],
        negate: false,
      });
      explorer.zoomToMatches();
    } else {
      explorer.setFocus(facetOf(hit.kind), hit.label);
    }

    close();
  }

  function apply(next: Plan) {
    explorer.clearRivals();
    for (const filter of next.filters) {
      explorer.addFilter(filter);
    }
    for (const rival of next.rivals) {
      explorer.addRival(rival);
    }
    if (next.rivals.length < 2 && next.focus != null) {
      explorer.setFocus(next.focus.facet, next.focus.label);
    }
    if (next.goTo != null) {
      explorer.goTo(next.goTo.slug);
    }

    close();
  }

  function append(add: string) {
    query = `${query.trimEnd()}${add}`.replace(/^\s+/, "");
    cursor = 0;
    field?.focus();
  }

  function surprise() {
    const found = strange(hoods, matrix, {
      layer: explorer.layer,
      focus: explorer.focus,
      filters: explorer.filters,
      rivals: explorer.rivals,
      at: explorer.selected,
    });
    if (found == null) {
      return;
    }

    explorer.leap(found);
    close();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      // stopPropagation: the window handler reads a second Escape as dropping the filters.
      event.preventDefault();
      event.stopPropagation();
      close();

      return;
    }

    if (
      event.key === "Backspace" &&
      scope != null &&
      field?.selectionStart === 0 &&
      field.selectionEnd === 0
    ) {
      event.preventDefault();
      scope = null;
      cursor = 0;

      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      cursor = (at + step + steps) % Math.max(1, steps);

      return;
    }

    if (event.key === "Enter") {
      if (onPlan && plan != null) {
        event.preventDefault();
        apply(plan);

        return;
      }

      const hit = hits[hitAt];
      if (hit != null) {
        event.preventDefault();
        run(hit);
      }
    }
  }

  $effect(() => {
    if (explorer.search) {
      document
        .getElementById(`search-hit-${at}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  });

  function fitToRoom(node: HTMLElement) {
    let frame = 0;
    let last = 0;

    const measure = () => {
      // visualViewport, so a phone keyboard takes room from the list instead of covering it.
      const below = window.visualViewport;
      const floor =
        below == null ? window.innerHeight : below.height + below.offsetTop;
      const room = Math.max(
        140,
        Math.round(floor - node.getBoundingClientRect().top - 12),
      );
      if (room !== last) {
        last = room;
        node.style.setProperty("--room", `${room}px`);
      }

      frame = requestAnimationFrame(measure);
    };

    measure();

    return () => {
      cancelAnimationFrame(frame);
    };
  }
</script>

<div
  bind:this={root}
  class="relative"
  onfocusout={(event: FocusEvent) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || root?.contains(next) !== true) {
      explorer.search = false;
    }
  }}
>
  <div
    class={cn(
      "group relative isolate flex items-center gap-2 border-b pb-1.5 transition-colors duration-200 forced-colors:has-[input:focus-visible]:outline-2 forced-colors:has-[input:focus-visible]:outline-offset-4 forced-colors:has-[input:focus-visible]:outline-ring",
      {
        "border-primary/55": explorer.search,
        "border-foreground/25": !explorer.search,
      },
    )}
  >
    <span
      aria-hidden="true"
      class={cn(
        "pointer-events-none absolute -inset-x-2 -top-2 bottom-0 -z-10 rounded-t-[5px] rounded-b-xs transition-colors duration-300 group-has-[input:focus-visible]:bg-primary/6",
        { "bg-primary/4.5": explorer.search },
      )}
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute -inset-x-2 -bottom-px h-0.5 origin-center scale-x-0 bg-primary transition-transform duration-300 ease-out group-has-[input:focus-visible]:scale-x-100"
    ></span>

    <SearchIcon
      class={cn("size-4 shrink-0 transition-colors duration-200", {
        "text-primary": explorer.search,
        "text-muted-foreground": !explorer.search,
      })}
    />

    {#if scope != null}
      <button
        type="button"
        class="-my-1 flex shrink-0 items-center gap-1 rounded-[3px] bg-primary/12 py-1 pr-1 pl-1.5 text-[0.71875rem] font-medium text-primary transition-opacity duration-200 hover:opacity-75"
        aria-label="Search everything instead of just {scopeName}"
        title="Search everything instead"
        onclick={() => {
          scope = null;
          cursor = 0;
          field?.focus();
        }}
      >
        {scopeName}
        <span aria-hidden="true" class="relative block size-2.5">
          <span
            class="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 rotate-45 bg-current"
          ></span>
          <span
            class="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 -rotate-45 bg-current"
          ></span>
        </span>
      </button>
    {/if}
    <input
      bind:this={field}
      bind:value={query}
      {onkeydown}
      oninput={() => {
        eatPrefix();
        cursor = 0;
      }}
      onfocus={() => {
        explorer.openSearch();
      }}
      type="text"
      name="q"
      role="combobox"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="go"
      aria-expanded={explorer.search}
      aria-controls={explorer.search && !empty && steps > 0
        ? "search-hits"
        : undefined}
      aria-autocomplete="list"
      aria-activedescendant={explorer.search && steps > 0
        ? `search-hit-${at}`
        : undefined}
      aria-label={waiting == null
        ? scope == null
          ? "Look up a breed, a name, or a place"
          : `Look up a ${SCOPE_NAMES[scope][0]}`
        : `Find something to compare with ${waiting}`}
      placeholder={waiting == null
        ? scope == null
          ? "Look up a breed, a name, or a place"
          : `Look up a ${SCOPE_NAMES[scope][0]}`
        : `Compare ${waiting} with…`}
      class="w-full bg-transparent text-[0.84375rem] text-foreground placeholder:text-muted-foreground focus:outline-none any-pointer-coarse:text-base"
    />
    {#if asked}
      <button
        type="button"
        class="-m-1.5 shrink-0 p-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
        aria-label="Clear the box"
        onclick={() => {
          query = "";
          cursor = 0;
          field?.focus();
        }}
      >
        <XIcon class="size-3.5" />
      </button>
    {/if}

    <button
      type="button"
      class="-m-1.5 shrink-0 p-1.5 text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:text-primary"
      aria-label="What this box can do"
      title="What this box can do"
      onclick={() => {
        explorer.help = true;
      }}
    >
      <CircleQuestionMarkIcon class="size-4" />
    </button>
  </div>

  <p role="status" class="sr-only">
    {#if explorer.search}
      {#if empty}
        No match for “{query.trim()}”.
      {:else if steps > 0}
        {steps} {steps === 1 ? "match" : "matches"}.
      {/if}
    {/if}
  </p>

  {#if explorer.search}
    <div
      {@attach fitToRoom}
      class="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg paper shadow-[0_2px_1px_rgb(58_48_38/0.14),0_10px_26px_rgb(58_48_38/0.16)] outline outline-foreground/15"
    >
      <div class="scroll-fade-y [--scroll-fade:2rem]">
        <div
          {@attach scrollEdges()}
          class="max-h-[min(var(--room,25rem),25rem)] overflow-y-auto overscroll-contain p-1.5"
        >
          {#if empty}
            <p
              class="px-2 py-6 text-center text-[0.8125rem] text-muted-foreground"
            >
              No dog and no place here goes by “{query.trim()}”.
            </p>
          {:else if steps === 0}
            <p
              class="px-2 py-6 text-center text-[0.8125rem] text-muted-foreground"
            >
              Type a {scopeName} to look one up.
            </p>
          {:else}
            <div id="search-hits" role="listbox" aria-label="Matches">
              {#if plan != null}
                <div role="group" aria-labelledby="search-hit-plan-head">
                  <p
                    id="search-hit-plan-head"
                    class="px-2 pt-1.5 pb-1 slab text-[0.78125rem] text-muted-foreground"
                  >
                    Reads as
                  </p>
                  <button
                    type="button"
                    id="search-hit-0"
                    role="option"
                    tabindex="-1"
                    aria-selected={onPlan}
                    class={cn(
                      "flex w-full items-start gap-2.5 rounded-[3px] px-2 py-1.5 text-left transition-colors duration-150",
                      { "bg-foreground/6": onPlan },
                    )}
                    onmouseenter={() => {
                      cursor = 0;
                    }}
                    onclick={() => {
                      apply(plan);
                    }}
                  >
                    <span
                      class="min-w-0 flex-1 text-[0.8125rem] leading-snug text-foreground"
                    >
                      <Sentence parts={says} />
                    </span>
                  </button>
                </div>
                {#if hits.length > 0}
                  <p
                    class="mx-2 mt-1 mb-0.5 border-t rule pt-1"
                    aria-hidden="true"
                  ></p>
                {/if}
              {/if}

              {#each asked ? groupsOf(hits) : [{ kind: hits[0]?.kind ?? "breed", items: hits }] as group, g (g)}
                {const drawn = $derived(
                  group.items.some((hit) => hit.kind === "breed"),
                )}
                {#if group.items.length > 0}
                  <div role="group" aria-labelledby="search-hit-group-{g}">
                    <p
                      id="search-hit-group-{g}"
                      class="px-2 pt-1.5 pb-1 slab text-[0.78125rem] text-muted-foreground"
                    >
                      {asked
                        ? HEADINGS[group.kind]
                        : "Not sure where to start?"}
                    </p>
                    {#each group.items as hit (hit.id)}
                      {const index = $derived(
                        hits.indexOf(hit) + (plan == null ? 0 : 1),
                      )}
                      <div
                        class={cn("flex items-center rounded-[3px]", {
                          "bg-foreground/6": index === at,
                        })}
                      >
                        <button
                          type="button"
                          id="search-hit-{index}"
                          role="option"
                          tabindex="-1"
                          aria-selected={index === at}
                          class="flex w-full min-w-0 flex-1 items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left transition-colors duration-150"
                          onmouseenter={() => {
                            cursor = index;
                          }}
                          onclick={() => {
                            run(hit);
                          }}
                        >
                          {#if drawn || hit.kind === "shelter"}
                            <span class="grid w-8 shrink-0 place-items-center">
                              {#if hit.kind === "breed"}
                                <Plate
                                  breed={hit.label}
                                  height={26}
                                  class="max-w-8"
                                />
                              {:else if hit.kind === "shelter"}
                                <svg
                                  viewBox="0 0 26 25"
                                  class="size-4 text-foreground/70"
                                  aria-hidden="true"
                                >
                                  <path
                                    d={KENNEL}
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linejoin="round"
                                  />
                                  <path d={DOORWAY} fill="currentColor" />
                                </svg>
                              {/if}
                            </span>
                          {/if}
                          <span class="min-w-0 flex-1">
                            <span
                              class="block truncate-clip font-display text-[0.84375rem] font-semibold text-foreground"
                            >
                              {hit.label}
                            </span>
                            <span
                              class="mt-0.5 block truncate-clip text-[0.71875rem] text-muted-foreground"
                            >
                              {hit.note}
                            </span>
                          </span>
                        </button>
                        {#if rivalOf(hit) != null}
                          {const mine = $derived(
                            explorer.isRival(rivalOf(hit)!),
                          )}
                          <button
                            type="button"
                            aria-pressed={mine}
                            aria-label={mine
                              ? `Stop comparing ${hit.label}`
                              : `Compare ${hit.label}`}
                            class={cn(
                              "mr-2 shrink-0 self-center py-1 text-[0.71875rem] underline decoration-dotted underline-offset-[3px] transition-colors duration-200",
                              {
                                "font-medium text-primary decoration-primary":
                                  mine,
                                "text-muted-foreground decoration-primary/45 hover:text-foreground hover:decoration-primary":
                                  !mine && index === at,
                                "hidden text-muted-foreground decoration-primary/45 pointer-coarse:inline":
                                  !mine && index !== at,
                              },
                            )}
                            onclick={() => {
                              explorer.addRival(rivalOf(hit)!);
                            }}
                          >
                            {mine ? "comparing" : "compare"}
                          </button>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              {/each}
            </div>

            {#if offers.length > 0}
              <p
                class="mt-1 border-t rule px-2 pt-2 pb-1 text-[0.71875rem] leading-relaxed text-muted-foreground"
              >
                {asked
                  ? "Add"
                  : "Try"}{" "}{#each offers as offer, i (offer.add)}<button
                    type="button"
                    class="font-medium text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-foreground hover:decoration-primary"
                    onclick={() => {
                      append(offer.add);
                    }}>{offer.show}</button
                  >{i === offers.length - 1
                    ? "."
                    : i === offers.length - 2
                      ? offers.length > 2
                        ? ", or "
                        : " or "
                      : ", "}{/each}
              </p>
            {/if}

            {#if !asked}
              <button
                type="button"
                class="mt-1 flex w-full items-center gap-2.5 rounded-[3px] border-t rule px-2 py-1.5 pt-2.5 text-left text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                onclick={surprise}
              >
                <span
                  class="font-display font-semibold underline decoration-primary/45 decoration-dotted underline-offset-[3px]"
                >
                  Show me something strange
                </span>
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
