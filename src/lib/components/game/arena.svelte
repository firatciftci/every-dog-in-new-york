<script lang="ts">
  import {
    PauseIcon,
    PlayIcon,
    Share2Icon,
    Volume2Icon,
    VolumeXIcon,
    XIcon,
  } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { on } from "svelte/events";
  import { MediaQuery, SvelteMap, SvelteSet } from "svelte/reactivity";
  import { fade, fly } from "svelte/transition";
  import type { GameEvent, Tone } from "#lib/game/events.js";
  import type { Cam } from "#lib/game/ink.js";
  import type { ParkId, Tag } from "#lib/game/parks.js";
  import type { MapTheme } from "#lib/map-style.js";
  import type { Rider } from "#lib/types.js";
  import { plateUrl } from "#lib/breeds.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import { DashGame } from "#lib/game/dash.js";
  import { PALETTES } from "#lib/game/ink.js";
  import { kennel } from "#lib/game/kennel.svelte.js";
  import { offLeash } from "#lib/game/off-leash.js";
  import {
    conditionsOf,
    PARKS,
    prettyDay,
    rankOf,
    rng,
    RUNNERS,
    seedOf,
    shareText,
    TAGS,
    todayKey,
  } from "#lib/game/parks.js";
  import { shareCard } from "#lib/game/sharecard.js";
  import { sound } from "#lib/game/sound.svelte.js";
  import { TRAIT_WORD, traitOf, WalkerGame } from "#lib/game/walker.js";
  import { collarOf, pet } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { cn, count } from "#lib/utils.js";
  import Clock from "./clock.svelte";
  import CollarTags from "./collar-tags.svelte";

  let {
    park: id,
    riders,
    theme,
  }: { park: ParkId; riders: Array<Rider>; theme: MapTheme } = $props();

  const park = $derived(PARKS[id]);
  const isWalk = $derived(id === "central");
  const clock = $derived(offLeash(park, theme === "dark"));

  const rider = untrack(() => {
    const here = PARKS[id];
    let best = riders[0]!;
    let gap = Infinity;
    for (const r of riders) {
      const reach = (r.lon - here.lon) ** 2 + ((r.lat - here.lat) * 1.32) ** 2;
      if (reach < gap) {
        gap = reach;
        best = r;
      }
    }

    return best;
  });

  const local = RUNNERS.has(rider.breed)
    ? rider.breed
    : "Labrador (or Crossbreed)";
  const mine = untrack(() => pet.dog);
  let yours = $state(
    untrack(() => mine != null && (kennel.dog === "" || kennel.dog === "mine")),
  );
  const leadName = (but = "") => {
    if (yours && mine != null) {
      return mine.name;
    }

    const pool = rider.names.filter((n) => n !== but);

    return pool[Math.floor(Math.random() * pool.length)] ?? "Luna";
  };
  let dog = $state(untrack(() => leadName()));
  const fine = new MediaQuery("(hover: hover) and (pointer: fine)");

  let phase = $state<"start" | "play" | "pause" | "over">("start");
  const pace = $state({ slow: false, daily: true });
  let breed = $state(
    untrack(() =>
      yours && mine != null
        ? mine.breed
        : RUNNERS.has(kennel.dog)
          ? kennel.dog
          : local,
    ),
  );
  let plate = $state<HTMLImageElement | null>(null);
  let wrap = $state<HTMLElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let size = $state({ w: 0, h: 0 });
  let hud = $state({
    clock: "",
    gameSeconds: 0,
    score: 0,
    miles: 0,
    pack: 0,
    whistle: 0,
    combo: 0,
    boost: 0,
    shield: false,
    magnet: 0,
    zoomies: 0,
    spare: 0,
  });
  let feed = $state<Array<{ id: number; text: string; tone: Tone }>>([]);
  let shout = $state<{ id: number; text: string; tone: Tone } | null>(null);
  let banner = $state("");
  let conditionsName = $state("");
  let said = $state("");
  let outcome = $state<{
    isNewBest: boolean;
    fresh: Array<Tag>;
    streak: number;
  } | null>(null);
  let shared = $state("");
  let scoreGlow = $state(false);
  let glowTimer = 0;
  let game: WalkerGame | DashGame | null = null;
  const plates = new SvelteMap<string, HTMLImageElement>();
  let minted = 0;
  let bannerTimer = 0;
  let shoutTimer = 0;
  const feedTimers = new SvelteSet<number>();
  const held = new SvelteSet<string>();

  const best = $derived(kennel.best(id));
  const todayConditions = $derived(
    conditionsOf(id, seedOf(`${todayKey()}:${id}`)),
  );
  const rank = $derived(
    rankOf(id, phase === "over" ? Math.max(0, hud.score) : best),
  );
  const earned = $derived(kennel.earned(id));

  const opener = untrack(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  $effect(() => () => {
    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  });

  $effect(() => {
    const img = new Image();
    img.decoding = "async";
    const drop = on(img, "load", () => {
      plate = img;
    });
    img.src = plateUrl(breed);

    return drop;
  });

  $effect(() => {
    if (!isWalk) {
      return;
    }

    for (const option of [...RUNNERS, ...(mine == null ? [] : [mine.breed])]) {
      if (plates.has(option)) {
        continue;
      }

      const img = new Image();
      img.decoding = "async";
      img.src = plateUrl(option);
      plates.set(option, img);
    }
  });

  function sheetFor(option: string) {
    const img = plates.get(option);

    return img != null && img.complete && img.naturalWidth > 0 ? img : null;
  }

  $effect(() => {
    const box = wrap;
    if (box == null) {
      return;
    }

    const take = () => {
      size = { w: box.clientWidth, h: box.clientHeight };
    };

    take();
    const watch = new ResizeObserver(take);
    watch.observe(box);

    return () => watch.disconnect();
  });

  function choose(next: string) {
    breed = next;
    kennel.dog = next;
    yours = false;
    dog = leadName(dog);
  }

  function chooseMine() {
    if (mine == null) {
      return;
    }

    yours = true;
    breed = mine.breed;
    dog = mine.name;
    kennel.dog = "mine";
  }

  function handle(event: GameEvent) {
    switch (event.type) {
      case "sound": {
        sound.play(event.name);
        break;
      }

      case "stamp": {
        minted += 1;
        const line = { id: minted, text: event.text, tone: event.tone };
        feed = [line, ...feed].slice(0, 4);
        const clearLine = window.setTimeout(() => {
          feedTimers.delete(clearLine);
          feed = feed.filter((f) => f.id !== line.id);
        }, 2600);
        feedTimers.add(clearLine);
        break;
      }

      case "shout": {
        minted += 1;
        shout = { id: minted, text: event.text, tone: event.tone };
        clearTimeout(shoutTimer);
        shoutTimer = window.setTimeout(() => {
          shout = null;
        }, 1500);
        break;
      }

      case "banner": {
        banner = event.text;
        said = event.text;
        clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => {
          banner = "";
        }, 2400);
        break;
      }

      case "say": {
        said = event.text;
        break;
      }

      case "tag": {
        sound.play("ding");
        break;
      }

      case "over": {
        finish();
        break;
      }
    }
  }

  function finish() {
    if (game == null) {
      return;
    }

    const all = TAGS[id];
    if (rankOf(id, Math.max(0, game.score)).next == null) {
      game.tags.add("show");
    }

    const result = kennel.record(
      id,
      Math.max(0, game.score),
      game.tags,
      pace.daily,
    );
    outcome = {
      isNewBest: result.isNewBest,
      fresh: result.fresh
        .map((f) => all.find((t) => t.id === f))
        .filter((t): t is Tag => t != null),
      streak: result.streak,
    };
    if (result.isNewBest) {
      sound.play("fanfare");
    }

    shared = "";
    said = `${rankOf(id, Math.max(0, game.score)).name}. ${count(game.score)} points${result.isNewBest ? ", a new best" : ""}.`;
    phase = "over";
  }

  function start(isDaily = pace.daily) {
    pace.daily = isDaily;
    const seed = isDaily
      ? seedOf(`${todayKey()}:${id}`)
      : Math.floor(Math.random() * 2_147_483_647);
    const roll = rng(seed);
    // Kept so the rest of the daily draw stays the same for everyone.
    roll();
    if (isWalk) {
      const others = [...RUNNERS].filter((b) => b !== breed);
      const names = rider.names.filter((n) => n !== dog);
      const starters = [{ breed, name: dog }];
      for (let i = 0; i < 2; i += 1) {
        const pickBreed =
          others.splice(Math.floor(roll() * others.length), 1)[0] ?? "Beagle";
        const pickName =
          names.splice(Math.floor(roll() * names.length), 1)[0] ??
          `Dog ${i + 2}`;
        starters.push({ breed: pickBreed, name: pickName });
      }

      game = new WalkerGame(
        seed,
        starters,
        rider.names,
        sheetFor,
        handle,
        clock,
      );
    } else {
      game = new DashGame(dog, seed, handle, clock);
    }
    feed = [];
    shout = null;
    banner = game.conditions.name;
    conditionsName = game.conditions.name;
    outcome = null;
    said = isWalk
      ? `Three dogs on the leash, ${dog} in front. It is ${clock.at(0)} in the morning.`
      : `${dog} is running down the Long Meadow. It is ${clock.at(0)}.`;
    phase = "play";
    sound.play("tick");
  }

  function pause() {
    if (phase === "play") {
      phase = "pause";
      held.clear();
    }
  }

  function resume() {
    if (phase === "pause") {
      phase = "play";
    }
  }

  function close() {
    explorer.game = null;
  }

  const summary = $derived.by(() => {
    if (game == null || phase !== "over") {
      return [];
    }

    return game.summary();
  });

  async function card() {
    if (game == null || plate == null) {
      return null;
    }

    return shareCard({
      title: park.title,
      dog,
      breed,
      plate,
      score: game.score,
      rank: rankOf(id, Math.max(0, game.score)).name,
      lines: summary,
      when: `${
        pace.daily
          ? `${prettyDay(todayKey())}, ${clock.words}`
          : `Any ${clock.isNight ? "night" : "morning"}`
      } · ${game.conditions.name}`,
      theme,
    });
  }

  async function share() {
    if (game == null) {
      return;
    }

    const text = shareText(
      id,
      game.score,
      summary,
      pace.daily
        ? `${prettyDay(todayKey())}, ${clock.words}`
        : `any ${clock.isNight ? "night" : "morning"}`,
      game.conditions.name,
    );
    try {
      const blob = await card();
      const file =
        blob == null
          ? null
          : new File([blob], "every-dog-in-new-york.png", {
              type: "image/png",
            });
      if (
        file != null &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], text });
        shared = "Shared";

        return;
      }

      await navigator.clipboard.writeText(text);
      shared = "Copied to your clipboard";
    } catch {
      shared = "Could not share from here";
    }
  }

  async function save() {
    const blob = await card();
    if (blob == null || game == null) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `every-dog-${id}-${count(game.score)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    shared = "Saved";
  }

  $effect(() => {
    const board = canvas;
    if (board == null || plate == null) {
      return;
    }

    const ctx = board.getContext("2d");
    if (ctx == null) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio, 2);
    const cam: Cam = {
      isNight: clock.isNight,
      w: size.w,
      h: size.h,
      horizon: size.h * 0.42,
      f: size.h * 1.05,
      eye: isWalk ? 2.1 : 1.9,
      x: 0,
      z: 0,
    };
    board.width = Math.round(size.w * dpr);
    board.height = Math.round(size.h * dpr);

    const pal = PALETTES[theme];
    const sheet = plate;
    const face = clock;
    const isLeashes = isWalk;
    let frame = 0;
    let last = 0;

    // ink leaves lineCap, alpha and text state dirty, so every frame starts from a known one.
    const paint = (live: WalkerGame | DashGame) => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      live.draw(ctx, cam, pal, sheet);
      ctx.restore();
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;

      const live = game;
      if (live == null) {
        const idle = isLeashes
          ? new WalkerGame(
              1,
              [{ breed, name: dog }],
              rider.names,
              sheetFor,
              () => {},
              face,
            )
          : new DashGame(dog, 1, () => {}, face);
        idle.over = true;
        game = idle;
        paint(idle);

        return;
      }

      if (phase === "play") {
        const step = (pace.slow ? 0.55 : 1) * dt;
        if (live instanceof WalkerGame) {
          if (held.has("ArrowLeft")) {
            live.steer(-1, step);
          }

          if (held.has("ArrowRight")) {
            live.steer(1, step);
          }
        }

        live.update(step);
      }

      const next = {
        clock: face.at(live.gameSeconds),
        gameSeconds: Math.floor(live.gameSeconds),
        score: live.score,
        miles: live.miles,
        ...live.gauges(),
        spare: live.spare,
      };
      if (next.score !== hud.score) {
        scoreGlow = true;
        clearTimeout(glowTimer);
        glowTimer = window.setTimeout(() => {
          scoreGlow = false;
        }, 260);
      }

      if (JSON.stringify(next) !== JSON.stringify(hud)) {
        hud = next;
      }

      paint(live);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const drop = on(document, "visibilitychange", () => {
      if (document.hidden) {
        pause();
      }
    });

    return drop;
  });

  $effect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (phase === "play") {
          event.preventDefault();
          pause();
        }

        return;
      }

      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "BUTTON" || tag === "A") {
          return;
        }
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        if (phase === "play") {
          pause();
        } else if (phase === "pause") {
          resume();
        }

        return;
      }

      if (phase !== "play" || game == null) {
        return;
      }

      if (game instanceof WalkerGame) {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          held.add(event.key);
        } else if (
          event.key === " " ||
          event.key === "Enter" ||
          event.key === "w" ||
          event.key === "W"
        ) {
          event.preventDefault();
          game.blow();
        }

        return;
      }

      if (event.repeat) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        game.left();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        game.right();
      } else if (
        event.key === " " ||
        event.key === "ArrowUp" ||
        event.key === "Enter"
      ) {
        event.preventDefault();
        game.jump();
      }
    };

    const up = (event: KeyboardEvent) => {
      held.delete(event.key);
    };

    const dropDown = on(window, "keydown", down);
    const dropUp = on(window, "keyup", up);

    return () => {
      dropDown();
      dropUp();
    };
  });

  $effect(() => () => {
    clearTimeout(glowTimer);
    clearTimeout(bannerTimer);
    clearTimeout(shoutTimer);
    for (const timer of feedTimers) {
      clearTimeout(timer);
    }
  });

  let swipe: { x: number; y: number; t: number; moved: boolean } | null = null;
  let drag: { x: number; at: number } | null = null;

  function at(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pointerDown(event: PointerEvent) {
    if (phase !== "play" || game == null) {
      return;
    }

    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured, and the press still counts.
    }

    const p = at(event);
    if (game instanceof WalkerGame) {
      drag = { x: p.x, at: game.targetX };
    } else {
      swipe = { x: p.x, y: p.y, t: performance.now(), moved: false };
    }
  }

  function pointerMove(event: PointerEvent) {
    if (phase !== "play" || game == null) {
      return;
    }

    const p = at(event);
    if (game instanceof WalkerGame) {
      if (drag != null) {
        game.steerTo(drag.at + ((p.x - drag.x) / size.w) * 22);
      }
    } else if (swipe != null && !swipe.moved) {
      const dx = p.x - swipe.x;
      const dy = p.y - swipe.y;
      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
        swipe.moved = true;
        if (dx < 0) {
          game.left();
        } else {
          game.right();
        }
      } else if (dy < -36) {
        swipe.moved = true;
        game.jump();
      }
    }
  }

  function pointerUp(event: PointerEvent) {
    if (game == null) {
      return;
    }

    if (game instanceof WalkerGame) {
      drag = null;

      return;
    }

    if (swipe == null) {
      return;
    }

    const isQuick = performance.now() - swipe.t < 420;
    if (!swipe.moved && isQuick && phase === "play") {
      const p = at(event);
      if (p.x < size.w * 0.28) {
        game.left();
      } else if (p.x > size.w * 0.72) {
        game.right();
      } else {
        game.jump();
      }
    }

    swipe = null;
  }

  function focusFirst(node: HTMLElement) {
    const target = node.querySelector<HTMLElement>("button, input");
    (target ?? node).focus({ preventScroll: true });
  }
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="arena-title"
  tabindex="-1"
  {@attach (node: HTMLElement) => {
    node.focus({ preventScroll: true });
  }}
  transition:fade={{ duration: 220 }}
  class="fixed inset-0 z-50 h-full w-full overflow-hidden paper text-foreground outline-none select-none"
>
  <div bind:this={wrap} class="absolute inset-0">
    <canvas
      bind:this={canvas}
      aria-label="A drawn view of {park.name} with {dog}, a {breed}, in it."
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
      class={cn("absolute inset-0 h-full w-full touch-none", {
        "cursor-ew-resize": isWalk && phase === "play" && fine.current,
      })}
    ></canvas>
  </div>

  <p role="status" class="sr-only">{said}</p>

  <header
    class="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 px-3 pt-safe-offset-2 [text-shadow:0_0_9px_var(--color-background),0_0_3px_var(--color-background),0_0_1px_var(--color-background)] @max-xs:grid-cols-[minmax(0,1fr)_auto]"
  >
    <div class="min-w-0 pt-1">
      <h2
        id="arena-title"
        class="slab text-[0.9375rem] leading-tight sm:text-[1.1875rem]"
      >
        {park.title}
      </h2>
      <p
        class="mt-0.5 hidden text-[0.75rem] leading-snug text-muted-foreground @min-[35rem]:block"
      >
        {dog}, a {breed}
      </p>
      {#if phase === "play" && isWalk}
        <p
          class="mt-0.5 font-display numeric text-[0.8125rem] font-bold whitespace-nowrap text-foreground/85 sm:mt-1 sm:text-[1.1875rem]"
        >
          {hud.pack}
          {hud.pack === 1 ? "dog" : "dogs"} · {hud.miles.toFixed(2)} mi
        </p>
      {/if}
    </div>

    <div
      class="flex flex-col items-center @max-xs:col-span-full @max-xs:row-start-2"
    >
      <Clock gameSeconds={hud.gameSeconds} {clock} />
      <p
        class="-mt-1 font-display numeric text-[0.8125rem] font-bold text-foreground/80"
        aria-label="Time"
      >
        {hud.clock}
      </p>
      {#if banner !== ""}
        {#key banner}
          <p
            in:fly={{ y: -8, duration: 320 }}
            out:fade={{ duration: 200 }}
            class="mt-1.5 rounded-[3px] paper px-3 py-1 slab text-[0.8125rem] whitespace-nowrap text-foreground outline outline-foreground/15 sm:text-[0.9375rem]"
          >
            {banner}
          </p>
        {/key}
      {/if}
    </div>

    <div class="flex flex-col items-end">
      <div class="pointer-events-auto -mr-1.5 flex items-center">
        <button
          type="button"
          onclick={() => sound.toggle()}
          aria-pressed={!sound.quiet}
          aria-label={sound.quiet ? "Turn the sound on" : "Turn the sound off"}
          title={sound.quiet ? "Sound is off" : "Sound is on"}
          class="grid size-9 cursor-pointer place-items-center text-foreground/70 transition-colors duration-200 hover:text-foreground"
        >
          {#if sound.quiet}
            <VolumeXIcon aria-hidden="true" class="size-4.5" />
          {:else}
            <Volume2Icon aria-hidden="true" class="size-4.5" />
          {/if}
        </button>
        {#if phase === "play" || phase === "pause"}
          <button
            type="button"
            onclick={() => (phase === "play" ? pause() : resume())}
            aria-label={phase === "play" ? "Pause" : "Resume"}
            title={phase === "play" ? "Pause (P)" : "Resume (P)"}
            class="grid size-9 cursor-pointer place-items-center text-foreground/70 transition-colors duration-200 hover:text-foreground"
          >
            {#if phase === "play"}
              <PauseIcon aria-hidden="true" class="size-4.5" />
            {:else}
              <PlayIcon aria-hidden="true" class="size-4.5" />
            {/if}
          </button>
        {/if}
        <button
          type="button"
          onclick={close}
          aria-label="Back to the map"
          title="Back to the map (Escape)"
          class="grid size-9 cursor-pointer place-items-center text-foreground/70 transition-colors duration-200 hover:text-foreground"
        >
          <XIcon aria-hidden="true" class="size-5" />
        </button>
      </div>
      <p
        class={cn(
          "flex items-baseline gap-1.5 font-display numeric text-[2.5rem] leading-none font-bold tracking-tight transition-colors duration-300 sm:text-[3.25rem]",
          { "text-primary": scoreGlow },
        )}
      >
        <span aria-label="Score">{count(hud.score)}</span>
      </p>
      {#if !isWalk}
        <p class="font-display numeric text-[0.71875rem] text-muted-foreground">
          {hud.miles.toFixed(2)} mi{#if hud.combo >= 3}<span
              class="text-primary"
            >
              · x{hud.combo}</span
            >{/if}
        </p>
      {/if}
      {#if phase === "play"}
        <div
          class="mt-1 flex gap-1.5 font-sans numeric text-[0.65625rem]"
          aria-hidden="true"
        >
          {#if hud.boost > 0}
            <span class="rounded-[3px] bg-foreground/8 px-1.5 py-0.5 text-brine"
              >bagel {hud.boost.toFixed(0)}s</span
            >
          {/if}
          {#if hud.zoomies > 0}
            <span class="rounded-[3px] bg-foreground/8 px-1.5 py-0.5 text-brine"
              >unstoppable {hud.zoomies.toFixed(0)}s</span
            >
          {/if}
          {#if hud.shield}
            <span class="rounded-[3px] bg-foreground/8 px-1.5 py-0.5 text-brine"
              >bone</span
            >
          {/if}
          {#if hud.magnet > 0}
            <span class="rounded-[3px] bg-foreground/8 px-1.5 py-0.5 text-brine"
              >magnet {hud.magnet.toFixed(0)}s</span
            >
          {/if}
          {#if isWalk && hud.whistle > 0}
            <span
              class="rounded-[3px] bg-foreground/8 px-1.5 py-0.5 text-muted-foreground"
              >whistle in {hud.whistle.toFixed(0)}s</span
            >
          {/if}
        </div>
        <ul class="mt-1.5 flex flex-col items-end gap-0.5" aria-hidden="true">
          {#each feed as line (line.id)}
            <li
              transition:fade={{ duration: 200 }}
              class={cn(
                "max-w-[44vw] truncate font-display numeric text-[0.78125rem] whitespace-nowrap sm:max-w-[36vw] sm:text-[0.84375rem]",
                {
                  "text-primary": line.tone === "good",
                  "text-foreground/80": line.tone === "plain",
                  "text-foreground": line.tone === "bad",
                  "text-brine": line.tone === "note",
                },
              )}
            >
              {line.text}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </header>

  {#if shout != null}
    {#key shout.id}
      <p
        aria-hidden="true"
        out:fade={{ duration: 300 }}
        class={cn(
          "pointer-events-none absolute inset-x-0 top-[30%] text-center slab text-[clamp(28px,6vw,44px)] [text-shadow:0_0_10px_var(--color-background),0_0_2px_var(--color-background)] motion-safe:animate-[stamp-out_1.5s_ease-out_both]",
          {
            "text-primary": shout.tone === "good",
            "text-foreground/80": shout.tone === "plain",
            "text-foreground": shout.tone === "bad",
            "text-brine": shout.tone === "note",
          },
        )}
        style:--tilt="-2deg"
      >
        {shout.text}
      </p>
    {/key}
  {/if}

  {#if phase === "play" || phase === "pause"}
    <div
      transition:fly={{ y: 24, duration: 260 }}
      class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-3 pb-safe-offset-3"
    >
      {#if isWalk}
        <p class="text-[0.75rem] text-muted-foreground" aria-hidden="true">
          {#if fine.current}
            Drag or use the arrow keys to steer. Space whistles.
          {:else}
            Drag to steer. Tap Whistle to pull the pack in.
          {/if}
        </p>
        <div class="flex items-stretch gap-2">
          <button
            type="button"
            aria-label="Steer left"
            onpointerdown={() => held.add("ArrowLeft")}
            onpointerup={() => held.delete("ArrowLeft")}
            onpointercancel={() => held.delete("ArrowLeft")}
            onpointerleave={() => held.delete("ArrowLeft")}
            class="grid h-12 w-16 place-items-center rounded-lg paper text-[1.125rem] shadow-[0_2px_1px_rgb(60_50_40/0.14)] outline outline-foreground/15 select-none active:translate-y-px sm:w-14"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            disabled={hud.whistle > 0}
            onclick={() => game?.act()}
            class="shout px-6 text-[1.0625rem] uppercase disabled:text-muted-foreground disabled:opacity-100"
          >
            Whistle
          </button>
          <button
            type="button"
            aria-label="Steer right"
            onpointerdown={() => held.add("ArrowRight")}
            onpointerup={() => held.delete("ArrowRight")}
            onpointercancel={() => held.delete("ArrowRight")}
            onpointerleave={() => held.delete("ArrowRight")}
            class="grid h-12 w-16 place-items-center rounded-lg paper text-[1.125rem] shadow-[0_2px_1px_rgb(60_50_40/0.14)] outline outline-foreground/15 select-none active:translate-y-px sm:w-14"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      {:else}
        <p class="text-[0.75rem] text-muted-foreground" aria-hidden="true">
          {#if fine.current}
            Arrow keys move, Space jumps. Strollers, carts, joggers, and bikes
            need a lane change.
          {:else}
            Tap the sides to move, the middle to jump. Strollers, carts,
            joggers, and bikes need a lane change.
          {/if}
        </p>
        <div class="flex items-stretch gap-2">
          <button
            type="button"
            aria-label="Move left"
            onclick={() => game?.nudge(-1)}
            class="grid h-12 w-16 place-items-center rounded-lg paper text-[1.125rem] shadow-[0_2px_1px_rgb(60_50_40/0.14)] outline outline-foreground/15 select-none active:translate-y-px sm:w-14"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onclick={() => game?.act()}
            class="shout px-8 text-[1.0625rem] uppercase">Jump</button
          >
          <button
            type="button"
            aria-label="Move right"
            onclick={() => game?.nudge(1)}
            class="grid h-12 w-16 place-items-center rounded-lg paper text-[1.125rem] shadow-[0_2px_1px_rgb(60_50_40/0.14)] outline outline-foreground/15 select-none active:translate-y-px sm:w-14"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  {#if phase !== "play"}
    <div
      transition:fade={{ duration: 180 }}
      class="absolute inset-0 overflow-y-auto bg-background/35"
    >
      <div
        class="flex min-h-full w-full items-center justify-center px-3 py-11 sm:px-4 sm:py-16"
      >
        <section
          {@attach focusFirst}
          aria-label={phase === "start"
            ? "How to play"
            : phase === "pause"
              ? "Paused"
              : "How it went"}
          in:fly={{ y: 18, duration: 320 }}
          class="w-full max-w-md min-w-0 rotate-[-0.6deg] bubble paper p-4 shadow-[0_14px_40px_rgb(20_16_10/0.4)] outline outline-foreground/15 sm:p-5"
        >
          <button
            type="button"
            onclick={close}
            aria-label="Back to the map"
            title="Back to the map"
            class="absolute top-2 right-2 z-10 grid size-9 cursor-pointer place-items-center rounded-[3px] text-foreground/60 transition-colors duration-200 hover:text-foreground"
          >
            <XIcon aria-hidden="true" class="size-4.5" />
          </button>
          {#if phase === "start"}
            <h3
              class="font-display text-[1.5rem] leading-[1.02] font-bold tracking-tight sm:text-[1.6875rem]"
            >
              {park.title}
            </h3>
            {#if best > 0}
              <p
                class="mt-1 font-display numeric text-[0.8125rem] leading-snug text-foreground/85 sm:mt-1.5 sm:text-[0.9375rem]"
              >
                Your best here is <strong class="text-foreground"
                  >{count(best)}</strong
                >
                points, good for <em>{rank.name}</em>.{kennel.streak > 1
                  ? ` Day ${kennel.streak} of your streak.`
                  : ""}
              </p>
            {/if}
            <p
              class="mt-2 text-[0.78125rem] leading-snug text-foreground/85 sm:text-[0.84375rem] sm:leading-relaxed"
            >
              {park.brief}
            </p>
            <p class="mt-2.5 text-[0.78125rem] leading-snug text-foreground/85">
              {#if isWalk}
                <strong class="font-semibold text-foreground">{dog}</strong>
                walks in front and {TRAIT_WORD[traitOf(breed)]}. To put another
                dog in front, pick one below.
              {:else}
                <strong class="font-semibold text-foreground">{dog}</strong> runs
                this one. To run another dog, pick one below.
              {/if}
            </p>
            <ul
              class="-mx-4 mt-0.5 no-scrollbar flex gap-0.5 overflow-x-auto border-b border-foreground/25 px-4 pt-1 sm:-mx-5 sm:px-5"
              aria-label="Pick a breed"
            >
              {#if mine != null}
                <li class="shrink-0">
                  <button
                    type="button"
                    aria-pressed={yours}
                    aria-label="{mine.name}, your dog"
                    title="{mine.name}, your dog"
                    onclick={chooseMine}
                    class="relative flex h-12 min-w-12 flex-col items-center justify-end pb-0.5 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span
                      aria-hidden="true"
                      class={cn(
                        "absolute inset-x-1.5 bottom-0 h-1.5 rounded-[50%] transition-opacity duration-200",
                        { "opacity-0": !yours },
                      )}
                      style:background={collarOf(mine.collar)}
                    ></span>
                    <Plate
                      breed={mine.breed}
                      height={34}
                      class={cn("relative transition-opacity duration-200", {
                        "opacity-60": !yours,
                      })}
                    />
                    <span
                      aria-hidden="true"
                      class="absolute top-0 right-0 size-2.5 rounded-full ring-2 ring-background"
                      style:background={collarOf(mine.collar)}
                    ></span>
                  </button>
                </li>
                <li
                  aria-hidden="true"
                  class="mx-1 my-2 w-px shrink-0 bg-foreground/15"
                ></li>
              {/if}
              {#each [...RUNNERS] as option (option)}
                <li class="shrink-0">
                  <button
                    type="button"
                    aria-pressed={!yours && option === breed}
                    aria-label={option}
                    title={option}
                    onclick={() => choose(option)}
                    class="relative flex h-12 w-12 flex-col items-center justify-end pb-0.5 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span
                      aria-hidden="true"
                      class={cn(
                        "absolute inset-x-1.5 bottom-0 h-1.5 rounded-[50%] transition-colors duration-200",
                        !yours && option === breed
                          ? "bg-primary/85"
                          : "bg-transparent",
                      )}
                    ></span>
                    <Plate
                      breed={option}
                      height={34}
                      class={cn("relative transition-opacity duration-200", {
                        "opacity-60": yours || option !== breed,
                      })}
                    />
                  </button>
                </li>
              {/each}
            </ul>
            <p
              class="mt-2.5 text-[0.75rem] leading-snug text-foreground/80 sm:text-[0.8125rem] sm:leading-relaxed"
            >
              {#each park.how as line (line.do)}
                {line.do}{line.key !== "" && fine.current
                  ? " "
                  : ""}{#if line.key !== "" && fine.current}<span class="key"
                    >{line.key}</span
                  >{/if}.{" "}
              {/each}
            </p>
            <div
              class="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t rule pt-2.5"
            >
              <button
                type="button"
                aria-pressed={pace.daily}
                onclick={() => (pace.daily = true)}
                class={cn(
                  "cursor-pointer py-1 slab text-[0.9375rem] transition-colors duration-200 aria-pressed:text-foreground aria-pressed:underline aria-pressed:decoration-primary aria-pressed:decoration-2 aria-pressed:underline-offset-4",
                  { "text-muted-foreground": !pace.daily },
                )}>Today's {clock.isNight ? "night" : "morning"}</button
              >
              <span class="text-muted-foreground" aria-hidden="true">·</span>
              <button
                type="button"
                aria-pressed={!pace.daily}
                onclick={() => (pace.daily = false)}
                class={cn(
                  "cursor-pointer py-1 slab text-[0.9375rem] transition-colors duration-200 aria-pressed:text-foreground aria-pressed:underline aria-pressed:decoration-primary aria-pressed:decoration-2 aria-pressed:underline-offset-4",
                  { "text-muted-foreground": pace.daily },
                )}>Any {clock.isNight ? "night" : "morning"}</button
              >
            </div>
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <button
                type="button"
                aria-pressed={!pace.slow}
                onclick={() => (pace.slow = false)}
                class={cn(
                  "cursor-pointer py-1 slab text-[0.9375rem] transition-colors duration-200 aria-pressed:text-foreground aria-pressed:underline aria-pressed:decoration-primary aria-pressed:decoration-2 aria-pressed:underline-offset-4",
                  { "text-muted-foreground": pace.slow },
                )}>Full speed</button
              >
              <span class="text-muted-foreground" aria-hidden="true">·</span>
              <button
                type="button"
                aria-pressed={pace.slow}
                onclick={() => (pace.slow = true)}
                class={cn(
                  "cursor-pointer py-1 slab text-[0.9375rem] transition-colors duration-200 aria-pressed:text-foreground aria-pressed:underline aria-pressed:decoration-primary aria-pressed:decoration-2 aria-pressed:underline-offset-4",
                  { "text-muted-foreground": !pace.slow },
                )}>Half speed</button
              >
            </div>
            <p
              class="mt-1 numeric text-[0.71875rem] leading-snug text-muted-foreground"
            >
              {pace.daily
                ? `${todayConditions.name}: ${todayConditions.note} Everyone who plays on ${prettyDay(todayKey())} gets this same ${clock.isNight ? "night" : "morning"}, with the same conditions.`
                : `A fresh ${clock.isNight ? "night" : "morning"} is rolled on your own machine, with its own conditions, shared with nobody.`}
              {pace.slow ? " Everything moves at about half speed." : ""}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onclick={() => start()}
                class="shout px-5 py-2 text-[1.0625rem] uppercase sm:px-6 sm:text-[1.1875rem]"
                >{park.cta}</button
              >
            </div>
          {:else if phase === "pause"}
            <h3
              class="font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight"
            >
              Paused
            </h3>
            <p
              class="mt-2 text-[0.84375rem] leading-relaxed text-foreground/85"
            >
              The clock stopped at {hud.clock}. {dog} is waiting.
            </p>
            <div class="mt-4 flex items-center gap-4">
              <button
                type="button"
                onclick={resume}
                class="shout px-5 py-2 text-[1.0625rem] uppercase sm:px-6 sm:text-[1.1875rem]"
                >Keep going</button
              >
            </div>
          {:else}
            <p class="text-[0.75rem] text-muted-foreground">
              {park.name}, {pace.daily
                ? `the ${clock.isNight ? "night" : "morning"} of ${prettyDay(todayKey())}`
                : `any ${clock.isNight ? "night" : "morning"}`}. {conditionsName}.
            </p>
            <p class="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span class="figure text-foreground"
                >{count(Math.max(0, hud.score))}</span
              >
              <span
                class="font-display text-[1.1875rem] leading-none text-foreground/85 italic"
                >{rank.name}</span
              >
            </p>
            <div class="mt-4">
              <CollarTags
                tags={TAGS[id]}
                {earned}
                fresh={new Set(outcome?.fresh.map((f) => f.id) ?? [])}
              />
            </div>
            <p
              class="mt-3 numeric text-[0.8125rem] leading-relaxed text-foreground/85"
            >
              {summary.join(". ")}.
              {outcome?.isNewBest
                ? "A new best."
                : `Your best is ${count(best)}.`}
              {#if rank.next != null}
                {count(rank.next.at - Math.max(0, hud.score))} more would make {rank
                  .next.name}.
              {/if}
              {#if pace.daily && (outcome?.streak ?? 0) > 1}
                Day {outcome?.streak} of your streak.
              {/if}
            </p>
            <p
              class="mt-2 hidden text-[0.78125rem] leading-relaxed text-muted-foreground sm:block"
            >
              {park.fact}
            </p>
            <div
              class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t rule pt-3"
            >
              <button
                type="button"
                onclick={() => start()}
                class="shout px-5 py-2 text-[1.0625rem] uppercase sm:px-6 sm:text-[1.1875rem]"
                >Once more</button
              >
              <button
                type="button"
                onclick={share}
                class="flex items-center gap-1.5 py-1 text-[0.78125rem] text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
              >
                <Share2Icon aria-hidden="true" class="size-3.5" />
                Share it
              </button>
              <button
                type="button"
                onclick={save}
                class="hidden py-1 text-[0.78125rem] text-foreground/80 underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary sm:inline"
                >Save the card</button
              >
              {#if shared !== ""}
                <span class="text-[0.75rem] text-muted-foreground" role="status"
                  >{shared}</span
                >
              {/if}
            </div>
          {/if}
        </section>
      </div>
    </div>
  {/if}
</div>
