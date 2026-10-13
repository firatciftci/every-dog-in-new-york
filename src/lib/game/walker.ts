import { plateOf } from "#lib/breeds.js";
import { count } from "#lib/utils.js";
import type { Emit } from "./events";
import type { Cam, Look, Palette } from "./ink";
import type { OffLeash } from "./off-leash";
import type { Conditions } from "./parks";
import type { Gauges } from "./run";
import {
  borrow,
  buildings,
  cutout,
  bagel as drawBagel,
  ball as drawBall,
  balto as drawBalto,
  bench as drawBench,
  carousel as drawCarousel,
  carriage as drawCarriage,
  cart as drawCart,
  client as drawClient,
  fountain as drawFountain,
  house as drawHouse,
  hydrant as drawHydrant,
  lamppost as drawLamppost,
  mushroom as drawMushroom,
  pond as drawPond,
  railing as drawRailing,
  rock as drawRock,
  squirrel as drawSquirrel,
  walker as drawWalker,
  groundEllipse,
  handAt,
  hash,
  jogger,
  leash,
  lookFrom,
  meadow,
  project,
  puff,
  ring,
  shadow,
  signpost,
  sky,
  speedLines,
  tree,
  treeline,
} from "./ink";
import { conditionsOf, rng, RUNNERS } from "./parks";
import { award, NO_GAUGES } from "./run";

const LEASH = 3.4;
const SNAP = 2.4;
const WALK = 8;
const HALF = 6.5;
const LOOSE_SECONDS = 6;
const WHISTLE_COOLDOWN = 8;
const MILE = 1609;
const DOG_H = 0.62;
const BLOCK = 50;

function zAt(street: number) {
  return (street - 59) * BLOCK;
}

function rise(z: number) {
  const s = 59 + z / BLOCK;
  const hill =
    s > 75.5 && s < 80 ? 2.2 * Math.sin(((s - 75.5) / 4.5) * Math.PI) ** 2 : 0;

  return 0.3 * Math.sin(z / 95) + hill;
}

type Decor =
  | { kind: "pond"; x: number; s: number; rx: number; rz: number }
  | { kind: "rink"; x: number; s: number }
  | { kind: "railing"; x: number; s: number; s1: number }
  | {
      kind: "house";
      x: number;
      s: number;
      w: number;
      d: number;
      h: number;
      style: "cottage" | "columns" | "stone" | "flat";
    }
  | { kind: "carousel"; x: number; s: number }
  | { kind: "mall"; s: number; s1: number }
  | { kind: "balto"; x: number; s: number }
  | { kind: "fountain"; x: number; s: number }
  | { kind: "mushroom"; x: number; s: number }
  | { kind: "rock"; x: number; s: number; w: number; h: number }
  | { kind: "sign"; x: number; s: number; text: string };

const DECOR: Array<Decor> = [
  { kind: "pond", x: -15, s: 60.5, rx: 8, rz: 34 },
  { kind: "sign", x: -HALF - 1.2, s: 59.6, text: "THE POND" },
  { kind: "rock", x: -HALF - 2, s: 61.8, w: 7, h: 2.2 },
  { kind: "rink", x: -13, s: 62.5 },
  { kind: "sign", x: -HALF - 1.2, s: 62.2, text: "WOLLMAN RINK" },
  { kind: "railing", x: HALF + 0.9, s: 63, s1: 66 },
  { kind: "sign", x: HALF + 1.8, s: 63.1, text: "THE ZOO" },
  { kind: "house", x: HALF + 3, s: 64, w: 9, d: 7, h: 6, style: "stone" },
  { kind: "carousel", x: -12, s: 64.6 },
  {
    kind: "house",
    x: -HALF - 3.5,
    s: 65.2,
    w: 7,
    d: 6,
    h: 3.5,
    style: "cottage",
  },
  { kind: "sign", x: -HALF - 1.2, s: 65, text: "THE DAIRY" },
  { kind: "mall", s: 66, s1: 72 },
  { kind: "sign", x: -HALF - 1.2, s: 66.2, text: "THE MALL" },
  { kind: "balto", x: HALF - 0.4, s: 67 },
  { kind: "house", x: HALF + 3, s: 69.5, w: 12, d: 10, h: 2.2, style: "flat" },
  { kind: "sign", x: HALF + 1.8, s: 69.3, text: "RUMSEY PLAYFIELD" },
  { kind: "fountain", x: -13, s: 72 },
  { kind: "sign", x: -HALF - 1.2, s: 71.6, text: "BETHESDA TERRACE" },
  { kind: "pond", x: 16, s: 74, rx: 8, rz: 40 },
  { kind: "sign", x: HALF + 1.8, s: 73, text: "CONSERVATORY WATER" },
  { kind: "mushroom", x: HALF + 3, s: 75.2 },
  { kind: "rock", x: -HALF - 2.5, s: 76.5, w: 9, h: 3 },
  { kind: "sign", x: -HALF - 1.2, s: 76.2, text: "CAT HILL" },
  { kind: "rock", x: HALF + 2.5, s: 78.5, w: 8, h: 2.6 },
  { kind: "pond", x: -16, s: 79.7, rx: 9, rz: 30 },
  { kind: "sign", x: -HALF - 1.2, s: 79.3, text: "TURTLE POND" },
  { kind: "house", x: HALF + 4, s: 81, w: 30, d: 60, h: 9, style: "columns" },
  { kind: "sign", x: HALF + 1.8, s: 80.6, text: "THE MET" },
];

