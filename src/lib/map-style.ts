import type {
  FillLayerSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";

const POSITRON_URL = "https://tiles.openfreemap.org/styles/positron";

export const FONT_REGULAR = "Noto Sans Regular";
export const FONT_BOLD = "Noto Sans Bold";
export const FONT_ITALIC = "Noto Sans Italic";

export type Slots = {
  underWater: string | undefined;
  overWater: string | undefined;
};

export type MapTheme = "light" | "dark";

export const MAP_INK = {
  light: {
    paper: "#f5f3ee",
    water: "#ccd7de",
    sand: "#e9e0ca",
    green: "#e7ebe2",
    waterLabel: "#8fa3b0",
    hoodLine: "#ffffff",
    selectedLine: "#221f19",
    label: "#39352f",
    labelHalo: "#fcfcf9",
    selectedLabel: "#191510",
    selectedLabelHalo: "#ffffff",
    parkFill: "#dde3d5",
    parkLine: "#cfd7c6",
    parkLabel: "#6f7d63",
    parkLabelHalo: "#eef1e9",
    builtFill: "#d5d2ca",
    builtLine: "#c5c1b6",
    builtLabel: "#6d675c",
    builtLabelHalo: "#e8e6e0",
    road: "#4a4437",
    street: "#8b8375",
    streetHalo: "#f7f5f0",
    paw: "#4d4436",
    stationFill: "#fffdf8",
    stationRing: "#4a4437",
    stationLabel: "#5f584c",
  },
  dark: {
    paper: "#1b1917",
    water: "#27343d",
    sand: "#31291a",
    green: "#232722",
    waterLabel: "#5d707c",
    hoodLine: "#14120f",
    selectedLine: "#fbf8f2",
    label: "#ddd7cc",
    labelHalo: "#14120f",
    selectedLabel: "#ffffff",
    selectedLabelHalo: "#14120f",
    parkFill: "#20241d",
    parkLine: "#2a2f26",
    parkLabel: "#77836a",
    parkLabelHalo: "#14120f",
    builtFill: "#34322e",
    builtLine: "#403d38",
    builtLabel: "#948c7f",
    builtLabelHalo: "#14120f",
    road: "#efe8d9",
    street: "#8d8577",
    streetHalo: "#16140f",
    paw: "#efe6d4",
    stationFill: "#12100c",
    stationRing: "#c9c0ad",
    stationLabel: "#a49b89",
  },
} as const satisfies Record<MapTheme, Record<string, string>>;

export type Ink = (typeof MAP_INK)[MapTheme];

type Repaint = Parameters<MapLibreMap["setPaintProperty"]>;

const KEEP = new Set([
  "background",
  "park",
  "water",
  "waterway",
  "landcover_wood",
  "road_area_pier",
  "road_pier",
  "highway_minor",
  "highway_major_inner",
  "highway_motorway_inner",
  "highway_motorway_bridge_inner",
  "water_name_point_label",
  "water_name_line_label",
  "highway-name-major",
  "highway-name-minor",
]);

// Positron draws water first; these are re-inserted above the choropleth and under the roads.
const SHORE = new Set(["landcover_sand", "water", "waterway"]);

const OVER_SHORE = new Set([
  "road_area_pier",
  "road_pier",
  "highway_minor",
  "highway_major_inner",
  "highway_motorway_inner",
  "highway_motorway_bridge_inner",
]);

function fade(scale: number, stops: Array<[number, number]>) {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    ...stops.flatMap(([zoom, opacity]) => [zoom, Math.min(1, opacity * scale)]),
  ];
}

function width(...stops: Array<number>) {
  return ["interpolate", ["exponential", 1.35], ["zoom"], ...stops];
}

