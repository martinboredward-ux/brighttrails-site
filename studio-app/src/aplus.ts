export interface Spec { size: "970x600" | "970x300" | "300x300"; w: number; h: number }
export const SPECS: Spec[] = [
  { size: "970x600", w: 970, h: 600 },
  { size: "970x300", w: 970, h: 300 },
  { size: "300x300", w: 300, h: 300 },
];

export interface BannerOptions {
  fit: "fit" | "fill";
  /** 300x300 only: caption bar under the picture. */
  textBar: boolean;
}
export const DEFAULT_OPTIONS: BannerOptions = { fit: "fit", textBar: false };

const FOREST = "#15382A";
const CREAM = "#F6EEDF";

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

/** Draws img inside the box. "fit" shows the whole picture with padding; "fill" covers the box and may crop. */
function place(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, mode: "fit" | "fill", pad: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const bw = mode === "fit" ? w - pad * 2 : w;
  const bh = mode === "fit" ? h - pad * 2 : h;
  const scale = mode === "fit" ? Math.min(bw / img.naturalWidth, bh / img.naturalHeight) : Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** Draws an opaque RGB banner at the exact pixel size of the module. */
export function drawBanner(canvas: HTMLCanvasElement, spec: Spec, headline: string, body: string, img: HTMLImageElement | null, opts: BannerOptions = DEFAULT_OPTIONS) {
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const { w, h } = spec;

  if (spec.size === "300x300") {
    ctx.fillStyle = FOREST;
    ctx.fillRect(0, 0, w, h);
    if (img) {
      // Picture only by default. With the caption bar, the picture takes the space above it.
      const barH = opts.textBar ? 64 : 0;
      place(ctx, img, 0, 0, w, h - barH, opts.fit, 14);
      if (opts.textBar) {
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, h - barH, w, barH);
        ctx.fillStyle = FOREST;
        ctx.font = "bold 20px Arial, Helvetica, sans-serif";
        const lines = wrap(ctx, headline, w - 28).slice(0, 2);
        const startY = h - barH + (lines.length === 1 ? 38 : 28);
        lines.forEach((l, i) => ctx.fillText(l, 14, startY + i * 24));
      }
      return;
    }
    // No picture yet: a text tile.
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = FOREST;
    ctx.font = "bold 28px Arial, Helvetica, sans-serif";
    wrap(ctx, headline, w - 40).slice(0, 4).forEach((l, i) => ctx.fillText(l, 20, 56 + i * 34));
    ctx.font = "16px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "#333333";
    wrap(ctx, body, w - 40).slice(0, 6).forEach((l, i) => ctx.fillText(l, 20, 190 + i * 22));
    ctx.fillStyle = "#FFC94D";
    ctx.fillRect(20, h - 30, 70, 6);
    return;
  }

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, w, h);
  const imgW = Math.round(w * 0.42);
  const imgX = w - imgW;
  ctx.fillStyle = FOREST;
  ctx.fillRect(imgX, 0, imgW, h);
  if (img) place(ctx, img, imgX, 0, imgW, h, opts.fit, h >= 500 ? 28 : 18);

  const pad = 40;
  const textW = w - imgW - pad * 2;
  const hSize = h >= 500 ? 44 : 34;
  const bSize = h >= 500 ? 22 : 18;
  ctx.fillStyle = FOREST;
  ctx.font = `bold ${hSize}px Arial, Helvetica, sans-serif`;
  const hLines = wrap(ctx, headline, textW).slice(0, 4);
  let y = pad + hSize;
  hLines.forEach((l) => { ctx.fillText(l, pad, y); y += hSize * 1.15; });
  y += 10;
  ctx.fillStyle = "#333333";
  ctx.font = `${bSize}px Arial, Helvetica, sans-serif`;
  wrap(ctx, body, textW).slice(0, h >= 500 ? 9 : 4).forEach((l) => { ctx.fillText(l, pad, y); y += bSize * 1.4; });
  ctx.fillStyle = "#FFC94D";
  ctx.fillRect(pad, h - pad - 6, 90, 6);
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}
