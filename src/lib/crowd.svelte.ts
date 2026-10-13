import { browser } from "$app/env";
import { on } from "svelte/events";
import type { Heard, Kind, Peer, Ride, Shown, Told } from "#lib/crowd.js";

const HIDDEN = "edny:crowd-hidden";
const PING = 50_000;
const AWAY = 60_000;
const FIRST_WAIT = 2000;
const LONGEST_WAIT = 120_000;
const HEARD_FOR = 6000;

function readHidden() {
  if (!browser) {
    return false;
  }

  try {
    return localStorage.getItem(HIDDEN) === "1";
  } catch {
    return false;
  }
}

/**
 * Other readers on the map right now, and what this reader shows them in return.
 */
class Crowd {
  #heard: ReturnType<typeof setTimeout> | undefined;
  #hidden = $state(readHidden());
  #you: string | null = null;
  #socket: WebSocket | null = null;
  #dogs: Array<Shown> = [];
  #ride: Ride | null = null;
  #ears: AudioContext | null = null;
  peers = $state.raw<ReadonlyArray<Peer>>([]);
  /**
   * The last hello another reader sent one of this reader's dogs, until it fades.
   */
  pinged = $state.raw<{
    n: number;
    dog: number;
    kind: Kind;
    from: Shown | null;
  } | null>(null);

