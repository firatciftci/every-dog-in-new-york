import { DurableObject } from "cloudflare:workers";
import type { Heard, Kind, Peer, Ride, Shown } from "#lib/crowd.js";

const ORIGINS = /^(?:https?:\/\/everydog\.nyc|http:\/\/localhost:\d+)$/;
const FULL = 5000;
const MOST_DOGS = 5;
const LONGEST = 4096;
const FLUSH = 400;
const BURST = 12;
const REFILL = 2;
const COLLARS = new Set(["red", "blue", "green", "pink", "gold"]);
const KINDS = new Set<unknown>(["sniff", "ball", "bark"] satisfies Array<Kind>);
const PAIR_GAP = 30_000;
const SENT = { burst: 4, refill: 1 / 15 };
const HEARD = { burst: 3, refill: 1 / 10 };
const MIXED = "Mixed breed";

type Lists = { names: Set<string>; breeds: Set<string>; slugs: Set<string> };

type Tag = { peer: Peer; kept: Array<number> };

type Bucket = { tokens: number; at: number };

function take(
  buckets: Map<string, Bucket>,
  id: string,
  burst: number,
  refill: number,
) {
  const now = Date.now();
  const bucket = buckets.get(id) ?? { tokens: burst, at: now };
  bucket.tokens = Math.min(
    burst,
    bucket.tokens + ((now - bucket.at) / 1000) * refill,
  );
  bucket.at = now;
  if (bucket.tokens < 1) {
    buckets.set(id, bucket);

    return false;
  }

  bucket.tokens -= 1;
  buckets.set(id, bucket);

  return true;
}

async function load(assets: Fetcher): Promise<Lists> {
  const [names, cells] = await Promise.all([
    assets.fetch("https://assets.local/data/names.json"),
    assets.fetch("https://assets.local/data/matrix.json"),
  ]);
  const everyone = await names.json<{ names: Record<string, number> }>();
  const matrix = await cells.json<{
    slugs: Array<string>;
    breeds: Record<string, unknown>;
  }>();

  return {
    names: new Set(Object.keys(everyone.names)),
    breeds: new Set([...Object.keys(matrix.breeds), MIXED]),
    slugs: new Set(matrix.slugs),
  };
}

function shownOf(raw: unknown, known: Lists): Shown | null {
  if (typeof raw !== "object" || raw == null) {
    return null;
  }

  const { name, breed, slug, collar } = raw as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    typeof breed !== "string" ||
    typeof slug !== "string" ||
    typeof collar !== "string" ||
    !known.breeds.has(breed) ||
    !known.slugs.has(slug) ||
    !COLLARS.has(collar)
  ) {
    return null;
  }

  const upper = name.trim().toUpperCase();
  const key = upper.slice(0, 1) + upper.slice(1).toLowerCase();

  return { name: known.names.has(key) ? key : null, breed, slug, collar };
}

function rideOf(raw: unknown, kept: Array<number>): Ride | null | undefined {
  if (raw === null) {
    return null;
  }

  if (typeof raw !== "object") {
    return undefined;
  }

  const { dog, route, sign, at, next, speed } = raw as Record<string, unknown>;
  if (
    typeof dog !== "number" ||
    typeof route !== "string" ||
    typeof sign !== "string" ||
    typeof at !== "number" ||
    typeof next !== "number" ||
    typeof speed !== "number" ||
    !kept.includes(dog) ||
    !/^[A-Z\d]{1,3}$/.test(route) ||
    sign.length > 80 ||
    !Number.isSafeInteger(next) ||
    next < 0 ||
    next > 400 ||
    !Number.isFinite(at) ||
    at < 0 ||
    at > 200_000 ||
    !Number.isFinite(speed) ||
    speed < 0 ||
    speed > 5000
  ) {
    return undefined;
  }

  return { dog: kept.indexOf(dog), route, sign, at, next, speed };
}

