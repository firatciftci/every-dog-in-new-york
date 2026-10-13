<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { watch } from "runed";
  import { untrack } from "svelte";
  import { on } from "svelte/events";
  import { MediaQuery } from "svelte/reactivity";
  import { fade } from "svelte/transition";
  import type { Pet } from "#lib/pet.svelte.js";
  import type { Car, Line } from "#lib/trains.js";
  import type {
    RailLines,
    RailStations,
    Rider,
    SubwayLines,
    SubwayStations,
  } from "#lib/types.js";
  import { plateOf } from "#lib/breeds.js";
  import { crowd } from "#lib/crowd.svelte.js";
  import { pet } from "#lib/pet.svelte.js";
  import { explorer } from "#lib/state.svelte.js";
  import { boardingAt, buildLines, crew, pick, pointAt } from "#lib/trains.js";
  import type { Padding } from "./camera";
  import { stage } from "./camera";
  import { carUnder, fleet, yard } from "./fleet.svelte";
  import TrainCar from "./train-car.svelte";
  import TrainPanel from "./train-panel.svelte";

  let {
    map,
    lines,
    stations,
    rail,
    railStops,
    riders,
    padding,
    show,
    dens,
  }: {
    map: MapLibreMap;
    lines: SubwayLines;
    stations: SubwayStations;
    rail: RailLines;
    railStops: RailStations;
    riders: Array<Rider>;
    padding: Padding;
    show: boolean;
    dens: Array<{
      dog: Pet;
      at: [number, number];
      borough: string;
      hood: string;
    }>;
  } = $props();

  const RIDE_ZOOM = 12.6;

  const CLEARANCE = 142;

  // Half a card width plus its dog.
  const EDGE = 76;

  const FOLLOW = 0.1;

  const STABLED = 24;

  const PX_PER_SEC = 20;

  const RIDE_AT = 14.2;
  let built = $state<Array<Line>>([]);
  let zoom = $state(0);
  let chosen = $state<number | null>(null);
  let grazed = $state<number | null>(null);
  let card = $state<HTMLElement | null>(null);
  let below = $state(false);
  let nub = $state(0);
  let panelHeight = 0;
  // Not $state: the frame loop writes it, and only the next frame reads it.
  let told = { next: -1, halted: true, speed: 0, at: 0 };
  // The fleet outlives this component, so new ids start above the cars already parked.
  let minted = untrack(() => Math.max(0, ...fleet.map((car) => car.id)));

  const calm = new MediaQuery("(prefers-reduced-motion: reduce)");

  const riding = $derived(crew(riders));
  const running = $derived(show && zoom >= RIDE_ZOOM && built.length > 0);
  const onstage = $derived(fleet.filter((car) => car.live));
  const open = $derived(fleet.find((car) => car.id === chosen) ?? null);

  // Read the props outside the timeout, or the effect never re-runs: it only tracks synchronous reads.
  $effect(() => {
    const arcs = lines;
    const stops = stations;
    const iron = rail;
    const platforms = railStops;
    const id = setTimeout(() => {
      built = buildLines(arcs, stops, iron, platforms);
    }, 400);

    return () => clearTimeout(id);
  });

  $effect(() => {
    yard.lines = built;
  });

  watch([() => lines, () => rail, () => riders], () => {
    const services = new Set([
      ...lines.features.map((feature) => `subway:${feature.properties.route}`),
      ...rail.features.map(
        (feature) => `${feature.properties.system}:${feature.properties.route}`,
      ),
    ]);
    const homes = new Set(riders.map((rider) => rider.slug));

    built = built.filter((line) =>
      services.has(`${line.system}:${line.route}`),
    );

    for (let i = fleet.length - 1; i >= 0; i -= 1) {
      const car = fleet[i]!;

      if (!services.has(`${car.line.system}:${car.line.route}`)) {
        if (chosen === car.id) {
          release();
        }

        if (car.mine) {
          explorer.ride = null;
        }

        fleet.splice(i, 1);
      } else if (!car.mine && car.peer == null && !homes.has(car.slug)) {
        riding.boardRider(car, car.stop);
      }
    }
  });

  $effect(() => {
    const read = () => {
      zoom = map.getZoom();
    };

    read();
    map.on("zoom", read);

    return () => {
      map.off("zoom", read);
    };
  });

  $effect(() => {
    const tap = (event: { point: { x: number; y: number } }) => {
      const car = carUnder(event.point);
      chosen = car == null || car.id === chosen ? null : car.id;
    };

    const graze = (event: { point: { x: number; y: number } }) => {
      grazed = carUnder(event.point)?.id ?? null;
    };

    // preventDefault marks it handled so the page's own Escape does not also clear the map.
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && chosen != null) {
        event.preventDefault();
        release();
      }
    };

    map.on("click", tap);
    map.on("mousemove", graze);
    // drag, not dragstart: MapLibre fires dragstart on mousedown, which is also the start of a click.
    map.on("drag", release);
    const drop = on(document, "keydown", key);

    return () => {
      map.off("click", tap);
      map.off("mousemove", graze);
      map.off("drag", release);
      drop();
    };
  });

  function release() {
    chosen = null;
  }

  // Offset, not padding, for the same reason as Camera.focus.
  function meet(spot: [number, number]) {
    const seen = stage(map, padding);
    const canvas = map.getCanvas();

    map.easeTo({
      center: spot,
      zoom: Math.max(map.getZoom(), RIDE_AT),
      offset: [
        (seen.left - (canvas.clientWidth - seen.right)) / 2,
        (seen.top - (canvas.clientHeight - seen.bottom)) / 2,
      ],
      duration: calm.current ? 0 : 1100,
    });
  }

  // The reader's own dog boards at the stop nearest home, in the direction they chose.
  watch([() => explorer.ride, () => built.length > 0], ([ride, ready]) => {
    told = { next: -1, halted: true, speed: 0, at: 0 };
    crowd.ride(null);

    for (let i = fleet.length - 1; i >= 0; i -= 1) {
      if (fleet[i]!.mine) {
        if (chosen === fleet[i]!.id) {
          release();
        }

        fleet.splice(i, 1);
      }
    }

    const den = untrack(() => dens.find((d) => d.dog.id === ride?.id));
    if (ride == null || !ready || den == null) {
      return;
    }

    const line = built.find(
      (l) =>
        l.system === "subway" &&
        l.route === ride.route &&
        l.signs.includes(ride.sign),
    );
    if (line == null) {
      explorer.ride = null;

      return;
    }

    const dir: 1 | -1 = line.signs[1] === ride.sign ? 1 : -1;
    const [lon, lat] = den.at;
    let platform = line.stops[dir === 1 ? 0 : line.stops.length - 1]!;
    let gap = Infinity;
    for (const [i, stop] of line.stops.entries()) {
      const last = dir === 1 ? i === line.stops.length - 1 : i === 0;
      const [x, y] = pointAt(line, stop.at);
      const far = (x - lon) ** 2 + ((y - lat) * 1.32) ** 2;
      if (!last && stop.city && far < gap) {
        gap = far;
        platform = stop;
      }
    }

    const seat = map.project(pointAt(line, boardingAt(line, platform, dir)));
    minted += 1;
    const car = riding.board(line, platform, dir, minted, seat, {
      dog: den.dog.name,
      breed: den.dog.breed,
      plate: plateOf(den.dog.breed),
      hood: den.hood,
      borough: den.borough,
      slug: den.dog.slug,
    });

    fleet.push(car);
    chosen = car.id;
    meet(pointAt(line, car.at));
  });

  // Another reader's dog rides from their last departure, at the speed their own map ran it.
  watch([() => crowd.peers, () => built.length > 0], ([peers, ready]) => {
    if (!ready) {
      return;
    }

    const aboard = new Map(
      peers.flatMap((peer) =>
        peer.ride == null
          ? []
          : [[peer.id, { dogs: peer.dogs, ride: peer.ride }] as const],
      ),
    );

    for (let i = fleet.length - 1; i >= 0; i -= 1) {
      const car = fleet[i]!;
      if (car.peer == null) {
        continue;
      }

      const ride = aboard.get(car.peer.id)?.ride;
      if (
        ride?.route === car.line.route &&
        car.line.signs.includes(ride.sign)
      ) {
        continue;
      }

      if (chosen === car.id) {
        release();
      }

      fleet.splice(i, 1);
    }

    for (const [id, { dogs, ride }] of aboard) {
      const dog = dogs[ride.dog];
      const home = riders.find((rider) => rider.slug === dog?.slug);
      const line = built.find(
        (l) =>
          l.system === "subway" &&
          l.route === ride.route &&
          l.signs.includes(ride.sign),
      );
      const platform = line?.stops[ride.next];
      if (dog == null || home == null || line == null || platform == null) {
        continue;
      }

      const dir: 1 | -1 = line.signs[1] === ride.sign ? 1 : -1;
      let car = fleet.find((other) => other.peer?.id === id);
      if (
        car?.peer?.next === ride.next &&
        car.peer.speed === ride.speed &&
        car.dir === dir
      ) {
        continue;
      }

      if (car == null) {
        minted += 1;
        car = riding.board(
          line,
          platform,
          dir,
          minted,
          map.project(pointAt(line, ride.at)),
          {
            dog: dog.name ?? dog.breed,
            breed: dog.breed,
            plate: plateOf(dog.breed),
            hood: home.hood,
            borough: home.borough,
            slug: dog.slug,
          },
        );
        car.mine = false;
        car.live = false;
        fleet.push(car);
      }

      const isSameLeg = car.peer?.next === ride.next && car.dir === dir;
      const at = !isSameLeg
        ? ride.at
        : dir === 1
          ? Math.max(ride.at, car.at)
          : Math.min(ride.at, car.at);

      car.peer = {
        id,
        collar: dog.collar,
        at,
        next: ride.next,
        speed: ride.speed,
        stamp: performance.now(),
      };
      car.at = at;
      car.dir = dir;
      car.next = ride.next;
      car.dest = ride.sign;
      car.origin = dir === 1 ? line.signs[0] : line.signs[1];
      car.getOff = ride.sign;
      car.ahead = platform.name;
    }
  });

  watch(
    () => explorer.follow,
    (_, was) => {
      const car = fleet.find((other) => other.mine);
      if (was === undefined || car == null) {
        return;
      }

      chosen = car.id;
      meet(pointAt(car.line, car.at));
    },
  );

  type Spot = { car: Car; x: number; y: number; lean: number };
  type Stage = ReturnType<typeof stage>;

  function inside(spot: { x: number; y: number }, seen: Stage, margin: number) {
    return (
      spot.x > seen.left - margin &&
      spot.x < seen.right + margin &&
      spot.y > seen.top - margin &&
      spot.y < seen.bottom + margin
    );
  }

  function clear(spot: { x: number; y: number }, taken: Array<Spot>) {
    return taken.every(
      (other) => Math.hypot(other.x - spot.x, other.y - spot.y) > CLEARANCE,
    );
  }

  function board(seen: Stage, taken: Array<Spot>): Car | null {
    const inX = (seen.right - seen.left) * 0.1;
    const inY = (seen.bottom - seen.top) * 0.1;
    const sw = map.unproject([seen.left + inX, seen.bottom - inY]);
    const ne = map.unproject([seen.right - inX, seen.top + inY]);
    const box = [sw.lng, sw.lat, ne.lng, ne.lat] as const;

    const here = built.filter(
      (line) =>
        line.bbox[0] < box[2] &&
        line.bbox[2] > box[0] &&
        line.bbox[1] < box[3] &&
        line.bbox[3] > box[1],
    );

    const busy = new Set(taken.map((spot) => spot.car.line));
    const fresh = here.filter((line) => !busy.has(line));
    const pool = fresh.length > 0 ? fresh : here;

    for (const line of pool.sort(() => Math.random() - 0.5).slice(0, 7)) {
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const free = line.stops.filter((platform, i) => {
        if (dir === 1 ? i === line.stops.length - 1 : i === 0) {
          return false;
        }

        const [lon, lat] = pointAt(line, platform.at);
        if (lon < box[0] || lon > box[2] || lat < box[1] || lat > box[3]) {
          return false;
        }

        return clear(
          map.project(pointAt(line, boardingAt(line, platform, dir))),
          taken,
        );
      });

      if (free.length === 0) {
        continue;
      }

      const platform = pick(free);
      const seat = map.project(pointAt(line, boardingAt(line, platform, dir)));

      minted += 1;

      return riding.board(line, platform, dir, minted, seat);
    }

    return null;
  }

  function place(car: Car) {
    const { line } = car;
    const here = map.project(pointAt(line, car.at));
    const back = map.project(pointAt(line, Math.max(car.at - 50, 0)));
    const fore = map.project(pointAt(line, Math.min(car.at + 50, line.length)));

    let lean = (Math.atan2(fore.y - back.y, fore.x - back.x) * 180) / Math.PI;
    if (lean > 90) {
      lean -= 180;
    } else if (lean < -90) {
      lean += 180;
    }

    const travel = (fore.x - back.x) * car.dir;
    if (travel < -1.5) {
      car.faceLeft = true;
    } else if (travel > 1.5) {
      car.faceLeft = false;
    }

    return { x: here.x, y: here.y, lean: Math.max(-11, Math.min(11, lean)) };
  }

  function play(car: Car, now: number) {
    if (car.peer == null) {
      return;
    }

    const { at, next, speed, stamp } = car.peer;
    const platform = car.line.stops[next];
    const run = at + (car.dir * speed * Math.max(0, now - stamp)) / 1000;
    const isThere =
      platform != null &&
      (car.dir === 1 ? run >= platform.at : run <= platform.at);

    car.at = Math.min(
      Math.max(isThere ? platform.at : run, 0),
      car.line.length,
    );
    car.halted = isThere;
    if (isThere) {
      car.stop = platform.name;
    }
  }

  function measure(car: Car) {
    return (el: HTMLElement) => {
      const take = () => {
        car.w = el.offsetWidth;
        car.h = el.offsetHeight;
      };

      take();
      const watch = new ResizeObserver(take);
      watch.observe(el);

      return () => watch.disconnect();
    };
  }

  function panel(el: HTMLElement) {
    panelHeight = el.offsetHeight;
    const watch = new ResizeObserver(() => {
      panelHeight = el.offsetHeight;
    });

    watch.observe(el);

    return () => watch.disconnect();
  }

  $effect(() => {
    // Untracked: a car joining the fleet must not count as the stage going dark.
    if (!running) {
      untrack(() => {
        for (const car of fleet) {
          car.live = false;
        }

        release();
      });

      return;
    }

    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.08);
      last = now;

      const seen = stage(map, padding);
      const wide = seen.right - seen.left;
      const metersPerPx =
        (156_543.033_92 * Math.cos((map.getCenter().lat * Math.PI) / 180)) /
        2 ** map.getZoom();

      const size = Math.min(0.82, 0.68 + (map.getZoom() - RIDE_ZOOM) * 0.12);
      const want = Math.max(2, Math.min(4, Math.round(wide / 400)));
      const showing: Array<Spot> = [];
      let chase: [number, number] | null = null;

      for (const car of fleet) {
        if (car.live || (!car.mine && car.peer == null)) {
          continue;
        }

        play(car, now);
        const spot = place(car);
        if (car.mine || inside(spot, seen, 0)) {
          car.seed = `translate3d(${spot.x}px, ${spot.y}px, 0)`;
          car.live = true;
        }
      }

      for (const car of fleet) {
        if (!car.live) {
          continue;
        }

        car.followed = car.id === chosen;
        if (car.peer != null) {
          play(car, now);
        } else if (!calm.current) {
          riding.step(car, dt, PX_PER_SEC * metersPerPx);
        }

        // A departure is all another reader needs: their map runs the leg from there.
        if (car.mine) {
          const speed = calm.current ? 0 : PX_PER_SEC * metersPerPx;
          const isOff = !car.halted && (told.halted || told.next !== car.next);
          const isFaster =
            !car.halted &&
            Math.abs(speed - told.speed) > told.speed * 0.3 &&
            now - told.at > 1500;
          told.halted = car.halted;

          const dog = pet.dogs.findIndex((d) => d.id === explorer.ride?.id);
          if ((isOff || isFaster) && dog >= 0) {
            told = { next: car.next, halted: false, speed, at: now };
            crowd.ride({
              dog,
              route: car.line.route,
              sign: car.dest,
              at: Math.round(car.at),
              next: car.next,
              speed: Math.round(speed),
            });
          }
        }

        // The followed dog got off: the map gets off with them, and the car leaves service.
        if (car.alighted) {
          release();
          car.live = false;
          continue;
        }

        const spot = place(car);
        if (!car.mine && !inside(spot, seen, EDGE)) {
          car.live = false;
          if (chosen === car.id) {
            release();
          }

          continue;
        }

        showing.push({ car, ...spot });
      }

      for (let i = fleet.length - 1; i >= 0; i -= 1) {
        if (fleet[i]!.alighted) {
          fleet.splice(i, 1);
        }
      }

      if (showing.length < want) {
        for (const car of fleet) {
          if (showing.length >= want || car.live || car.peer != null) {
            continue;
          }

          const spot = place(car);
          if (!inside(spot, seen, -60) || !clear(spot, showing)) {
            continue;
          }

          car.seed = `translate3d(${spot.x}px, ${spot.y}px, 0)`;
          car.live = true;
          showing.push({ car, ...spot });
        }
      }

      while (showing.length < want) {
        const car = board(seen, showing);
        if (car == null) {
          break;
        }

        fleet.push(car);
        showing.push({ car, ...place(car) });

        if (fleet.length > STABLED) {
          const stale = fleet.findIndex(
            (other) => !other.live && other.peer == null,
          );
          if (stale >= 0) {
            fleet.splice(stale, 1);
          }
        }
      }

      showing.sort((a, b) => b.y - a.y);
      for (let i = 1; i < showing.length; i++) {
        const above = showing[i]!;
        for (let j = 0; j < i; j++) {
          const under = showing[j]!;
          if (Math.abs(above.x - under.x) < 140 && under.y - above.y < 58) {
            above.y = under.y - 58;
          }
        }
      }

      for (const spot of showing) {
        spot.car.sx = spot.x;
        spot.car.sy = spot.y;
        spot.car.scale = size;
        spot.car.lean = spot.lean;

        if (spot.car.el != null) {
          spot.car.el.style.transform = `translate3d(${spot.x}px, ${spot.y}px, 0) rotate(${spot.lean}deg) scale(${size})`;
        }

        if (spot.car.id !== chosen || card == null) {
          continue;
        }

        const half = 130;
        const x = Math.min(
          Math.max(spot.x, seen.left + half),
          seen.right - half,
        );
        const lift = spot.y - 82 - panelHeight;
        const roomAbove = lift > seen.top + 8;
        const y = Math.max(
          seen.top + 8,
          roomAbove
            ? lift
            : Math.min(spot.y + 26, seen.bottom - panelHeight - 8),
        );

        card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        below = !roomAbove;
        nub = Math.max(-96, Math.min(96, spot.x - x));

        chase = [
          (spot.x - (seen.left + seen.right) / 2) * FOLLOW,
          (spot.y - (seen.top + seen.bottom) / 2) * FOLLOW,
        ];
      }

      if (chase != null && Math.hypot(chase[0], chase[1]) > 0.4) {
        map.panBy(chase, { duration: 0, animate: false });
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  });
</script>

