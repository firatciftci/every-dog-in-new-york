import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import type { Rival } from "#lib/compare.js";
import type { System } from "#lib/rail.js";

export type HoodProperties = {
  slug: string;
  name: string;
  nta: string;
  area_mi2: number;
  borough: string;
  dogs: number;
  people: number;
  homes: number;
  dogs_per_1k: number;
  dogs_per_100_homes: number;
  density: number;
  complaints: number;
  complaints_barking: number;
  complaints_waste: number;
  complaints_leash: number;
  complaints_per_100_dogs: number;
  median_age: number | null;
  top_breed: string | null;
  top_breed_share: number;
  top_name: string | null;
  top_name_share: number;
  distinct_name: string | null;
  distinct_name_lift: number;
  distinct_breed: string | null;
  distinct_breed_lift: number;
  lon: number;
  lat: number;
};

export type PaintedProperties = HoodProperties & {
  fill: string;
  valueLabel: string;
  tone: string | null;
  dim: boolean;
};

export type HoodCollection = FeatureCollection<
  Polygon | MultiPolygon,
  HoodProperties
>;

export type PaintedCollection = FeatureCollection<
  Polygon | MultiPolygon,
  PaintedProperties
>;

export type ParkCollection = FeatureCollection<
  Polygon | MultiPolygon,
  { name: string; kind: string; mi2: number; lon: number; lat: number }
>;

export type LabelCollection<P> = FeatureCollection<Point, P>;

export type HoodLabels = LabelCollection<{
  slug: string;
  name: string;
  short: string;
  rank: number;
  plate: string;
  value: string;
}>;

export type BoroughLabels = LabelCollection<{ name: string }>;

export type ParkLabels = LabelCollection<{
  name: string;
  kind: string;
  mi2: number;
}>;

export type SubwayLines = FeatureCollection<
  LineString | MultiLineString,
  { route: string; name: string }
>;

export type SubwayStations = FeatureCollection<
  Point,
  { name: string; routes: string }
>;

export type RailLines = FeatureCollection<
  LineString | MultiLineString,
  { system: System; route: string; bullet: string; name: string }
>;

export type RailStations = FeatureCollection<
  Point,
  { system: System; name: string; city: number }
>;

export type Rider = {
  slug: string;
  hood: string;
  borough: string;
  lon: number;
  lat: number;
  breed: string;
  plate: string;
  names: Array<string>;
};

export type DogScatter = FeatureCollection<Point, { slug: string }>;

type Tally = { label: string; est: number };

type Ranked = Tally & { lift: number };

export type Ordered = { common: Array<Ranked>; distinct: Array<Ranked> };

export type HoodDetail = {
  names: Ordered;
  breeds: Ordered;
  zips: Array<{ zip: string; dogs: number; share: number }>;
};

export type Matrix = {
  slugs: Array<string>;
  names: Record<string, Array<number>>;
  breeds: Record<string, Array<number>>;
  dogs: Array<number>;
};

export type Summary = {
  extract_year: string;
  licenses: number;
  breed_unknown: number;
  licenses_placed: number;
  licenses_unallocated: number;
  neighborhoods: number;
  zips_in_data: number;
  zips_matched: number;
  residential_units: number;
  city_top_names: Array<Tally>;
  city_top_breeds: Array<Tally>;
  max_dogs: number;
  max_density: number;
  people: number;
  homes: number;
  median_age: number;
  complaints: number;
  complaints_placed: number;
  complaints_through: string;
  split_error: number;
  split_error_flat: number;
  lapse_occasions: Array<string>;
  lapse_cohort_births: Array<number>;
  lapse_dogs_seen: number;
  lapse_holding_now: number;
  lapse_ratio: number;
  lapse_ratio_common_names: number;
  lapse_ratio_rare_names: number;
};

export type Detent = "shut" | "peek" | "full";

export type SheetGrip = { step: () => void; detent: Detent; label: string };

export type Shelter = {
  slug: string;
  name: string;
  org: string;
  borough: string;
  address: string;
  phone: string;
  site: string | null;
  /**
   * Query verified to open the shelter's own Google Maps card; null falls back to coordinates.
   */
  maps: string | null;
  hood: string;
  lon: number;
  lat: number;
  note: string;
};

export type Facet = "breeds" | "names";

export const FACETS = [
  "breeds",
  "names",
] as const satisfies ReadonlyArray<Facet>;

export const FACET_FIELDS = {
  breeds: {
    noun: "breed",
    top: "top_breed",
    share: "top_breed_share",
    distinct: "distinct_breed",
    lift: "distinct_breed_lift",
  },
  names: {
    noun: "name",
    top: "top_name",
    share: "top_name_share",
    distinct: "distinct_name",
    lift: "distinct_name_lift",
  },
} as const;

export type CatKey = (typeof FACET_FIELDS)[Facet]["top" | "distinct"];

export type CategoryField = "borough" | CatKey;

export type LayerId =
  | "breed"
  | "distinct-breed"
  | "name"
  | "distinct-name"
  | "density"
  | "dogs"
  | "per-home"
  | "per-person"
  | "complaints";

export type Focus = { facet: Facet; label: string };

export type View =
  | { kind: "layer"; layer: LayerId }
  | { kind: "focus"; focus: Focus }
  | { kind: "bout"; rivals: ReadonlyArray<Rival> };

export type Lightbox = { breed: string; at: number; from: DOMRect };

export type Pointing = { field: "slug" | CategoryField; value: string };

export type Readout = { headline: string; sub: string };

export type PointerAt = { x: number; y: number };

export type OnHover = (slug: string | null, at: PointerAt | null) => void;
