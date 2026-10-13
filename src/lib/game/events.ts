import type { SoundName } from "./sound.svelte";

export type Tone = "good" | "plain" | "bad" | "note";

export type GameEvent =
  | { type: "stamp"; text: string; tone: Tone }
  | { type: "shout"; text: string; tone: Tone }
  | { type: "banner"; text: string }
  | { type: "say"; text: string }
  | { type: "sound"; name: SoundName }
  | { type: "tag"; id: string }
  | { type: "over" };

export type Emit = (event: GameEvent) => void;
