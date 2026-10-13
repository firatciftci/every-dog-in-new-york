import type { System } from "#lib/rail.js";
import type {
  RailLines,
  RailStations,
  Rider,
  SubwayLines,
  SubwayStations,
} from "#lib/types.js";
import { delaysFor, FAR_SIGN, railColor, SIGN_AS } from "#lib/rail.js";
import { ROUTE_COLOR } from "#lib/subway.js";

/**
 * at is meters along the run from the first stop.
 */
export type Stop = { name: string; at: number; city: boolean };

export type Line = {
  system: System;
  route: string;
  bullet: string;
  name: string;
  color: string;
  path: Array<[number, number]>;
  /**
   * Cumulative meters at each vertex.
   */
  cum: Array<number>;
  length: number;
  stops: Array<Stop>;
  signs: [string, string];
  bbox: [number, number, number, number];
};

// Meters per degree at New York's latitude; flat approximation is exact to the meter here.
const LAT_M = 111_320;
const LON_M = 84_400;

// Meters. Widest real seams: 73 m subway (Jamaica Bay), about 250 m commuter rail.
const SNAP = { subway: 90, rail: 300 };

// Max meters from the track for a station to count as on it.
const ON_TRACK = 260;

// Min meters a terminal stands off another run to count as a branch.
const BRANCHED = 400;

function meters(a: [number, number], b: [number, number]) {
  const x = (a[0] - b[0]) * LON_M;
  const y = (a[1] - b[1]) * LAT_M;

  return Math.hypot(x, y);
}

function span(path: Array<[number, number]>) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += meters(path[i - 1]!, path[i]!);
  }

  return total;
}

type Step = { node: number; coords: Array<[number, number]> };
type Graph = Array<Array<Step & { w: number }>>;

function closestNode(dist: Float64Array, done: Uint8Array) {
  let at = -1;
  let near = Infinity;

  for (const [i, gap] of dist.entries()) {
    if (done[i] === 1 || gap >= near) {
      continue;
    }

    near = gap;
    at = i;
  }

  return at;
}

function sweep(graph: Graph, sources: Array<number>) {
  const size = graph.length;
  const dist = new Float64Array(size).fill(Infinity);
  const prev = new Map<number, Step>();
  const done = new Uint8Array(size);
  for (const source of sources) {
    dist[source] = 0;
  }

  for (;;) {
    const at = closestNode(dist, done);
    if (at < 0) {
      break;
    }

    done[at] = 1;
    const out = graph[at] as Array<Step & { w: number }>;
    for (const edge of out) {
      const through = dist[at]! + edge.w;
      if (through < dist[edge.node]!) {
        dist[edge.node] = through;
        prev.set(edge.node, { node: at, coords: edge.coords });
      }
    }
  }

  let far = sources[0] ?? 0;
  for (let i = 0; i < size; i++) {
    if (dist[i]! < Infinity && dist[i]! > dist[far]!) {
      far = i;
    }
  }

  return { dist, prev, far };
}

function trace(prev: Map<number, Step>, to: number) {
  const walk: Array<Array<[number, number]>> = [];

  for (let node = to; ;) {
    const step = prev.get(node);
    if (step === undefined) {
      break;
    }

    walk.unshift(step.coords);
    node = step.node;
  }

  const path: Array<[number, number]> = [];
  for (const seg of walk) {
    path.push(...(path.length === 0 ? seg : seg.slice(1)));
  }

  return path;
}

function weave(parts: Array<Array<[number, number]>>, snap: number) {
  const nodes: Array<[number, number]> = [];
  const graph: Graph = [];

  const idOf = (point: [number, number]) => {
    for (const [i, node] of nodes.entries()) {
      if (meters(node, point) < snap) {
        return i;
      }
    }

    nodes.push(point);
    graph.push([]);

    return nodes.length - 1;
  };

  for (const part of parts) {
    if (part.length < 2) {
      continue;
    }

    const a = idOf(part[0]!);
    const b = idOf(part.at(-1)!);
    if (a === b) {
      continue;
    }

    const w = span(part);
    (graph[a] as Array<Step & { w: number }>).push({
      node: b,
      w,
      coords: part,
    });
    (graph[b] as Array<Step & { w: number }>).push({
      node: a,
      w,
      coords: part.toReversed(),
    });
  }

  return { graph, nodes };
}

