import { browser } from "$app/env";

export type SoundName =
  | "throw"
  | "bounce"
  | "catch"
  | "fetch"
  | "bark"
  | "whistle"
  | "squirrel"
  | "jump"
  | "land"
  | "collect"
  | "hit"
  | "puddle"
  | "splash"
  | "chime"
  | "tick"
  | "flutter"
  | "honk"
  | "chomp"
  | "ding"
  | "gold"
  | "close"
  | "stylish"
  | "fanfare"
  | "boost"
  | "lost";

const QUIET = "edny:game-quiet";

const audio: {
  ctx: AudioContext | null;
  master: GainNode | null;
  hiss: AudioBuffer | null;
} = { ctx: null, master: null, hiss: null };

function wake() {
  if (audio.ctx == null || audio.master == null) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    audio.ctx = ctx;
    audio.master = master;
  }

  if (audio.ctx.state === "suspended") {
    void audio.ctx.resume();
  }

  return { ctx: audio.ctx, master: audio.master };
}

function tone(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  gain: number,
  at = 0,
) {
  const { ctx: c, master: out } = wake();
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function hiss(
  dur: number,
  f0: number,
  f1: number,
  gain: number,
  q = 1,
  at = 0,
  type: BiquadFilterType = "bandpass",
) {
  const { ctx: c, master: out } = wake();
  if (audio.hiss == null) {
    const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    audio.hiss = buffer;
  }

  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = audio.hiss;
  src.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(filter).connect(env).connect(out);
  src.start(t);
  src.stop(t + dur + 0.03);
}

const PLAY: Record<SoundName, () => void> = {
  throw: () => hiss(0.28, 500, 2600, 0.22, 0.8),
  bounce: () => {
    tone("sine", 230, 80, 0.13, 0.32);
    hiss(0.06, 900, 300, 0.1, 0.9);
  },
  catch: () => {
    tone("triangle", 660, 990, 0.09, 0.26);
    tone("triangle", 990, 1480, 0.14, 0.26, 0.09);
  },
  fetch: () => {
    tone("sine", 880, 880, 0.08, 0.2);
    tone("sine", 1320, 1320, 0.16, 0.22, 0.08);
  },
  bark: () => {
    hiss(0.1, 1000, 380, 0.45, 2.2);
    tone("sawtooth", 330, 170, 0.11, 0.16);
    hiss(0.09, 900, 360, 0.4, 2.2, 0.17);
    tone("sawtooth", 310, 160, 0.1, 0.14, 0.17);
  },
  whistle: () => {
    tone("sine", 1300, 2400, 0.26, 0.22);
    tone("sine", 2400, 1900, 0.18, 0.18, 0.26);
  },
  squirrel: () => {
    for (let i = 0; i < 4; i += 1) {
      tone("square", 2700, 2200, 0.035, 0.06, i * 0.06);
    }
  },
  jump: () => hiss(0.2, 280, 1500, 0.16, 0.7),
  land: () => tone("sine", 170, 70, 0.1, 0.28),
  collect: () => {
    tone("sine", 990, 990, 0.07, 0.22);
    tone("sine", 1480, 1480, 0.13, 0.22, 0.06);
  },
  hit: () => {
    tone("sine", 150, 48, 0.17, 0.42);
    hiss(0.13, 420, 140, 0.28, 0.7);
  },
  puddle: () => hiss(0.28, 1400, 320, 0.3, 0.6, 0, "lowpass"),
  splash: () => {
    hiss(0.75, 2000, 240, 0.5, 0.5, 0, "lowpass");
    tone("sine", 210, 60, 0.32, 0.2);
    hiss(0.3, 3000, 900, 0.18, 0.4, 0.12, "highpass");
  },
  chime: () => {
    tone("sine", 880, 880, 1.3, 0.28);
    tone("sine", 1760, 1760, 0.9, 0.1);
    tone("sine", 660, 660, 1.3, 0.2, 0.7);
  },
  tick: () => tone("square", 1800, 1800, 0.02, 0.04),
  flutter: () => {
    for (let i = 0; i < 6; i += 1) {
      hiss(0.05, 1500, 700, 0.14, 0.9, i * 0.055);
    }
  },
  honk: () => {
    tone("sawtooth", 290, 230, 0.16, 0.14);
    hiss(0.16, 700, 500, 0.12, 3);
    tone("sawtooth", 300, 220, 0.14, 0.12, 0.2);
  },
  chomp: () => {
    hiss(0.07, 600, 200, 0.35, 1.2);
    hiss(0.07, 500, 180, 0.3, 1.2, 0.1);
  },
  ding: () => {
    tone("sine", 1320, 1320, 0.2, 0.2);
    tone("sine", 1980, 1980, 0.3, 0.1, 0.02);
  },
  gold: () => {
    tone("sine", 1050, 1050, 0.08, 0.16);
    tone("sine", 1400, 1400, 0.08, 0.16, 0.08);
    tone("sine", 2100, 2100, 0.22, 0.14, 0.16);
  },
  close: () => tone("triangle", 2400, 2900, 0.05, 0.08),
  stylish: () => {
    tone("triangle", 880, 880, 0.07, 0.18);
    tone("triangle", 1108, 1108, 0.07, 0.18, 0.07);
    tone("triangle", 1320, 1320, 0.12, 0.18, 0.14);
    tone("triangle", 1760, 1760, 0.2, 0.14, 0.21);
  },
  fanfare: () => {
    tone("triangle", 660, 660, 0.14, 0.2);
    tone("triangle", 880, 880, 0.14, 0.2, 0.14);
    tone("triangle", 990, 990, 0.14, 0.2, 0.28);
    tone("triangle", 1320, 1320, 0.5, 0.22, 0.42);
    tone("sine", 660, 660, 0.5, 0.1, 0.42);
  },
  boost: () => hiss(0.4, 400, 3200, 0.22, 0.7),
  lost: () => {
    tone("sine", 420, 180, 0.3, 0.2);
    hiss(0.35, 1200, 300, 0.25, 0.6, 0.05, "lowpass");
  },
};

class Sound {
  quiet = $state(false);

  constructor() {
    if (!browser) {
      return;
    }

    try {
      this.quiet = localStorage.getItem(QUIET) === "1";
    } catch {
      this.quiet = false;
    }
  }

  toggle() {
    this.quiet = !this.quiet;
    try {
      localStorage.setItem(QUIET, this.quiet ? "1" : "0");
    } catch {
      // Storage access throws in private mode and locked-down browsers.
    }

    if (!this.quiet) {
      this.play("tick");
    }
  }

  play(name: SoundName) {
    if (!browser || typeof AudioContext === "undefined" || this.quiet) {
      return;
    }

    try {
      PLAY[name]();
    } catch {
      // A blocked or torn-down audio context is not worth stopping the game for.
    }
  }
}

export const sound = new Sound();
