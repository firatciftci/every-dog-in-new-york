// Hard dilation, not a blur glow: blur bleeds inward on outline plates until the dog is a blob.
const PAD = 12;

// 2.2 percent of a 220px plate, matching `plate-cut` in app.css.
const RING = 4.8;

const STEPS = 24;

const SOFTEN = RING * 0.3;

// Matches `--plate-paper` in app.css.
const PAPER = "#f7f4ec";

function draw(img: HTMLImageElement): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth + PAD * 2;
  canvas.height = img.naturalHeight + PAD * 2;

  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    return new ImageData(canvas.width, canvas.height);
  }

  ctx.filter = `blur(${SOFTEN}px)`;
  for (let i = 0; i < STEPS; i += 1) {
    const angle = (i / STEPS) * Math.PI * 2;
    ctx.drawImage(
      img,
      PAD + Math.cos(angle) * RING,
      PAD + Math.sin(angle) * RING,
    );
  }

  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(img, PAD, PAD);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () =>
      reject(new Error(`plate ${url} failed to load`)),
    );
    img.src = url;
  });
}

const cache = new Map<string, HTMLImageElement>();

export async function plateIcon(url: string): Promise<ImageData> {
  let img = cache.get(url);
  if (img == null) {
    img = await load(url);
    cache.set(url, img);
  }

  return draw(img);
}
