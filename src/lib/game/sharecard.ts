import type { MapTheme } from "#lib/map-style.js";
import { PALETTES, TAU, tinted } from "./ink";

export type Card = {
  title: string;
  dog: string;
  breed: string;
  plate: HTMLImageElement;
  score: number;
  rank: string;
  lines: Array<string>;
  when: string;
  theme: MapTheme;
};

const W = 1200;
const H = 630;

function paletteOf(theme: MapTheme) {
  return PALETTES[theme];
}

export async function shareCard(card: Card): Promise<Blob | null> {
  await Promise.all([
    document.fonts.load('40px "Alfa Slab One"'),
    document.fonts.load('40px "Source Serif 4 Variable"'),
  ]);

  const pal = paletteOf(card.theme);
  const primary = card.theme === "dark" ? "#d9905f" : "#b8562e";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    return null;
  }

  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.globalAlpha = 1;

  const plateH = 300;
  const plateW = (plateH * card.plate.naturalWidth) / card.plate.naturalHeight;
  const px = 80;
  const py = 400;
  ctx.fillStyle = primary;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(px + plateW / 2, py - 6, plateW * 0.55, 14, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.drawImage(tinted(card.plate, pal.ink), px, py - plateH, plateW, plateH);

  const tx = Math.max(px + plateW + 70, 470);

  ctx.fillStyle = pal.ink;
  ctx.font = '26px "Source Serif 4 Variable", Georgia, serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${card.dog}, a ${card.breed}`, px, py + 48);

  ctx.font = '24px "Alfa Slab One", serif';
  ctx.fillStyle = primary;
  ctx.fillText("EVERY DOG IN NEW YORK", tx, 110);

  ctx.fillStyle = pal.ink;
  ctx.font = '50px "Alfa Slab One", serif';
  ctx.fillText(card.title, tx, 176);

  ctx.font = '140px "Alfa Slab One", serif';
  ctx.fillText(card.score.toLocaleString("en-US"), tx - 6, 320);

  ctx.font = 'italic 38px "Source Serif 4 Variable", Georgia, serif';
  ctx.fillText(card.rank, tx, 378);

  ctx.font = '26px "Source Serif 4 Variable", Georgia, serif';
  const lines = card.lines;
  for (const [i, line] of lines.slice(0, 4).entries()) {
    ctx.fillText(line, tx, 432 + i * 36);
  }

  ctx.globalAlpha = 0.7;
  ctx.font = '22px "Source Serif 4 Variable", Georgia, serif';
  ctx.fillText(`${card.when} · everydog.nyc`, tx, 586);
  ctx.globalAlpha = 1;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
