<script lang="ts">
  import { TrainFrontIcon } from "@lucide/svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { slide } from "svelte/transition";
  import type { Pet } from "#lib/pet.svelte.js";
  import Bullet from "#lib/components/map/bullet.svelte";
  import { draw } from "#lib/components/map/draw.svelte.js";
  import { yard } from "#lib/components/map/fleet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  let { dog, afloat }: { dog: Pet; afloat: boolean } = $props();

  const ORDER = "1 2 3 4 5 6 7 A C E B D F M G J Z L N Q R W".split(" ");

  let open = $state(false);
  let route = $state<string | null>(null);

  const routes = $derived.by(() => {
    const seen = new SvelteMap<
      string,
      { route: string; bullet: string; color: string; name: string }
    >();
    for (const line of yard.lines) {
      if (line.system === "subway" && !seen.has(line.route)) {
        seen.set(line.route, {
          route: line.route,
          bullet: line.bullet,
          color: line.color,
          name: line.name,
        });
      }
    }

    const rank = (r: string) => {
      const at = ORDER.indexOf(r);

      return at < 0 ? ORDER.length + (r === "SIR" ? 1 : 0) : at;
    };

    return [...seen.values()].toSorted((a, b) => rank(a.route) - rank(b.route));
  });

  const picked = $derived(routes.find((r) => r.route === route) ?? null);

  const signs = $derived.by(() => {
    const out: Array<string> = [];
    for (const line of yard.lines) {
      if (line.system !== "subway" || line.route !== route) {
        continue;
      }

      for (const sign of line.signs) {
        if (!out.includes(sign)) {
          out.push(sign);
        }
      }
    }

    return out;
  });

  const riding = $derived(explorer.ride?.id === dog.id ? explorer.ride : null);
  const ridingOn = $derived(
    routes.find((r) => r.route === riding?.route) ?? null,
  );
</script>

<section
  class="rounded-[6px] bg-foreground/[0.035] px-3 py-2.5 ring-1 ring-foreground/8"
>
  {#if riding != null && ridingOn != null}
    <p
      class="flex items-center gap-2 text-[0.8125rem] leading-snug text-foreground/85"
    >
      <Bullet
        system="subway"
        route={ridingOn.route}
        bullet={ridingOn.bullet}
        color={ridingOn.color}
      />
      <span class="min-w-0 flex-1">
        {dog.name} is riding the {ridingOn.bullet} toward {riding.sign}.
      </span>
    </p>
    <p
      class="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.78125rem]"
    >
      <button
        type="button"
        class="cursor-pointer py-1 font-medium text-primary underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        onclick={() => {
          explorer.follow += 1;
          explorer.shutSheet();
        }}>Find them on the map</button
      >
      <button
        type="button"
        class="cursor-pointer py-1 font-medium text-muted-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
        onclick={() => {
          explorer.ride = null;
        }}>Get off the train</button
      >
    </p>
  {:else}
    <button
      type="button"
      disabled={afloat || routes.length === 0}
      aria-expanded={open}
      class="group flex w-full cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-100"
      onclick={() => {
        open = !open;
      }}
    >
      <span
        class="grid size-7 shrink-0 place-items-center rounded-full bg-[#16181a] text-white transition-transform duration-200 group-hover:-rotate-6"
        aria-hidden="true"
      >
        <TrainFrontIcon class="size-3.5" strokeWidth={2.25} />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block slab text-[0.8125rem] text-foreground"
          >Take {dog.name} on the subway</span
        >
        <span
          class="block text-[0.71875rem] leading-snug text-muted-foreground"
        >
          {afloat
            ? "The trains wait for dry land."
            : "Pick a line and a direction, and the map rides along."}
        </span>
      </span>
    </button>

    {#if open && !afloat}
      <div transition:slide={{ duration: 240 }}>
        <div
          class="flex flex-wrap gap-1.5 pt-3"
          role="group"
          aria-label="Lines"
        >
          {#each routes as r (r.route)}
            <button
              type="button"
              aria-pressed={route === r.route}
              title={r.name}
              class={cn(
                "cursor-pointer rounded-full p-0.5 transition-[scale,box-shadow] duration-150",
                {
                  "scale-115 ring-2 ring-foreground/70": route === r.route,
                  "hover:scale-110": route !== r.route,
                },
              )}
              onclick={() => {
                route = r.route;
              }}
            >
              <Bullet
                system="subway"
                route={r.route}
                bullet={r.bullet}
                color={r.color}
              />
            </button>
          {/each}
        </div>

        {#if picked != null}
          <div transition:slide={{ duration: 200 }}>
            <p class="pt-3 text-[0.71875rem] text-muted-foreground">
              {picked.name}. Board toward
            </p>
            <div class="mt-1 grid gap-1">
              {#each signs as sign (sign)}
                <button
                  type="button"
                  class="group flex cursor-pointer items-center gap-2 rounded-lg bg-[#16181a] px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-px"
                  onclick={() => {
                    draw.rail = true;
                    explorer.ride = { route: picked.route, sign, id: dog.id };
                    open = false;
                    explorer.shutSheet();
                  }}
                >
                  <Bullet
                    system="subway"
                    route={picked.route}
                    bullet={picked.bullet}
                    color={picked.color}
                    small
                  />
                  <span
                    class="min-w-0 flex-1 truncate font-sans text-[0.6875rem] font-bold tracking-wider text-white uppercase"
                    >{sign}</span
                  >
                  <span
                    class="font-sans text-[0.625rem] font-semibold tracking-wider text-[#fdb713] uppercase opacity-80 transition-opacity group-hover:opacity-100"
                    >Board</span
                  >
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</section>
