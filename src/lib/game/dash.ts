import { count } from "#lib/utils.js";
import type { Emit } from "./events";
import type { Cam, Palette } from "./ink";
import type { OffLeash } from "./off-leash";
import type { Conditions } from "./parks";
import type { Gauges } from "./run";
import {
  borrow,
  buildings,
  cutout,
  arch as drawArch,
  backstop as drawBackstop,
  bagel as drawBagel,
  ball as drawBall,
  bench as drawBench,
  biker as drawBiker,
  bone as drawBone,
  can as drawCan,
  cart as drawCart,
  goose as drawGoose,
  house as drawHouse,
  hydrant as drawHydrant,
  jogger as drawJogger,
  rat as drawRat,
  rock as drawRock,
  sprinkler as drawSprinkler,
  stroller as drawStroller,
  droplet,
  duck,
  groundEllipse,
  hash,
  hotdog,
  meadow,
  pigeon,
  pool,
  project,
  ring,
  shadow,
  signpost,
  sky,
  speedLines,
  TAU,
  tree,
  treeline,
} from "./ink";
import { conditionsOf, rng } from "./parks";
import { award, NO_GAUGES } from "./run";

const MILE = 1609;
const LANES = [-2.7, 0, 2.7];
const HALF = 9.5;
const BASE = 23;
const MIN = 14;
const MAX = 38;
const FLOORS = [23, 26, 29];
const DOG_H = 0.62;
const WATER = MILE + 3;
const SIGNS: Array<[number, string]> = [
  [MILE / 4, "¼ MILE"],
  [MILE * 0.3, "PICNIC HOUSE"],
  [MILE / 2, "½ MILE"],
  [MILE * 0.62, "TENNIS HOUSE"],
  [(MILE * 3) / 4, "¾ MILE"],
  [MILE - 6, "DOG BEACH"],
];
const ZONES = [MILE * 0.3, MILE * 0.62];

function rise(z: number) {
  const dip = z > MILE - 110 ? -((z - (MILE - 110)) / 110) * 2 : 0;

  return 0.5 * Math.sin(z / 130) + dip;
}

type Kind =
  | "ball"
  | "gold"
  | "blanket"
  | "sleeper"
  | "puddle"
  | "frisbee"
  | "goose"
  | "stroller"
  | "jogger"
  | "sprinkler"
  | "rat"
  | "hydrant"
  | "bench"
  | "cart"
  | "biker"
  | "pigeons"
  | "hotdog"
  | "bone"
  | "bagel"
  | "can"
  | "squeaky";

type Item = {
  kind: Kind;
  x: number;
  z: number;
  done: boolean;
  seed: number;
  dir: number;
  isHigh: boolean;
};

type Drop = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
};

type Layer = { z: number; draw: () => void };

const ZONE_HAZARDS: Array<Array<Kind>> = [
  [
    "blanket",
    "puddle",
    "goose",
    "hydrant",
    "bench",
    "pigeons",
    "rat",
    "blanket",
  ],
  [
    "blanket",
    "puddle",
    "goose",
    "sleeper",
    "frisbee",
    "stroller",
    "hydrant",
    "bench",
    "rat",
    "cart",
    "pigeons",
  ],
  [
    "blanket",
    "goose",
    "sleeper",
    "frisbee",
    "stroller",
    "jogger",
    "sprinkler",
    "biker",
    "rat",
    "cart",
    "bench",
    "jogger",
  ],
];

const MOVERS = new Set<Kind>(["rat", "biker", "frisbee"]);

const FAVORED: Record<string, Kind> = {
  geese: "goose",
  sprinklers: "sprinkler",
  runners: "jogger",
  rats: "rat",
};

const CONSUMED = new Set<Kind>([
  "ball",
  "gold",
  "bone",
  "bagel",
  "can",
  "squeaky",
  "hotdog",
]);

const JUMPABLE: Partial<
  Record<Kind, [number, number, number, string, string]>
> = {
  blanket: [1.5, 0.5, 40, "Oof", "Tripped over a picnic blanket."],
  sleeper: [1.4, 0.55, 40, "Sorry!", "Ran into a sleeping dog."],
  hydrant: [1.2, 0.6, 40, "Hydrant", "Ran into a hydrant."],
  bench: [2.2, 0.75, 40, "Bench", "Ran into a bench."],
};

const SOLID: Partial<Record<Kind, [number, number, string, string]>> = {
  stroller: [1.6, 60, "Stroller", "Ran into a stroller."],
  cart: [1.7, 60, "Hot dog cart", "Ran into a hot dog cart."],
  jogger: [1.3, 60, "Jogger", "Ran into a jogger."],
  biker: [1.5, 60, "Citi Bike", "A Citi Bike clipped you."],
};

export class DashGame {
  #rand: () => number;
  #spawned = 0;
  #lastPower = 0;
  #landT = 0;

  name: string;
  emit: Emit;
  conditions: Conditions;
  readonly clock: OffLeash;