export type Trait = "sniffer" | "chaser" | "fetcher" | "puller" | "small";

const TRAITS: Record<string, Trait> = {
  "Labrador (or Crossbreed)": "fetcher",
  "Yorkshire Terrier": "chaser",
  "Shih Tzu": "small",
  "Pit Bull (or Mix)": "chaser",
  Chihuahua: "small",
  Poodle: "fetcher",
  Maltese: "small",
  "French Bulldog": "small",
  Pomeranian: "small",
  Havanese: "small",
  "German Shepherd Dog": "puller",
  Beagle: "sniffer",
  Dachshund: "sniffer",
  Pug: "small",
};

export const TRAIT_WORD: Record<Trait, string> = {
  sniffer: "follows every smell",
  chaser: "lunges at squirrels",
  fetcher: "bolts for tennis balls",
  puller: "pulls you faster",
  small: "lags behind at every hydrant",
};

export function traitOf(breed: string): Trait {
  return TRAITS[breed] ?? "fetcher";
}

type Kind =
  | "tree"
  | "lamppost"
  | "bench"
  | "puddle"
  | "hydrant"
  | "cart"
  | "ball"
  | "bagel"
  | "client"
  | "carriage"
  | "crosser";

type Thing = {
  kind: Kind;
  x: number;
  z: number;
  r: number;
  seed: number;
  taken: boolean;
  breed: string;
};

export type Dog = {
  breed: string;
  plate: string;
  name: string;
  trait: Trait;
  x: number;
  z: number;
  face: number;
  stride: number;
  slot: number;
  hooked: Thing | null;
  stretch: number;
  looseT: number;
  wet: number;
  dwell: number;
  img: HTMLImageElement | null;
};

type Spark = {
  kind: "puff" | "ring";
  x: number;
  z: number;
  t: number;
  life: number;
};

const LOSE_TEXT = ["is gone", "went home on its own", "found a better walker"];

const SOLIDS: Set<Kind> = new Set([
  "tree",
  "lamppost",
  "bench",
  "cart",
  "carriage",
  "crosser",
]);

const TALL: Set<Kind> = new Set(["tree", "lamppost", "cart", "client"]);

export class WalkerGame {
  #rand: () => number;
  #nextAt = 18;
  #clientAt = 55;
  #crossAt = 110;
  #carriageAt = 170;
  #squirrelIn = 9;
  #puffAt = 0;
  #names: Array<string>;
  #breeds: Array<string>;

  name: string;
  emit: Emit;
  load: (breed: string) => HTMLImageElement | null;
  look: Look;
  readonly clock: OffLeash;

  time = 0;
  z = 0;
  x = 0;
  camX = 0;
  targetX = 0;
  speed = WALK;
  stumble = 0;
  stride = 0;
  earned = 0;
  bonus = 0;
  penalty = 0;
  snaps = 0;
  rescues = 0;
  lost = 0;
  clients = 0;
  squirrels = 0;
  maxPack = 0;
  topSpeed = 0;
  whistle = 0;
  whistled = 0;
  hookedAt = -9;
  hookedOn: Thing | null = null;
  conditions: Conditions;
  over = false;
  phase = 0;
  tags = new Set<string>();

  pack: Array<Dog> = [];
  things: Array<Thing> = [];
  squirrel: { x: number; z: number; dir: number; stride: number } | null = null;
  stray: {
    x: number;
    z: number;
    vx: number;
    vz: number;
    stride: number;
    breed: string;
  } | null = null;
  strayIn = 20;
  sparks: Array<Spark> = [];

  constructor(
    seed: number,
    starters: Array<{ breed: string; name: string }>,
    names: Array<string>,
    load: (breed: string) => HTMLImageElement | null,
    emit: Emit,
    clock: OffLeash,
  ) {
    this.name = starters[0]?.name ?? "Luna";
    this.clock = clock;
    this.emit = emit;
    this.load = load;
    this.#rand = rng(seed);
    this.conditions = conditionsOf("central", seed);
    this.look = lookFrom(rng(seed + 1));
    this.#names = names;
    this.#breeds = [...RUNNERS];
    for (const s of starters) {
      this.#join(s.breed, s.name, true);
    }
  }

  #join(breed: string, name: string, isQuiet: boolean) {
    const slot = this.pack.length;
    this.pack.push({
      breed,
      plate: plateOf(breed),
      name,
      trait: traitOf(breed),
      x: this.x + (slot - 1) * 0.9,
      z: this.z + 2,
      face: 1,
      stride: 0,
      slot,
      hooked: null,
      stretch: 0,
      looseT: 0,
      wet: 0,
      dwell: 0,
      img: this.load(breed),
    });
    this.#reslot();
    this.maxPack = Math.max(this.maxPack, this.pack.length);
    if (this.pack.length >= 8) {
      this.#award("hands");
    }