export class City extends DurableObject<Env> {
  #changed = new Set<string>();
  #gone = new Set<string>();
  #flushing: ReturnType<typeof setTimeout> | null = null;
  #spent = new Map<string, Bucket>();
  #sent = new Map<string, Bucket>();
  #heard = new Map<string, Bucket>();
  #greeted = new Map<string, number>();
  #lists: Promise<Lists> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async #known() {
    this.#lists ??= load(this.env.ASSETS);
    try {
      return await this.#lists;
    } catch (error) {
      this.#lists = null;
      throw error;
    }
  }

  #ping(ws: WebSocket, told: Record<string, unknown>) {
    const { to, dog, kind, from } = told;
    const { peer, kept } = ws.deserializeAttachment() as Tag;
    const now = Date.now();
    if (
      typeof to !== "string" ||
      typeof dog !== "number" ||
      !KINDS.has(kind) ||
      (from !== null && typeof from !== "number") ||
      to === peer.id ||
      now - (this.#greeted.get(`${peer.id}>${to}`) ?? 0) < PAIR_GAP
    ) {
      return;
    }

    const [target] = this.ctx.getWebSockets(to);
    const there = target?.deserializeAttachment() as Tag | undefined;
    const at = there?.kept[dog];
    if (
      target == null ||
      at === undefined ||
      !take(this.#sent, peer.id, SENT.burst, SENT.refill) ||
      !take(this.#heard, to, HEARD.burst, HEARD.refill)
    ) {
      return;
    }

    this.#greeted.set(`${peer.id}>${to}`, now);
    const back = from === null ? -1 : kept.indexOf(from);
    const heard: Heard = {
      t: "ping",
      dog: at,
      kind: kind as Kind,
      from: peer.dogs[back] ?? null,
      by: peer.id,
      back: back === -1 ? null : back,
    };
    try {
      target.send(JSON.stringify(heard));
    } catch {
      // The target is closing; the sender sees them leave on the next update.
    }
  }

  #schedule() {
    this.#flushing ??= setTimeout(() => {
      this.#flushing = null;
      this.#flush();
    }, FLUSH);
  }

  #flush() {
    const sockets = this.ctx.getWebSockets();
    const peers: Array<Peer> = [];
    for (const ws of sockets) {
      const { peer } = ws.deserializeAttachment() as Tag;
      if (this.#changed.has(peer.id)) {
        peers.push(peer);
      }
    }

    const heard: Heard = { t: "up", peers, gone: [...this.#gone] };
    const message = JSON.stringify(heard);
    this.#changed.clear();
    this.#gone.clear();

    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch {
        // A socket mid-close throws on send, and its own close event cleans it up.
      }
    }
  }

  override fetch(): Response {
    const open = this.ctx.getWebSockets();
    if (open.length >= FULL) {
      return new Response("The map is full", { status: 503 });
    }

    const [client, server] = Object.values(new WebSocketPair()) as [
      WebSocket,
      WebSocket,
    ];
    const id = crypto.randomUUID().slice(0, 8);
    const tag: Tag = { peer: { id, dogs: [], ride: null }, kept: [] };

    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment(tag);

    const peers: Array<Peer> = [];
    for (const ws of open) {
      const { peer } = ws.deserializeAttachment() as Tag;
      if (peer.dogs.length > 0) {
        peers.push(peer);
      }
    }

    const heard: Heard = { t: "all", you: id, peers };
    server.send(JSON.stringify(heard));

    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const { id } = (ws.deserializeAttachment() as Tag).peer;
    if (
      typeof raw !== "string" ||
      raw.length > LONGEST ||
      !take(this.#spent, id, BURST, REFILL)
    ) {
      ws.close(1008, "Too many messages");

      return;
    }

    let told: unknown;
    try {
      told = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof told !== "object" || told == null) {
      return;
    }

    const { t, dogs, ride } = told as Record<string, unknown>;
    const known = await this.#known();
    if (t === "dogs" && Array.isArray(dogs)) {
      const tag = ws.deserializeAttachment() as Tag;
      tag.peer.dogs = [];
      tag.kept = [];
      for (const [nth, raw] of dogs.slice(0, MOST_DOGS).entries()) {
        const shown = shownOf(raw, known);
        if (shown != null) {
          tag.peer.dogs.push(shown);
          tag.kept.push(nth);
        }
      }

      tag.peer.ride = null;
      ws.serializeAttachment(tag);
    } else if (t === "ping") {
      this.#ping(ws, told as Record<string, unknown>);

      return;
    } else if (t === "ride") {
      const tag = ws.deserializeAttachment() as Tag;
      const next = rideOf(ride, tag.kept);
      if (next === undefined) {
        return;
      }

      tag.peer.ride = next;
      ws.serializeAttachment(tag);
    } else {
      return;
    }

    this.#changed.add(id);
    this.#schedule();
  }

  override webSocketClose(ws: WebSocket) {
    const { id } = (ws.deserializeAttachment() as Tag).peer;
    this.#changed.delete(id);
    this.#spent.delete(id);
    this.#sent.delete(id);
    this.#heard.delete(id);
    for (const pair of this.#greeted.keys()) {
      if (pair.startsWith(`${id}>`) || pair.endsWith(`>${id}`)) {
        this.#greeted.delete(pair);
      }
    }
    this.#gone.add(id);
    this.#schedule();
  }

  override webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/live") {
      return env.ASSETS.fetch(request);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }

    if (!ORIGINS.test(request.headers.get("Origin") ?? "")) {
      return new Response("Forbidden", { status: 403 });
    }

    return env.CITY.getByName("city").fetch(request);
  },
} satisfies ExportedHandler<Env>;
