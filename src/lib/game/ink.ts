import type { MapTheme } from "#lib/map-style.js";

export type Cam = {
  w: number;
  h: number;
  horizon: number;
  f: number;
  eye: number;
  x: number;
  z: number;
  rise?: (z: number) => number;
  base?: number;
  isNight?: boolean;
};

/**
 * The arena hands both games the same camera, so a frame borrows it and gives it
 * back. The field list lives here once: a game that writes one the caller forgot
 * to save is what makes the other game's camera drift on the next run.
 */
export function borrow(cam: Cam, frame: Partial<Cam>) {
  const rest = {
    z: cam.z,
    x: cam.x,
    rise: cam.rise,
    base: cam.base,
    eye: cam.eye,
    horizon: cam.horizon,
    isNight: cam.isNight,
  };
  Object.assign(cam, frame);

  return () => Object.assign(cam, rest);
}

function groundAt(cam: Cam, z: number) {
  return cam.rise == null ? 0 : cam.rise(z) - (cam.base ?? 0);
}

export type Palette = {
  ink: string;
  paper: string;
  grass: string;
  blade: string;
  shade: string;
  leaf: string;
  water: string;
  foam: string;
  ball: string;
  seam: string;
  fur: string;
  post: string;
  blanket: string;
  bagel: string;
  gold: string;
  goldSeam: string;
  leafDark: string;
  stone: string;
  brine: string;
};

export const PALETTES: Record<MapTheme, Palette> = {
  light: {
    ink: "#2b2620",
    paper: "#f7f4ec",
    grass: "#dde3d5",
    blade: "rgba(74,96,58,0.3)",
    shade: "rgba(43,38,32,0.15)",
    leaf: "#c6d2b6",
    water: "rgba(96,163,200,0.62)",
    foam: "rgba(244,250,253,0.95)",
    ball: "#e3d13f",
    seam: "#7b6f1a",
    fur: "#b09a80",
    post: "#8b6d4a",
    blanket: "#d9a58f",
    bagel: "#d9a35a",
    gold: "#f2c31c",
    goldSeam: "#9a6e08",
    leafDark: "#aebb9d",
    stone: "#c9c2b4",
    brine: "#3f7ea8",
  },
  dark: {
    ink: "#ece7dc",
    paper: "#221e19",
    grass: "#20241d",
    blade: "rgba(170,190,150,0.18)",
    shade: "rgba(0,0,0,0.4)",
    leaf: "#2c352a",
    water: "rgba(46,100,134,0.8)",
    foam: "rgba(150,200,226,0.9)",
    ball: "#d6c43c",
    seam: "#f2e690",
    fur: "#6f6252",
    post: "#6a5540",
    blanket: "#7a4f42",
    bagel: "#a3733a",
    gold: "#e6b418",
    goldSeam: "#fff0a8",
    leafDark: "#232a21",
    stone: "#4a463f",
    brine: "#7fb0d2",
  },
};

export const TAU = Math.PI * 2;

export function project(cam: Cam, x: number, y: number, z: number) {
  const s = cam.f / Math.max(z - cam.z, 0.25);

  return {
    sx: cam.w / 2 + (x - cam.x) * s,
    sy: cam.horizon + (cam.eye - y - groundAt(cam, z)) * s,
    s,
  };
}

export function hash(n: number) {
  let t = Math.imul(Math.floor(n) ^ 1_831_565_813, 2_246_822_507);
  t ^= t >>> 13;
  t = Math.imul(t, 3_266_489_909);
  t ^= t >>> 16;

  return (t >>> 0) / 4_294_967_296;
}

export function groundEllipse(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  x: number,
  z: number,
  rx: number,
  rz: number,
  fill: string,
) {
  const p = project(cam, x, 0, z);
  const squash = (p.s * cam.eye) / cam.f;
  const w = rx * p.s;
  if (w < 0.5) {
    return;
  }

  const h = Math.max(0.6, rz * p.s * squash);
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, w, h, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
Low morning sun in the east: every shadow runs west, about twice the height of what casts it.
*/
export function shadow(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  width: number,
  height: number,
  lift = 0,
) {
  const fade = Math.max(0, 1 - lift / 3);
  if (fade <= 0) {
    return;
  }

  ctx.globalAlpha = fade;
  groundEllipse(
    ctx,
    cam,
    x - height * 0.5,
    z,
    width * 0.42 + height * 0.45,
    width * 0.26,
    pal.shade,
  );
  ctx.globalAlpha = 1;
}

function groundBands(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  half: number,
  far: number,
  stripe: number,
) {
  const unit = stripe > 0 ? stripe : 6;
  const lastK = Math.floor((cam.z + far) / unit);
  const firstK = Math.floor((cam.z + 0.3) / unit);
  for (let k = lastK; k >= firstK; k -= 1) {
    const z0 = Math.max(cam.z + 0.3, k * unit);
    const z1 = Math.min(cam.z + far, (k + 1) * unit);
    if (z1 <= z0) {
      continue;
    }

    const depth = (z0 - cam.z) / far;
    const pieces = depth < 0.08 ? 4 : depth < 0.2 ? 2 : 1;
    for (let q = 0; q < pieces; q += 1) {
      const a = z0 + ((z1 - z0) * q) / pieces;
      const b = z0 + ((z1 - z0) * (q + 1)) / pieces;
      const al = project(cam, -half, 0, a);
      const ar = project(cam, half, 0, a);
      const bl = project(cam, -half, 0, b);
      const br = project(cam, half, 0, b);
      const band = new Path2D();
      band.moveTo(al.sx - 400, al.sy + 0.5);
      band.lineTo(ar.sx + 400, ar.sy + 0.5);
      band.lineTo(br.sx + 400, br.sy);
      band.lineTo(bl.sx - 400, bl.sy);
      band.closePath();
      ctx.fillStyle = pal.grass;
      ctx.fill(band);
      if (stripe > 0 && k % 2 === 1) {
        ctx.fillStyle = pal.ink;
        ctx.globalAlpha = 0.045;
        ctx.fill(band);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function tufts(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  half: number,
  far: number,
) {
  ctx.strokeStyle = pal.blade;
  ctx.lineCap = "round";
  const rowStep = 3;
  const first = Math.ceil((cam.z + 0.4) / rowStep) * rowStep;
  for (let rz = first; rz < cam.z + far; rz += rowStep) {
    const depth = (rz - cam.z) / far;
    const alpha = Math.max(0, 1 - depth) ** 1.4;
    if (alpha < 0.03) {
      break;
    }

    const row = Math.round(rz / rowStep);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(0.7, 1.6 * (1 - depth));
    const count = Math.max(8, Math.round(half * 2.4 * (1.4 - depth)));
    for (let i = 0; i < count; i += 1) {
      const seed = row * 977 + i * 31;
      const x = -half + hash(seed) * half * 2;
      const zz = rz + (hash(seed + 7) - 0.5) * rowStep * 0.9;
      const p = project(cam, x, 0, zz);
      if (p.sx < -10 || p.sx > cam.w + 10) {
        continue;
      }

      const tuft = Math.min(11, Math.max(1.5, 0.12 * p.s));
      const blades = new Path2D();
      blades.moveTo(p.sx, p.sy);
      blades.lineTo(p.sx - tuft * 0.45, p.sy - tuft);
      blades.moveTo(p.sx, p.sy);
      blades.lineTo(p.sx + tuft * 0.5, p.sy - tuft * 0.9);
      ctx.stroke(blades);
    }
  }

  ctx.globalAlpha = 1;
}

export function meadow(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  half: number,
  far: number,
  stripe = 0,
) {
  const edge = project(cam, 0, 0, cam.z + far * 3);
  ctx.fillStyle = pal.grass;
  ctx.fillRect(0, edge.sy, cam.w, cam.h - edge.sy);
  groundBands(ctx, cam, pal, half, far, stripe);
  tufts(ctx, cam, pal, half, far);
}

export function tree(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  size: number,
  seed: number,
) {
  const base = project(cam, x, 0, z);
  if (
    base.s <= 0 ||
    base.s > cam.f / 4 ||
    base.sx < -200 ||
    base.sx > cam.w + 200
  ) {
    return;
  }

  const s = base.s;
  groundEllipse(
    ctx,
    cam,
    x - size * 1.7,
    z,
    size * 1.7,
    size * 0.75,
    pal.shade,
  );

  const trunkH = 1.5 * size * s;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(1, 0.16 * size * s);
  ctx.lineCap = "round";
  const trunk = new Path2D();
  trunk.moveTo(base.sx, base.sy);
  trunk.lineTo(base.sx + 0.08 * size * s, base.sy - trunkH);
  ctx.stroke(trunk);

  const cx = base.sx + 0.1 * size * s;
  const cy = base.sy - trunkH - 1.05 * size * s;
  const r = 1.25 * size * s;
  const lobes = 7;
  ctx.fillStyle = pal.leafDark;
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.14, cy - r * 0.08, r * 0.92, r * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= lobes; i += 1) {
    const a0 = (i / lobes) * TAU;
    const a1 = ((i + 0.5) / lobes) * TAU;
    const r0 = r * (0.86 + 0.28 * hash(seed * 13 + i));
    const r1 = r * (1.06 + 0.22 * hash(seed * 17 + i));
    const px = cx + Math.cos(a0) * r0;
    const py = cy + Math.sin(a0) * r0 * 0.92;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.quadraticCurveTo(
        cx + Math.cos(a1 - TAU / lobes) * r1,
        cy + Math.sin(a1 - TAU / lobes) * r1 * 0.92,
        px,
        py,
      );
    }
  }

  ctx.closePath();
  ctx.fillStyle = pal.leaf;
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, 0.07 * size * s);
  ctx.stroke();

  ctx.lineWidth = Math.max(0.6, 0.045 * size * s);
  ctx.globalAlpha = 0.55;
  const hatch = new Path2D();
  for (let i = 0; i < 5; i += 1) {
    const y0 = cy - r * 0.5 + i * r * 0.28;
    const reach = Math.sqrt(Math.max(0, r * r - (y0 - cy) ** 2));
    hatch.moveTo(cx - reach * 0.95, y0);
    hatch.lineTo(cx - reach * 0.35, y0 + r * 0.12);
  }

  ctx.stroke(hatch);

  ctx.globalAlpha = 1;
}

const tints = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

export function tinted(img: HTMLImageElement, color: string) {
  let byColor = tints.get(img);
  if (byColor == null) {
    byColor = new Map();
    tints.set(img, byColor);
  }

  let sheet = byColor.get(color);
  if (sheet == null) {
    sheet = document.createElement("canvas");
    sheet.width = img.naturalWidth;
    sheet.height = img.naturalHeight;
    const c = sheet.getContext("2d");
    if (c != null) {
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = "source-in";
      c.fillStyle = color;
      c.fillRect(0, 0, sheet.width, sheet.height);
    }

    byColor.set(color, sheet);
  }

  return sheet;
}

const halos = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

function haloed(img: HTMLImageElement, halo: string) {
  let sheet = halos.get(img);
  if (sheet != null) {
    return sheet;
  }

  const pad = 6;
  sheet = document.createElement("canvas");
  sheet.width = img.naturalWidth + pad * 2;
  sheet.height = img.naturalHeight + pad * 2;
  const c = sheet.getContext("2d");
  if (c != null) {
    const ring = img.naturalWidth * 0.022;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU;
      c.drawImage(img, pad + Math.cos(a) * ring, pad + Math.sin(a) * ring);
    }

    c.globalCompositeOperation = "source-in";
    c.fillStyle = halo;
    c.fillRect(0, 0, sheet.width, sheet.height);
    c.globalCompositeOperation = "source-over";
    c.drawImage(img, pad, pad);
  }

  halos.set(img, sheet);

  return sheet;
}

export function cutout(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  img: HTMLImageElement,
  x: number,
  y: number,
  z: number,
  height: number,
  isFlipped: boolean,
  lean = 0,
) {
  const p = project(cam, x, y, z);
  const h = height * p.s;
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.rotate(lean);
  ctx.scale(isFlipped ? -1 : 1, 1);
  if (cam.isNight === true) {
    const sheet = haloed(img, pal.ink);
    const hh = (h * sheet.height) / img.naturalHeight;
    const ww = (hh * sheet.width) / sheet.height;
    ctx.drawImage(sheet, -ww / 2, -hh + (hh - h) / 2, ww, hh);
  } else {
    ctx.drawImage(tinted(img, pal.ink), -w / 2, -h, w, h);
  }

  ctx.restore();

  return { sx: p.sx, sy: p.sy, w, h };
}

export function ball(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
  r: number,
) {
  const p = project(cam, x, y, z);
  const rr = Math.max(1.6, r * p.s);
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, rr, 0, TAU);
  ctx.fillStyle = pal.ball;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, rr * 0.11);
  ctx.stroke();

  if (rr > 4) {
    ctx.strokeStyle = pal.seam;
    ctx.lineWidth = Math.max(0.8, rr * 0.09);
    ctx.beginPath();
    ctx.arc(p.sx - rr * 1.05, p.sy, rr * 1.1, -0.62, 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.sx + rr * 1.05, p.sy, rr * 1.1, Math.PI - 0.62, Math.PI + 0.62);
    ctx.stroke();
  }
}

