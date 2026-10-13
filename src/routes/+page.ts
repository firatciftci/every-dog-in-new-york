import type {
  DogScatter,
  HoodCollection,
  HoodDetail,
  Matrix,
  ParkCollection,
  RailLines,
  RailStations,
  Shelter,
  Stories,
  SubwayLines,
  SubwayStations,
  Summary,
} from "#lib/types.js";
import { fetchJson, fetchTopology } from "#lib/data.js";
import { timed } from "#lib/stories.js";
import type { PageLoad } from "./$types";

const SUBWAY = "/data/subway.topo.json";
const RAIL = "/data/rail.topo.json";

export const load: PageLoad = async ({ fetch }) => {
  const [
    hoods,
    parks,
    subway,
    stations,
    rail,
    railStops,
    dogs,
    details,
    matrix,
    summary,
    shelters,
    stories,
  ] = await Promise.all([
    fetchTopology<HoodCollection>(fetch, "/data/neighborhoods.topo.json"),
    fetchTopology<ParkCollection>(fetch, "/data/parks.topo.json"),
    fetchTopology<SubwayLines>(fetch, SUBWAY, "subway_lines"),
    fetchTopology<SubwayStations>(fetch, SUBWAY, "subway_stations"),
    fetchTopology<RailLines>(fetch, RAIL, "rail_lines"),
    fetchTopology<RailStations>(fetch, RAIL, "rail_stations"),
    fetchJson<DogScatter>(fetch, "/data/dogs.json"),
    fetchJson<Record<string, HoodDetail>>(fetch, "/data/details.json"),
    fetchJson<Matrix>(fetch, "/data/matrix.json"),
    fetchJson<Summary>(fetch, "/data/summary.json"),
    fetchJson<Array<Shelter>>(fetch, "/data/shelters.json"),
    fetchJson<Stories>(fetch, "/data/stories.json"),
  ]);

  return {
    hoods: timed(hoods, stories),
    parks,
    subway,
    stations,
    rail,
    railStops,
    dogs,
    details,
    matrix,
    summary,
    shelters,
    stories,
  };
};
