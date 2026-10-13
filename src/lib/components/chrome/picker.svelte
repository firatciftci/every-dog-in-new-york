<script lang="ts">
  import Plate from "#lib/components/brand/plate.svelte";
  import { cn } from "#lib/utils.js";

  let {
    id,
    label,
    placeholder,
    options,
    value,
    onpick,
  }: {
    id: string;
    label: string;
    placeholder: string;
    options: ReadonlyArray<{
      key: string;
      label: string;
      sub?: string;
      breed?: string;
    }>;
    value: string | null;
    onpick: (key: string) => void;
  } = $props();

  const SHOWN = 6;

  const chosen = $derived(options.find((o) => o.key === value) ?? null);

  let typed = $state<string | null>(null);
  let open = $state(false);
  let active = $state(0);

  const text = $derived(typed ?? chosen?.label ?? "");

  const hits = $derived.by(() => {
    const q = (typed ?? "").trim().toLowerCase();
    if (q.length === 0) {
      return options.slice(0, SHOWN);
    }

    const starts: Array<(typeof options)[number]> = [];
    const within: Array<(typeof options)[number]> = [];
    for (const option of options) {
      const name = option.label.toLowerCase();
      if (name.startsWith(q)) {
        starts.push(option);
      } else if (
        name.includes(q) ||
        (option.sub?.toLowerCase().startsWith(q) ?? false)
      ) {
        within.push(option);
      }
    }

    return [...starts, ...within].slice(0, SHOWN);
  });

  function pick(key: string) {
    onpick(key);
    typed = null;
    open = false;
  }
</script>

<div>
  <label for={id} class="slab text-[0.625rem] tracking-[0.13em] uppercase"
    >{label}</label
  >
  <div class="relative mt-1">
    {#if chosen?.breed != null && typed == null}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
      >
        <Plate breed={chosen.breed} height={22} />
      </span>
    {/if}
    <input
      {id}
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-expanded={open && hits.length > 0}
      aria-controls="{id}-list"
      aria-autocomplete="list"
      aria-activedescendant={open && hits[active] != null
        ? `${id}-${active}`
        : undefined}
      {placeholder}
      value={text}
      class={cn(
        "h-10 w-full rounded-[5px] bg-background/70 pr-3 text-[0.875rem] text-foreground ring-1 ring-foreground/20 transition-shadow duration-200 contain-inline-size outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/60",
        {
          "pl-11": chosen?.breed != null && typed == null,
          "pl-3": chosen?.breed == null || typed != null,
        },
      )}
      onfocus={(event) => {
        open = true;
        active = 0;
        event.currentTarget.select();
      }}
      onblur={() => {
        open = false;
        typed = null;
      }}
      oninput={(event) => {
        typed = event.currentTarget.value;
        open = true;
        active = 0;
      }}
      onkeydown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          open = true;
          const step = event.key === "ArrowDown" ? 1 : -1;
          active = (active + step + hits.length) % Math.max(1, hits.length);
        } else if (event.key === "Enter") {
          const hit = hits[active];
          if (open && hit != null) {
            event.preventDefault();
            pick(hit.key);
          }
        } else if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          open = false;
          typed = null;
        }
      }}
    />
  </div>

  {#if open && hits.length > 0}
    <ul
      id="{id}-list"
      role="listbox"
      aria-label={label}
      class="mt-1 grid gap-px rounded-[5px] bg-background/80 p-1 ring-1 ring-foreground/12"
    >
      {#each hits as hit, i (hit.key)}
        <li
          id="{id}-{i}"
          role="option"
          aria-selected={i === active}
          class={cn(
            "flex cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1 text-[0.8125rem] transition-colors duration-150",
            {
              "bg-foreground/6": i === active,
              "hover:bg-foreground/[0.035]": i !== active,
            },
          )}
          onpointerdown={(event) => {
            event.preventDefault();
            pick(hit.key);
          }}
          onpointerenter={() => {
            active = i;
          }}
        >
          {#if hit.breed != null}
            <span class="grid w-8 shrink-0 place-items-center">
              <Plate breed={hit.breed} height={20} />
            </span>
          {/if}
          <span class="min-w-0 flex-1 truncate text-foreground"
            >{hit.label}</span
          >
          {#if hit.sub != null}
            <span class="shrink-0 text-[0.71875rem] text-muted-foreground"
              >{hit.sub}</span
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
