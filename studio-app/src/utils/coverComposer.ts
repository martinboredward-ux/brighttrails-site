import { jsPDF } from "jspdf";
import type { Book, CoverSettings, PaperType } from "../types";
import { trimDims, type Trim } from "./trims";

/** KDP spine width per page, in inches, by paper type. */
export const SPINE_PER_PAGE: Record<PaperType, number> = { white: 0.002252, standardColor: 0.002252, cream: 0.0025, premiumColor: 0.002347 };
export const PAPER_LABEL: Record<PaperType, string> = { standardColor: "Standard Color", premiumColor: "Premium Color", white: "White (black ink)", cream: "Cream (black ink)" };
export const BLEED = 0.125;
export const DPI = 300;

export const spineWidth = (pages: number, paper: PaperType = "white") => Math.round(Math.max(0, pages) * SPINE_PER_PAGE[paper] * 1000) / 1000;

export interface WrapGeometry { trimW: number; trimH: number; spine: number; totalW: number; totalH: number }
export function wrapGeometry(s: CoverSettings, fallbackTrim: Trim): WrapGeometry {
  const t = trimDims(s.trim ?? fallbackTrim);
  const spine = spineWidth(s.pageCount ?? 90, s.paper ?? "white");
  return { trimW: t.w, trimH: t.h, spine, totalW: 2 * t.w + spine + 2 * BLEED, totalH: t.h + 2 * BLEED };
}

export function coverDefaults(book: Book): CoverSettings {
  const c = (book.cover ?? {}) as CoverSettings & { paper?: string };
  const paper = (c.paper as string) === "color" ? "premiumColor" : (c.paper ?? "white");
  return {
    title: c.title ?? book.title,
    subtitle: c.subtitle ?? book.subtitle,
    author: c.author ?? "",
    seriesPill: c.seriesPill ?? (book.nameplateLabel || (book.seriesName ? `${book.seriesName.toUpperCase()}` : "")),
    pageCount: c.pageCount ?? Math.max(24, book.sections.length * 4 + 20),
    trim: c.trim ?? book.trim,
    paper: paper as PaperType,
    frontArtId: c.frontArtId,
    backBlurb: c.backBlurb ?? "",
    barcodeCorner: c.barcodeCorner ?? true,
    fit: c.fit ?? "fill",
    padColor: c.padColor ?? "#bfe3f5",
    shift: c.shift ?? "center",
    titlePlacement: c.titlePlacement ?? "top",
    scrim: c.scrim ?? "softLight",
    textColor: c.textColor ?? "#15382a",
    textEffect: c.textEffect ?? "none",
    topSky: c.topSky ?? "off",
    approvedSig: c.approvedSig, approvedAt: c.approvedAt, checkNotes: c.checkNotes, checkedAt: c.checkedAt,
  };
}

/** What the author approved: everything that changes how the cover looks. */
export const coverSig = (s: CoverSettings) =>
  JSON.stringify([s.title, s.subtitle, s.author, s.seriesPill, s.trim, s.frontArtId, s.fit, s.padColor, s.shift, s.titlePlacement, s.scrim, s.textColor, s.textEffect, s.topSky]);
export const coverApproved = (s: CoverSettings) => !!s.approvedSig && s.approvedSig === coverSig(s);

const FONT = '"Nunito","Poppins","Segoe UI",system-ui,sans-serif';
type Ctx = CanvasRenderingContext2D;
type Img = CanvasImageSource & { width: number; height: number };

function wrapLines(ctx: Ctx, text: string, maxW: number): string[] {
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

interface Block { lines: string[]; px: number; weight: number; lh: number; height: number; width: number }
function layout(ctx: Ctx, text: string, maxW: number, maxLines: number, startPx: number, weight = 800, lh = 1.12, maxH = Infinity): Block {
  let px = startPx, lines: string[] = [];
  for (; px >= 18; px -= 3) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    lines = wrapLines(ctx, text, maxW);
    if (lines.length <= maxLines && lines.length * px * lh <= maxH) break;
  }
  ctx.font = `${weight} ${px}px ${FONT}`;
  return { lines, px, weight, lh, height: lines.length * px * lh, width: Math.max(...lines.map((l) => ctx.measureText(l).width), 0) };
}

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

