<script lang="ts" module>
  import type { Padding } from "#lib/components/map/camera.js";
  import type { HoodDetail } from "#lib/types.js";

  const NONE = { common: [], distinct: [] };
  const EMPTY: HoodDetail = { names: NONE, breeds: NONE, zips: [] };

  // One object, so the desktop camera sees no padding change and never refits on its own.
  const RAIL: Padding = { left: 392, right: 48, top: 40, bottomFraction: 0.06 };

  const PADDING: Record<
    "wide" | "narrow",
    { idle: Padding; focused: Padding; walk: Padding }
  > = {
    // Constant per breakpoint on purpose; tracking live sheet height would move the camera every drag frame.
    wide: { idle: RAIL, focused: RAIL, walk: RAIL },
    narrow: {
      idle: { left: 24, right: 24, top: 28, bottomFraction: 0.26 },
      focused: { left: 24, right: 24, top: 28, bottomFraction: 0.56 },
      // The narrator bubble covers the foot of the phone map, so the city fits above it.
      walk: { left: 24, right: 24, top: 28, bottomFraction: 0.4 },
    },
  };
</script>

<script lang="ts">
  import { browser } from "$app/env";
  import { afterNavigate, goto } from "$app/navigation";
  import { page } from "$app/state";
  import { mode } from "mode-watcher";
  import { useSearchParams } from "runed/kit";
  import { untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import type { BaseStyle, MapTheme } from "#lib/map-style.js";
  import About from "#lib/components/chrome/about.svelte";
  import Desktop from "#lib/components/chrome/desktop.svelte";
  import Help from "#lib/components/chrome/help.svelte";
  import Intro from "#lib/components/chrome/intro.svelte";
  import Loader from "#lib/components/chrome/loader.svelte";
  import Maker from "#lib/components/chrome/maker.svelte";
  import Meta from "#lib/components/chrome/meta.svelte";
  import ModePill from "#lib/components/chrome/mode-pill.svelte";
  import Arena from "#lib/components/game/arena.svelte";
  import Map from "#lib/components/map/index.svelte";
  import ShelterCard from "#lib/components/map/shelter-card.svelte";
  import WalkCard from "#lib/components/map/walk-card.svelte";
  import Sheet from "#lib/components/mobile/sheet.svelte";
  import Lightbox from "#lib/components/panel/lightbox.svelte";
  import { hoodLabels } from "#lib/data.js";
  import { cut, facetSwatches } from "#lib/layers.js";
  import { loadBaseStyle } from "#lib/map-style.js";
  import { QUERY } from "#lib/share.js";
  import { explorer } from "#lib/state.svelte.js";
  import { setSwatches } from "#lib/swatches.svelte.js";
  import { count } from "#lib/utils.js";
  import { worldOf } from "#lib/world.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let base = $state<BaseStyle | null>(null);
  let styleError = $state<string | null>(null);
  let mapReady = $state(false);

  const wide = new MediaQuery("(min-width: 880px)");
  const theme = $derived<MapTheme>(mode.current === "dark" ? "dark" : "light");
  const padding = $derived(PADDING[wide.current ? "wide" : "narrow"]);
  const narrating = $derived(explorer.walk >= 0 || explorer.hookInBubble);
  const frame = $derived(
    explorer.walk >= 0 || explorer.greeting ? padding.walk : padding.idle,
  );

  const world = $derived(worldOf(data, explorer.sank));

  const query = useSearchParams(QUERY, { debounce: 200, noScroll: true });
  explorer.bindQuery(query);

  untrack(() => {
    if (!browser || page.url.search.length === 0) {
      return;
    }

    explorer.dismissIntro();
    const play = page.url.searchParams.get("play");
    if (play === "central" || play === "prospect") {
      explorer.game = play;
    }
  });

  afterNavigate(() => {
    if (!page.url.searchParams.has("play")) {
      return;
    }

    const url = new URL(page.url.href);
    url.searchParams.delete("play");
    // Same page, minus one param: there is no route to resolve, and history.replaceState fights the router.
    // replaceState() would throw here: the router is not started until the enter callbacks return.
    void goto(url, { replace: true, reset: false });
  });

  const painted = $derived(
    cut(world.hoods, data.matrix, explorer.view, explorer.filters, theme),
  );

  const labels = $derived(hoodLabels(painted.data, (p) => explorer.dogHere(p)));

  const swatches = $derived(facetSwatches(data.hoods, theme));
  setSwatches(() => swatches);

  const selected = $derived(
    painted.data.features.find((f) => f.properties.slug === explorer.selected)
      ?.properties ?? null,
  );

  const openShelter = $derived(
    world.shelters.find((place) => place.slug === explorer.shelter) ?? null,
  );

  const detail = $derived(
    selected == null ? null : (data.details[selected.slug] ?? EMPTY),
  );

  const notice = $derived.by(() => {
    if (!mapReady) {
      return "";
    }

    const parts: Array<string> = [];
    if (selected != null) {
      parts.push(`${selected.name}, ${selected.borough}.`);
    }
    if (explorer.filters.length > 0) {
      parts.push(
        `${count(painted.standing.length)} of ${count(world.hoods.features.length)} neighborhoods on the map.`,
      );
    }
    if (explorer.sank) {
      parts.push("Staten Island is under water.");
    }
    parts.push(`Colored by ${explorer.viewLabel}.`);

    return parts.join(" ");
  });

  $effect(() => () => {
    query.cleanup();
  });

  // Fetched once; theme is read untracked so a theme change does not refetch the base style.
  $effect(() => {
    if (!browser || base != null) {
      return;
    }

    let canceled = false;

    loadBaseStyle(untrack(() => theme))
      .then((loaded) => {
        if (!canceled) {
          base = loaded;
        }
      })
      .catch((error: unknown) => {
        if (canceled) {
          return;
        }

        styleError =
          error instanceof Error
            ? error.message
            : "The basemap failed to load.";
      });

    return () => {
      canceled = true;
    };
  });
</script>

<Meta summary={data.summary} />

<svelte:window
  onkeydown={(e: KeyboardEvent) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      explorer.dismissTop();
    }
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      explorer.openSearch();
    }
  }}
