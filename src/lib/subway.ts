// MTA official route colors.
const TRUNK: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ["#ee352e", ["1", "2", "3"]],
  ["#00933c", ["4", "5", "6"]],
  ["#b933ad", ["7"]],
  ["#2850ad", ["A", "C", "E"]],
  ["#ff6319", ["B", "D", "F", "M"]],
  ["#6cbe45", ["G"]],
  ["#996633", ["J", "Z"]],
  ["#a7a9ac", ["L"]],
  ["#fccc0a", ["N", "Q", "R", "W"]],
  ["#808183", ["SF", "SR", "ST", "S"]],
  ["#1f55a5", ["SIR"]],
];

export const ROUTE_COLOR = new Map(
  TRUNK.flatMap(([color, routes]) => routes.map((route) => [route, color])),
);

export function routePaint(fallback: string) {
  return [
    "match",
    ["get", "route"],
    ...TRUNK.flatMap(([color, routes]) => [routes, color]),
    fallback,
  ];
}
