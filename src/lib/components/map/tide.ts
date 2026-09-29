import type {
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
} from "geojson";

export type SunkShapes = FeatureCollection<
  Polygon | MultiPolygon,
  GeoJsonProperties
>;

/**
 * Kept out of sink-layer.svelte: ESLint's type program cannot read named exports from .svelte files.
 */
export const SWELL = 2000;
