export type ParkId = "central" | "prospect";

export type Park = {
  id: ParkId;
  name: string;
  lon: number;
  lat: number;
  title: string;
  brief: string;
  cta: string;
  startMinute: number;
  how: Array<{ do: string; key: string }>;
  fact: string;
};

type Rank = { at: number; name: string };

export type Tag = { id: string; name: string; how: string };

export type Conditions = { id: string; name: string; note: string };

export type Kennel = {
  best: Record<ParkId, number>;
  tags: Record<ParkId, Array<string>>;
  plays: Record<ParkId, number>;
  streak: { last: string; count: number };
  dog: string;
};

export const PARKS: Record<ParkId, Park> = {
  central: {
    id: "central",
    name: "Central Park",
    lon: -73.97225,
    lat: 40.7733,
    title: "Eight Leashes",
    brief:
      "Walk as many dogs as you can before the leashes go back on at the top of the hour. More dogs means more points. Beagles trail hot dog carts, terriers chase squirrels, Huskies pull, and Chihuahuas stop at hydrants.",
    cta: "Grab the leashes",
    startMinute: 57,
    how: [
      {
        do: "Steer with one thumb or the arrow keys, and the pack follows",
        key: "",
      },
      {
        do: "Keep every dog on your side of trees and lampposts. If a leash hooks, go around before it snaps",
        key: "",
      },
      {
        do: "Reach a loose dog within six seconds to get it back on the leash",
        key: "",
      },
      {
        do: "Walk past a client to take another dog. Whistle to pull the pack tight",
        key: "Space whistles",
      },
    ],
    fact: "New York City sets no limit on how many dogs one walker can take, and you can see walkers with ten dogs crossing 72nd Street. When off-leash hours end, every dog in the park goes back on the leash.",
  },
  prospect: {
    id: "prospect",
    name: "Prospect Park",
    lon: -73.96966,
    lat: 40.66288,
    title: "The Long Meadow dash",
    brief:
      "Dog Beach is nearly a mile down the Long Meadow, and the leashes go back on at the top of the hour. Run, jump, and grab tennis balls on the way. Bagels and bones help you reach the water in time, and every tumble costs points.",
    cta: "Run for the water",
    startMinute: 58,
    how: [
      { do: "Swipe or tap either side to change lanes", key: "Arrow keys" },
      {
        do: "Tap to jump picnic blankets, benches, geese, hydrants, sleeping dogs, and puddles",
        key: "Space jumps",
      },
      {
        do: "Sidestep strollers, hot dog carts, joggers, and Citi Bikes. Run under a frisbee, and jump over rats",
        key: "",
      },
      {
        do: "Grab tennis balls to run faster. A bone takes one hit, a bagel is a speed burst, a can of balls pulls balls in, and a squeaky toy makes you unstoppable for a few seconds",
        key: "",
      },
    ],
    fact: "The Long Meadow runs close to a mile past the Picnic House and the Tennis House, one of the longest unbroken meadows in an American park. At the Upper Pool, Dog Beach lets dogs off the leash.",
  },
};

const RANKS: Record<ParkId, Array<Rank>> = {
  central: [
    { at: 0, name: "Puppy sitter" },
    { at: 450, name: "Dog walker" },
    { at: 850, name: "Pack leader" },
    { at: 1250, name: "Upper East Side legend" },
    { at: 1600, name: "Best in show" },
  ],
  prospect: [
    { at: 0, name: "Puppy legs" },
    { at: 450, name: "Good dog" },
    { at: 800, name: "Long Meadow local" },
    { at: 1150, name: "Meadow royalty" },
    { at: 1500, name: "Best in show" },
  ],
};