function drawBlock(ctx: Ctx, b: Block, cx: number, y: number, color: string, effect: CoverSettings["textEffect"]) {
  ctx.font = `${b.weight} ${b.px}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  b.lines.forEach((l, i) => {
    const yy = y + i * b.px * b.lh;
    if (effect === "outline") {
      ctx.lineJoin = "round"; ctx.lineWidth = Math.max(3, b.px * 0.14);
      ctx.strokeStyle = lum(color) > 0.55 ? "#102a20" : "#ffffff";
      ctx.strokeText(l, cx, yy);
    }
    if (effect === "shadow") { ctx.shadowColor = lum(color) > 0.55 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)"; ctx.shadowBlur = b.px * 0.2; ctx.shadowOffsetY = b.px * 0.05; }
    ctx.fillStyle = color;
    ctx.fillText(l, cx, yy);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  });
}

/** A soft band behind ONE text block only, so art in the middle (faces) is never washed. */
function scrimFor(ctx: Ctx, mode: CoverSettings["scrim"], rect: { x: number; y: number; w: number; h: number }, color: string, edge: "top" | "bottom" | "mid", artBox: { x: number; w: number }) {
  if (!mode || mode === "none") return;
  const light = lum(color) <= 0.55; // dark text wants a light scrim
  const rgb = mode === "softDark" ? "10,25,20" : mode === "softLight" ? "255,255,255" : light ? "255,255,255" : "10,25,20";
  if (mode === "pill") {
    ctx.fillStyle = `rgba(${rgb},0.86)`;
    ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(rect.h / 2, 60)); ctx.fill();
    return;
  }
  const a = mode === "softDark" ? 0.6 : 0.88;
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  if (edge === "top") { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.7, `rgba(${rgb},${a * 0.7})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else if (edge === "bottom") { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.3, `rgba(${rgb},${a * 0.7})`); g.addColorStop(1, `rgba(${rgb},${a})`); }
  else { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.25, `rgba(${rgb},${a})`); g.addColorStop(0.75, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  ctx.fillStyle = g; ctx.fillRect(artBox.x, rect.y, artBox.w, rect.h);
}

function paintArt(ctx: Ctx, s: CoverSettings, art: Img | null, x: number, y: number, w: number, h: number, skyShift = 0) {
  const focus = s.shift === "top" ? 0 : s.shift === "bottom" ? 1 : 0.5;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (!art) { ctx.fillStyle = "#15382a"; ctx.fillRect(x, y, w, h); ctx.restore(); return; }
  const ay = y + skyShift, ah = h - skyShift; // the picture lives below the extra sky
  ctx.save();
  ctx.beginPath(); ctx.rect(x, ay, w, ah); ctx.clip();
  if (s.fit === "fit") {
    ctx.fillStyle = s.padColor || "#bfe3f5"; ctx.fillRect(x, ay, w, ah);
    const r = Math.min(w / art.width, ah / art.height);
    const dw = art.width * r, dh = art.height * r;
    ctx.drawImage(art, x + (w - dw) / 2, ay + (ah - dh) * focus, dw, dh);
  } else {
    const r = Math.max(w / art.width, ah / art.height);
    const dw = art.width * r, dh = art.height * r;
    ctx.drawImage(art, x + (w - dw) / 2, ay + (ah - dh) * focus, dw, dh);
  }
  ctx.restore();
  if (skyShift > 0) {
    // Header band in the picture's own top-edge color, blended down into the art so there is no hard seam.
    let color = s.padColor || "#bfe3f5";
    try {
      const row = ctx.getImageData(Math.floor(x), Math.floor(ay + 2), Math.max(1, Math.floor(w)), 1).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < row.length; i += 4) { r += row[i]; g += row[i + 1]; b += row[i + 2]; n++; }
      color = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
    } catch { /* keep the pad color */ }
    ctx.fillStyle = color; ctx.fillRect(x, y, w, skyShift);
    const fade = Math.min(ah * 0.12, h * 0.06);
    const gr = ctx.createLinearGradient(0, ay, 0, ay + fade);
    gr.addColorStop(0, color); gr.addColorStop(1, color.replace("rgb(", "rgba(").replace(")", ",0)"));
    ctx.fillStyle = gr; ctx.fillRect(x, ay, w, fade);
  }
  ctx.restore();
}

/**
 * Draws the front cover. `rect` is the whole painted area (it may include bleed); `trim` is the trimmed page inside it.
 * Text is placed inside `trim`, art fills `rect`.
 */