  time = 0;
  balls = 0;
  golds = 0;
  bonus = 0;
  penalty = 0;
  hits = 0;
  tricks = 0;
  geese = 0;
  rats = 0;
  combo = 0;
  bestCombo = 0;
  over = false;
  leashed = false;
  splashed = false;
  zone = 0;
  rating = "";

  z = 0;
  lane = 1;
  x = 0;
  y = 0;
  vy = 0;
  speed = BASE;
  stumble = 0;
  stride = 0;
  launched = false;
  finishT = 0;
  shield = false;
  shieldUsed = false;
  burst = 0;
  magnet = 0;
  zoomies = 0;
  tags = new Set<string>();

  items: Array<Item> = [];
  drops: Array<Drop> = [];
  rings: Array<{ x: number; z: number; t: number }> = [];
  nextAt = 55;

  constructor(name: string, seed: number, emit: Emit, clock: OffLeash) {
    this.name = name;
    this.clock = clock;
    this.emit = emit;
    this.#rand = rng(seed);
    this.conditions = conditionsOf("prospect", seed);
  }

  #award(tag: string) {
    award(this.tags, this.emit, tag);
  }

  #zoneAt(z: number) {
    return z < ZONES[0]! ? 0 : z < ZONES[1]! ? 1 : 2;
  }

  #push(kind: Kind, x: number, z: number, seed: number, isHigh = false) {
    this.items.push({
      kind,
      x,
      z,
      done: false,
      seed,
      dir: this.#rand() < 0.5 ? -1 : 1,
      isHigh,
    });
  }

  #row(at: number, lane: number) {
    const isGold = this.#rand() < 0.12;
    const isHigh = this.#zoneAt(at) >= 1 && this.#rand() < 0.35;
    for (let k = 0; k < 3; k += 1) {
      this.#push(
        isGold && k === 1 ? "gold" : "ball",
        lane,
        at + k * 4.5,
        at + k,
        isHigh,
      );
    }
  }

  #hazard(at: number, zone: number, lane: number) {
    const table = ZONE_HAZARDS[zone]!;
    const favored = FAVORED[this.conditions.id];
    const kind =
      favored != null && this.#rand() < 0.35
        ? favored
        : table[Math.floor(this.#rand() * table.length)]!;
    if (kind === "jogger") {
      const open = Math.floor(this.#rand() * 3);
      for (const [i, lx] of LANES.entries()) {
        if (i !== open) {
          this.#push(kind, lx, at + (i - 1) * 0.6, at + i);
        }
      }

      return;
    }

    if (MOVERS.has(kind)) {
      this.#push(kind, 0, at, at);

      return;
    }

    this.#push(kind, lane, at, at);
    if (zone === 2 && this.#rand() < 0.45) {
      this.#push(kind, this.#beside(lane), at, at + 7);
    }
  }

  #beside(lane: number) {
    if (lane !== 0) {
      return 0;
    }

    return this.#rand() < 0.5 ? -2.7 : 2.7;
  }

  #powerup(at: number, lane: number) {
    const roll = this.#rand();
    const kind: Kind =
      roll < 0.3
        ? "bone"
        : roll < 0.55
          ? "bagel"
          : roll < 0.8
            ? "can"
            : roll < 0.9
              ? "squeaky"
              : "hotdog";
    this.#push(kind, lane, at, at);
    this.#lastPower = at;
  }

  #place(at: number) {
    const zone = this.#zoneAt(at);
    const lane = LANES[Math.floor(this.#rand() * 3)] ?? 0;
    this.#spawned += 1;
    const gap = [22, 17, 13][zone]! + this.#rand() * 7;

    if (at - this.#lastPower > 150 && this.#rand() < 0.5) {
      this.#powerup(at, lane);
      this.nextAt = at + gap * 0.7;

      return;
    }

    if (this.#spawned % 3 === 0) {
      this.#row(at, lane);
      this.nextAt = at + gap;

      return;
    }

    this.#hazard(at, zone, lane);
    const isFollowed = this.#rand() < 0.5;
    if (isFollowed) {
      const other =
        LANES[(LANES.indexOf(lane) + 1 + Math.floor(this.#rand() * 2)) % 3] ??
        0;
      this.#row(at + 9, other);
    }

    this.nextAt = at + gap + (isFollowed ? 14 : 0);
  }

  #strollPhase(item: Item) {
    return (((this.time * 1.3 + item.seed * 7) % 12) + 12) % 12;
  }

  #moverX(item: Item) {
    switch (item.kind) {
      case "stroller": {
        const phase = this.#strollPhase(item);

        return item.x + (phase < 6 ? phase : 12 - phase) - 3;
      }

      case "frisbee": {
        return Math.sin(this.time * 1.15 + item.seed) * (HALF - 3.5);
      }

      case "rat": {
        const pace = this.conditions.id === "rats" ? 4.8 : 3.4;

        return (
          (((((this.time * pace + item.seed * 3) % 16) + 16) % 16) - 8) *
          item.dir
        );
      }

      case "biker": {
        return (
          (((((this.time * 5.5 + item.seed * 5) % 22) + 22) % 22) - 11) *
          item.dir
        );
      }

      default: {
        return item.x;
      }
    }
  }

  #hit(cost: number, text: string, say: string) {
    if (this.zoomies > 0) {
      this.bonus += 5;
      this.emit({ type: "sound", name: "close" });
      this.emit({ type: "stamp", text: "Knocked it flat +5", tone: "good" });

      return;
    }

    if (this.shield) {
      this.shield = false;
      this.shieldUsed = true;
      this.#award("shield");
      this.emit({ type: "sound", name: "ding" });
      this.emit({ type: "stamp", text: "The bone took it", tone: "note" });

      return;
    }

    const toll = Math.round(cost * (1 + Math.max(0, this.speed - BASE) / 30));
    this.speed = Math.max(MIN, this.speed * 0.55);
    this.stumble = 0.6;
    this.hits += 1;
    this.combo = 0;
    this.penalty += toll;
    this.emit({ type: "sound", name: "hit" });
    this.emit({ type: "stamp", text: `−${toll} ${text}`, tone: "bad" });
    this.emit({ type: "say", text: say });
  }

  #reward(
    points: number,
    text: string,
    sound: "close" | "collect" | "stylish" | "gold" | "flutter",
  ) {
    this.bonus += points;
    this.emit({ type: "sound", name: sound });
    this.emit({ type: "stamp", text: `+${points} ${text}`, tone: "good" });
  }

  #collect(isAirborne: boolean, isGold: boolean) {
    this.balls += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.speed = Math.min(MAX + (this.burst > 0 ? 4 : 0), this.speed + 1.9);
    if (this.balls >= 25) {
      this.#award("hog");
    }

    if (isGold) {
      this.golds += 1;
      if (this.golds >= 3) {
        this.#award("gold");
      }

      this.#reward(30, "Gold ball", "gold");

      return;
    }

    if (isAirborne) {
      this.tricks += 1;
      if (this.tricks >= 5) {
        this.#award("stylish");
      }

      this.#reward(8, "Stylish", "stylish");

      return;
    }

    const extra = this.combo >= 3 ? 2 * Math.min(this.combo, 10) : 0;
    this.bonus += extra;
    this.emit({ type: "sound", name: "collect" });
    this.emit({
      type: "stamp",
      text: extra > 0 ? `+${10 + extra} ×${this.combo}` : "+10",
      tone: "good",
    });
  }

  #soak(cost: number) {
    if (this.zoomies > 0) {
      return;
    }

    this.speed = Math.max(MIN, this.speed - 4);
    this.penalty += cost;
    this.emit({ type: "sound", name: "puddle" });
    this.emit({ type: "stamp", text: `−${cost} Splash`, tone: "bad" });
  }

  #jumpable(
    dx: number,
    reach: number,
    maxY: number,
    cost: number,
    text: string,
    say: string,
    onHop?: () => void,
  ) {
    if (dx < reach) {
      if (this.y < maxY) {
        this.#hit(cost, text, say);
      } else {
        onHop?.();
        this.#reward(15, "Hop", "close");
      }
    } else if (dx < reach + 1.1) {
      this.#reward(8, "Close", "close");
    }
  }

  #solid(dx: number, reach: number, cost: number, text: string, say: string) {
    if (dx < reach) {
      this.#hit(cost, text, say);
    } else if (dx < reach + 1.1) {
      this.#reward(8, "Close", "close");
    }
  }

  #wet(dx: number, reach: number, maxY: number, cost: number) {
    if (dx >= reach) {
      return;
    }

    if (this.y < maxY) {
      this.#soak(cost);
    } else {
      this.#reward(15, "Hop", "close");
    }
  }

  #power(kind: Kind) {
    switch (kind) {
      case "bone": {
        this.shield = true;
        this.emit({ type: "sound", name: "ding" });
        this.emit({
          type: "stamp",
          text: "Good bone: one free hit",
          tone: "note",
        });

        return;
      }

      case "bagel": {
        this.burst = 3.5;
        this.speed = Math.min(MAX + 4, this.speed + 8);
        this.emit({ type: "sound", name: "boost" });
        this.emit({ type: "stamp", text: "Bagel! Zoomies", tone: "note" });

        return;
      }

      case "can": {
        this.magnet = 5;
        this.emit({ type: "sound", name: "gold" });
        this.emit({ type: "stamp", text: "Ball magnet", tone: "note" });

        return;
      }

      case "squeaky": {
        this.zoomies = 3.5;
        this.emit({ type: "sound", name: "fanfare" });
        this.emit({
          type: "stamp",
          text: "Squeaky toy! Unstoppable",
          tone: "note",
        });

        return;
      }

      default: {
        this.#reward(30, "Hot dog!", "collect");
      }
    }
  }

  #crossAnimal(item: Item, dx: number) {
    if (item.kind === "goose") {
      if (dx < 2.6) {
        this.emit({ type: "sound", name: "honk" });
      }

      this.#jumpable(dx, 1.3, 0.5, 40, "Honk!", "A goose got you.", () => {
        this.geese += 1;
        if (this.geese >= 6) {
          this.#award("geese");
        }
      });

      return;
    }

    this.#jumpable(dx, 1, 0.3, 20, "Rat!", "A rat ran under your paws.", () => {
      this.rats += 1;
      if (this.rats >= 4) {
        this.#award("rat");
      }
    });
  }

  #crossSpecial(item: Item, dx: number) {
    switch (item.kind) {
      case "goose":
      case "rat": {
        this.#crossAnimal(item, dx);

        return;
      }

      case "puddle": {
        this.#wet(dx, 1.4, 0.3, 15);

        return;
      }

      case "sprinkler": {
        this.#wet(dx, 1.3, 0.75, 15);

        return;
      }

      case "frisbee": {
        if (dx < 1.2 && this.y > 0.45) {
          this.#hit(40, "Frisbee!", "Jumped into a frisbee.");
        } else if (dx < 1.2) {
          this.#reward(10, "Ducked", "close");
        }

        return;
      }

      case "pigeons": {
        if (dx < 1.8) {
          this.#reward(5, "Scatter", "flutter");
        }

        return;
      }

      default: {
        if (dx < 1.3) {
          this.#power(item.kind);
        }
      }
    }
  }

  #cross(item: Item) {
    const dx = Math.abs(this.#moverX(item) - this.x);
    if (item.kind === "ball" || item.kind === "gold") {
      if (dx < 1.25 && (!item.isHigh || this.y > 0.35)) {
        this.#collect(this.y > 0.3, item.kind === "gold");
      } else if (dx < 1.9) {
        this.combo = 0;
      }

      return;
    }

    const jumpable = JUMPABLE[item.kind];
    if (jumpable != null) {
      this.#jumpable(
        dx,
        jumpable[0],
        jumpable[1],
        jumpable[2],
        jumpable[3],
        jumpable[4],
      );

      return;
    }

    const solid = SOLID[item.kind];
    if (solid != null) {
      this.#solid(dx, solid[0], solid[1], solid[2], solid[3]);

      return;
    }

    this.#crossSpecial(item, dx);
  }

  #splash() {
    this.splashed = true;
    const spare = Math.max(0, this.clock.seconds - this.time);
    const isCannon = this.speed >= 30;
    this.rating = isCannon
      ? "Cannonball!"
      : this.speed >= 22
        ? "Splash!"
        : "Belly flop";
    this.bonus +=
      Math.round(this.speed * 7) + (isCannon ? 100 : 0) + Math.round(spare * 8);
    if (isCannon) {
      this.#award("cannonball");
    }

    if (spare >= 12) {
      this.#award("early");
    }

    if (this.hits === 0) {
      this.#award("clean");
    }

    for (let i = 0; i < 34; i += 1) {
      const a = hash(i * 9) * TAU;
      const power = 1.5 + hash(i * 13) * 3.5;
      this.drops.push({
        x: this.x + Math.cos(a) * 0.4,
        y: 0.1,
        z: this.z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * power * 0.6,
        vy: 3 + hash(i * 17) * 4.5,
        vz: Math.sin(a) * power * 0.6,
        r: 0.06 + hash(i * 19) * 0.12,
      });
    }

    this.rings.push(
      { x: this.x, z: this.z, t: 0 },
      { x: this.x, z: this.z, t: -0.3 },
    );
    this.emit({ type: "sound", name: "splash" });
    this.emit({ type: "shout", text: this.rating, tone: "good" });
    this.emit({
      type: "say",
      text: `Into Dog Beach with ${Math.round(spare)} seconds to spare. ${count(this.score)} points.`,
    });
  }

  #end() {
    this.over = true;
    this.emit({ type: "over" });
  }

  #clock(dt: number) {
    this.time += dt;
    if (this.time >= this.clock.seconds && !this.launched) {
      this.leashed = true;
      this.emit({ type: "sound", name: "chime" });
      this.emit({ type: "shout", text: "Leashes on", tone: "plain" });
      this.emit({
        type: "say",
        text: `${this.clock.endHour} o'clock, leashes on at ${this.miles.toFixed(2)} miles. ${count(this.score)} points.`,
      });
      this.#end();

      return false;
    }

    const zone = this.#zoneAt(this.z);
    if (zone !== this.zone) {
      this.zone = zone;
      this.emit({ type: "sound", name: "tick" });
      this.emit({
        type: "banner",
        text: this.clock.isNight
          ? zone === 1
            ? "Picnic House · the late crowd"
            : "Tennis House · last call"
          : zone === 1
            ? "Picnic House · the meadow fills up"
            : "Tennis House · rush hour",
      });
    }

    return true;
  }

  #run(dt: number) {
    if (this.stumble > 0) {
      this.stumble -= dt;
    }

    this.burst = Math.max(0, this.burst - dt);
    this.magnet = Math.max(0, this.magnet - dt);
    this.zoomies = Math.max(0, this.zoomies - dt);
    this.#landT = Math.max(0, this.#landT - dt);
    const base = FLOORS[this.zone]!;
    const floor = this.burst > 0 || this.zoomies > 0 ? base + 9 : base;
    this.speed += (floor - this.speed) * 0.11 * dt;
    this.z += this.speed * dt;
    this.stride += this.speed * dt;

    const want = LANES[this.lane] ?? 0;
    this.x += (want - this.x) * Math.min(1, 14 * dt);

    if (this.y <= 0 && this.vy <= 0) {
      return;
    }

    this.vy -= 9.8 * dt;
    this.y += this.vy * dt;
    if (this.y > 0) {
      return;
    }

    this.y = 0;
    this.vy = 0;
    this.#landT = 0.18;
    if (!this.launched) {
      this.emit({ type: "sound", name: "land" });
    } else if (!this.splashed) {
      this.#splash();
    }
  }

  #shore(dt: number) {
    if (!this.launched && this.z >= MILE) {
      this.launched = true;
      this.vy = 6.4;
      this.speed = Math.max(this.speed, 18);
      this.emit({ type: "sound", name: "jump" });
    }

    if (this.launched && this.splashed) {
      this.speed *= Math.max(0, 1 - 4 * dt);
      this.finishT += dt;
      if (this.finishT > 2.1) {
        this.#end();
      }
    }
  }

  #meet(dt: number) {
    while (this.nextAt < this.z + 170 && this.nextAt < MILE - 24) {
      this.#place(this.nextAt);
    }

    for (const item of this.items) {
      if (item.kind === "jogger") {
        item.z -= (this.conditions.id === "runners" ? 5.5 : 3.8) * dt;
      } else if (item.kind === "stroller") {
        item.z -= 1.2 * dt;
      }

      const isBall = item.kind === "ball" || item.kind === "gold";
      if (
        isBall &&
        this.magnet > 0 &&
        item.z > this.z &&
        item.z < this.z + 14
      ) {
        item.x += (this.x - item.x) * Math.min(1, 5 * dt);
      }

      if (item.done || Math.abs(item.z - this.z) >= 0.9) {
        continue;
      }

      item.done = true;
      this.#cross(item);
    }

    this.items = this.items.filter((item) => item.z > this.z - 12);
  }

  #rain(dt: number) {
    for (const d of this.drops) {
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
    }

    this.drops = this.drops.filter((d) => d.y > -0.5);
    for (const r of this.rings) {
      r.t += dt / 1.6;
    }

    this.rings = this.rings.filter((r) => r.t < 1);
  }

  #drawTrees(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    layers: Array<Layer>,
  ) {
    for (let k = Math.ceil((cam.z + 4) / 9); k < (cam.z + 140) / 9; k += 1) {
      for (const side of [-1, 1]) {
        const seed = k * 2 + (side + 1) / 2;
        const z = k * 9 + hash(seed * 5) * 5;
        if (z > WATER - 6 || z - cam.z < 11) {
          continue;
        }

        const x = side * (HALF + 2.2 + hash(seed * 3) * 6);
        layers.push({
          z,
          draw: () =>
            tree(ctx, cam, pal, x, z, 1.7 + hash(seed * 7) * 1.1, seed),
        });
      }
    }

    for (const [at, text] of SIGNS) {
      layers.push({
        z: at,
        draw: () => signpost(ctx, cam, pal, HALF - 0.6, at, text),
      });
    }

    const decor: Array<[number, () => void]> = [
      [6, () => drawArch(ctx, cam, pal, 0, 6, 11)],
      [
        MILE * 0.3,
        () =>
          drawHouse(ctx, cam, pal, HALF + 7, MILE * 0.3, 12, 9, 4.2, "cottage"),
      ],
      [
        MILE * 0.62,
        () =>
          drawHouse(ctx, cam, pal, HALF + 7, MILE * 0.62, 14, 9, 5, "columns"),
      ],
      [
        MILE * 0.84,
        () => drawBackstop(ctx, cam, pal, -HALF - 5, MILE * 0.84, 9),
      ],
      [MILE * 0.9, () => drawBackstop(ctx, cam, pal, HALF + 5, MILE * 0.9, 9)],
      [120, () => drawRock(ctx, cam, pal, -HALF - 4, 120, 8, 2.4, 3)],
      [
        MILE * 0.45,
        () => drawRock(ctx, cam, pal, HALF + 4, MILE * 0.45, 7, 2, 5),
      ],
      [
        MILE * 0.72,
        () => drawRock(ctx, cam, pal, -HALF - 3.5, MILE * 0.72, 10, 3, 7),
      ],
    ];
    for (const [at, draw] of decor) {
      if (at > cam.z + 0.5 && at < cam.z + 170) {
        layers.push({ z: at, draw });
      }
    }
  }

  #drawEdges(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette) {
    ctx.strokeStyle = pal.post;
    const posts = new Path2D();
    for (
      let z = Math.ceil(cam.z / 6) * 6;
      z < Math.min(cam.z + 110, MILE);
      z += 6
    ) {
      for (const side of [-1, 1]) {
        const a = project(cam, side * (HALF + 0.8), 0, z);
        const b = project(cam, side * (HALF + 0.8), 0.8, z);
        posts.moveTo(a.sx, a.sy);
        posts.lineTo(b.sx, b.sy);
      }
    }

    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.7;
    ctx.stroke(posts);
    ctx.strokeStyle = pal.blade;
    ctx.lineWidth = 1;
    for (const edge of [-1.35, 1.35]) {
      for (
        let z = Math.ceil(cam.z / 2) * 2;
        z < Math.min(cam.z + 70, MILE);
        z += 2
      ) {
        const a = project(cam, edge, 0, z);
        const b = project(cam, edge, 0, z + 0.9);
        const dash = new Path2D();
        dash.moveTo(a.sx, a.sy);
        dash.lineTo(b.sx, b.sy);
        ctx.globalAlpha = Math.max(0, 1 - (z - cam.z) / 70) * 0.9;
        ctx.stroke(dash);
      }
    }

    ctx.globalAlpha = 1;
  }

  #drawDog(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    plate: HTMLImageElement,
  ) {
    if (this.launched && this.splashed) {
      const line = project(cam, this.x, 0, this.z);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cam.w, line.sy);
      ctx.clip();
      cutout(ctx, cam, pal, plate, this.x, -0.32, this.z, DOG_H, false, 0);
      ctx.restore();
      groundEllipse(ctx, cam, this.x, this.z, 1.1, 0.7, pal.foam);

      return;
    }

    const want = LANES[this.lane] ?? 0;
    const bob = this.y > 0 ? 0 : Math.abs(Math.sin(this.stride * 0.9)) * 0.08;
    const lean =
      this.stumble > 0
        ? 0.5
        : Math.sin(this.stride * 0.9) * 0.04 + (want - this.x) * 0.1;
    const stretch = this.y > 0 ? 1 + this.vy * 0.03 : 1 - this.#landT * 0.7;
    shadow(ctx, cam, pal, this.x, this.z, 0.9, DOG_H, this.y);
    if (this.shield || this.zoomies > 0) {
      const p = project(cam, this.x, 0.4 + this.y, this.z);
      ctx.strokeStyle = this.zoomies > 0 ? pal.gold : pal.ink;
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 5) * 0.2;
      ctx.lineWidth = this.zoomies > 0 ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, 0.75 * p.s, 0.55 * p.s, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    cutout(
      ctx,
      cam,
      pal,
      plate,
      this.x,
      this.y + bob,
      this.z,
      DOG_H * stretch,
      false,
      lean,
    );
  }

  #drawItem(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette, item: Item) {
    if (item.done && CONSUMED.has(item.kind)) {
      return;
    }

    const float = 0.25 + Math.abs(Math.sin(this.time * 3 + item.seed)) * 0.1;
    const x = this.#moverX(item);
    switch (item.kind) {
      case "ball":
      case "gold": {
        this.#drawBall(ctx, cam, pal, item);

        return;
      }

      case "blanket": {
        this.#drawBlanket(ctx, cam, pal, item);

        return;
      }

      case "sleeper": {
        this.#drawSleeper(ctx, cam, pal, item);

        return;
      }

      case "puddle": {
        groundEllipse(ctx, cam, item.x, item.z, 1.25, 0.85, pal.water);
        ring(ctx, cam, pal, item.x, item.z, 0.9, 0.5);

        return;
      }

      case "frisbee": {
        shadow(ctx, cam, pal, x, item.z, 0.6, 0.15, 1.25);
        const p = project(cam, x, 1.25, item.z);
        ctx.fillStyle = pal.blanket;
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = Math.max(0.8, 0.03 * p.s);
        ctx.beginPath();
        ctx.ellipse(
          p.sx,
          p.sy,
          0.34 * p.s,
          Math.max(1.5, 0.1 * p.s),
          0,
          0,
          TAU,
        );
        ctx.fill();
        ctx.stroke();

        return;
      }

      case "goose": {
        drawGoose(
          ctx,
          cam,
          pal,
          item.x,
          item.z,
          item.seed % 2 === 0,
          this.time * 0.8 + item.seed,
        );

        return;
      }

      case "stroller": {
        drawStroller(
          ctx,
          cam,
          pal,
          x,
          item.z,
          this.time * 2 + item.seed,
          this.#strollPhase(item) >= 6,
        );

        return;
      }

      case "jogger": {
        drawJogger(ctx, cam, pal, item.x, item.z, this.time * 2.4 + item.seed);

        return;
      }

      case "sprinkler": {
        drawSprinkler(ctx, cam, pal, item.x, item.z, this.time + item.seed);

        return;
      }

      case "rat": {
        drawRat(ctx, cam, pal, x, item.z, item.dir < 0, this.time * 4);

        return;
      }

      case "hydrant": {
        drawHydrant(ctx, cam, pal, item.x, item.z);

        return;
      }

      case "bench": {
        drawBench(ctx, cam, pal, item.x, item.z);

        return;
      }

      case "cart": {
        drawCart(ctx, cam, pal, item.x, item.z);

        return;
      }

      case "biker": {
        drawBiker(ctx, cam, pal, x, item.z, item.dir < 0, this.time * 4);

        return;
      }

      case "pigeons": {
        for (let i = 0; i < 5; i += 1) {
          const isGone = item.done;
          pigeon(
            ctx,
            cam,
            pal,
            item.x + (hash(item.seed + i) - 0.5) * 2.4,
            isGone ? Math.min(3, (this.z - item.z) * 0.3) : 0,
            item.z + (hash(item.seed * 3 + i) - 0.5) * 1.6,
            i % 2 === 0,
            isGone ? this.time + i : 0,
          );
        }

        return;
      }

      case "hotdog": {
        shadow(ctx, cam, pal, item.x, item.z, 0.4, 0.15, float);
        hotdog(ctx, cam, pal, item.x, float + 0.15, item.z);

        return;
      }

      case "bone": {
        shadow(ctx, cam, pal, item.x, item.z, 0.4, 0.15, float);
        drawBone(ctx, cam, pal, item.x, float + 0.15, item.z);

        return;
      }

      case "bagel": {
        shadow(ctx, cam, pal, item.x, item.z, 0.3, 0.14, float);
        drawBagel(ctx, cam, pal, item.x, float + 0.15, item.z);

        return;
      }

      case "can": {
        shadow(ctx, cam, pal, item.x, item.z, 0.3, 0.2, float);
        drawCan(ctx, cam, pal, item.x, float, item.z);

        return;
      }

      case "squeaky": {
        shadow(ctx, cam, pal, item.x, item.z, 0.3, 0.2, float);
        duck(ctx, cam, pal, item.x, float + 0.15, item.z);
      }
    }
  }

  #drawBall(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette, item: Item) {
    const y = item.isHigh
      ? 0.62 + Math.sin(this.time * 3 + item.seed) * 0.05
      : 0.11;
    shadow(ctx, cam, pal, item.x, item.z, 0.24, item.isHigh ? 0.1 : 0.2);
    drawBall(
      ctx,
      cam,
      item.kind === "gold"
        ? { ...pal, ball: pal.gold, seam: pal.goldSeam }
        : pal,
      item.x,
      y,
      item.z,
      0.11,
    );
  }

  #drawBlanket(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    item: Item,
  ) {
    const corners = [
      project(cam, item.x - 1.2, 0, item.z - 1),
      project(cam, item.x + 1.2, 0, item.z - 1),
      project(cam, item.x + 1.2, 0, item.z + 1),
      project(cam, item.x - 1.2, 0, item.z + 1),
    ];
    const cloth = new Path2D();
    for (const [i, c] of corners.entries()) {
      if (i === 0) {
        cloth.moveTo(c.sx, c.sy);
      } else {
        cloth.lineTo(c.sx, c.sy);
      }
    }

    cloth.closePath();
    ctx.fillStyle = pal.blanket;
    ctx.fill(cloth);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1;
    ctx.stroke(cloth);

    const a = project(cam, item.x, 0, item.z - 1);
    const b = project(cam, item.x, 0, item.z + 1);
    const l = project(cam, item.x - 1.2, 0, item.z);
    const r = project(cam, item.x + 1.2, 0, item.z);
    const seams = new Path2D();
    seams.moveTo(a.sx, a.sy);
    seams.lineTo(b.sx, b.sy);
    seams.moveTo(l.sx, l.sy);
    seams.lineTo(r.sx, r.sy);
    ctx.globalAlpha = 0.45;
    ctx.stroke(seams);
    ctx.globalAlpha = 1;
    const basket = project(cam, item.x + 0.6, 0.18, item.z + 0.4);
    ctx.fillStyle = pal.bagel;
    ctx.beginPath();
    ctx.rect(
      basket.sx - 0.2 * basket.s,
      basket.sy - 0.18 * basket.s,
      0.4 * basket.s,
      0.2 * basket.s,
    );
    ctx.fill();
    ctx.stroke();
  }

  #drawSleeper(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    item: Item,
  ) {
    shadow(ctx, cam, pal, item.x, item.z, 1.4, 0.4);
    const p = project(cam, item.x, 0.32, item.z);
    const s = p.s;
    ctx.fillStyle = pal.fur;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = Math.max(0.8, 0.04 * s);
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, 0.75 * s, 0.34 * s, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.sx + 0.5 * s, p.sy - 0.05 * s, 0.24 * s, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const tail = new Path2D();
    tail.moveTo(p.sx - 0.7 * s, p.sy);
    tail.quadraticCurveTo(
      p.sx - 1.05 * s,
      p.sy - 0.35 * s,
      p.sx - 0.75 * s,
      p.sy - 0.4 * s,
    );
    ctx.stroke(tail);
    if (s > 24) {
      ctx.fillStyle = pal.ink;
      ctx.font = `${0.28 * s}px "Alfa Slab One", serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const wink = Math.sin(this.time * 2 + item.seed) * 0.05 * s;
      ctx.fillText("z", p.sx + 0.7 * s, p.sy - 0.45 * s - wink);
      ctx.fillText("z", p.sx + 0.88 * s, p.sy - 0.68 * s - wink * 1.5);
    }
  }

  get gameSeconds() {
    return this.clock.tick(this.time);
  }

  get miles() {
    return Math.min(this.z, MILE) / MILE;
  }

  get score() {
    return (
      this.balls * 10 +
      Math.floor(Math.min(this.z, MILE) / 8) +
      this.bonus -
      this.penalty
    );
  }

  get controllable() {
    return !this.over && this.stumble <= 0 && !this.launched;
  }

  get spare() {
    return Math.max(0, this.clock.seconds - this.time);
  }

  left() {
    if (this.controllable && this.lane > 0) {
      this.lane -= 1;
    }
  }

  right() {
    if (this.controllable && this.lane < 2) {
      this.lane += 1;
    }
  }

  jump() {
    if (!this.controllable || this.y > 0) {
      return;
    }

    this.vy = 5.7;
    this.emit({ type: "sound", name: "jump" });
  }

  update(dt: number) {
    if (this.over || !this.#clock(dt)) {
      return;
    }

    this.#run(dt);
    this.#shore(dt);
    this.#meet(dt);
    this.#rain(dt);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    plate: HTMLImageElement,
  ) {
    const give = borrow(cam, {
      z: this.z - 6,
      x: this.x * 0.4,
      rise,
      base: rise(this.z),
      eye: cam.eye + Math.sin(this.stride * 0.9) * 0.025 + this.y * 0.35,
    });

    sky(ctx, cam, pal);
    treeline(ctx, cam, pal, HALF + 26, cam.z + 150);
    meadow(ctx, cam, pal, HALF + 14, 130, 7);
    if (WATER - 60 < this.z) {
      pool(ctx, cam, pal, HALF + 6, WATER, WATER + 60, this.time);
    }
    buildings(ctx, cam, pal, HALF + 34, cam.z, cam.z + 150, 29);
    this.#drawEdges(ctx, cam, pal);

    const layers: Array<Layer> = [];
    this.#drawTrees(ctx, cam, pal, layers);
    for (const item of this.items) {
      if (item.z < cam.z + 1 || item.z > cam.z + 140) {
        continue;
      }

      layers.push({
        z: item.z,
        draw: () => this.#drawItem(ctx, cam, pal, item),
      });
    }

    for (const r of this.rings) {
      if (r.t > 0) {
        layers.push({
          z: r.z,
          draw: () =>
            ring(ctx, cam, pal, r.x, r.z, 0.4 + r.t * 3, (1 - r.t) * 0.8),
        });
      }
    }

    layers.push({ z: this.z, draw: () => this.#drawDog(ctx, cam, pal, plate) });
    for (const d of this.drops) {
      layers.push({
        z: d.z,
        draw: () => droplet(ctx, cam, pal, d.x, d.y, d.z, d.r),
      });
    }

    layers.sort((a, b) => b.z - a.z);
    for (const layer of layers) {
      layer.draw();
    }

    speedLines(ctx, cam, pal, Math.max(0, (this.speed - 29) / 9), this.time);
    give();
  }

  gauges(): Gauges {
    return {
      ...NO_GAUGES,
      combo: this.combo,
      boost: this.burst,
      shield: this.shield,
      magnet: this.magnet,
      zoomies: this.zoomies,
    };
  }

  summary() {
    return [
      `${count(this.balls)} tennis ${this.balls === 1 ? "ball" : "balls"}, ${count(this.golds)} gold`,
      this.leashed
        ? `${this.miles.toFixed(2)} miles before the leashes went on`
        : `${this.rating} with ${Math.round(this.spare)} seconds to spare`,
      `${count(this.hits)} ${this.hits === 1 ? "tumble" : "tumbles"} cost ${count(this.penalty)} points`,
    ];
  }

  nudge(dir: -1 | 1) {
    if (dir < 0) {
      this.left();
    } else {
      this.right();
    }
  }

  act() {
    this.jump();
  }
}