export const TAGS: Record<ParkId, Array<Tag>> = {
  central: [
    { id: "hands", name: "Full hands", how: "Hold eight dogs at once" },
    {
      id: "nosnap",
      name: "Not one snap",
      how: "Finish with five or more dogs and no snapped leash",
    },
    { id: "rescue", name: "Come back here", how: "Catch three loose dogs" },
    {
      id: "husky",
      name: "Husky express",
      how: "Hit top speed with a puller on the leash",
    },
    { id: "squirrel", name: "Squirrel-proof", how: "Survive six squirrels" },
    {
      id: "clients",
      name: "Fully booked",
      how: "Take on six clients in one morning",
    },
    { id: "mile", name: "The walker's mile", how: "Cover a mile before nine" },
    { id: "show", name: "Best in show", how: "Reach the top rank" },
  ],
  prospect: [
    { id: "clean", name: "Clean run", how: "Reach the water without a tumble" },
    { id: "hog", name: "Ball hog", how: "Pick up 25 tennis balls" },
    { id: "stylish", name: "Stylish", how: "Grab five balls in mid-air" },
    {
      id: "cannonball",
      name: "Cannonball",
      how: "Hit the water at full speed",
    },
    {
      id: "early",
      name: "Early bird",
      how: "Reach the beach with 12 seconds to spare",
    },
    { id: "geese", name: "Goose whisperer", how: "Clear six geese in one run" },
    { id: "shield", name: "Good bone", how: "Let a bone take a hit for you" },
    { id: "rat", name: "Rat dodger", how: "Clear four rats in one run" },
    { id: "gold", name: "Gold rush", how: "Pick up three gold balls" },
    { id: "show", name: "Best in show", how: "Reach the top rank" },
  ],
};

const CONDITIONS: Record<ParkId, Array<Conditions>> = {
  central: [
    {
      id: "clear",
      name: "A clear drive",
      note: "Nothing out of the ordinary on the East Drive.",
    },
    {
      id: "squirrels",
      name: "Squirrel season",
      note: "Twice the squirrels, and the terriers and the Pit Bull are lunging.",
    },
    {
      id: "wet",
      name: "Wet grass",
      note: "More puddles along the drive, and a wet dog costs more.",
    },
    {
      id: "carts",
      name: "Carts out",
      note: "More hot dog carts, and the sniffers pull harder.",
    },
    {
      id: "strays",
      name: "Loose dog hour",
      note: "Loose dogs show up twice as often.",
    },
  ],
  prospect: [
    {
      id: "clear",
      name: "A clear meadow",
      note: "Nothing unusual across the meadow.",
    },
    {
      id: "geese",
      name: "Geese everywhere",
      note: "More geese across the meadow than usual.",
    },
    {
      id: "sprinklers",
      name: "Sprinklers on",
      note: "The sprinklers are on, so there is more to jump.",
    },
    {
      id: "runners",
      name: "Run club",
      note: "More joggers are out, and running faster.",
    },
    { id: "rats", name: "Rat hour", note: "More rats, and quicker." },
  ],
};

export function conditionsOf(id: ParkId, seed: number): Conditions {
  const list = CONDITIONS[id];

  return list[Math.floor(rng(seed)() * list.length)] ?? list[0]!;
}

export function parkOf(name: string): ParkId | null {
  for (const park of Object.values(PARKS)) {
    if (park.name === name) {
      return park.id;
    }
  }

  return null;
}

export function rankOf(id: ParkId, score: number) {
  const ladder = RANKS[id];
  let index = 0;
  for (const [i, rank] of ladder.entries()) {
    if (score >= rank.at) {
      index = i;
    }
  }

  return {
    index,
    name: ladder[index]?.name ?? "",
    next: ladder[index + 1] ?? null,
  };
}

export function yesterdayKey() {
  const now = new Date();
  now.setDate(now.getDate() - 1);

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function todayKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function prettyDay(key: string) {
  const [y = 2026, m = 1, d = 1] = key.split("-").map(Number);

  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export function seedOf(text: string) {
  let h = 2_166_136_261;
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16_777_619);
  }

  return h >>> 0;
}

/**
mulberry32: one seed gives the same morning to everyone who plays it.
*/
export function rng(seed: number) {
  let a = seed >>> 0;

  return () => {
    a = (a + 1_831_565_813) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function shareText(
  id: ParkId,
  score: number,
  lines: Array<string>,
  when: string,
  conditions: string,
) {
  const park = PARKS[id];
  const rank = rankOf(id, score).name;

  return [
    `${park.title} · Every Dog in New York`,
    `${when} · ${conditions} · ${score.toLocaleString("en-US")} points · ${rank}`,
    ...lines,
    `everydog.nyc/?play=${id}`,
  ].join("\n");
}

export const RUNNERS = new Set([
  "Labrador (or Crossbreed)",
  "Yorkshire Terrier",
  "Shih Tzu",
  "Pit Bull (or Mix)",
  "Chihuahua",
  "Poodle",
  "Maltese",
  "French Bulldog",
  "Pomeranian",
  "Havanese",
  "German Shepherd Dog",
  "Beagle",
  "Dachshund",
  "Pug",
]);
