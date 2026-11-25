export interface Spec { size: "970x600" | "970x300" | "300x300"; w: number; h: number }
export const SPECS: Spec[] = [
  { size: "970x600", w: 970, h: 600 },
  { size: "970x300", w: 970, h: 300 },
  { size: "300x300", w: 300, h: 300 },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

/** Draws an opaque RGB banner: cream background, image on the right (cover-fit), headline and body on the left. */
export function drawBanner(canvas: HTMLCanvasElement, spec: Spec, headline: string, body: string, img: HTMLImageElement | null) {
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const { w, h } = spec;
  ctx.fillStyle = "#F6EEDF";
  ctx.fillRect(0, 0, w, h);

  const square = spec.size === "300x300";
  const imgW = square ? w : Math.round(w * 0.42);
  const imgX = square ? 0 : w - imgW;

  if (img) {
    // cover-fit the picture into its box
    const boxW = imgW;
    const boxH = h;
    const scale = Math.max(boxW / img.width, boxH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(imgX, 0, boxW, boxH);
    ctx.clip();
    ctx.drawImage(img, imgX + (boxW - dw) / 2, (boxH - dh) / 2, dw, dh);
    ctx.restore();
  } else if (!square) {
    ctx.fillStyle = "#15382A";
    ctx.fillRect(imgX, 0, imgW, h);
  }

  if (square) {
    // text sits on a solid band at the bottom so it stays readable over the picture
    const bandH = Math.round(h * 0.4);
    ctx.fillStyle = "rgba(21,56,42,0.92)";
    ctx.fillRect(0, h - bandH, w, bandH);
    ctx.fillStyle = "#FFC94D";
    ctx.font = "bold 22px Arial, Helvetica, sans-serif";
    wrap(ctx, headline, w - 32).slice(0, 2).forEach((l, i) => ctx.fillText(l, 16, h - bandH + 32 + i * 26));
    return;
  }

  const pad = 40;
  const textW = w - imgW - pad * 2;
  const hSize = spec.h >= 500 ? 44 : 34;
  const bSize = spec.h >= 500 ? 22 : 18;
  ctx.fillStyle = "#15382A";
  ctx.font = `bold ${hSize}px Arial, Helvetica, sans-serif`;
  const hLines = wrap(ctx, headline, textW).slice(0, 4);
  let y = pad + hSize;
  hLines.forEach((l) => { ctx.fillText(l, pad, y); y += hSize * 1.15; });
  y += 10;
  ctx.fillStyle = "#333333";
  ctx.font = `${bSize}px Arial, Helvetica, sans-serif`;
  wrap(ctx, body, textW).slice(0, spec.h >= 500 ? 9 : 4).forEach((l) => { ctx.fillText(l, pad, y); y += bSize * 1.4; });
  ctx.fillStyle = "#FFC94D";
  ctx.fillRect(pad, h - pad - 6, 90, 6);
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}