function prune(
  graph: Graph,
  nodes: Array<[number, number]>,
  platforms: Array<[number, number]>,
) {
  const isServed = (spot: [number, number]) =>
    platforms.some((stop) => meters(stop, spot) < ON_TRACK);

  for (;;) {
    let isCut = false;

    for (const [i, out] of graph.entries()) {
      const only = out.length === 1 ? out[0] : undefined;
      if (
        only === undefined ||
        isServed(nodes[i]!) ||
        // Test every point on the arc; a yard lead running past a terminal otherwise hides it.
        only.coords.some((point) => isServed(point))
      ) {
        continue;
      }

      graph[i] = [];
      graph[only.node] = graph[only.node]!.filter((edge) => edge.node !== i);
      isCut = true;
    }

    if (!isCut) {
      return;
    }
  }
}

function anchorOf(graph: Graph) {
  const size = graph.length;
  let anchor = -1;
  let reach = 0;
  const seen = new Uint8Array(size);

  for (let start = 0; start < size; start++) {
    if (seen[start] === 1) {
      continue;
    }

    const out = sweep(graph, [start]);
    for (let i = 0; i < size; i++) {
      if (out.dist[i]! < Infinity) {
        seen[i] = 1;
      }
    }

    const back = sweep(graph, [out.far]);
    if (back.dist[back.far]! > reach) {
      reach = back.dist[back.far]!;
      anchor = out.far;
    }
  }

  return anchor;
}

// Head is the end with the largest summed distance to the others; longest-tail picks Grand Central.
function headOf(graph: Graph, ends: Array<number>) {
  let head = ends[0]!;
  let widest = -1;

  for (const end of ends) {
    const out = sweep(graph, [end]);
    let total = 0;
    for (const other of ends) {
      if (other !== end && out.dist[other]! < Infinity) {
        total += out.dist[other]!;
      }
    }

    if (total > widest) {
      widest = total;
      head = end;
    }
  }

  return head;
}

function branches(
  runs: ReadonlyArray<{ path: Array<[number, number]>; length: number }>,
) {
  const longest = runs[0]?.length ?? 0;
  const kept: Array<Array<[number, number]>> = [];

  for (const run of runs) {
    if (run.length < longest * 0.4 || kept.length >= 3) {
      continue;
    }

    // Compare against track points, not joints; a double-tracked short turn shares no joints.
    const finish = run.path.at(-1)!;
    const isShadowed = kept.some((other) =>
      other.some((point) => meters(point, finish) < BRANCHED),
    );

    if (!isShadowed) {
      kept.push(run.path);
    }
  }

  return kept;
}

function services(
  graph: Graph,
  nodes: Array<[number, number]>,
  platforms: Array<[number, number]>,
) {
  const size = graph.length;
  if (size === 0) {
    return [];
  }

  prune(graph, nodes, platforms);

  const anchor = anchorOf(graph);
  if (anchor < 0) {
    return [];
  }

  const home = sweep(graph, [anchor]);
  const ends = new Set<number>([anchor, home.far]);

  for (let i = 0; i < size; i++) {
    if (home.dist[i]! < Infinity && (graph[i] as Array<unknown>).length === 1) {
      ends.add(i);
    }
  }

  const head = headOf(graph, [...ends]);
  const out = sweep(graph, [head]);

  return branches(
    [...ends]
      .filter((end) => end !== head && out.dist[end]! < Infinity)
      .map((end) => ({ path: trace(out.prev, end), length: out.dist[end]! }))
      .toSorted((a, b) => b.length - a.length),
  );
}

function nearest(
  path: Array<[number, number]>,
  cum: Array<number>,
  pt: [number, number],
) {
  let at = 0;
  let gap = Infinity;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const ax = (b[0] - a[0]) * LON_M;
    const ay = (b[1] - a[1]) * LAT_M;
    const px = (pt[0] - a[0]) * LON_M;
    const py = (pt[1] - a[1]) * LAT_M;
    const len2 = ax * ax + ay * ay;
    const t =
      len2 === 0 ? 0 : Math.min(Math.max((px * ax + py * ay) / len2, 0), 1);
    const dx = px - ax * t;
    const dy = py - ay * t;
    const off = Math.hypot(dx, dy);

    if (off < gap) {
      gap = off;
      at = cum[i - 1]! + Math.sqrt(len2) * t;
    }
  }

  return { at, gap };
}

type Feed = {
  system: System;
  route: string;
  bullet: string;
  name: string;
  color: string;
  parts: Array<Array<[number, number]>>;
  platforms: Array<{ name: string; at: [number, number]; city: boolean }>;
  least: number;
};

