export function pawImage(color: string, size = 30): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    return new ImageData(size, size);
  }

  const s = size / 30;
  ctx.fillStyle = color;

  const toes: Array<[number, number, number, number, number]> = [
    [7.4, 10.6, 3.1, 3.9, -0.24],
    [13.1, 7.6, 3.3, 4.3, -0.08],
    [19.2, 8.4, 3.2, 4.1, 0.12],
    [24.1, 13.4, 2.8, 3.5, 0.3],
  ];

  for (const [x, y, rx, ry, tilt] of toes) {
    ctx.beginPath();
    ctx.ellipse(x * s, y * s, rx * s, ry * s, tilt, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(14.6 * s, 20.6 * s, 7.1 * s, 6.2 * s, 0.06, 0, Math.PI * 2);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}