  #send(told: Told) {
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(told));
    }
  }

  #greet() {
    this.#send({ t: "dogs", dogs: this.#hidden ? [] : this.#dogs });
    this.#send({ t: "ride", ride: this.#hidden ? null : this.#ride });
  }

  /**
   * Plays the sound for a hello, built from oscillators and noise so nothing has to load.
   * A page in the background stays quiet.
   */
  #yip(kind: Kind) {
    if (document.visibilityState !== "visible") {
      return;
    }

    try {
      this.#ears ??= new AudioContext();
    } catch {
      return;
    }

    const audio = this.#ears;
    if (audio.state === "suspended") {
      void audio.resume();
    }

    const start = audio.currentTime + 0.02;
    const out = audio.createGain();
    out.gain.value = 0.2;
    out.connect(audio.destination);

    const hiss = audio.createBuffer(
      1,
      audio.sampleRate * 0.5,
      audio.sampleRate,
    );
    const samples = hiss.getChannelData(0);
    for (const [i] of samples.entries()) {
      samples[i] = Math.random() * 2 - 1;
    }

    const burst = (
      at: number,
      long: number,
      pitch: number,
      q: number,
      loud: number,
    ) => {
      const source = audio.createBufferSource();
      source.buffer = hiss;
      const band = audio.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = pitch;
      band.Q.value = q;
      const level = audio.createGain();
      level.gain.setValueAtTime(0.0001, at);
      level.gain.exponentialRampToValueAtTime(loud, at + 0.012);
      level.gain.exponentialRampToValueAtTime(0.0001, at + long);
      source.connect(band).connect(level).connect(out);
      source.start(at);
      source.stop(at + long + 0.02);
    };

    if (kind === "sniff") {
      for (const [i, gap] of [0, 0.12, 0.21].entries()) {
        burst(start + gap, 0.075, 2200 + i * 260, 1.4, 1.6);
      }

      return;
    }

    if (kind === "ball") {
      for (const [gap, loud] of [
        [0, 1],
        [0.3, 0.6],
        [0.5, 0.36],
        [0.63, 0.2],
        [0.71, 0.1],
      ] as const) {
        const at = start + gap;
        const tone = audio.createOscillator();
        tone.type = "triangle";
        tone.frequency.setValueAtTime(760, at);
        tone.frequency.exponentialRampToValueAtTime(380, at + 0.07);
        const level = audio.createGain();
        level.gain.setValueAtTime(0.0001, at);
        level.gain.exponentialRampToValueAtTime(loud * 0.7, at + 0.003);
        level.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
        tone.connect(level).connect(out);
        tone.start(at);
        tone.stop(at + 0.13);
        burst(at, 0.025, 1900, 0.9, loud * 0.5);
      }

      return;
    }

    const voice = audio.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(380, start);
    voice.frequency.linearRampToValueAtTime(540, start + 0.035);
    voice.frequency.exponentialRampToValueAtTime(250, start + 0.2);
    const growl = audio.createOscillator();
    growl.frequency.value = 34;
    const depth = audio.createGain();
    depth.gain.value = 26;
    growl.connect(depth).connect(voice.frequency);

    const level = audio.createGain();
    level.gain.setValueAtTime(0.0001, start);
    level.gain.exponentialRampToValueAtTime(1, start + 0.014);
    level.gain.setValueAtTime(1, start + 0.06);
    level.gain.exponentialRampToValueAtTime(0.0001, start + 0.23);
    level.connect(out);

    for (const [pitch, q, loud] of [
      [720, 5, 3],
      [1250, 6, 1.7],
    ] as const) {
      const formant = audio.createBiquadFilter();
      formant.type = "bandpass";
      formant.frequency.value = pitch;
      formant.Q.value = q;
      const mix = audio.createGain();
      mix.gain.value = loud;
      voice.connect(formant).connect(mix).connect(level);
    }

    voice.start(start);
    growl.start(start);
    voice.stop(start + 0.25);
    growl.stop(start + 0.25);
    burst(start, 0.09, 1500, 0.8, 0.5);
  }

  #hear(heard: Heard) {
    if (heard.t === "ping") {
      clearTimeout(this.#heard);
      this.pinged = {
        n: (this.pinged?.n ?? 0) + 1,
        dog: heard.dog,
        kind: heard.kind,
        from: heard.from,
      };
      this.#yip(heard.kind);
      this.#heard = setTimeout(() => {
        this.pinged = null;
      }, HEARD_FOR);

      return;
    }

    if (heard.t === "all") {
      this.#you = heard.you;
      this.peers = heard.peers.filter((peer) => peer.id !== this.#you);

      return;
    }

    const fresh = new Set(heard.peers.map((peer) => peer.id));
    const gone = new Set(heard.gone);
    const kept = this.peers.filter(
      (peer) => !gone.has(peer.id) && !fresh.has(peer.id),
    );
    for (const peer of heard.peers) {
      if (peer.id !== this.#you && peer.dogs.length > 0) {
        kept.push(peer);
      }
    }

    this.peers = kept;
  }

  get hidden() {
    return this.#hidden;
  }

  set hidden(on: boolean) {
    this.#hidden = on;
    this.#greet();
    try {
      if (on) {
        localStorage.setItem(HIDDEN, "1");
      } else {
        localStorage.removeItem(HIDDEN);
      }
    } catch {
      // Storage access throws in private mode and locked-down browsers.
    }
  }

  /**
   * Opens the socket and keeps it open while the page is in view. Returns the way out.
   */
  join() {
    let socket: WebSocket | null = null;
    let wait = FIRST_WAIT;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let away: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    let isLeaving = false;

    const open = () => {
      if (socket != null || isLeaving) {
        return;
      }

      const next = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/live`,
      );
      socket = next;

      on(next, "open", () => {
        wait = FIRST_WAIT;
        this.#socket = next;
        this.#greet();
        ping = setInterval(() => {
          next.send("ping");
        }, PING);
      });

      on(next, "message", (event) => {
        const { data } = event as MessageEvent<unknown>;
        if (typeof data !== "string" || data === "pong") {
          return;
        }

        try {
          this.#hear(JSON.parse(data) as Heard);
        } catch {
          // A garbled frame is dropped; the next update carries the whole peer again.
        }
      });

      on(next, "close", () => {
        clearInterval(ping);
        socket = null;
        if (this.#socket === next) {
          this.#socket = null;
          this.peers = [];
        }
        if (!isLeaving && document.visibilityState === "visible") {
          retry = setTimeout(open, wait);
          wait = Math.min(wait * 2, LONGEST_WAIT);
        }
      });
    };

    const shut = () => {
      clearTimeout(retry);
      socket?.close();
    };

    const seen = on(document, "visibilitychange", () => {
      clearTimeout(away);
      if (document.visibilityState === "visible") {
        open();
      } else {
        away = setTimeout(shut, AWAY);
      }
    });

    open();

    return () => {
      isLeaving = true;
      seen();
      clearTimeout(away);
      shut();
    };
  }

  show(dogs: Array<Shown>) {
    this.#dogs = dogs;
    this.#send({ t: "dogs", dogs: this.#hidden ? [] : dogs });
  }

  ping(to: string, dog: number, kind: Kind, from: number | null) {
    this.#yip(kind);
    this.#send({ t: "ping", to, dog, kind, from: this.#hidden ? null : from });
  }

  ride(ride: Ride | null) {
    this.#ride = ride;
    this.#send({ t: "ride", ride: this.#hidden ? null : ride });
  }
}

export const crowd = new Crowd();