/>

<main class="relative h-dvh w-full overflow-clip bg-background">
  <p role="status" class="sr-only">{notice}</p>
  {#if base != null}
    <Map
      style={base.style}
      slots={base.slots}
      {theme}
      {world}
      {painted}
      {labels}
      padding={frame}
      focusPadding={padding.focused}
      pointer={wide.current}
      onready={() => {
        mapReady = true;
      }}
    />
  {/if}

  {#if mapReady}
    {const shell = $derived({
      painted,
      selected,
      detail,
      hoods: world.hoods,
      matrix: data.matrix,
      summary: data.summary,
      shelters: world.shelters,
      licenses: world.licenses,
    })}
    {#if wide.current}
      <Desktop {...shell} />
    {:else}
      <Sheet {...shell} />
    {/if}
  {/if}

  {#if mapReady && narrating}
    <WalkCard hoods={world.hoods} matrix={data.matrix} summary={data.summary} />
  {/if}

  {#if mapReady}
    <ModePill />
  {/if}

  {#if !mapReady}
    <Loader
      styled={base != null}
      hoods={data.summary.neighborhoods}
      error={styleError}
    />
  {/if}
  <noscript>
    <div class="absolute inset-0 z-30 grid place-items-center paper px-6 py-12">
      <div class="max-w-md text-center">
        <h1 class="rotate-[-1.4deg] poster text-[clamp(2rem,7vw,3.4rem)]">
          EVERY DOG<br />IN NEW YORK
        </h1>
        <div
          class="mx-auto mt-6 h-1.5 max-w-56 rounded-[50%] bg-primary/85"
        ></div>
        <p
          class="mt-6 text-[15.5px] leading-relaxed text-balance text-foreground/85"
        >
          This site maps {count(data.summary.licenses)} licensed New York City dogs
          into {count(data.summary.neighborhoods)} neighborhoods, alongside the homes
          and people in each. Look up any breed or any dog name and see where the
          city keeps them. The map draws in your browser, so it needs JavaScript turned
          on.
        </p>
        <p
          class="mt-5 text-[12px] leading-relaxed text-balance text-muted-foreground"
        >
          Dogs from
          <a
            href="https://data.cityofnewyork.us/Health/NYC-Dog-Licensing-Dataset/nu7n-tubp"
            rel="noreferrer external"
            class="underline decoration-foreground/25 underline-offset-2"
            >NYC Open Data</a
          >. A license carries nothing finer than a ZIP code, so every
          neighborhood figure here is an estimate.
        </p>
      </div>
    </div>
  </noscript>

  {#if explorer.intro && mapReady}
    <Intro summary={data.summary} />
  {/if}

  {#if explorer.about}
    <About summary={data.summary} />
  {/if}

  {#if explorer.help}
    <Help />
  {/if}

  {#if explorer.maker}
    <Maker />
  {/if}

  {#if openShelter != null}
    <ShelterCard place={openShelter} />
  {/if}

  {#if explorer.lightbox != null}
    <Lightbox open={explorer.lightbox} />
  {/if}

  {#if explorer.game != null}
    <Arena park={explorer.game} riders={world.riders} {theme} />
  {/if}
</main>
