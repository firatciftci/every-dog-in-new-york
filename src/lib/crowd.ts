/**
 * The messages between a reader's page and the City Durable Object in `worker/index.ts`.
 * Nothing here runs in either place, so both can import it.
 */

export type Shown = {
  name: string | null;
  breed: string;
  slug: string;
  collar: string;
};

export type Ride = {
  dog: number;
  route: string;
  sign: string;
  at: number;
  next: number;
  speed: number;
};

export type Kind = "sniff" | "ball" | "bark";

export type Peer = { id: string; dogs: Array<Shown>; ride: Ride | null };

export type Told =
  | { t: "dogs"; dogs: Array<Shown> }
  | { t: "ride"; ride: Ride | null }
  | { t: "ping"; to: string; dog: number; kind: Kind; from: number | null };

export type Heard =
  | { t: "all"; you: string; peers: Array<Peer> }
  | { t: "up"; peers: Array<Peer>; gone: Array<string> }
  | { t: "ping"; dog: number; kind: Kind; from: Shown | null };