export function squirrel(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  isFacingLeft: boolean,
  stride: number,
) {
  const p = project(cam, x, 0, z);
  const k = (0.42 * p.s) / 24;
  if (k * 24 < 3) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.35, z, 0.5, 0.2, pal.shade);

  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(isFacingLeft ? -k : k, k);
  const hop = Math.abs(Math.sin(stride * 2.2)) * 3;
  ctx.translate(0, -hop);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.fur;

  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.quadraticCurveTo(-16, -12, -13, -22);
  ctx.quadraticCurveTo(-11, -28, -5, -25);
  ctx.stroke();
  ctx.strokeStyle = pal.fur;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -8, 9, 5.6, -0.15, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(9.5, -13, 4.2, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8, -16.5);
  ctx.lineTo(9, -20.5);
  ctx.lineTo(11.5, -16.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(11, -14, 0.9, 0, TAU);
  ctx.fill();

  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(-6 + Math.sin(stride * 4.4) * 3, 0);
  ctx.moveTo(5, -3);
  ctx.lineTo(7 - Math.sin(stride * 4.4) * 3, 0);
  ctx.stroke();

  ctx.restore();
}

export function treeline(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  half: number,
  z: number,
) {
  for (let i = -half; i <= half; i += 4) {
    tree(
      ctx,
      cam,
      pal,
      i + (hash(i * 3) - 0.5) * 3,
      z + hash(i * 5) * 10,
      1.8 + hash(i * 7),
      i,
    );
  }
}