function recolorFor(theme: MapTheme): Record<string, Record<string, unknown>> {
  const ink = MAP_INK[theme];
  const k = theme === "dark" ? 1.5 : 1;

  return {
    background: { "background-color": ink.paper },
    water: { "fill-color": ink.water, "fill-antialias": true },
    waterway: { "line-color": ink.water },
    park: { "fill-color": ink.green },
    landcover_wood: { "fill-color": ink.green, "fill-opacity": 0.6 },

    /**
     * Not a Positron layer; `beach` adds it below, listed here so `reink` repaints it too.
     */
    landcover_sand: { "fill-color": ink.sand },

    road_area_pier: { "fill-color": ink.paper },
    road_pier: { "line-color": ink.paper, "line-width": width(12, 0.6, 15, 3) },

    highway_motorway_inner: {
      "line-color": ink.road,
      "line-opacity": fade(k, [
        [9.6, 0],
        [11, 0.2],
        [14, 0.34],
      ]),
      "line-width": width(9, 0.5, 12, 1.1, 15, 2.4),
    },
    highway_motorway_bridge_inner: {
      "line-color": ink.road,
      "line-opacity": fade(k, [
        [9.6, 0],
        [11, 0.2],
        [14, 0.34],
      ]),
      "line-width": width(9, 0.5, 12, 1.1, 15, 2.4),
    },
    highway_major_inner: {
      "line-color": ink.road,
      "line-opacity": fade(k, [
        [10.5, 0],
        [12, 0.16],
        [15, 0.28],
      ]),
      "line-width": width(10, 0.3, 12, 0.7, 15, 1.6),
    },
    highway_minor: {
      "line-color": ink.road,
      "line-opacity": fade(k, [
        [12.6, 0],
        [14, 0.1],
        [15, 0.18],
      ]),
      "line-width": width(13, 0.3, 15, 0.9),
    },
    water_name_point_label: {
      "text-color": ink.waterLabel,
      "text-halo-color": ink.water,
      "text-halo-width": 1,
    },
    water_name_line_label: {
      "text-color": ink.waterLabel,
      "text-halo-color": ink.water,
      "text-halo-width": 1,
    },

    "highway-name-major": {
      "text-color": ink.street,
      "text-halo-color": ink.streetHalo,
      "text-halo-width": 1.1,
      "text-opacity": fade(1, [
        [12.4, 0],
        [13.4, 0.85],
      ]),
    },
    "highway-name-minor": {
      "text-color": ink.street,
      "text-halo-color": ink.streetHalo,
      "text-halo-width": 1.1,
      "text-opacity": fade(1, [
        [14.6, 0],
        [15, 0.75],
      ]),
    },
  };
}

// Filter on subclass: class "sand" also covers sandpits and ball fields inside parks.
function beach(wood: FillLayerSpecification, ink: Ink): FillLayerSpecification {
  return {
    ...wood,
    id: "landcover_sand",
    filter: [
      "all",
      ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false],
      ["==", ["get", "subclass"], "beach"],
    ],
    paint: { "fill-color": ink.sand },
  };
}

export type BaseStyle = { style: StyleSpecification; slots: Slots };

const cache: { source: Promise<StyleSpecification> | null } = { source: null };

async function readSource(fetcher: typeof fetch) {
  const response = await fetcher(POSITRON_URL);
  if (!response.ok) {
    cache.source = null;
    throw new Error(`Could not load the basemap (${response.status}).`);
  }

  return (await response.json()) as StyleSpecification;
}

async function fetchSource(fetcher: typeof fetch) {
  cache.source ??= readSource(fetcher);

  return cache.source;
}

export async function loadBaseStyle(
  theme: MapTheme,
  fetcher: typeof fetch = fetch,
): Promise<BaseStyle> {
  const source = await fetchSource(fetcher);
  const recolor = recolorFor(theme);

  const layers: Array<LayerSpecification> = [];
  const shore: Array<LayerSpecification> = [];
  for (const layer of source.layers) {
    if (!KEEP.has(layer.id)) {
      continue;
    }

    const next = { ...layer };
    const patch = recolor[layer.id];
    if (patch != null) {
      next.paint = { ...next.paint, ...patch };
    }

    (SHORE.has(layer.id) ? shore : layers).push(next);
  }

  const wood = layers.find((layer) => layer.id === "landcover_wood");
  if (wood?.type === "fill") {
    shore.unshift(beach(wood, MAP_INK[theme]));
  }

  const seam = layers.findIndex((layer) => OVER_SHORE.has(layer.id));
  layers.splice(seam === -1 ? layers.length : seam, 0, ...shore);

  const used = new Set(
    layers.map((layer) => ("source" in layer ? layer.source : undefined)),
  );
  const sources: StyleSpecification["sources"] = {};
  for (const [id, spec] of Object.entries(source.sources)) {
    if (used.has(id)) {
      sources[id] = spec;
    }
  }

  const symbols = layers.find((layer) => layer.type === "symbol")?.id;

  return {
    style: { ...source, sources, layers },
    slots: { underWater: shore[0]?.id ?? symbols, overWater: symbols },
  };
}

/**
Paint properties only; `setStyle` would drop and rebuild every layer this app added.
*/
export function reink(map: MapLibreMap, theme: MapTheme) {
  const recolor = recolorFor(theme);

  for (const [id, patch] of Object.entries(recolor)) {
    if (map.getLayer(id) == null) {
      continue;
    }

    for (const [key, value] of Object.entries(patch)) {
      map.setPaintProperty(id, key as Repaint[1], value as Repaint[2]);
    }
  }
}
