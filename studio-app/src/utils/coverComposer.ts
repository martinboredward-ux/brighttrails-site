import { jsPDF } from "jspdf";
import type { Book, CoverSettings } from "../types";

/** KDP spine width per page, in inches, by paper type. */
export const SPINE_PER_PAGE = { white: 0.002252, cream: 0.0025, color: 0.002347 } as const;
export const BLEED = 0.125;
export const DPI = 300;

export const trimSize = (t: "6x9" | "8.5x11") => (t === "6x9" ? { w: 6, h: 9 } : { w: 8.5, h: 11 });

export function spineWidth(pages: number, paper: keyof typeof SPINE_PER_PAGE = "white"): number {
  return Math.round(Math.max(0, pages) * SPINE_PER_PAGE[paper] * 1000) / 1000;
}

export interface WrapGeometry { trimW: number; trimH: number; spine: number; totalW: number; totalH: number }
export function wrapGeometry(s: CoverSettings, fallbackTrim: "6x9" | "8.5x11"): WrapGeometry {
  const t = trimSize(s.trim ?? fallbackTrim);
  const spine = spineWidth(s.pageCount ?? 90, s.paper ?? "white");
  return { trimW: t.w, trimH: t.h, spine, totalW: 2 * t.w + spine + 2 * BLEED, totalH: t.h + 2 * BLEED };
}

export function coverDefaults(book: Book): CoverSettings {
  const c = book.cover ?? {};
  return {
    title: c.title ?? book.title,
    subtitle: c.subtitle ?? book.subtitle,
    author: c.author ?? "",
    seriesPill: c.seriesPill ?? (book.nameplateLabel || (book.seriesName ? `${book.seriesName.toUpperCase()}` : "")),
    pageCount: c.pageCount ?? Math.max(24, book.sections.length * 4 + 20),
    trim: c.trim ?? book.trim,
    paper: c.paper ?? "white",
    frontArtId: c.frontArtId,
    backBlurb: c.backBlurb ?? "",
    barcodeCorner: c.barcodeCorner ?? true,
  };
}

const FONT = '"Nunito","Poppins","Segoe UI",system-ui,sans-serif';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Draws text that shrinks to fit a box. Returns the y below the last line. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, maxLines: number, startPx: number, weight = 800, lh = 1.12): number {
  let px = startPx;
  let lines: string[] = [];
  for (; px >= 20; px -= 4) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    lines = wrapText(ctx, text, maxW);
    if (lines.length <= maxLines) break;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * px * lh));
  return y + lines.length * px * lh;
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, px: number, bg: string, fg: string) {
  ctx.font = `800 ${px}px ${FONT}`;
  const w = ctx.measureText(text).width + px * 1.6;
  const h = px * 1.9;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + px * 0.04);
}

