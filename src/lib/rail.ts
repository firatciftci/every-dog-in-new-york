export type System = "subway" | "lirr" | "mnr" | "path" | "njt" | "amtrak";

export const RAILROAD: Record<System, { name: string }> = {
  subway: { name: "New York City Subway" },
  lirr: { name: "Long Island Rail Road" },
  mnr: { name: "Metro-North Railroad" },
  path: { name: "Port Authority Trans-Hudson" },
  njt: { name: "NJ Transit" },
  amtrak: { name: "Amtrak" },
};

const RAIL_INK: Record<string, string> = {
  "lirr:CTZ": "#4d5357",
  "lirr:PWS": "#c60c30",
  "lirr:FRY": "#6e3219",
  "lirr:BAB": "#00985f",
  "lirr:MTK": "#00b2a9",
  "lirr:RON": "#a626aa",
  "lirr:PJN": "#006ec7",
  "lirr:HEM": "#ce8e00",
  "lirr:WHD": "#00a1de",
  "lirr:LBH": "#ff6319",
  "lirr:OBY": "#00af3f",
  "lirr:CEN": "#4d5357",

  "mnr:HUD": "#009b3a",
  "mnr:HAR": "#0039a6",
  "mnr:NHV": "#e00034",

  "path:NWK": "#ef3941",
  "path:HOB": "#009e58",
  "path:JSQ": "#fdb827",
  "path:H33": "#0082c6",

  "njt:MNB": "#e66b5b",
  "njt:NEC": "#ef3e42",
  "njt:MOE": "#00a94f",

  "amtrak:NEC": "#123a63",
  "amtrak:EMP": "#123a63",
};

export function railColor(system: System, route: string, fallback: string) {
  return RAIL_INK[`${system}:${route}`] ?? fallback;
}

const LANE: Record<System, number> = {
  subway: 0,
  lirr: 1,
  mnr: 0,
  path: 1,
  njt: 0,
  amtrak: -1,
};

// A zoom expression is only legal as input to a top-level step/interpolate, so the ramp is outermost.
const LANE_PX: ReadonlyArray<[number, number]> = [
  [9, 0.7],
  [12, 1.5],
  [15, 2.8],
];

export function railOffset() {
  const lane = [
    "match",
    ["get", "system"],
    ...Object.entries(LANE).flatMap(([system, slot]) => [[system], slot]),
    0,
  ];

  return [
    "interpolate",
    ["exponential", 1.4],
    ["zoom"],
    ...LANE_PX.flatMap(([zoom, gap]) => [zoom, ["*", lane, gap]]),
  ];
}

export function railPaint(fallback: string) {
  return [
    "match",
    ["concat", ["get", "system"], ":", ["get", "route"]],
    ...Object.entries(RAIL_INK).flatMap(([key, color]) => [[key], color]),
    fallback,
  ];
}

export const SIGN_AS: Record<string, string> = {
  "New York Penn Station": "New York",
  "Journal Square Transportation Center": "Journal Square",
  "Montclair State University": "Montclair State",
  "Hoboken Terminal": "Hoboken",
  "Flushing Main Street": "Flushing",
  "Wayne Route 23 Transit Center": "Wayne",
  "Newark Liberty Airport": "Newark Airport",
  "Newark Penn Station": "Newark",
};

export const FAR_SIGN: Record<string, string> = {
  "amtrak:NEC": "Washington",
  "amtrak:EMP": "Albany",
};

