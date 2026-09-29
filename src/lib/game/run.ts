import type { Emit } from "$lib/game/events";

export type Gauges = {
  pack: number;
  whistle: number;
  combo: number;
  boost: number;
  shield: boolean;
  magnet: number;
  zoomies: number;
};

export const NO_GAUGES: Gauges = {
  pack: 0,
  whistle: 0,
  combo: 0,
  boost: 0,
  shield: false,
  magnet: 0,
  zoomies: 0,
};

export function award(tags: Set<string>, emit: Emit, tag: string) {
  if (tags.has(tag)) {
    return;
  }

  tags.add(tag);
  emit({ type: "tag", id: tag });
}