function coverFit(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height);
  const dw = img.width * r, dh = img.height * r;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round(w); c.height = Math.round(h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  return [c, ctx];
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the picture"))), "image/png"));

/** Title, subtitle and author drawn on top of the front art. */
function drawFront(ctx: CanvasRenderingContext2D, s: CoverSettings, x: number, y: number, w: number, h: number, art: (CanvasImageSource & { width: number; height: number }) | null) {
  if (art) coverFit(ctx, art, x, y, w, h);
  else { ctx.fillStyle = "#15382a"; ctx.fillRect(x, y, w, h); }
  const pad = w * 0.08;
  // Soft white panel behind the title so it stays readable on any art.
  const topH = h * 0.27;
  const g = ctx.createLinearGradient(0, y, 0, y + topH);
  g.addColorStop(0, "rgba(255,255,255,0.94)"); g.addColorStop(0.8, "rgba(255,255,255,0.86)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, topH);
  ctx.fillStyle = "#15382a"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  let yy = fitText(ctx, s.title ?? "", x + w / 2, y + h * 0.04, w - pad * 2, 3, w * 0.115, 900);
  if (s.subtitle?.trim()) { ctx.fillStyle = "#1f5a43"; fitText(ctx, s.subtitle, x + w / 2, yy + h * 0.008, w - pad * 2, 3, w * 0.05, 700, 1.2); }
  if (s.seriesPill?.trim()) pill(ctx, s.seriesPill.trim(), x + w / 2, y + h * 0.935 - w * 0.075, w * 0.032, "#ffc94d", "#15382a");
  // Author on a soft panel at the bottom.
  const botH = h * 0.1;
  const g2 = ctx.createLinearGradient(0, y + h - botH, 0, y + h);
  g2.addColorStop(0, "rgba(255,255,255,0)"); g2.addColorStop(0.35, "rgba(255,255,255,0.88)"); g2.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = g2; ctx.fillRect(x, y + h - botH, w, botH);
  ctx.fillStyle = "#15382a"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${w * 0.052}px ${FONT}`;
  ctx.fillText((s.author ?? "").trim(), x + w / 2, y + h - h * 0.032, w - pad * 2);
}

export async function renderEbookCover(s: CoverSettings, art: HTMLImageElement | null): Promise<Blob> {
  const [c, ctx] = canvasOf(1600, 2560);
  drawFront(ctx, s, 0, 0, 1600, 2560, art);
  return toBlob(c);
}

export interface WrapOptions { guides?: boolean }

/** Full paperback wrap at 300 dpi: back (blurb) + spine + front, with bleed. */
export function renderWrapCanvas(s: CoverSettings, fallbackTrim: "6x9" | "8.5x11", art: HTMLImageElement | null, opts: WrapOptions = {}): HTMLCanvasElement {
  const g = wrapGeometry(s, fallbackTrim);
  const [c, ctx] = canvasOf(g.totalW * DPI, g.totalH * DPI);
  const bleed = BLEED * DPI, tw = g.trimW * DPI, th = g.trimH * DPI, sp = g.spine * DPI;
  const backX = 0, spineX = bleed + tw, frontX = bleed + tw + sp;
  // Back cover: warm cream panel with blurb.
  ctx.fillStyle = "#fbf4e4"; ctx.fillRect(0, 0, bleed + tw, c.height);
  // Spine
  ctx.fillStyle = "#15382a"; ctx.fillRect(spineX, 0, sp, c.height);
  // Front (extends into the right bleed)
  drawFront(ctx, s, frontX, 0, bleed + tw, c.height, art);
  // Back content
  const safe = bleed + 0.25 * DPI;
  ctx.fillStyle = "#15382a"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  let y = bleed + 0.55 * DPI;
  y = fitText(ctx, s.title ?? "", backX + safe, y, tw - 0.5 * DPI, 2, tw * 0.1, 900) + 0.18 * DPI;
  ctx.fillStyle = "#1f2f28";
  if (s.backBlurb?.trim()) fitText(ctx, s.backBlurb, backX + safe, y, tw - 0.5 * DPI, 14, tw * 0.045, 600, 1.35);
  if (s.seriesPill?.trim()) pill(ctx, s.seriesPill.trim(), backX + bleed + tw / 2, c.height - bleed - th * 0.2, tw * 0.03, "#ffc94d", "#15382a");
  // Barcode corner stays empty: KDP prints the barcode here.
  const bw = 2 * DPI, bh = 1.2 * DPI, bx = bleed + tw - 0.25 * DPI - bw, by = c.height - bleed - 0.25 * DPI - bh;
  if (s.barcodeCorner !== false) { ctx.fillStyle = "#ffffff"; ctx.fillRect(bx, by, bw, bh); }
  // Spine text only when KDP allows it (more than 79 pages).
  if ((s.pageCount ?? 0) > 79 && sp > 0.25 * DPI) {
    ctx.save();
    ctx.translate(spineX + sp / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const px = Math.min(sp * 0.5, 0.22 * DPI);
    ctx.font = `800 ${px}px ${FONT}`;
    ctx.fillText(`${(s.title ?? "").slice(0, 46)}${s.author ? "   ·   " + s.author : ""}`, 0, 0, th * 0.75);
    ctx.restore();
  }
  if (opts.guides) {
    ctx.save();
    ctx.lineWidth = 3; ctx.setLineDash([18, 12]);
    ctx.strokeStyle = "#e0245e"; ctx.strokeRect(bleed, bleed, c.width - 2 * bleed, c.height - 2 * bleed);         // trim line
    ctx.strokeStyle = "#1f8fff"; ctx.strokeRect(safe, safe, c.width - 2 * safe, c.height - 2 * safe);               // safe zone
    ctx.strokeStyle = "#ff9d00"; ctx.beginPath(); ctx.moveTo(spineX, 0); ctx.lineTo(spineX, c.height); ctx.moveTo(frontX, 0); ctx.lineTo(frontX, c.height); ctx.stroke();
    ctx.restore();
  }
  return c;
}

export async function renderWrapPng(s: CoverSettings, fallbackTrim: "6x9" | "8.5x11", art: HTMLImageElement | null): Promise<Blob> {
  return toBlob(renderWrapCanvas(s, fallbackTrim, art));
}

export function renderWrapPdf(s: CoverSettings, fallbackTrim: "6x9" | "8.5x11", art: HTMLImageElement | null): Blob {
  const g = wrapGeometry(s, fallbackTrim);
  const c = renderWrapCanvas(s, fallbackTrim, art);
  const pdf = new jsPDF({ orientation: g.totalW > g.totalH ? "landscape" : "portrait", unit: "in", format: [g.totalW, g.totalH] });
  pdf.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, g.totalW, g.totalH);
  return pdf.output("blob");
}