const HELD: Record<System, ReadonlyArray<string>> = {
  subway: [
    "sniffing investigation on the platform",
    "squirrel reported on the roadbed",
    "a very good boy is holding the doors",
    "unscheduled belly rub in the last car",
    "waiting for a transferring beagle",
    "dropped treat between the cars",
    "leash caught in the doors",
    "we are being held by a corgi",
    "tennis ball on the express track",
    "conductor is handing out biscuits",
    "puppy needs a moment",
    "signal problems, and one loud husky",
    "two dachshunds counted as one dog",
    "greyhound got on the local by mistake",
  ],

  lirr: [
    "held at Jamaica for a train that is also held at Jamaica",
    "six cars where twelve were promised, and four of them are retriever",
    "a labrador is standing in the vestibule and will not be moved",
    "waiting for the eastbound so a corgi can change at Jamaica",
    "the conductor cannot punch a ticket that is being held in a mouth",
    "the bar car is gone and a golden retriever wants to discuss it",
    "Penn Station has not given us a track yet",
    "somebody's puppy has the window seat and intends to keep it",
    "train ahead of us, and a wolfhound in the aisle",
    "please step all the way in, there is room behind the great dane",
  ],

  mnr: [
    "leaves on the rail past Botanical Garden",
    "a deer is on the track and a hound has strong opinions about it",
    "quiet car dispute, two terriers, ongoing",
    "waiting on a signal at Woodlawn",
    "everyone has moved to the river side to look at the water",
    "the dog in seat four has not stopped watching the Hudson",
    "held outside Grand Central behind a train nobody can see",
    "a beagle boarded at Fordham and has been talking since",
    "third rail ice, and a shepherd who is unbothered by it",
  ],

  path: [
    "single tracking through the tube",
    "held at Grove Street for the train ahead",
    "a dachshund is short and the platform gap is not",
    "the Journal Square dispatcher is petting something",
    "doors held at Christopher Street for one very slow bulldog",
    "the escalator at 33rd Street is out and a corgi is thinking it over",
    "waiting for the tunnel, along with everybody else",
    "a whippet ran the length of the train and back",
    "this is a Hoboken train, and the dog wanted Newark",
  ],

  njt: [
    "Amtrak is holding us at a red signal outside Penn",
    "the Portal Bridge is open and a swan is taking its time",
    "overhead wire trouble, and one schnauzer who heard it happen",
    "held at Secaucus while a dog decides which level to sit on",
    "the upper level is entirely retriever",
    "waiting on equipment, which is somewhere near the Meadowlands",
    "the conductor is three cars back and moving slowly, on account of a puppy",
    "police activity at Newark Broad Street, described as one loose beagle",
  ],

  amtrak: [
    "freight interference, which is a phrase meaning a train nobody can see",
    "the cafe car has run out of everything except the pretzels",
    "held outside Penn for a platform, along with four other trains",
    "a dog in business class has been upgraded and knows it",
    "speed restriction over the Hell Gate Bridge, and one nervous whippet",
    "running about forty minutes behind, and we thank you for your patience",
    "the conductor is looking for the ticket of a dog who has eaten it",
    "engine change at Newark, and everybody has gone to look at it",
    "waiting on a crew, and on one bloodhound who is very much crew-adjacent",
  ],
};

const MONTCLAIR_HELD: ReadonlyArray<string> = [
  "a goldfinch is riding on the roof and will not be hurried",
  "held at Bay Street while a dog finishes a bagel",
  "the whole car smells like the Walnut Street farmers market",
  "somebody's greyhound got off at Upper Montclair by mistake",
  "waiting at Watchung Avenue on a very determined squirrel",
  "every dog on board is looking at the same tree",
  "the engineer stopped to say hello to a dog she knows",
  "leaf blower at Mountain Avenue, and eleven dogs objecting",
  "a Montclair State freshman is asking the beagle for directions",
  "held for a dog who has spotted the reservoir",
];

const MONTCLAIR_STOPS: ReadonlySet<string> = new Set([
  "Bay Street",
  "Walnut Street",
  "Watchung Avenue",
  "Upper Montclair",
  "Mountain Avenue",
  "Montclair Heights",
  "Montclair State University",
]);

export function delaysFor(system: System, station: string) {
  return MONTCLAIR_STOPS.has(station) ? MONTCLAIR_HELD : HELD[system];
}

export function inkOn(color: string) {
  const packed = Number.parseInt(color.slice(1), 16);
  const red = (packed >> 16) & 255;
  const green = (packed >> 8) & 255;
  const blue = packed & 255;

  return (red * 299 + green * 587 + blue * 114) / 1000 > 150
    ? "#16181a"
    : "#ffffff";
}