function coords(geometry: {
  type: string;
  coordinates: unknown;
}): Array<Array<[number, number]>> {
  return geometry.type === "LineString"
    ? [geometry.coordinates as Array<[number, number]>]
    : (geometry.coordinates as Array<Array<[number, number]>>);
}

function feeds(
  subway: SubwayLines,
  subwayStops: SubwayStations,
  rail: RailLines,
  railStops: RailStations,
): Array<Feed> {
  const bags = new Map<string, Feed>();

  for (const feature of subway.features) {
    const { route, name } = feature.properties;
    // The station file lists every shuttle under one S; the distance test sorts them out.
    const token = route !== "SIR" && route.startsWith("S") ? "S" : route;
    const bag: Feed = bags.get(route) ?? {
      system: "subway",
      route,
      bullet: token === "S" ? "S" : route,
      name,
      color: ROUTE_COLOR.get(route) ?? "#808183",
      parts: [],
      platforms: subwayStops.features
        .filter((station) =>
          station.properties.routes.split(" ").includes(token),
        )
        .map((station) => ({
          name: station.properties.name,
          at: station.geometry.coordinates as [number, number],
          city: true,
        })),
      least: 6,
    };

    bag.parts.push(...coords(feature.geometry));
    bags.set(route, bag);
  }

  for (const feature of rail.features) {
    const { system, route, bullet, name } = feature.properties;
    const key = `${system}:${route}`;
    // Rail station files carry no route list; match by system and let the distance test decide.
    const bag: Feed = bags.get(key) ?? {
      system,
      route,
      bullet,
      name,
      color: railColor(system, route, "#4d5357"),
      parts: [],
      platforms: railStops.features
        .filter((station) => station.properties.system === system)
        .map((station) => ({
          name: station.properties.name,
          at: station.geometry.coordinates as [number, number],
          city: station.properties.city === 1,
        })),
      least: system === "amtrak" ? 2 : 4,
    };

    bag.parts.push(...coords(feature.geometry));
    bags.set(key, bag);
  }

  return bags.values().toArray();
}

function walk(path: Array<[number, number]>) {
  const cum: Array<number> = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1]! + meters(path[i - 1]!, path[i]!));
  }

  return cum;
}