{#if running}
  <div class="pointer-events-none absolute inset-0 z-10 overflow-hidden">
    {#each onstage as car (car.id)}
      <div
        bind:this={car.el}
        {@attach measure(car)}
        aria-hidden="true"
        transition:fade={{ duration: 300 }}
        class="absolute top-0 left-0 w-max will-change-transform"
        style:transform={car.seed}
      >
        <TrainCar
          system={car.line.system}
          route={car.line.route}
          bullet={car.line.bullet}
          color={car.line.color}
          finch={car.line.route === "MNB"}
          dest={car.dest}
          dog={car.dog}
          boarded={car.boarded}
          stop={car.stop}
          plate={car.plate}
          delay={car.delay}
          halted={car.halted}
          faceLeft={car.faceLeft}
          open={car.id === chosen}
          grazed={car.id === grazed}
          mine={car.mine}
          peer={car.peer?.collar ?? null}
        />
      </div>
    {/each}

    {#if open != null}
      <div
        bind:this={card}
        transition:fade={{ duration: 140 }}
        onwheelcapture={(event) => {
          event.preventDefault();
          map
            .getCanvasContainer()
            .dispatchEvent(new WheelEvent("wheel", event));
        }}
        class="absolute top-0 left-0 z-10 will-change-transform"
      >
        <div {@attach panel}>
          <TrainPanel
            dog={open.dog}
            breed={open.breed}
            plate={open.plate}
            system={open.line.system}
            route={open.line.route}
            bullet={open.line.bullet}
            color={open.line.color}
            service={open.line.name}
            boarded={open.boarded}
            hood={open.hood}
            borough={open.borough}
            slug={open.slug}
            stop={open.halted ? open.stop : open.ahead}
            getOff={open.getOff}
            dest={open.dest}
            delay={open.delay}
            halted={open.halted}
            finch={open.line.route === "MNB"}
            {below}
            {nub}
            mine={open.mine}
            peer={open.peer != null}
            onadopt={() => {
              open.alighted = true;
              release();
            }}
            onclose={release}
          />
        </div>
      </div>
    {/if}
  </div>
{/if}