function drawFront(ctx: Ctx, s: CoverSettings, art: Img | null, rect: { x: number; y: number; w: number; h: number }, trim: { x: number; y: number; w: number; h: number }) {
  const sky = s.topSky === "20" ? 0.2 : s.topSky === "30" ? 0.3 : 0;
  const skyShift = sky && (s.titlePlacement === "top" || s.titlePlacement === "split" || !s.titlePlacement) ? rect.h * sky : 0;
  paintArt(ctx, s, art, rect.x, rect.y, rect.w, rect.h, skyShift);
  const color = s.textColor || "#15382a";
  const effect = s.textEffect ?? "none";
  const place = s.titlePlacement ?? "top";
  const cx = trim.x + trim.w / 2;
  const padX = trim.w * 0.09, maxW = trim.w - padX * 2;
  const safeTop = trim.y + trim.h * 0.045, safeBottom = trim.y + trim.h - trim.h * 0.04;
  const artBox = { x: rect.x, w: rect.w };

  const title = layout(ctx, s.title ?? "", maxW, 3, trim.w * 0.115, 900, 1.12, trim.h * 0.26);
  const sub = s.subtitle?.trim() ? layout(ctx, s.subtitle, maxW, 3, trim.w * 0.05, 700, 1.2, trim.h * 0.09) : null;
  const author = (s.author ?? "").trim() ? layout(ctx, (s.author ?? "").trim(), maxW, 1, trim.w * 0.055, 800) : null;
  const gap = trim.h * 0.012, pad = trim.h * 0.018;

  const topBlocks: { b: Block; weight: "t" | "s" | "a" }[] = [];
  const botBlocks: { b: Block; weight: "t" | "s" | "a" }[] = [];
  if (place === "top") { topBlocks.push({ b: title, weight: "t" }); if (sub) topBlocks.push({ b: sub, weight: "s" }); }
  else if (place === "bottom") { botBlocks.push({ b: title, weight: "t" }); if (sub) botBlocks.push({ b: sub, weight: "s" }); }
  else { topBlocks.push({ b: title, weight: "t" }); if (sub) botBlocks.push({ b: sub, weight: "s" }); }
  if (author) botBlocks.push({ b: author, weight: "a" });

  const stack = (blocks: typeof topBlocks) => blocks.reduce((h, x, i) => h + x.b.height + (i ? gap : 0), 0);
  const drawStack = (blocks: typeof topBlocks, top: number) => {
    let y = top;
    for (const x of blocks) { drawBlock(ctx, x.b, cx, y, color, effect); y += x.b.height + gap; }
  };

  if (topBlocks.length) {
    const h = stack(topBlocks);
    const w = Math.max(...topBlocks.map((x) => x.b.width));
    if (s.scrim === "pill") scrimFor(ctx, "pill", { x: cx - w / 2 - pad * 1.5, y: safeTop - pad, w: w + pad * 3, h: h + pad * 2 }, color, "top", artBox);
    else scrimFor(ctx, s.scrim, { x: trim.x, y: trim.y, w: trim.w, h: safeTop - trim.y + h + pad * 2.2 }, color, "top", artBox);
    drawStack(topBlocks, safeTop);
  }
  if (botBlocks.length) {
    const h = stack(botBlocks);
    const top = safeBottom - h;
    const w = Math.max(...botBlocks.map((x) => x.b.width));
    if (s.scrim === "pill") scrimFor(ctx, "pill", { x: cx - w / 2 - pad * 1.5, y: top - pad, w: w + pad * 3, h: h + pad * 2 }, color, "bottom", artBox);
    else scrimFor(ctx, s.scrim, { x: trim.x, y: top - pad * 2.2, w: trim.w, h: safeBottom - top + pad * 2.2 + (trim.y + trim.h - safeBottom) + (rect.y + rect.h - (trim.y + trim.h)) }, color, "bottom", artBox);
    drawStack(botBlocks, top);
  }
  // Series pill sits just above the bottom stack.
  if (s.seriesPill?.trim()) {
    const px = trim.w * 0.03;
    ctx.font = `800 ${px}px ${FONT}`;
    const t = s.seriesPill.trim();
    const w = ctx.measureText(t).width + px * 1.8, h = px * 1.9;
    const bottomH = botBlocks.length ? stack(botBlocks) + pad * 2.5 : 0;
    const py = safeBottom - bottomH - h / 2 - gap;
    ctx.fillStyle = "#ffc94d"; ctx.beginPath(); ctx.roundRect(cx - w / 2, py - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = "#15382a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, cx, py + px * 0.04);
  }
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.round(w); c.height = Math.round(h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  return [c, ctx];
}
const toBlob = (c: HTMLCanvasElement, type = "image/png", q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the picture"))), type, q));

export function renderEbookCanvas(s: CoverSettings, art: Img | null): HTMLCanvasElement {
  const [c, ctx] = canvasOf(1600, 2560);
  const r = { x: 0, y: 0, w: 1600, h: 2560 };
  drawFront(ctx, s, art, r, r);
  return c;
}
export const renderEbookCover = (s: CoverSettings, art: Img | null) => toBlob(renderEbookCanvas(s, art));

/** Print front cover at exactly the trim size (no bleed), 300 dpi: 2550 x 2550 for 8.5 x 8.5. */
export function renderPrintFrontCanvas(s: CoverSettings, fallbackTrim: Trim, art: Img | null): HTMLCanvasElement {
  const t = trimDims(s.trim ?? fallbackTrim);
  const [c, ctx] = canvasOf(t.w * DPI, t.h * DPI);
  const r = { x: 0, y: 0, w: c.width, h: c.height };
  drawFront(ctx, s, art, r, r);
  return c;
}
export const renderPrintFront = (s: CoverSettings, fallbackTrim: Trim, art: Img | null) => toBlob(renderPrintFrontCanvas(s, fallbackTrim, art));

/** A small JPEG of the print front, for the AI cover check. */
export async function renderCheckJpeg(s: CoverSettings, fallbackTrim: Trim, art: Img | null): Promise<string> {
  const big = renderPrintFrontCanvas(s, fallbackTrim, art);
  const scale = 1100 / Math.max(big.width, big.height);
  const [c, ctx] = canvasOf(big.width * scale, big.height * scale);
  ctx.drawImage(big, 0, 0, c.width, c.height);
  const blob = await toBlob(c, "image/jpeg", 0.85);
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface WrapOptions { guides?: boolean }

/** Full paperback wrap at 300 dpi: back (blurb) + spine + front, with bleed. */
export function renderWrapCanvas(s: CoverSettings, fallbackTrim: Trim, art: Img | null, opts: WrapOptions = {}): HTMLCanvasElement {
  const g = wrapGeometry(s, fallbackTrim);
  const [c, ctx] = canvasOf(g.totalW * DPI, g.totalH * DPI);
  const bleed = BLEED * DPI, tw = g.trimW * DPI, th = g.trimH * DPI, sp = g.spine * DPI;
  const spineX = bleed + tw, frontX = bleed + tw + sp;
  ctx.fillStyle = "#fbf4e4"; ctx.fillRect(0, 0, bleed + tw, c.height);
  ctx.fillStyle = "#15382a"; ctx.fillRect(spineX, 0, sp, c.height);
  drawFront(ctx, s, art, { x: frontX, y: 0, w: bleed + tw, h: c.height }, { x: frontX, y: bleed, w: tw, h: th });
  const safe = bleed + 0.25 * DPI;
  ctx.fillStyle = "#15382a"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  const maxW = tw - 0.5 * DPI;
  const t = layout(ctx, s.title ?? "", maxW, 2, tw * 0.1, 900);
  ctx.fillStyle = "#15382a"; ctx.textAlign = "left";
  t.lines.forEach((l, i) => ctx.fillText(l, safe, bleed + 0.55 * DPI + i * t.px * t.lh));
  if (s.backBlurb?.trim()) {
    const b = layout(ctx, s.backBlurb, maxW, 14, tw * 0.045, 600, 1.35);
    ctx.fillStyle = "#1f2f28"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    const y0 = bleed + 0.55 * DPI + t.height + 0.18 * DPI;
    b.lines.forEach((l, i) => ctx.fillText(l, safe, y0 + i * b.px * b.lh));
  }
  const bw = 2 * DPI, bh = 1.2 * DPI, bx = bleed + tw - 0.25 * DPI - bw, by = c.height - bleed - 0.25 * DPI - bh;
  if (s.barcodeCorner !== false) { ctx.fillStyle = "#ffffff"; ctx.fillRect(bx, by, bw, bh); }
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
    ctx.strokeStyle = "#e0245e"; ctx.strokeRect(bleed, bleed, c.width - 2 * bleed, c.height - 2 * bleed);
    ctx.strokeStyle = "#1f8fff"; ctx.strokeRect(safe, safe, c.width - 2 * safe, c.height - 2 * safe);
    ctx.strokeStyle = "#ff9d00"; ctx.beginPath(); ctx.moveTo(spineX, 0); ctx.lineTo(spineX, c.height); ctx.moveTo(frontX, 0); ctx.lineTo(frontX, c.height); ctx.stroke();
    ctx.restore();
  }
  return c;
}
export const renderWrapPng = (s: CoverSettings, fallbackTrim: Trim, art: Img | null) => toBlob(renderWrapCanvas(s, fallbackTrim, art));

export function renderWrapPdf(s: CoverSettings, fallbackTrim: Trim, art: Img | null): Blob {
  const g = wrapGeometry(s, fallbackTrim);
  const c = renderWrapCanvas(s, fallbackTrim, art);
  const pdf = new jsPDF({ orientation: g.totalW > g.totalH ? "landscape" : "portrait", unit: "in", format: [g.totalW, g.totalH] });
  pdf.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, g.totalW, g.totalH);
  return pdf.output("blob");
}