export function pool(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  half: number,
  zFrom: number,
  zTo: number,
  t: number,
) {
  const a = project(cam, -half, 0, zFrom);
  const b = project(cam, half, 0, zFrom);
  const c = project(cam, half, 0, zTo);
  const d = project(cam, -half, 0, zTo);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
  ctx.fillStyle = pal.water;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  ctx.strokeStyle = pal.foam;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.85;
  for (let z = zFrom + 1.5; z < zTo; z += 2.5) {
    const p = project(cam, 0, 0, z);
    const span = half * p.s * 0.9;
    const wave = Math.max(2, 0.4 * p.s);
    ctx.beginPath();
    for (let sx = -span; sx <= span; sx += wave * 2) {
      const phase = t * 1.6 + z * 0.7;
      ctx.moveTo(p.sx + sx, p.sy + Math.sin(phase) * wave * 0.15);
      ctx.quadraticCurveTo(
        p.sx + sx + wave * 0.6,
        p.sy - wave * 0.32 + Math.sin(phase + 1) * wave * 0.1,
        p.sx + sx + wave * 1.3,
        p.sy,
      );
    }

    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

export function droplet(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
  r: number,
) {
  const p = project(cam, x, y, z);
  const rr = Math.max(1.2, r * p.s);
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, rr * 0.8, rr, 0, 0, TAU);
  ctx.fillStyle = pal.water;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function signpost(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  text: string,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s * 2 < 6) {
    return;
  }

  groundEllipse(ctx, cam, x - 1.6, z, 1.6, 0.25, pal.shade);
  ctx.strokeStyle = pal.post;
  ctx.lineWidth = Math.max(1.5, 0.14 * s);
  ctx.beginPath();
  ctx.moveTo(base.sx, base.sy);
  ctx.lineTo(base.sx, base.sy - 2.1 * s);
  ctx.stroke();

  const h = 0.6 * s;
  ctx.font = `${Math.max(6, h * 0.62)}px "Alfa Slab One", serif`;
  const w = Math.max(1.9 * s, ctx.measureText(text).width + h * 0.6);
  const top = base.sy - 2.1 * s;
  ctx.fillStyle = pal.stone;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  const side = Math.max(1, 0.07 * s);
  ctx.beginPath();
  ctx.rect(base.sx - w / 2 - side, top + side * 0.6, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.rect(base.sx - w / 2, top, w, h);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, base.sx, top + h / 2 + h * 0.03);
}

export function puff(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  r: number,
  alpha: number,
) {
  const p = project(cam, x, 0.12, z);
  const rr = Math.max(1, r * p.s);
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, Math.min(rr, 18), Math.min(rr, 18) * 0.6, 0, 0, TAU);
  ctx.fillStyle = pal.paper;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function ring(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  r: number,
  alpha: number,
) {
  const p = project(cam, x, 0, z);
  const squash = (p.s * cam.eye) / cam.f;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, r * p.s, Math.max(1, r * p.s * squash), 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function pigeon(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
  isFacingLeft: boolean,
  wing: number,
) {
  const p = project(cam, x, y, z);
  const k = (0.3 * p.s) / 24;
  if (k * 24 < 2.5) {
    return;
  }

  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(isFacingLeft ? -k : k, k);
  ctx.fillStyle = pal.fur;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(0, -9, 9, 5.5, -0.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8.5, -14, 3.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.moveTo(12, -14);
  ctx.lineTo(15.5, -13);
  ctx.lineTo(12, -12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, -9);
  ctx.lineTo(-15, -7);
  ctx.lineTo(-14, -11);
  ctx.closePath();
  ctx.fill();
  if (wing > 0) {
    const lift = Math.sin(wing * 14) * 8;
    const wings = new Path2D();
    wings.moveTo(-2, -12);
    wings.quadraticCurveTo(-8, -20 - lift, -18, -16 - lift);
    wings.moveTo(-2, -12);
    wings.quadraticCurveTo(2, -20 - lift, 12, -18 - lift);
    ctx.lineWidth = 2.2;
    ctx.stroke(wings);
  } else {
    const legs = new Path2D();
    legs.moveTo(-2, -4);
    legs.lineTo(-3, 0);
    legs.moveTo(3, -4);
    legs.lineTo(3, 0);
    ctx.stroke(legs);
  }

  ctx.restore();
}

export function bagel(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
) {
  const p = project(cam, x, y, z);
  const r = Math.max(2.5, 0.14 * p.s);
  ctx.fillStyle = pal.bagel;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, r, r * 0.86, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy + r * 0.05, r * 0.36, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (r > 6) {
    ctx.fillStyle = pal.ink;
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * TAU + 0.4;
      ctx.beginPath();
      ctx.ellipse(
        p.sx + Math.cos(a) * r * 0.64,
        p.sy + Math.sin(a) * r * 0.54,
        r * 0.07,
        r * 0.045,
        a,
        0,
        TAU,
      );
      ctx.fill();
    }
  }
}

export function bone(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
) {
  const p = project(cam, x, y, z);
  const w = Math.max(6, 0.4 * p.s);
  const h = w * 0.3;
  ctx.fillStyle = pal.paper;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, w * 0.04);
  const shape = new Path2D();
  shape.roundRect(p.sx - w / 2, p.sy - h / 2, w, h, h / 2);
  for (const side of [-1, 1]) {
    shape.moveTo(p.sx + side * w * 0.42, p.sy - h * 0.45);
    shape.arc(p.sx + side * w * 0.42, p.sy - h * 0.45, h * 0.62, 0, TAU);
    shape.moveTo(p.sx + side * w * 0.42, p.sy + h * 0.45);
    shape.arc(p.sx + side * w * 0.42, p.sy + h * 0.45, h * 0.62, 0, TAU);
  }

  ctx.fill(shape);
  ctx.stroke(shape);
}

export function can(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
) {
  const p = project(cam, x, y, z);
  const h = Math.max(6, 0.42 * p.s);
  const w = h * 0.42;
  ctx.fillStyle = pal.leaf;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, h * 0.035);
  ctx.beginPath();
  ctx.rect(p.sx - w / 2, p.sy - h, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ball;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy - h, w / 2, w * 0.28, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(p.sx - w / 2, p.sy - h * 0.62, w, h * 0.18);
  ctx.globalAlpha = 1;
}

export function goose(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  isFacingLeft: boolean,
  stride: number,
) {
  const p = project(cam, x, 0, z);
  const k = (0.55 * p.s) / 24;
  if (k * 24 < 3) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.4, z, 0.55, 0.22, pal.shade);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(isFacingLeft ? -k : k, k);
  ctx.lineCap = "round";
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.4;
  const legs = new Path2D();
  const swing = Math.sin(stride * 5) * 2.5;
  legs.moveTo(-3, -6);
  legs.lineTo(-4 + swing, 0);
  legs.moveTo(3, -6);
  legs.lineTo(4 - swing, 0);
  ctx.stroke(legs);
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.ellipse(0, -11, 11, 6, -0.1, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.fur;
  ctx.beginPath();
  ctx.ellipse(-2, -12, 7.5, 4, -0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(8, -14);
  ctx.quadraticCurveTo(12, -20, 11, -27);
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.ellipse(12, -28, 3.6, 2.6, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.ellipse(11.4, -27.4, 1.6, 1, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.moveTo(15, -28);
  ctx.lineTo(19, -27);
  ctx.lineTo(15, -26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function figure(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  stride: number,
  isLean: boolean,
) {
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.ink;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -42, 4, 0, TAU);
  ctx.fill();
  const body = new Path2D();
  body.roundRect(-4.5, -38, 9, 18, 3);
  ctx.fill(body);
  const swing = isLean ? Math.sin(stride * 3.2) * 7 : 0;
  ctx.lineWidth = 3;
  const limbs = new Path2D();
  limbs.moveTo(-2, -20);
  limbs.lineTo(-3 - swing, -2);
  limbs.moveTo(2, -20);
  limbs.lineTo(3 + swing, -2);
  limbs.moveTo(-3, -35);
  limbs.lineTo(-6 + swing * 0.8, -24);
  limbs.moveTo(3, -35);
  limbs.lineTo(6 - swing * 0.8, -24);
  ctx.stroke(limbs);
}

export function jogger(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  stride: number,
) {
  const p = project(cam, x, 0, z);
  const k = (1.75 * p.s) / 46;
  if (k * 46 < 4) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.9, z, 1, 0.25, pal.shade);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(k, k);
  ctx.rotate(-0.08);
  figure(ctx, pal, stride, true);
  ctx.restore();
}

export function stroller(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  stride = 0,
  isFacingLeft = false,
) {
  const p = project(cam, x, 0, z);
  const k = (1.7 * p.s) / 46;
  if (k * 46 < 4) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.9, z, 1.3, 0.3, pal.shade);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(isFacingLeft ? -k : k, k);
  ctx.save();
  ctx.translate(-14, 0);
  figure(ctx, pal, stride, stride !== 0);
  ctx.restore();
  ctx.fillStyle = pal.paper;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.6;
  const pram = new Path2D();
  pram.roundRect(-2, -24, 22, 13, 3);
  ctx.fill(pram);
  ctx.stroke(pram);
  ctx.beginPath();
  ctx.moveTo(-2, -24);
  ctx.quadraticCurveTo(6, -36, 20, -30);
  ctx.lineTo(20, -24);
  ctx.closePath();
  ctx.fillStyle = pal.blanket;
  ctx.fill();
  ctx.stroke();
  const handle = new Path2D();
  handle.moveTo(-2, -22);
  handle.lineTo(-9, -30);
  ctx.stroke(handle);
  ctx.fillStyle = pal.ink;
  for (const wx of [2, 16]) {
    ctx.beginPath();
    ctx.arc(wx, -4, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.paper;
    ctx.beginPath();
    ctx.arc(wx, -4, 1.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.ink;
  }

  ctx.restore();
}

export function sprinkler(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  t: number,
) {
  const base = project(cam, x, 0, z);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(1, 0.06 * base.s);
  const post = new Path2D();
  post.moveTo(base.sx, base.sy);
  post.lineTo(base.sx, base.sy - 0.35 * base.s);
  ctx.stroke(post);
  ctx.fillStyle = pal.water;
  const sweep = Math.sin(t * 2.2);
  for (let i = 0; i < 14; i += 1) {
    const f = i / 14;
    const dx = (f - 0.5) * 2.2 * sweep;
    const dz = (f - 0.5) * 2.4;
    const height = 0.35 + Math.sin(f * Math.PI) * 1.4;
    const d = project(cam, x + dx, height, z + dz);
    ctx.beginPath();
    ctx.ellipse(
      d.sx,
      d.sy,
      Math.max(1, 0.05 * d.s),
      Math.max(1.5, 0.08 * d.s),
      0,
      0,
      TAU,
    );
    ctx.fill();
  }
}

export function sky(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette) {
  if (cam.isNight !== true) {
    sun(ctx, cam, pal);

    return;
  }

  ctx.fillStyle = pal.ink;
  for (let i = 0; i < 46; i += 1) {
    const sx = hash(i * 7) * cam.w;
    const sy = hash(i * 13) * cam.horizon * 0.9;
    const r = 0.6 + hash(i * 19) * 1.1;
    ctx.globalAlpha = 0.45 + hash(i * 23) * 0.4;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const cx = cam.w * 0.8;
  const cy = cam.horizon - cam.h * 0.16;
  const r = cam.h * 0.04;
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.arc(cx + r * 0.42, cy - r * 0.18, r * 0.86, 0, TAU);
  ctx.fill();
}

function sun(ctx: CanvasRenderingContext2D, cam: Cam, pal: Palette) {
  const cx = cam.w * 0.8;
  const cy = cam.horizon - cam.h * 0.13;
  const r = cam.h * 0.045;
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.4;
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const rays = new Path2D();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU;
    rays.moveTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
    rays.lineTo(cx + Math.cos(a) * r * 1.75, cy + Math.sin(a) * r * 1.75);
  }

  ctx.stroke(rays);
  ctx.globalAlpha = 1;
}

export function speedLines(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  k: number,
  t: number,
) {
  if (k <= 0) {
    return;
  }

  ctx.globalAlpha = 0.18 * k;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1;
  const lines = new Path2D();
  for (let i = 0; i < 12; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const y = cam.h * (0.25 + hash(i * 17 + Math.floor(t * 9)) * 0.55);
    const len = cam.w * (0.05 + hash(i * 31 + Math.floor(t * 7)) * 0.12) * k;
    const x0 = side < 0 ? cam.w * 0.02 : cam.w * 0.98;
    lines.moveTo(x0, y);
    lines.lineTo(x0 - side * len, y);
  }

  ctx.stroke(lines);
  ctx.globalAlpha = 1;
}

export function buildings(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  zFrom: number,
  zTo: number,
  seedBase: number,
) {
  const side = Math.sign(x);
  for (let z = Math.ceil(zFrom / 26) * 26; z < zTo; z += 26) {
    const seed = seedBase + z;
    const h = 18 + hash(seed) * 34;
    const w = 20 + hash(seed * 3) * 10;
    const near = project(cam, x, 0, z);
    const far = project(cam, x, 0, z + w);
    const nearTop = project(cam, x, h, z);
    const farTop = project(cam, x, h, z + w);
    const outer = project(cam, x + side * 14, 0, z);
    const outerTop = project(cam, x + side * 14, h, z);
    if (near.sx < -300 || near.sx > cam.w + 300) {
      continue;
    }

    const face = new Path2D();
    face.moveTo(near.sx, near.sy);
    face.lineTo(nearTop.sx, nearTop.sy);
    face.lineTo(farTop.sx, farTop.sy);
    face.lineTo(far.sx, far.sy);
    face.closePath();
    ctx.fillStyle = pal.stone;
    ctx.fill(face);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.8;
    ctx.stroke(face);
    const front = new Path2D();
    front.moveTo(near.sx, near.sy);
    front.lineTo(nearTop.sx, nearTop.sy);
    front.lineTo(outerTop.sx, outerTop.sy);
    front.lineTo(outer.sx, outer.sy);
    front.closePath();
    ctx.fillStyle = pal.paper;
    ctx.fill(front);
    ctx.stroke(front);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pal.ink;
    for (let row = 1; row < 5; row += 1) {
      for (let col = 1; col < 4; col += 1) {
        const p = project(cam, x, (h * row) / 5, z + (w * col) / 4);
        ctx.fillRect(
          p.sx - 1,
          p.sy - 1,
          Math.max(1, 0.05 * p.s),
          Math.max(1, 0.08 * p.s),
        );
      }
    }

    ctx.globalAlpha = 1;
  }
}

export function balto(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x - 1.2, z, 1.6, 0.6, pal.shade);
  ctx.fillStyle = pal.stone;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  ctx.beginPath();
  ctx.ellipse(base.sx, base.sy - 0.5 * s, 1.1 * s, 0.6 * s, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  const dog = new Path2D();
  const k = 0.028 * s;
  const ox = base.sx - 14 * k;
  const oy = base.sy - 1 * s;
  dog.moveTo(ox, oy);
  dog.lineTo(ox + 4 * k, oy - 14 * k);
  dog.lineTo(ox + 18 * k, oy - 16 * k);
  dog.lineTo(ox + 24 * k, oy - 24 * k);
  dog.lineTo(ox + 30 * k, oy - 22 * k);
  dog.lineTo(ox + 32 * k, oy - 16 * k);
  dog.lineTo(ox + 27 * k, oy - 13 * k);
  dog.lineTo(ox + 26 * k, oy);
  dog.lineTo(ox + 22 * k, oy);
  dog.lineTo(ox + 21 * k, oy - 9 * k);
  dog.lineTo(ox + 8 * k, oy - 9 * k);
  dog.lineTo(ox + 5 * k, oy);
  dog.closePath();
  ctx.fill(dog);
}

export function fountain(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  t: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x, z, 3.2, 1.6, pal.water);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  const squash = (s * cam.eye) / cam.f;
  ctx.beginPath();
  ctx.ellipse(
    base.sx,
    base.sy,
    3.2 * s,
    Math.max(1, 1.6 * s * squash),
    0,
    0,
    TAU,
  );
  ctx.stroke();
  ctx.fillStyle = pal.stone;
  ctx.beginPath();
  ctx.rect(base.sx - 0.35 * s, base.sy - 2.6 * s, 0.7 * s, 2.6 * s);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(base.sx, base.sy - 2.6 * s);
  ctx.scale((1.6 * s) / 46, (1.6 * s) / 46);
  figure(ctx, pal, 0, false);
  ctx.restore();
  ctx.fillStyle = pal.foam;
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU + t;
    const f = (t * 0.8 + i / 10) % 1;
    const p = project(
      cam,
      x + Math.cos(a) * 2.2 * f,
      2.2 - 2.2 * f * f,
      z + Math.sin(a) * 1.2 * f,
    );
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, Math.max(1, 0.06 * p.s), 0, TAU);
    ctx.fill();
  }
}

export function mushroom(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 1.5) {
    return;
  }

  groundEllipse(ctx, cam, x - 1, z, 1.4, 0.5, pal.shade);
  ctx.fillStyle = pal.stone;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  ctx.beginPath();
  ctx.rect(base.sx - 0.35 * s, base.sy - 1.4 * s, 0.7 * s, 1.4 * s);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(base.sx, base.sy - 1.5 * s, 1.5 * s, 0.7 * s, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(base.sx, base.sy - 2.1 * s);
  ctx.scale((1.2 * s) / 46, (1.2 * s) / 46);
  figure(ctx, pal, 0, false);
  ctx.restore();
}

export function rat(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  isFacingLeft: boolean,
  stride: number,
) {
  const p = project(cam, x, 0, z);
  const k = (0.3 * p.s) / 24;
  if (k * 24 < 2.5) {
    return;
  }

  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(isFacingLeft ? -k : k, k);
  ctx.fillStyle = pal.fur;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  const tail = new Path2D();
  tail.moveTo(-10, -4);
  tail.quadraticCurveTo(-20, -2 + Math.sin(stride * 6) * 3, -26, -8);
  ctx.stroke(tail);
  ctx.beginPath();
  ctx.ellipse(0, -5, 11, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9, -6);
  ctx.lineTo(17, -3.5);
  ctx.lineTo(9, -1.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, -9, 2.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(12, -5, 0.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function hydrant(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.5, z, 0.55, 0.2, pal.shade);
  ctx.fillStyle = pal.blanket;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  const body = new Path2D();
  body.roundRect(
    base.sx - 0.16 * s,
    base.sy - 0.75 * s,
    0.32 * s,
    0.75 * s,
    0.05 * s,
  );
  ctx.fill(body);
  ctx.stroke(body);
  ctx.beginPath();
  ctx.arc(base.sx, base.sy - 0.75 * s, 0.17 * s, Math.PI, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(base.sx - 0.3 * s, base.sy - 0.5 * s, 0.6 * s, 0.12 * s);
  ctx.fill();
  ctx.stroke();
}

export function bench(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.4, z, 1.3, 0.3, pal.shade);
  ctx.fillStyle = pal.post;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.04 * s);
  const w = 1.2 * s;
  ctx.beginPath();
  ctx.rect(base.sx - w, base.sy - 0.5 * s, w * 2, 0.1 * s);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(base.sx - w, base.sy - 0.95 * s, w * 2, 0.1 * s);
  ctx.fill();
  ctx.stroke();
  const legs = new Path2D();
  for (const lx of [base.sx - w * 0.85, base.sx + w * 0.85]) {
    legs.moveTo(lx, base.sy);
    legs.lineTo(lx, base.sy - 0.95 * s);
  }

  ctx.lineWidth = Math.max(1, 0.06 * s);
  ctx.stroke(legs);
}

export function cart(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.8, z, 1.2, 0.4, pal.shade);
  ctx.fillStyle = pal.stone;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  ctx.beginPath();
  ctx.rect(base.sx - 0.7 * s, base.sy - 1.1 * s, 1.4 * s, 0.8 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  for (const wx of [base.sx - 0.45 * s, base.sx + 0.45 * s]) {
    ctx.beginPath();
    ctx.arc(wx, base.sy - 0.15 * s, 0.16 * s, 0, TAU);
    ctx.fill();
  }

  const pole = new Path2D();
  pole.moveTo(base.sx + 0.5 * s, base.sy - 1.1 * s);
  pole.lineTo(base.sx + 0.5 * s, base.sy - 2.4 * s);
  ctx.stroke(pole);
  ctx.fillStyle = pal.blanket;
  ctx.beginPath();
  ctx.ellipse(
    base.sx + 0.5 * s,
    base.sy - 2.4 * s,
    1.3 * s,
    0.45 * s,
    0,
    Math.PI,
    TAU,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.paper;
  const scallops = new Path2D();
  for (let i = 0; i < 6; i += 1) {
    const sx = base.sx + 0.5 * s - 1.3 * s + ((i + 0.5) * (2.6 * s)) / 6;
    scallops.moveTo(sx - 0.2 * s, base.sy - 2.4 * s);
    scallops.arc(sx, base.sy - 2.4 * s, 0.2 * s, Math.PI, 0, true);
  }

  ctx.fill(scallops);
  ctx.stroke(scallops);
}

function jointed(
  path: Path2D,
  hx: number,
  hy: number,
  fx: number,
  fy: number,
  upper: number,
  lower: number,
  bend: number,
) {
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.max(0.1, Math.min(Math.hypot(dx, dy), upper + lower - 0.2));
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const kx = hx + ux * a - uy * h * bend;
  const ky = hy + uy * a + ux * h * bend;
  path.moveTo(hx, hy);
  path.lineTo(kx, ky);
  path.lineTo(fx, fy);
}

export function biker(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  isFacingLeft: boolean,
  stride: number,
) {
  const p = project(cam, x, 0, z);
  const k = (1.7 * p.s) / 46;
  if (k * 46 < 4) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.9, z, 1.3, 0.3, pal.shade);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(isFacingLeft ? -k : k, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const crank = stride * 3;
  const hipX = -6;
  const hipY = -24;
  const farLeg = new Path2D();
  jointed(
    farLeg,
    hipX,
    hipY,
    1 + Math.cos(crank + Math.PI) * 4,
    -7 + Math.sin(crank + Math.PI) * 4,
    11,
    11,
    -1,
  );
  ctx.strokeStyle = pal.shade;
  ctx.lineWidth = 3;
  ctx.stroke(farLeg);

  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.paper;
  ctx.lineWidth = 1.8;
  for (const wx of [-14, 14]) {
    ctx.beginPath();
    ctx.arc(wx, -8, 8, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const spokes = new Path2D();
    for (let i = 0; i < 4; i += 1) {
      const a = stride * 3 + (i * Math.PI) / 4;
      spokes.moveTo(wx - Math.cos(a) * 7, -8 - Math.sin(a) * 7);
      spokes.lineTo(wx + Math.cos(a) * 7, -8 + Math.sin(a) * 7);
    }

    ctx.lineWidth = 0.7;
    ctx.stroke(spokes);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(wx, -8, 9.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.lineWidth = 1.8;
  }

  ctx.strokeStyle = pal.brine;
  ctx.lineWidth = 2.6;
  const frame = new Path2D();
  frame.moveTo(11, -26);
  frame.quadraticCurveTo(6, -14, 1, -7);
  frame.lineTo(-6, -22);
  frame.moveTo(-14, -8);
  frame.lineTo(-6, -22);
  frame.lineTo(-6, -25);
  frame.moveTo(-14, -8);
  frame.lineTo(1, -7);
  frame.moveTo(11, -27);
  frame.lineTo(14, -8);
  ctx.stroke(frame);
  ctx.lineWidth = 1.8;
  const rack = new Path2D();
  rack.roundRect(13.5, -24, 7, 5, 1);
  rack.moveTo(13.5, -21.5);
  rack.lineTo(12.2, -22);
  ctx.stroke(rack);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.6;
  const bars = new Path2D();
  bars.moveTo(-10, -26);
  bars.lineTo(-3, -26);
  bars.moveTo(11, -27);
  bars.lineTo(7, -27);
  ctx.stroke(bars);
  ctx.beginPath();
  ctx.arc(1, -7, 2.2, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 3;
  const nearLeg = new Path2D();
  jointed(
    nearLeg,
    hipX,
    hipY,
    1 + Math.cos(crank) * 4,
    -7 + Math.sin(crank) * 4,
    11,
    11,
    -1,
  );
  ctx.stroke(nearLeg);
  const torso = new Path2D();
  torso.moveTo(-8, -24);
  torso.lineTo(-3, -24);
  torso.lineTo(0, -37);
  torso.lineTo(-6, -38);
  torso.closePath();
  ctx.fill(torso);
  ctx.beginPath();
  ctx.arc(-2, -42, 3.6, 0, TAU);
  ctx.fill();
  const arm = new Path2D();
  jointed(arm, -2, -35, 8, -27, 7, 7.5, 1);
  ctx.lineWidth = 2.6;
  ctx.stroke(arm);
  ctx.restore();
}

export function hotdog(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
) {
  const p = project(cam, x, y, z);
  const w = Math.max(6, 0.42 * p.s);
  const h = w * 0.34;
  ctx.fillStyle = pal.bagel;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, w * 0.04);
  const bun = new Path2D();
  bun.roundRect(p.sx - w / 2, p.sy - h / 2, w, h, h / 2);
  ctx.fill(bun);
  ctx.stroke(bun);
  ctx.fillStyle = pal.blanket;
  const dog = new Path2D();
  dog.roundRect(
    p.sx - w / 2 - h * 0.15,
    p.sy - h * 0.3,
    w + h * 0.3,
    h * 0.42,
    h * 0.3,
  );
  ctx.fill(dog);
  ctx.stroke(dog);
  ctx.strokeStyle = pal.gold;
  ctx.lineWidth = Math.max(0.8, w * 0.05);
  const mustard = new Path2D();
  mustard.moveTo(p.sx - w * 0.4, p.sy - h * 0.1);
  for (let i = 1; i <= 6; i += 1) {
    mustard.lineTo(
      p.sx - w * 0.4 + (i * w * 0.8) / 6,
      p.sy - h * 0.1 + (i % 2 === 0 ? -1 : 1) * h * 0.14,
    );
  }

  ctx.stroke(mustard);
}

export function duck(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  y: number,
  z: number,
) {
  const p = project(cam, x, y, z);
  const r = Math.max(3, 0.16 * p.s);
  ctx.fillStyle = pal.gold;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, r * 1.2, r * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.sx + r * 0.7, p.sy - r * 0.9, r * 0.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.blanket;
  ctx.beginPath();
  ctx.moveTo(p.sx + r * 1.25, p.sy - r * 0.95);
  ctx.lineTo(p.sx + r * 1.85, p.sy - r * 0.75);
  ctx.lineTo(p.sx + r * 1.25, p.sy - r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(p.sx + r * 0.85, p.sy - r * 1.05, r * 0.1, 0, TAU);
  ctx.fill();
}

export function lamppost(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.6, z, 0.5, 0.15, pal.shade);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(1.2, 0.09 * s);
  ctx.lineCap = "round";
  const post = new Path2D();
  post.moveTo(base.sx, base.sy);
  post.lineTo(base.sx, base.sy - 3.4 * s);
  post.quadraticCurveTo(
    base.sx,
    base.sy - 3.9 * s,
    base.sx + 0.35 * s,
    base.sy - 3.9 * s,
  );
  ctx.stroke(post);
  if (cam.isNight === true) {
    ctx.fillStyle = pal.gold;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(base.sx + 0.35 * s, base.sy - 3.9 * s, 1.6 * s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = cam.isNight === true ? pal.gold : pal.paper;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  ctx.beginPath();
  ctx.moveTo(base.sx + 0.35 * s, base.sy - 4.5 * s);
  ctx.lineTo(base.sx + 0.62 * s, base.sy - 3.7 * s);
  ctx.lineTo(base.sx + 0.08 * s, base.sy - 3.7 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export type Look = {
  build: number;
  hair: "short" | "long" | "bun" | "cap" | "curls" | "hijab" | "locs";
  isSkirt: boolean;
  isChair: boolean;
  height: number;
};

export function lookFrom(roll: () => number): Look {
  const hairs: Array<Look["hair"]> = [
    "short",
    "long",
    "bun",
    "cap",
    "curls",
    "hijab",
    "locs",
  ];

  return {
    build: 0.85 + roll() * 0.4,
    hair: hairs[Math.floor(roll() * hairs.length)] ?? "short",
    isSkirt: roll() < 0.3,
    isChair: roll() < 0.12,
    height: 0.9 + roll() * 0.2,
  };
}

function limb(
  path: Path2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  path.moveTo(x0, y0);
  path.lineTo(x1, y1);
  path.lineTo(x2, y2);
}

function hairOf(
  ctx: CanvasRenderingContext2D,
  look: Look,
  hx: number,
  hy: number,
) {
  const r = 3.7;
  ctx.beginPath();
  switch (look.hair) {
    case "long": {
      ctx.moveTo(hx - r, hy);
      ctx.quadraticCurveTo(hx - r - 1.5, hy + 6, hx - r - 2.2, hy + 11);
      ctx.lineTo(hx - 1, hy + 9);
      ctx.lineTo(hx - r + 0.5, hy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy - 0.4, r + 0.7, Math.PI, TAU);
      ctx.fill();

      return;
    }

    case "bun": {
      ctx.arc(hx - 3.4, hy - 3.2, 2.1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy - 0.3, r + 0.5, Math.PI, TAU);
      ctx.fill();

      return;
    }

    case "cap": {
      ctx.arc(hx, hy - 0.6, r + 0.6, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 0.8);
      ctx.lineTo(hx + 7.5, hy + 0.3);
      ctx.lineTo(hx + 1, hy + 1.4);
      ctx.closePath();
      ctx.fill();

      return;
    }

    case "curls": {
      for (let i = 0; i < 7; i += 1) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.moveTo(hx, hy);
        ctx.arc(
          hx + Math.cos(a) * (r + 0.6),
          hy + Math.sin(a) * (r + 0.6),
          2,
          0,
          TAU,
        );
      }

      ctx.fill();

      return;
    }

    case "hijab": {
      ctx.moveTo(hx - r - 1.2, hy - 1);
      ctx.quadraticCurveTo(hx, hy - r - 2.6, hx + r + 1, hy - 1);
      ctx.quadraticCurveTo(hx + r + 1.6, hy + 4, hx + 2, hy + 6.5);
      ctx.lineTo(hx - 3, hy + 7);
      ctx.quadraticCurveTo(hx - r - 2.2, hy + 4, hx - r - 1.2, hy - 1);
      ctx.closePath();
      ctx.fill();

      return;
    }

    case "locs": {
      ctx.arc(hx, hy - 0.4, r + 0.7, Math.PI, TAU);
      ctx.fill();
      ctx.lineWidth = 1.3;
      const strands = new Path2D();
      for (let i = 0; i < 5; i += 1) {
        const sx = hx - r + 0.4 + i * 1.5;
        strands.moveTo(sx, hy - 1);
        strands.lineTo(sx - 1.6, hy + 8 + (i % 2) * 2);
      }

      ctx.stroke(strands);

      return;
    }

    default: {
      ctx.arc(hx, hy - 0.5, r + 0.45, Math.PI, TAU);
      ctx.fill();
    }
  }
}

function standing(ctx: CanvasRenderingContext2D, look: Look, phase: number) {
  const sw = 4.4 * look.build;
  const hw = 3.2 * look.build;
  const bob = -Math.abs(Math.sin(phase)) * 1.1;
  ctx.translate(0, bob);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const legs = new Path2D();
  for (const [i, side] of [-1, 1].entries()) {
    const ph = phase + i * Math.PI;
    const swing = Math.sin(ph) * 0.62;
    const bend = Math.max(0, Math.sin(ph - 0.9)) * 1.1;
    const hipX = side * 1.4;
    const hipY = -20;
    const kneeX = hipX + Math.sin(swing) * 10.5;
    const kneeY = hipY + Math.cos(swing) * 10.5;
    const shinA = swing - bend;
    const ankleX = kneeX + Math.sin(shinA) * 10.2;
    const ankleY = kneeY + Math.cos(shinA) * 10.2;
    limb(legs, hipX, hipY, kneeX, kneeY, ankleX, ankleY);
    legs.moveTo(ankleX, ankleY);
    legs.lineTo(ankleX + 3.4, ankleY - 0.4);
  }

  ctx.lineWidth = 4.6 * look.build;
  ctx.stroke(legs);

  const torso = new Path2D();
  torso.moveTo(-sw, -37);
  torso.quadraticCurveTo(-sw - 0.6, -30, -hw, -21);
  torso.lineTo(hw, -21);
  torso.quadraticCurveTo(sw + 1, -30, sw + 0.6, -37);
  torso.quadraticCurveTo(0, -39.5, -sw, -37);
  torso.closePath();
  ctx.fill(torso);
  if (look.isSkirt) {
    const skirt = new Path2D();
    skirt.moveTo(-hw, -22);
    skirt.lineTo(-hw - 3.2, -9);
    skirt.lineTo(hw + 3.2, -9);
    skirt.lineTo(hw, -22);
    skirt.closePath();
    ctx.fill(skirt);
  }

  const back = new Path2D();
  const armSwing = -Math.sin(phase) * 0.7;
  const ex = -sw + 0.5 + Math.sin(armSwing) * 8;
  const ey = -35 + Math.cos(armSwing) * 8;
  limb(
    back,
    -sw + 0.8,
    -35.5,
    ex,
    ey,
    ex + Math.sin(armSwing + 1.3) * 7,
    ey + Math.cos(armSwing + 1.3) * 7,
  );
  ctx.lineWidth = 3.8 * look.build;
  ctx.stroke(back);

  const front = new Path2D();
  limb(front, sw - 0.6, -35.5, sw + 4.5, -30.5, sw + 5.6, -25.5);
  ctx.stroke(front);
  ctx.beginPath();
  ctx.arc(sw + 5.8, -25.2, 2, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(1, -42.6, 3.7, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-1.2, -40.5, 2.4, 3);
  ctx.fill();
  hairOf(ctx, look, 1, -42.6);
}

function rolling(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  look: Look,
  phase: number,
) {
  const sw = 4.4 * look.build;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.paper;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(-2, -11, 10.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const spokes = new Path2D();
  for (let i = 0; i < 4; i += 1) {
    const a = phase * 0.9 + (i * Math.PI) / 4;
    spokes.moveTo(-2 - Math.cos(a) * 9.5, -11 - Math.sin(a) * 9.5);
    spokes.lineTo(-2 + Math.cos(a) * 9.5, -11 + Math.sin(a) * 9.5);
  }

  ctx.lineWidth = 1;
  ctx.stroke(spokes);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(11, -3, 2.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 2.6;
  const frame = new Path2D();
  frame.moveTo(-7, -22);
  frame.lineTo(-6, -12);
  frame.moveTo(-4, -21.5);
  frame.lineTo(9, -21.5);
  frame.lineTo(11, -6);
  frame.moveTo(9, -21.5);
  frame.lineTo(12, -8);
  ctx.stroke(frame);

  const legs = new Path2D();
  limb(legs, 0, -22, 9.5, -21, 10.5, -8.5);
  legs.moveTo(10.5, -8.5);
  legs.lineTo(14, -8.2);
  ctx.lineWidth = 4.6 * look.build;
  ctx.stroke(legs);

  const torso = new Path2D();
  torso.moveTo(-sw - 1, -37);
  torso.quadraticCurveTo(-sw - 1.2, -30, -3, -22);
  torso.lineTo(4, -22);
  torso.quadraticCurveTo(sw, -30, sw, -37);
  torso.quadraticCurveTo(-0.5, -39.5, -sw - 1, -37);
  torso.closePath();
  ctx.fill(torso);

  const push = new Path2D();
  const a = phase * 0.9;
  const rimX = -2 + Math.cos(a) * 10.5;
  const rimY = -11 + Math.sin(a) * 10.5;
  limb(push, -sw, -35, (-sw + rimX) / 2 - 2, (-35 + rimY) / 2, rimX, rimY);
  ctx.lineWidth = 3.8 * look.build;
  ctx.stroke(push);
  const front = new Path2D();
  limb(front, sw - 1.2, -35.5, sw + 3.5, -31, sw + 5, -27);
  ctx.stroke(front);
  ctx.beginPath();
  ctx.arc(sw + 5.2, -26.7, 2, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -42.6, 3.7, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-1.6, -40.5, 2.4, 3);
  ctx.fill();
  hairOf(ctx, look, 0, -42.6);
}

export function handAt(cam: Cam, x: number, z: number, look: Look) {
  return project(cam, x + 0.3, look.isChair ? 0.98 : 1 * look.height, z);
}

export function walker(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  stride: number,
  lean: number,
  look: Look,
) {
  const p = project(cam, x, 0, z);
  const k = (1.75 * look.height * p.s) / 46;
  groundEllipse(ctx, cam, x - 0.9, z, look.isChair ? 1.2 : 1, 0.3, pal.shade);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(k, k);
  ctx.rotate(lean);
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.ink;
  if (look.isChair) {
    rolling(ctx, pal, look, stride * 2.2);
  } else {
    standing(ctx, look, stride * 2.2);
  }

  ctx.restore();
}

export function leash(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  from: { sx: number; sy: number },
  via: { sx: number; sy: number } | null,
  to: { sx: number; sy: number },
  stretch: number,
) {
  ctx.strokeStyle = stretch > 1.35 ? pal.blanket : pal.ink;
  ctx.lineWidth = stretch > 1.35 ? 1.8 : 1.2;
  ctx.globalAlpha = 0.85;
  const line = new Path2D();
  line.moveTo(from.sx, from.sy);
  if (via != null) {
    line.lineTo(via.sx, via.sy);
  } else {
    const sag = Math.max(0, (1 - stretch) * 18);
    line.quadraticCurveTo(
      (from.sx + to.sx) / 2,
      Math.max(from.sy, to.sy) + sag,
      to.sx,
      to.sy,
    );
    ctx.stroke(line);
    ctx.globalAlpha = 1;

    return;
  }

  line.lineTo(to.sx, to.sy);
  ctx.stroke(line);
  ctx.globalAlpha = 1;
}

export function carriage(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  stride: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 2) {
    return;
  }

  groundEllipse(ctx, cam, x - 1.5, z, 3.2, 0.9, pal.shade);
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(1, 0.06 * s);
  const horse = project(cam, x, 0, z + 2.6);
  const hk = horse.s;
  ctx.beginPath();
  ctx.ellipse(horse.sx, horse.sy - 1.25 * hk, 1.05 * hk, 0.5 * hk, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    horse.sx + 0.2 * hk,
    horse.sy - 2 * hk,
    0.32 * hk,
    0.6 * hk,
    0.3,
    0,
    TAU,
  );
  ctx.fill();
  const legs = new Path2D();
  const swing = Math.sin(stride * 4) * 0.25 * hk;
  for (const lx of [-0.7, -0.4, 0.4, 0.7]) {
    legs.moveTo(horse.sx + lx * hk, horse.sy - 0.9 * hk);
    legs.lineTo(horse.sx + lx * hk + (lx > 0 ? swing : -swing), horse.sy);
  }

  ctx.lineWidth = Math.max(1, 0.12 * hk);
  ctx.stroke(legs);
  ctx.fillStyle = pal.paper;
  ctx.lineWidth = Math.max(1, 0.06 * s);
  const body = new Path2D();
  body.roundRect(
    base.sx - 1.3 * s,
    base.sy - 1.9 * s,
    2.6 * s,
    1.3 * s,
    0.2 * s,
  );
  ctx.fill(body);
  ctx.stroke(body);
  ctx.beginPath();
  ctx.moveTo(base.sx - 1.3 * s, base.sy - 1.9 * s);
  ctx.quadraticCurveTo(
    base.sx - 0.6 * s,
    base.sy - 2.9 * s,
    base.sx + 0.6 * s,
    base.sy - 2.4 * s,
  );
  ctx.lineTo(base.sx + 0.6 * s, base.sy - 1.9 * s);
  ctx.closePath();
  ctx.fillStyle = pal.ink;
  ctx.fill();
  ctx.fillStyle = pal.paper;
  for (const wx of [-0.9, 0.9]) {
    ctx.beginPath();
    ctx.arc(base.sx + wx * s, base.sy - 0.4 * s, 0.45 * s, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(base.sx + wx * s, base.sy - 0.4 * s, 0.08 * s, 0, TAU);
    ctx.stroke();
  }
}

export function client(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  plate: HTMLImageElement | null,
) {
  const p = project(cam, x, 0, z);
  const k = (1.75 * p.s) / 46;
  if (k * 46 < 4) {
    return;
  }

  groundEllipse(ctx, cam, x - 0.9, z, 1.2, 0.3, pal.shade);
  ctx.save();
  ctx.translate(p.sx, p.sy);
  ctx.scale(k, k);
  figure(ctx, pal, 0, false);
  ctx.lineWidth = 3;
  ctx.strokeStyle = pal.ink;
  const arm = new Path2D();
  arm.moveTo(3, -35);
  arm.lineTo(12, -28);
  ctx.stroke(arm);
  ctx.restore();
  if (plate != null) {
    cutout(ctx, cam, pal, plate, x + 0.9, 0, z + 0.1, 0.55, false, 0);
  }
}

export function pond(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  rx: number,
  rz: number,
  t: number,
  seed: number,
) {
  const shore = new Path2D();
  const lobes = 9;
  for (let i = 0; i <= lobes; i += 1) {
    const a = (i / lobes) * TAU;
    const wob = 0.82 + 0.28 * hash(seed * 7 + i);
    const p = project(
      cam,
      x + Math.cos(a) * rx * wob,
      0,
      z + Math.sin(a) * rz * wob,
    );
    if (i === 0) {
      shore.moveTo(p.sx, p.sy);
    } else {
      shore.lineTo(p.sx, p.sy);
    }
  }

  shore.closePath();
  ctx.fillStyle = pal.water;
  ctx.fill(shore);
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.stroke(shore);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = pal.foam;
  for (let k = -2; k <= 2; k += 1) {
    const p = project(cam, x, 0, z + (k * rz) / 3);
    const span = rx * 0.55 * p.s;
    const wave = Math.max(2, 0.4 * p.s);
    const ripple = new Path2D();
    for (let sx = -span; sx <= span; sx += wave * 2) {
      const phase = t * 1.6 + k;
      ripple.moveTo(p.sx + sx, p.sy + Math.sin(phase) * wave * 0.15);
      ripple.quadraticCurveTo(
        p.sx + sx + wave * 0.6,
        p.sy - wave * 0.32,
        p.sx + sx + wave * 1.3,
        p.sy,
      );
    }

    ctx.lineWidth = 1.2;
    ctx.stroke(ripple);
  }

  ctx.globalAlpha = 1;
}

export type HouseStyle = "cottage" | "columns" | "stone" | "flat";

export function house(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  style: HouseStyle,
) {
  const side = x < cam.x ? 1 : -1;
  const near = project(cam, x, 0, z);
  if (near.s < 1 || near.sx < -600 || near.sx > cam.w + 600) {
    return;
  }

  const far = project(cam, x, 0, z + d);
  const nearTop = project(cam, x, h, z);
  const farTop = project(cam, x, h, z + d);
  const outer = project(cam, x - side * w, 0, z);
  const outerTop = project(cam, x - side * w, h, z);
  groundEllipse(
    ctx,
    cam,
    x - w * 0.4,
    z + d / 2,
    w * 0.8 + h * 0.5,
    d * 0.6,
    pal.shade,
  );
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.04 * near.s);

  const flank = new Path2D();
  flank.moveTo(near.sx, near.sy);
  flank.lineTo(nearTop.sx, nearTop.sy);
  flank.lineTo(farTop.sx, farTop.sy);
  flank.lineTo(far.sx, far.sy);
  flank.closePath();
  ctx.fillStyle = pal.stone;
  ctx.fill(flank);
  ctx.stroke(flank);

  const front = new Path2D();
  front.moveTo(near.sx, near.sy);
  front.lineTo(nearTop.sx, nearTop.sy);
  front.lineTo(outerTop.sx, outerTop.sy);
  front.lineTo(outer.sx, outer.sy);
  front.closePath();
  ctx.fillStyle = style === "stone" ? pal.stone : pal.paper;
  ctx.fill(front);
  ctx.stroke(front);

  switch (style) {
    case "cottage": {
      const peak = project(cam, x - (side * w) / 2, h * 1.5, z);
      const peakFar = project(cam, x - (side * w) / 2, h * 1.5, z + d);
      const roof = new Path2D();
      roof.moveTo(nearTop.sx, nearTop.sy);
      roof.lineTo(peak.sx, peak.sy);
      roof.lineTo(outerTop.sx, outerTop.sy);
      roof.closePath();
      roof.moveTo(nearTop.sx, nearTop.sy);
      roof.lineTo(peak.sx, peak.sy);
      roof.lineTo(peakFar.sx, peakFar.sy);
      roof.lineTo(farTop.sx, farTop.sy);
      roof.closePath();
      ctx.fillStyle = pal.blanket;
      ctx.fill(roof);
      ctx.stroke(roof);

      break;
    }
    case "columns": {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = Math.max(1, 0.12 * near.s);
      const cols = new Path2D();
      for (let i = 1; i < 6; i += 1) {
        const cx = x - (side * w * i) / 6;
        const a = project(cam, cx, 0, z - 0.4);
        const b = project(cam, cx, h * 0.92, z - 0.4);
        cols.moveTo(a.sx, a.sy);
        cols.lineTo(b.sx, b.sy);
      }

      ctx.stroke(cols);
      const pedTop = project(cam, x - (side * w) / 2, h * 1.35, z - 0.4);
      const pedL = project(cam, x, h, z - 0.4);
      const pedR = project(cam, x - side * w, h, z - 0.4);
      const pediment = new Path2D();
      pediment.moveTo(pedL.sx, pedL.sy);
      pediment.lineTo(pedTop.sx, pedTop.sy);
      pediment.lineTo(pedR.sx, pedR.sy);
      pediment.closePath();
      ctx.lineWidth = Math.max(0.8, 0.04 * near.s);
      ctx.fillStyle = pal.paper;
      ctx.fill(pediment);
      ctx.stroke(pediment);

      break;
    }
    case "stone": {
      ctx.fillStyle = pal.stone;
      for (let i = 0; i < 6; i += 1) {
        const cx = x - side * w * (0.08 + (i * 0.84) / 5);
        const a = project(cam, cx, h, z);
        ctx.fillRect(
          a.sx - 0.12 * a.s,
          a.sy - 0.5 * a.s,
          0.24 * a.s,
          0.5 * a.s,
        );
        ctx.strokeRect(
          a.sx - 0.12 * a.s,
          a.sy - 0.5 * a.s,
          0.24 * a.s,
          0.5 * a.s,
        );
      }

      break;
    }
    // No default
  }

  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.4;
  for (let i = 1; i < 4; i += 1) {
    const cx = x - (side * w * i) / 4;
    const win = project(cam, cx, h * 0.55, z - 0.05);
    ctx.fillRect(
      win.sx - 0.18 * win.s,
      win.sy - 0.35 * win.s,
      0.36 * win.s,
      0.7 * win.s,
    );
  }

  ctx.globalAlpha = 1;
}

export function carousel(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  t: number,
) {
  const base = project(cam, x, 0, z);
  const s = base.s;
  if (s < 1.5) {
    return;
  }

  groundEllipse(ctx, cam, x, z, 4.2, 2.4, pal.stone);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * s);
  const poles = new Path2D();
  for (let i = 0; i < 8; i += 1) {
    const a = t * 0.8 + (i / 8) * TAU;
    const px = x + Math.cos(a) * 3.4;
    const pz = z + Math.sin(a) * 2;
    const a0 = project(cam, px, 0.2, pz);
    const a1 = project(cam, px, 3.2, pz);
    poles.moveTo(a0.sx, a0.sy);
    poles.lineTo(a1.sx, a1.sy);
    const horse = project(cam, px, 1.1 + Math.sin(a * 3) * 0.25, pz);
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.ellipse(horse.sx, horse.sy, 0.5 * horse.s, 0.28 * horse.s, 0, 0, TAU);
    ctx.fill();
  }

  ctx.stroke(poles);
  const top = project(cam, x, 3.3, z);
  const peak = project(cam, x, 5.4, z);
  const rim = new Path2D();
  rim.ellipse(top.sx, top.sy, 4.4 * top.s, 1.7 * top.s, 0, 0, TAU);
  ctx.fillStyle = pal.blanket;
  ctx.fill(rim);
  ctx.stroke(rim);
  const cone = new Path2D();
  cone.moveTo(top.sx - 4.4 * top.s, top.sy);
  cone.lineTo(peak.sx, peak.sy);
  cone.lineTo(top.sx + 4.4 * top.s, top.sy);
  ctx.fillStyle = pal.paper;
  ctx.fill(cone);
  ctx.stroke(cone);
  const stripes = new Path2D();
  for (let i = 1; i < 8; i += 1) {
    const sx = top.sx - 4.4 * top.s + (i * 8.8 * top.s) / 8;
    stripes.moveTo(sx, top.sy - Math.abs(sx - top.sx) * 0.02);
    stripes.lineTo(peak.sx, peak.sy);
  }

  ctx.globalAlpha = 0.4;
  ctx.stroke(stripes);
  ctx.globalAlpha = 1;
}

export function rock(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  w: number,
  h: number,
  seed: number,
) {
  const base = project(cam, x, 0, z);
  if (base.s < 1) {
    return;
  }

  const mound = new Path2D();
  const n = 7;
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const px = x - w / 2 + f * w;
    const py = Math.sin(f * Math.PI) * h * (0.75 + 0.35 * hash(seed * 5 + i));
    const p = project(cam, px, py, z + Math.sin(f * Math.PI) * 0.4);
    if (i === 0) {
      mound.moveTo(p.sx, p.sy);
    } else {
      mound.lineTo(p.sx, p.sy);
    }
  }

  mound.closePath();
  ctx.fillStyle = pal.stone;
  ctx.fill(mound);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(0.8, 0.05 * base.s);
  ctx.stroke(mound);
  ctx.save();
  ctx.clip(mound);
  ctx.globalAlpha = 0.35;
  const hatch = new Path2D();
  for (let i = -3; i < 4; i += 1) {
    const a = project(cam, x + (i * w) / 6, 0, z);
    const b = project(cam, x + (i * w) / 6 + w * 0.25, h, z);
    hatch.moveTo(a.sx, a.sy);
    hatch.lineTo(b.sx, b.sy);
  }

  ctx.stroke(hatch);
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function arch(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  w: number,
) {
  const l = project(cam, x - w / 2, 0, z);
  if (l.s < 0.5 || z < cam.z + 1) {
    return;
  }

  const r = project(cam, x + w / 2, 0, z);
  const lTop = project(cam, x - w / 2, 3.2, z);
  const rTop = project(cam, x + w / 2, 3.2, z);
  const peak = project(cam, x, 5.6, z);
  const capL = project(cam, x - w / 2 - 1.2, 4.6, z);
  const capR = project(cam, x + w / 2 + 1.2, 4.6, z);
  const baseL = project(cam, x - w / 2 - 1.2, 0, z);
  const baseR = project(cam, x + w / 2 + 1.2, 0, z);
  ctx.fillStyle = pal.stone;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(1, 0.05 * l.s);
  const stone = new Path2D();
  stone.moveTo(baseL.sx, baseL.sy);
  stone.lineTo(capL.sx, capL.sy);
  stone.lineTo(capR.sx, capR.sy);
  stone.lineTo(baseR.sx, baseR.sy);
  stone.lineTo(r.sx, r.sy);
  stone.lineTo(rTop.sx, rTop.sy);
  stone.quadraticCurveTo(peak.sx, peak.sy, lTop.sx, lTop.sy);
  stone.lineTo(l.sx, l.sy);
  stone.closePath();
  ctx.fill(stone);
  ctx.stroke(stone);
  ctx.globalAlpha = 0.35;
  const joints = new Path2D();
  for (let i = 1; i < 6; i += 1) {
    const a = project(cam, x - w / 2 - 1.2, (i * 4.6) / 6, z);
    const b = project(cam, x - w / 2, (i * 4.6) / 6, z);
    joints.moveTo(a.sx, a.sy);
    joints.lineTo(b.sx, b.sy);
    const c = project(cam, x + w / 2, (i * 4.6) / 6, z);
    const d = project(cam, x + w / 2 + 1.2, (i * 4.6) / 6, z);
    joints.moveTo(c.sx, c.sy);
    joints.lineTo(d.sx, d.sy);
  }

  ctx.stroke(joints);
  ctx.globalAlpha = 1;
}

export function backstop(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  z: number,
  w: number,
) {
  const l = project(cam, x - w / 2, 0, z);
  if (l.s < 1) {
    return;
  }

  const r = project(cam, x + w / 2, 0, z);
  const lt = project(cam, x - w / 2, 5, z);
  const rt = project(cam, x + w / 2, 5, z);
  ctx.strokeStyle = pal.post;
  ctx.lineWidth = Math.max(1, 0.08 * l.s);
  const frame = new Path2D();
  frame.moveTo(l.sx, l.sy);
  frame.lineTo(lt.sx, lt.sy);
  frame.lineTo(rt.sx, rt.sy);
  frame.lineTo(r.sx, r.sy);
  ctx.stroke(frame);
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 0.7;
  const mesh = new Path2D();
  for (let i = 1; i < 6; i += 1) {
    const a = project(cam, x - w / 2, i, z);
    const b = project(cam, x + w / 2, i, z);
    mesh.moveTo(a.sx, a.sy);
    mesh.lineTo(b.sx, b.sy);
  }

  for (let i = 1; i < 8; i += 1) {
    const a = project(cam, x - w / 2 + (i * w) / 8, 0, z);
    const b = project(cam, x - w / 2 + (i * w) / 8, 5, z);
    mesh.moveTo(a.sx, a.sy);
    mesh.lineTo(b.sx, b.sy);
  }

  ctx.stroke(mesh);
  ctx.globalAlpha = 1;
}

export function railing(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pal: Palette,
  x: number,
  zFrom: number,
  zTo: number,
  height: number,
) {
  const a = project(cam, x, height, zFrom);
  if (a.s < 0.5) {
    return;
  }

  const from = Math.max(zFrom, cam.z + 7);
  if (from > zTo) {
    return;
  }

  const start = project(cam, x, height, from);
  const b = project(cam, x, height, zTo);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.min(2.2, Math.max(0.8, 0.05 * start.s));
  const rail = new Path2D();
  rail.moveTo(start.sx, start.sy);
  rail.lineTo(b.sx, b.sy);
  for (let z = Math.ceil(from / 1.6) * 1.6; z <= zTo; z += 1.6) {
    const foot = project(cam, x, 0, z);
    const top = project(cam, x, height, z);
    rail.moveTo(foot.sx, foot.sy);
    rail.lineTo(top.sx, top.sy);
  }

  ctx.globalAlpha = 0.8;
  ctx.stroke(rail);
  ctx.globalAlpha = 1;
}