    if (!isQuiet) {
      this.clients += 1;
      this.bonus += 40;
      if (this.clients >= 6) {
        this.#award("clients");
      }

      this.emit({ type: "sound", name: "ding" });
      this.emit({
        type: "stamp",
        text: `+40 ${name} the ${breed} joins`,
        tone: "good",
      });
      this.emit({
        type: "say",
        text: `${name} the ${breed} joins the pack. ${this.pack.length} dogs.`,
      });
    }
  }

  #reslot() {
    for (const [i, d] of this.pack.entries()) {
      d.slot = i;
    }
  }

  #award(tag: string) {
    award(this.tags, this.emit, tag);
  }

  #pick<T>(list: Array<T>) {
    return list[Math.floor(this.#rand() * list.length)] as T;
  }

  #side() {
    return this.#rand() < 0.5 ? -1 : 1;
  }

  #across(margin: number) {
    return (this.#rand() - 0.5) * 2 * (HALF - margin);
  }

  #thing(kind: Kind, x: number, z: number, r: number, breed = "") {
    this.things.push({ kind, x, z, r, seed: z, taken: false, breed });
  }

  #gate(at: number) {
    const w = [2.6, 2.1, 1.7][this.phase]!;
    const c = this.#across(3.2);
    this.#thing("tree", c - w, at, 0.4);
    this.#thing("tree", c + w, at + 0.4, 0.4);
  }

  #conditionScatter(at: number) {
    if (this.conditions.id === "wet" && this.#rand() < 0.16) {
      this.#thing("puddle", this.#across(1.5), at, 1.2);

      return true;
    }

    if (this.conditions.id === "carts" && this.#rand() < 0.14) {
      this.#thing("cart", this.#side() * (HALF - 0.4), at, 1);

      return true;
    }

    return false;
  }

  #scatter(at: number) {
    if (this.#conditionScatter(at)) {
      return;
    }

    const roll = this.#rand();
    if (roll < 0.34) {
      if (this.phase >= 1 && this.#rand() < 0.45) {
        this.#gate(at);

        return;
      }

      const n = 1 + Math.floor(this.#rand() * (this.phase + 2));
      for (let i = 0; i < n; i += 1) {
        this.#thing("tree", this.#across(0.6), at + i * 1.5, 0.4);
      }

      return;
    }

    this.#furniture(roll, at);
  }

  #furniture(roll: number, at: number) {
    if (roll < 0.5) {
      this.#thing(
        "lamppost",
        this.#side() * (HALF - 1.2 - this.#rand() * 2.5),
        at,
        0.18,
      );
    } else if (roll < 0.6) {
      this.#thing("bench", this.#side() * (HALF - 0.9), at, 1.3);
    } else if (roll < 0.7) {
      this.#thing("puddle", this.#across(1.5), at, 1.2);
    } else if (roll < 0.78) {
      this.#thing("hydrant", this.#side() * (HALF - 0.7), at, 0.3);
    } else if (roll < 0.86) {
      this.#thing("cart", this.#side() * (HALF - 0.4), at, 1);
    } else if (roll < 0.94) {
      this.#thing("ball", this.#across(1), at, 0.3);
    } else {
      this.#thing("bagel", this.#across(1), at, 0.3);
    }
  }

  #spawn() {
    const horizon = this.z + 150;
    while (this.#nextAt < horizon) {
      this.#scatter(this.#nextAt);
      this.#nextAt += [10, 7.5, 6][this.phase]! + this.#rand() * 5;
    }

    if (this.#clientAt < horizon) {
      this.#thing(
        "client",
        this.#side() * (HALF - 0.6),
        this.#clientAt,
        1.6,
        this.#pick(this.#breeds),
      );
      this.#clientAt += 70 + this.#rand() * 40;
    }

    if (this.phase >= 1 && this.#crossAt < horizon) {
      this.#thing("crosser", -HALF - 2, this.#crossAt, 1);
      this.#crossAt += 80 + this.#rand() * 40;
    }

    if (this.phase >= 1 && this.#carriageAt < horizon) {
      this.#thing("carriage", (this.#rand() - 0.5) * 6, this.#carriageAt, 1.6);
      this.#carriageAt += 140 + this.#rand() * 60;
    }

    this.things = this.things.filter((t) => t.z > this.z - 14);
  }

  #moveThings(dt: number) {
    for (const t of this.things) {
      if (t.kind === "carriage") {
        t.z += 3.2 * dt;
      } else if (t.kind === "crosser") {
        t.x += 2.6 * dt;
      }
    }
  }

  #pullOf(kind: Kind) {
    if (kind !== "cart") {
      return 4;
    }

    return this.conditions.id === "carts" ? 6.5 : 5;
  }

  #attractor(d: Dog): { x: number; z: number; pull: number } | null {
    let best: { x: number; z: number; pull: number } | null = null;
    let bestGap = Infinity;
    const wanted: Partial<Record<Trait, Array<Kind>>> = {
      sniffer: ["cart", "bagel"],
      fetcher: ["ball"],
      small: ["hydrant"],
    };
    const kinds = wanted[d.trait] ?? [];
    for (const t of this.things) {
      if (
        t.taken ||
        !kinds.includes(t.kind) ||
        t.z < d.z - 1 ||
        t.z > d.z + 12
      ) {
        continue;
      }

      const gap = Math.hypot(t.x - d.x, t.z - d.z);
      if (gap < bestGap) {
        bestGap = gap;
        best = { x: t.x, z: t.z, pull: this.#pullOf(t.kind) };
      }
    }

    return this.#lure(d) ?? best;
  }

  #lure(d: Dog): { x: number; z: number; pull: number } | null {
    const stray = this.stray;
    if (stray != null && Math.abs(stray.z - d.z) < 9) {
      return { x: stray.x, z: stray.z, pull: 6.5 };
    }

    const s = this.squirrel;
    if (s != null && d.trait === "chaser" && Math.abs(s.z - d.z) < 10) {
      return { x: s.x, z: s.z, pull: 6.5 };
    }

    return null;
  }

  #hookTest(d: Dog) {
    for (const t of this.things) {
      if (t.kind !== "tree" && t.kind !== "lamppost") {
        continue;
      }

      if (t.z < this.z || t.z > d.z + 0.3) {
        continue;
      }

      if ((t.x - this.x) * (t.x - d.x) >= 0) {
        continue;
      }

      const ax = this.x;
      const az = this.z;
      const bx = d.x;
      const bz = d.z;
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      if (len2 < 0.01) {
        continue;
      }

      const u = Math.max(
        0,
        Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / len2),
      );
      const px = ax + u * dx;
      const pz = az + u * dz;
      if (Math.hypot(px - t.x, pz - t.z) < t.r + 0.15) {
        return t;
      }
    }

    return null;
  }

  #snap(d: Dog) {
    d.hooked = null;
    d.looseT = 0.001;
    d.stretch = 0;
    this.snaps += 1;
    this.penalty += 80;
    this.emit({ type: "sound", name: "hit" });
    this.emit({
      type: "stamp",
      text: `−80 ${d.name}'s leash snapped`,
      tone: "bad",
    });
    this.emit({
      type: "say",
      text: `${d.name}'s leash snapped. Reach ${d.name} in six seconds.`,
    });
  }

  #stepLoose(d: Dog, dt: number) {
    d.looseT += dt;
    const pull = this.#attractor(d);
    const tx = pull?.x ?? d.x + Math.sin(d.slot * 3 + this.time) * 2;
    const tz = pull?.z ?? d.z + 6;
    const dx = tx - d.x;
    const dz = tz - d.z;
    const gap = Math.hypot(dx, dz) || 1;
    const pace = 6;
    d.x += (dx / gap) * pace * dt;
    d.z += (dz / gap) * pace * dt;
    d.x = Math.max(-HALF, Math.min(HALF, d.x));
    d.stride += pace * dt;
    if (Math.hypot(d.x - this.x, d.z - this.z) < 1.4) {
      d.looseT = 0;
      d.hooked = null;
      this.rescues += 1;
      this.bonus += 20;
      if (this.rescues >= 3) {
        this.#award("rescue");
      }

      this.emit({ type: "sound", name: "catch" });
      this.emit({
        type: "stamp",
        text: `+20 Got ${d.name} back`,
        tone: "good",
      });

      return;
    }

    if (d.looseT >= LOOSE_SECONDS) {
      this.pack = this.pack.filter((o) => o !== d);
      this.#reslot();
      this.lost += 1;
      this.penalty += 150;
      this.emit({ type: "sound", name: "lost" });
      this.emit({
        type: "stamp",
        text: `−150 ${d.name} ${this.#pick(LOSE_TEXT)}`,
        tone: "bad",
      });
      this.emit({
        type: "say",
        text: `${d.name} is gone. ${this.pack.length} dogs left.`,
      });
    }
  }

  #wants(d: Dog) {
    const n = this.pack.length;
    const spread =
      Math.min(HALF - 0.5, 0.75 * (n - 1)) * (this.whistled > 0 ? 0.4 : 1);
    const slotX = n === 1 ? 0 : -spread / 2 + (spread * d.slot) / (n - 1);
    const pull = this.whistled > 0 ? null : this.#attractor(d);
    const ahead = d.trait === "puller" ? 3 : d.trait === "small" ? 1.4 : 2.2;
    let x = this.x + slotX;
    let z = this.z + ahead;
    if (pull != null) {
      const k = pull.pull * 0.22;
      x = x * (1 - k) + pull.x * k;
      z = Math.max(z, Math.min(pull.z, this.z + LEASH * 0.95));
    }

    if (d.dwell > 0) {
      z = d.z;
    }

    if (d.wet > 0) {
      x += Math.sin(this.time * 25) * 0.8;
    }

    return { x, z };
  }

  #trot(d: Dog, dt: number) {
    d.dwell = Math.max(0, d.dwell - dt);
    d.wet = Math.max(0, d.wet - dt);
    if (d.hooked != null) {
      return;
    }

    const want = this.#wants(d);
    const pace = d.trait === "small" ? 7.5 : d.trait === "puller" ? 11 : 9.5;
    const dx = want.x - d.x;
    const dz = want.z - d.z;
    const gap = Math.hypot(dx, dz);
    if (gap <= 0.05) {
      return;
    }

    const step = Math.min(gap, pace * dt);
    d.x += (dx / gap) * step;
    d.z += (dz / gap) * step;
    d.stride += step;
    if (Math.abs(dx) > 0.2) {
      d.face = dx > 0 ? 1 : -1;
    }
  }

  #hook(d: Dog) {
    const held = d.hooked;
    if (held != null) {
      const isSameSide = Math.sign(this.x - held.x) === Math.sign(d.x - held.x);
      if (isSameSide && Math.abs(this.x - held.x) > held.r + 0.2) {
        d.hooked = null;
      }

      return;
    }

    const hook = this.#hookTest(d);
    if (hook == null) {
      return;
    }

    d.hooked = hook;
    if (this.hookedOn === hook && this.time - this.hookedAt < 1.2) {
      return;
    }

    this.hookedAt = this.time;
    this.hookedOn = hook;
    this.emit({ type: "sound", name: "close" });
    this.emit({
      type: "stamp",
      text: `${d.name} is hooked on a ${hook.kind}. Go around`,
      tone: "note",
    });
  }

  #stretchOf(d: Dog) {
    const held = d.hooked;
    if (held == null) {
      return Math.hypot(d.x - this.x, d.z - this.z) / LEASH;
    }

    return (
      (Math.hypot(held.x - this.x, held.z - this.z) +
        Math.hypot(d.x - held.x, d.z - held.z)) /
      LEASH
    );
  }

  #stepDog(d: Dog, dt: number) {
    if (d.looseT > 0) {
      this.#stepLoose(d, dt);

      return;
    }

    this.#trot(d, dt);
    d.x = Math.max(-HALF, Math.min(HALF, d.x));
    if (d.hooked == null) {
      d.z = Math.max(d.z, this.z + 0.6);
    }

    this.#hook(d);

    d.stretch = this.#stretchOf(d);
    if (d.hooked != null) {
      if (d.stretch > SNAP) {
        this.#snap(d);
      }

      return;
    }

    const reach = Math.hypot(d.x - this.x, d.z - this.z);
    if (reach > LEASH) {
      const k = LEASH / reach;
      const nx = this.x + (d.x - this.x) * k;
      const nz = this.z + (d.z - this.z) * k;
      d.x += (nx - d.x) * 0.45;
      d.z += (nz - d.z) * 0.45;
      this.x += (d.x - this.x) * 0.025;
    }

    for (const t of this.things) {
      if (!t.taken && Math.hypot(t.x - d.x, t.z - d.z) <= t.r + 0.9) {
        this.#touch(d, t);
      }
    }
  }

  #touch(d: Dog, t: Thing) {
    if (t.kind === "ball") {
      t.taken = true;
      this.bonus += 15;
      this.emit({ type: "sound", name: "collect" });
      this.emit({
        type: "stamp",
        text: `+15 ${d.name} got the ball`,
        tone: "good",
      });
    } else if (t.kind === "bagel") {
      t.taken = true;
      this.bonus += 10;
      this.emit({ type: "sound", name: "chomp" });
      this.emit({
        type: "stamp",
        text: `+10 ${d.name} found a bagel`,
        tone: "good",
      });
    } else if (t.kind === "puddle" && d.wet <= 0) {
      const cost = this.conditions.id === "wet" ? 12 : 8;
      d.wet = 2;
      this.penalty += cost;
      this.emit({ type: "sound", name: "puddle" });
      this.emit({
        type: "stamp",
        text: `−${cost} ${d.name}, out of the puddle`,
        tone: "bad",
      });
    } else if (t.kind === "hydrant" && d.trait === "small" && d.dwell <= 0) {
      d.dwell = 1.2;
    }
  }

  #bump() {
    if (this.stumble > 0) {
      return;
    }

    for (const t of this.things) {
      if (
        !SOLIDS.has(t.kind) ||
        Math.hypot(t.x - this.x, t.z - this.z) > t.r + 0.35
      ) {
        continue;
      }

      this.stumble = 0.7;
      const cost = t.kind === "crosser" ? 40 : 30;
      this.penalty += cost;
      this.emit({ type: "sound", name: "hit" });
      this.emit({
        type: "stamp",
        text:
          t.kind === "crosser"
            ? `−${cost} Tangled with another walker`
            : `−${cost} Walked into a ${t.kind}`,
        tone: "bad",
      });

      return;
    }
  }

  #greet() {
    for (const t of this.things) {
      if (
        t.kind !== "client" ||
        t.taken ||
        Math.hypot(t.x - this.x, t.z - this.z) > t.r
      ) {
        continue;
      }

      t.taken = true;
      const used = new Set(this.pack.map((d) => d.name));
      const free = this.#names.filter((n) => !used.has(n));
      this.#join(
        t.breed,
        free.length > 0 ? this.#pick(free) : `Dog ${this.pack.length + 1}`,
        false,
      );
    }
  }

  #stepWalker(dt: number) {
    this.stumble = Math.max(0, this.stumble - dt);
    const pullers = this.pack.filter(
      (d) => d.trait === "puller" && d.looseT === 0,
    ).length;
    const hooked = this.pack.filter((d) => d.hooked != null).length;
    const smalls = this.pack.filter(
      (d) => d.trait === "small" && d.dwell > 0,
    ).length;
    const want =
      Math.max(4, WALK + pullers * 0.9 - smalls * 0.8) *
      (this.stumble > 0 ? 0.5 : 1) *
      (hooked > 0 ? 0.35 : 1);
    this.speed += (want - this.speed) * Math.min(1, 3 * dt);
    if (pullers > 0 && this.speed > WALK + 1.5) {
      this.topSpeed = Math.max(this.topSpeed, this.speed);
      this.#award("husky");
    }

    this.z += this.speed * dt;
    this.stride += this.speed * dt;
    this.x += (this.targetX - this.x) * Math.min(1, 6 * dt);
    this.x = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, this.x));
    this.camX += (this.x * 0.82 - this.camX) * Math.min(1, 4.5 * dt);
    if (this.z >= MILE) {
      this.#award("mile");
    }

    this.#puffAt += this.speed * dt;
    if (this.#puffAt > 1.5) {
      this.#puffAt = 0;
      this.sparks.push({
        kind: "puff",
        x: this.x,
        z: this.z - 0.3,
        t: 0,
        life: 0.5,
      });
    }

    this.#bump();
    this.#greet();
  }

  #stepSquirrel(dt: number) {
    const s = this.squirrel;
    if (s == null) {
      this.#squirrelIn -= dt;
      if (this.#squirrelIn <= 0) {
        const dir = this.#rand() < 0.5 ? 1 : -1;
        this.squirrel = {
          x: -dir * (HALF + 1),
          z: this.z + 9 + this.#rand() * 5,
          dir,
          stride: 0,
        };
        this.squirrels += 1;
        if (this.squirrels >= 6) {
          this.#award("squirrel");
        }

        this.emit({ type: "sound", name: "squirrel" });
        this.#squirrelIn =
          ([8, 6, 4.5][this.phase]! + this.#rand() * 4) *
          (this.conditions.id === "squirrels" ? 0.6 : 1);
      }

      return;
    }

    s.x += s.dir * 6.5 * dt;
    s.stride += 6.5 * dt;
    if (Math.abs(s.x) > HALF + 1.5 || s.z < this.z - 3) {
      this.squirrel = null;
    }
  }

  #stepStray(dt: number) {
    const stray = this.stray;
    if (stray == null) {
      if (this.phase < 1) {
        return;
      }

      this.strayIn -= dt;
      if (this.strayIn <= 0) {
        const side = this.#side();
        this.stray = {
          x: side * (HALF + 2),
          z: this.z + 16,
          vx: -side * 5.5,
          vz: -3.5,
          stride: 0,
          breed: this.#pick(this.#breeds),
        };
        this.strayIn =
          (18 + this.#rand() * 10) *
          (this.conditions.id === "strays" ? 0.6 : 1);
        this.emit({ type: "sound", name: "bark" });
        this.emit({
          type: "stamp",
          text: "A loose dog! Whistle before the pack goes",
          tone: "note",
        });
        this.emit({
          type: "say",
          text: "A dog off its leash is running through. Whistle to hold the pack.",
        });
      }

      return;
    }

    stray.x += stray.vx * dt;
    stray.z += stray.vz * dt;
    stray.stride += 6.5 * dt;
    if (Math.abs(stray.x) > HALF + 3 || stray.z < this.z - 4) {
      this.stray = null;
    }
  }

  #stepPhase() {
    const minute = Math.min(
      this.clock.minutes - 1,
      Math.floor(this.clock.tick(this.time) / 60),
    );
    if (minute !== this.phase) {
      this.phase = minute;
      this.emit({ type: "sound", name: "tick" });
      const words = this.clock.isNight
        ? ["the night owls come out", "last call at the dog run"]
        : ["the park fills up", "rush hour"];
      this.emit({
        type: "banner",
        text: `${this.clock.stamp(minute)} · ${words[minute - 1] ?? ""}`,
      });
    }
  }

  #finish(why: string) {
    if (this.over) {
      return;
    }

    this.over = true;
    if (this.snaps === 0 && this.pack.length >= 5) {
      this.#award("nosnap");
    }

    this.emit({
      type: "sound",
      name: this.pack.length === 0 ? "lost" : "chime",
    });
    this.emit({ type: "shout", text: why, tone: "plain" });
    this.emit({
      type: "say",
      text: `${why}. ${this.pack.length} dogs on the leash, ${count(this.score)} points.`,
    });
    this.emit({ type: "over" });
  }

  #drawThing(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette, t: Thing) {
    switch (t.kind) {
      case "tree": {
        tree(ctx, cam, pal, t.x, t.z, 1 + hash(t.seed) * 0.4, t.seed);

        return;
      }

      case "lamppost": {
        drawLamppost(ctx, cam, pal, t.x, t.z);

        return;
      }

      case "bench": {
        drawBench(ctx, cam, pal, t.x, t.z);

        return;
      }

      case "puddle": {
        groundEllipse(ctx, cam, t.x, t.z, 1.25, 0.85, pal.water);
        ring(ctx, cam, pal, t.x, t.z, 0.9, 0.5);

        return;
      }

      case "hydrant": {
        drawHydrant(ctx, cam, pal, t.x, t.z);

        return;
      }

      case "cart": {
        drawCart(ctx, cam, pal, t.x, t.z);

        return;
      }

      case "ball": {
        if (!t.taken) {
          shadow(ctx, cam, pal, t.x, t.z, 0.24, 0.2);
          drawBall(ctx, cam, pal, t.x, 0.11, t.z, 0.11);
        }

        return;
      }

      case "bagel": {
        if (!t.taken) {
          shadow(ctx, cam, pal, t.x, t.z, 0.3, 0.14);
          drawBagel(ctx, cam, pal, t.x, 0.12, t.z);
        }

        return;
      }

      case "client": {
        drawClient(
          ctx,
          cam,
          pal,
          t.x,
          t.z,
          t.taken ? null : this.load(t.breed),
        );

        return;
      }

      case "carriage": {
        drawCarriage(ctx, cam, pal, t.x, t.z, this.time);

        return;
      }

      case "crosser": {
        this.#drawCrosser(ctx, cam, pal, t);
      }
    }
  }

  #drawCrosser(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    t: Thing,
  ) {
    jogger(ctx, cam, pal, t.x, t.z, this.time * 2);
    for (let i = 0; i < 3; i += 1) {
      const img = this.load(
        this.#breeds[(t.seed + i * 3) % this.#breeds.length] ?? "Beagle",
      );
      if (img != null) {
        cutout(
          ctx,
          cam,
          pal,
          img,
          t.x + 1.4 + i * 0.9,
          0,
          t.z + (i % 2 === 0 ? 0.4 : -0.4),
          0.5,
          false,
          0,
        );
      }
    }
  }

  #drawDog(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette, d: Dog) {
    if (d.img == null) {
      return;
    }

    const bob = Math.abs(Math.sin(d.stride * 2.4)) * 0.06;
    const lean =
      Math.sin(d.stride * 2.4) * 0.06 * d.face +
      (d.wet > 0 ? Math.sin(this.time * 30) * 0.12 : 0);
    const h =
      d.trait === "small"
        ? DOG_H * 0.75
        : d.trait === "puller"
          ? DOG_H * 1.1
          : DOG_H;
    shadow(ctx, cam, pal, d.x, d.z, 0.9, h);
    cutout(ctx, cam, pal, d.img, d.x, bob, d.z, h, d.face < 0, lean);
    if (d.looseT > 0) {
      const p = project(cam, d.x, h + 0.35, d.z);
      ctx.fillStyle = pal.blanket;
      ctx.font = `${Math.max(10, 0.5 * p.s)}px "Alfa Slab One", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(Math.ceil(LOOSE_SECONDS - d.looseT)), p.sx, p.sy);
    }
  }

  #drawLeashes(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    hand: { sx: number; sy: number },
  ) {
    for (const d of this.pack) {
      if (d.looseT > 0) {
        continue;
      }

      const collar = project(cam, d.x, 0.42, d.z);
      const via =
        d.hooked == null
          ? null
          : project(
              cam,
              d.hooked.x + (d.hooked.x > this.x ? -d.hooked.r : d.hooked.r),
              0.9,
              d.hooked.z,
            );
      leash(ctx, pal, hand, via, collar, d.stretch);
    }
  }

  #drawEdgeTrees(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    layers: Array<{ z: number; draw: () => void }>,
  ) {
    for (let k = Math.ceil((cam.z + 4) / 12); k < (cam.z + 130) / 12; k += 1) {
      for (const side of [-1, 1]) {
        const seed = k * 2 + (side + 1) / 2;
        const z = k * 12 + hash(seed * 5) * 6;
        if (z - cam.z < 8) {
          continue;
        }

        const x = side * (HALF + 3 + hash(seed * 3) * 8);
        layers.push({
          z,
          draw: () =>
            tree(ctx, cam, pal, x, z, 1.8 + hash(seed * 7) * 1.2, seed),
        });
      }
    }

    for (let s = 60; s <= 110; s += 1) {
      const z = zAt(s);
      if (z > cam.z && z < cam.z + 130) {
        layers.push({
          z,
          draw: () => signpost(ctx, cam, pal, HALF + 1.4, z, `${s}TH ST`),
        });
      }
    }
  }

  #drawDecor(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette, d: Decor) {
    const z = zAt(d.s);
    switch (d.kind) {
      case "pond": {
        drawPond(ctx, cam, pal, d.x, z, d.rx, d.rz, this.time, d.s * 3);

        return;
      }

      case "rink": {
        drawRailing(ctx, cam, pal, d.x - 7, z - 12, z + 12, 0.9);
        drawRailing(ctx, cam, pal, d.x + 7, z - 12, z + 12, 0.9);

        return;
      }

      case "railing": {
        drawRailing(ctx, cam, pal, d.x, z, zAt(d.s1), 1.3);

        return;
      }

      case "house": {
        drawHouse(ctx, cam, pal, d.x, z, d.w, d.d, d.h, d.style);

        return;
      }

      case "carousel": {
        drawCarousel(ctx, cam, pal, d.x, z, this.time);

        return;
      }

      case "mall": {
        return;
      }

      case "balto": {
        drawBalto(ctx, cam, pal, d.x, z);

        return;
      }

      case "fountain": {
        drawFountain(ctx, cam, pal, d.x, z, this.time);

        return;
      }

      case "mushroom": {
        drawMushroom(ctx, cam, pal, d.x, z);

        return;
      }

      case "rock": {
        drawRock(ctx, cam, pal, d.x, z, d.w, d.h, d.s);

        return;
      }

      case "sign": {
        signpost(ctx, cam, pal, d.x, z, d.text);
      }
    }
  }

  #decorEnd(d: Decor) {
    const z = zAt(d.s);
    if (d.kind === "mall" || d.kind === "railing") {
      return zAt(d.s1);
    }

    if (d.kind === "house") {
      return z + d.d;
    }

    return z + (d.kind === "pond" ? d.rz : 6);
  }

  #drawMall(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    layers: Array<{ z: number; draw: () => void }>,
    s0: number,
    s1: number,
  ) {
    for (let mz = zAt(s0); mz < zAt(s1); mz += 12) {
      for (const [row, mx] of [-HALF - 3.5, -HALF - 9].entries()) {
        const z = mz + row * 6 + hash(mz + row) * 2;
        if (z < this.z - 1 || z > cam.z + 160) {
          continue;
        }

        const x = mx + (hash(z) - 0.5) * 1.2;
        layers.push({
          z,
          draw: () => tree(ctx, cam, pal, x, z, 2.3 + hash(z * 3) * 0.7, z),
        });
      }
    }
  }

  #drawLandmarks(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    layers: Array<{ z: number; draw: () => void }>,
  ) {
    for (const d of DECOR) {
      const z = zAt(d.s);
      if (this.#decorEnd(d) < cam.z + 1 || z > cam.z + 160) {
        continue;
      }

      layers.push({
        z: d.kind === "pond" ? Infinity : Math.max(z, cam.z + 2),
        draw: () => this.#drawDecor(ctx, cam, pal, d),
      });
    }
  }

  #drawScenery(
    ctx: CanvasRenderingContext2D,
    cam: Cam,
    pal: Palette,
    layers: Array<{ z: number; draw: () => void }>,
  ) {
    this.#drawEdgeTrees(ctx, cam, pal, layers);
    this.#drawLandmarks(ctx, cam, pal, layers);
    for (const t of this.things) {
      const isTall = TALL.has(t.kind);
      const nearest = isTall ? this.z - 1.2 : cam.z + 1;
      if (t.z > nearest && t.z < cam.z + 130) {
        layers.push({ z: t.z, draw: () => this.#drawThing(ctx, cam, pal, t) });
      }
    }

    for (const s of this.sparks) {
      layers.push({
        z: s.z,
        draw: () =>
          puff(ctx, cam, pal, s.x, s.z, 0.12 + s.t * 0.3, (1 - s.t) * 0.5),
      });
    }

    const sq = this.squirrel;
    if (sq != null) {
      layers.push({
        z: sq.z,
        draw: () =>
          drawSquirrel(ctx, cam, pal, sq.x, sq.z, sq.dir < 0, sq.stride),
      });
    }
  }

  get gameSeconds() {
    return this.clock.tick(this.time);
  }

  get miles() {
    return this.z / MILE;
  }

  get score() {
    return Math.round(this.earned) + this.bonus - this.penalty;
  }

  get spare() {
    return Math.max(0, this.clock.seconds - this.time);
  }

  get whistleReady() {
    return this.whistle <= 0;
  }

  steerTo(x: number) {
    this.targetX = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, x));
  }

  steer(dir: number, dt: number) {
    this.steerTo(this.targetX + dir * 9 * dt);
  }

  blow() {
    if (this.over || this.whistle > 0) {
      return;
    }

    this.whistle = WHISTLE_COOLDOWN;
    this.whistled = 2;
    for (const d of this.pack) {
      d.dwell = 0;
    }

    this.emit({ type: "sound", name: "whistle" });
    this.emit({ type: "stamp", text: "Heel!", tone: "note" });
  }

  update(dt: number) {
    if (this.over) {
      return;
    }

    this.time += dt;
    this.whistle = Math.max(0, this.whistle - dt);
    this.whistled = Math.max(0, this.whistled - dt);
    if (this.time >= this.clock.seconds) {
      this.#finish(this.clock.spoken);

      return;
    }

    this.#stepPhase();
    this.#spawn();
    this.#moveThings(dt);
    this.#stepWalker(dt);
    for (const d of this.pack) {
      this.#stepDog(d, dt);
    }

    this.#stepSquirrel(dt);
    this.#stepStray(dt);
    this.earned += this.pack.filter((d) => d.looseT === 0).length * 1.8 * dt;
    for (const s of this.sparks) {
      s.t += dt / s.life;
    }

    this.sparks = this.sparks.filter((s) => s.t < 1);
    if (this.pack.length === 0) {
      this.#finish("Every leash is empty");
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette) {
    const give = borrow(cam, {
      z: this.z - 8,
      x: this.camX,
      rise,
      base: rise(this.z),
      eye: cam.eye + Math.sin(this.stride * 1.1) * 0.02,
    });

    sky(ctx, cam, pal);
    treeline(ctx, cam, pal, HALF + 30, cam.z + 150);
    meadow(ctx, cam, pal, HALF + 14, 130, 8);
    buildings(ctx, cam, pal, HALF + 30, cam.z, cam.z + 150, 13);

    const layers: Array<{ z: number; draw: () => void }> = [];
    this.#drawScenery(ctx, cam, pal, layers);
    for (const d of this.pack) {
      layers.push({ z: d.z, draw: () => this.#drawDog(ctx, cam, pal, d) });
    }

    const hand = handAt(cam, this.x, this.z, this.look);
    layers.push({
      z: this.z,
      draw: () =>
        drawWalker(
          ctx,
          cam,
          pal,
          this.x,
          this.z,
          this.stride,
          (this.targetX - this.x) * 0.04,
          this.look,
        ),
    });

    layers.sort((a, b) => b.z - a.z);
    for (const layer of layers) {
      layer.draw();
    }

    this.#drawLeashes(ctx, cam, pal, hand);
    speedLines(ctx, cam, pal, Math.max(0, (this.speed - 9.5) / 3), this.time);
    give();
  }

  gauges(): Gauges {
    return { ...NO_GAUGES, pack: this.pack.length, whistle: this.whistle };
  }

  summary() {
    return [
      `${count(this.pack.length)} ${this.pack.length === 1 ? "dog" : "dogs"} on the leash at the end, ${count(this.maxPack)} at most`,
      `${this.miles.toFixed(2)} miles, ${count(this.clients)} ${this.clients === 1 ? "client" : "clients"} picked up`,
      `${count(this.snaps)} snapped ${this.snaps === 1 ? "leash" : "leashes"}, ${count(this.rescues)} caught again, ${count(this.lost)} lost`,
    ];
  }

  nudge(dir: -1 | 1) {
    this.steer(dir, 0.12);
  }

  act() {
    this.blow();
  }
}