function along(
  path: Array<[number, number]>,
  cum: Array<number>,
  at: number,
): [number, number] {
  const d = Math.min(Math.max(at, 0), cum.at(-1) ?? 0);

  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = path[lo]!;
  const b = path[hi]!;
  const width = cum[hi]! - cum[lo]!;
  const t = width === 0 ? 0 : (d - cum[lo]!) / width;

  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clip(
  path: Array<[number, number]>,
  cum: Array<number>,
  from: number,
  to: number,
) {
  const cut: Array<[number, number]> = [along(path, cum, from)];
  for (const [i, point] of path.entries()) {
    if (cum[i]! > from && cum[i]! < to) {
      cut.push(point);
    }
  }
  cut.push(along(path, cum, to));

  return { path: cut, cum: walk(cut) };
}

function stopsOn(
  feed: Feed,
  run: Array<[number, number]>,
  laid: Array<number>,
) {
  const closest = new Map<string, { at: number; gap: number; city: boolean }>();

  for (const platform of feed.platforms) {
    const hit = nearest(run, laid, platform.at);
    if (hit.gap > ON_TRACK) {
      continue;
    }

    // A complex can be filed as two points under one name; keep the nearer.
    const seen = closest.get(platform.name);
    if (seen == null || hit.gap < seen.gap) {
      closest.set(platform.name, { ...hit, city: platform.city });
    }
  }

  return [...closest]
    .map(([name, hit]) => ({ name, at: hit.at, city: hit.city }))
    .toSorted((a, b) => a.at - b.at);
}

function lineOf(
  feed: Feed,
  run: Array<[number, number]>,
  signed: Set<string>,
): Line | null {
  if (run.length < 2) {
    return null;
  }

  const laid = walk(run);
  const found = stopsOn(feed, run, laid);

  const ticket = `${found[0]?.name} > ${found.at(-1)?.name}`;
  if (
    found.length < feed.least ||
    signed.has(ticket) ||
    found.every((stop) => !stop.city)
  ) {
    return null;
  }

  signed.add(ticket);

  const head = found[0]!.at;
  const { path, cum } = clip(run, laid, head, found.at(-1)!.at);
  const stops = found.map((stop) => ({ ...stop, at: stop.at - head }));
  const far = FAR_SIGN[`${feed.system}:${feed.route}`];
  const signs: [string, string] = [
    signName(stops[0]!.name),
    signName(stops.at(-1)!.name),
  ];

  if (far != null) {
    signs[stops[0]!.city ? 1 : 0] = far;
  }
  const lons = path.map((p) => p[0]);
  const lats = path.map((p) => p[1]);

  return {
    system: feed.system,
    route: feed.route,
    bullet: feed.bullet,
    name: feed.name,
    color: feed.color,
    path,
    cum,
    length: cum.at(-1)!,
    stops,
    signs,
    bbox: [
      Math.min(...lons),
      Math.min(...lats),
      Math.max(...lons),
      Math.max(...lats),
    ],
  };
}

export type Car = {
  id: number;
  line: Line;
  dir: 1 | -1;
  at: number;
  next: number;
  dwell: number;
  legs: number;
  seed: string;
  el: HTMLElement | null;
  sx: number;
  sy: number;
  w: number;
  h: number;
  scale: number;
  lean: number;
  live: boolean;
  halted: boolean;
  faceLeft: boolean;
  /**
   * The reader's own dog: never swapped for another rider, never culled off the stage.
   */
  mine: boolean;
  /**
   * The car the map rides with. Its rider gets off at their stop instead of handing the seat on.
   */
  followed: boolean;
  alighted: boolean;
  /**
   * Another reader's dog: placed from their last departure, never stepped or swapped here.
   */
  peer: {
    id: string;
    collar: string;
    at: number;
    next: number;
    speed: number;
    stamp: number;
  } | null;

  dog: string;
  breed: string;
  plate: string;
  hood: string;
  borough: string;
  slug: string;
  boarded: string;
  getOff: string;

  dest: string;
  origin: string;
  stop: string;
  ahead: string;
  delay: string | null;
};

const DWELL = 1.15;
const LATE_DWELL = 6.5;
const TURN = 3;
const LATE_ODDS = 0.22;
const BOARDING_BACK = 220;

type Seat = { x: number; y: number };

export function pick<T>(from: ReadonlyArray<T>) {
  return from[Math.floor(Math.random() * from.length)] as T;
}

function boardingFor(line: Line, at: number) {
  let best: Stop | null = null;
  let gap = Infinity;

  for (const stop of line.stops) {
    if (!stop.city || Math.abs(stop.at - at) >= gap) {
      continue;
    }

    gap = Math.abs(stop.at - at);
    best = stop;
  }

  return best;
}

function reverse(car: Car) {
  car.dir = car.dir === 1 ? -1 : 1;
  car.next += car.dir * 2;
  const back = car.dest;
  car.dest = car.origin;
  car.origin = back;
  car.dwell = Math.max(car.dwell, TURN);
  car.legs = car.mine ? Infinity : 1;
}

function calledAt(car: Car) {
  const passed = car.line.stops.filter((stop) =>
    car.dir === 1 ? stop.at <= car.at + 1 : stop.at >= car.at - 1,
  );

  return car.dir === 1 ? passed.at(-1) : passed[0];
}

function plan(car: Car) {
  const end = Math.min(
    Math.max(car.next + car.dir * (car.legs - 1), 0),
    car.line.stops.length - 1,
  );

  car.getOff = (car.line.stops[end] as { name: string }).name;
  car.ahead =
    (car.line.stops[car.next] ?? car.line.stops[end])?.name ?? car.getOff;
}

/**
 * The rules a car runs by, with the rider pool it draws its dogs from. Nothing here
 * projects a coordinate, so a reversal or a dwell can be checked with no map.
 */
export function crew(riders: ReadonlyArray<Rider>) {
  function riderNear(spot: [number, number]) {
    let best = riders[0]!;
    let gap = Infinity;

    for (const rider of riders) {
      const reach =
        (rider.lon - spot[0]) ** 2 + ((rider.lat - spot[1]) * 1.32) ** 2;
      if (reach < gap) {
        gap = reach;
        best = rider;
      }
    }

    return best;
  }

  function boardRider(car: Car, platform: string) {
    const here = car.line.stops.find((stop) => stop.name === platform);
    const home = here?.city === true ? here : boardingFor(car.line, car.at);
    if (home == null) {
      return;
    }

    const rider = riderNear(pointAt(car.line, home.at));

    car.dog = pick(rider.names);
    car.breed = rider.breed;
    car.plate = rider.plate;
    car.hood = rider.hood;
    car.borough = rider.borough;
    car.slug = rider.slug;
    car.boarded = (calledAt(car) ?? here ?? home).name;
    car.legs = 3 + Math.floor(Math.random() * 5);
    plan(car);
  }

  return {
    boardRider,
    board(
      line: Line,
      platform: Stop,
      dir: 1 | -1,
      id: number,
      seat: Seat,
      own?: Pick<Car, "dog" | "breed" | "plate" | "hood" | "borough" | "slug">,
    ) {
      const [first, last] = line.signs;
      const at = boardingAt(line, platform, dir);

      const car: Car = {
        id,
        line,
        dir,
        at,
        next: line.stops.indexOf(platform),
        dwell: 0,
        legs: 0,
        seed: `translate3d(${seat.x}px, ${seat.y}px, 0)`,
        el: null,
        sx: seat.x,
        sy: seat.y,
        w: 0,
        h: 0,
        scale: 1,
        lean: 0,
        live: true,
        halted: false,
        faceLeft: false,
        mine: own != null,
        followed: false,
        alighted: false,
        peer: null,
        dog: "",
        breed: "",
        plate: "terrier",
        hood: "",
        borough: "",
        slug: "",
        boarded: platform.name,
        getOff: platform.name,
        dest: dir === 1 ? last : first,
        origin: dir === 1 ? first : last,
        stop: platform.name,
        ahead: platform.name,
        delay: null,
      };

      if (own == null) {
        boardRider(car, platform.name);
      } else {
        Object.assign(car, own);
        car.legs = Infinity;
        plan(car);
      }

      return car;
    },
    step(car: Car, dt: number, speed: number) {
      if (car.dwell > 0) {
        car.dwell -= dt;
        if (car.dwell <= 0) {
          car.halted = false;
          car.delay = null;
        }

        return;
      }

      car.at += car.dir * speed * dt;

      const platform = car.line.stops[car.next];
      if (platform === undefined) {
        return;
      }

      const isArrived =
        car.dir === 1 ? car.at >= platform.at : car.at <= platform.at;
      if (!isArrived) {
        return;
      }

      car.at = platform.at;
      car.stop = platform.name;
      car.halted = true;
      car.next += car.dir;

      const isLate = Math.random() < LATE_ODDS;
      car.delay = isLate
        ? pick(delaysFor(car.line.system, platform.name))
        : null;
      car.dwell = isLate ? LATE_DWELL : DWELL;

      if (car.next < 0 || car.next >= car.line.stops.length) {
        reverse(car);
      }

      car.legs -= 1;
      if (car.legs > 0) {
        plan(car);
      } else if (platform.city && car.followed) {
        car.alighted = true;
      } else if (platform.city) {
        boardRider(car, platform.name);
      } else {
        car.legs = 3 + Math.floor(Math.random() * 4);
        plan(car);
      }
    },
  };
}

/** Where a car waits before its first platform, so the caller can project it. */
export function boardingAt(line: Line, platform: Stop, dir: 1 | -1) {
  return Math.min(Math.max(platform.at - dir * BOARDING_BACK, 0), line.length);
}

export function buildLines(
  subway: SubwayLines,
  subwayStops: SubwayStations,
  rail: RailLines,
  railStops: RailStations,
): Array<Line> {
  const built: Array<Line> = [];

  for (const feed of feeds(subway, subwayStops, rail, railStops)) {
    const { graph, nodes } = weave(
      feed.parts,
      feed.system === "subway" ? SNAP.subway : SNAP.rail,
    );
    const runs = services(
      graph,
      nodes,
      feed.platforms.map((platform) => platform.at),
    );
    const signed = new Set<string>();

    for (const run of runs) {
      const line = lineOf(feed, run, signed);
      if (line != null) {
        built.push(line);
      }
    }
  }

  return built;
}

export function pointAt(line: Line, at: number): [number, number] {
  return along(line.path, line.cum, at);
}

/**
MTA rollsign rule: drop the second half of a compound name unless short or led by a street number.
*/
export function signName(name: string) {
  const listed = SIGN_AS[name];
  if (listed != null) {
    return listed;
  }

  const cut = name.indexOf("-");
  if (name.length < 18 || cut < 6) {
    return name;
  }

  return name.slice(0, cut);
}
