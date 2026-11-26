import { trimDims } from "./utils/trims";
import { jsPDF } from "jspdf";

export type Pattern = "dotted" | "wavy" | "alphabet" | "numbers" | "counting" | "grid" | "images";

export interface ImagePage { dataUrl: string; format: "PNG" | "JPEG"; w: number; h: number }

export const PATTERNS: { id: Pattern; label: string; note: string }[] = [
  { id: "dotted", label: "Dotted line tracing rows", note: "Straight dotted lines with a start dot and arrow on every row." },
  { id: "wavy", label: "Wavy line tracing", note: "Smooth wavy paths for pre-writing control." },
  { id: "alphabet", label: "Alphabet tracing guides", note: "One big letter per page (A to Z) with tracing rows beneath." },
  { id: "numbers", label: "Number tracing guides", note: "One big number per page (0 to 9) with counting dots." },
  { id: "counting", label: "STEM counting", note: "Rows of shapes to count, with a box for the number." },
  { id: "grid", label: "STEM grid template", note: "Square-grid page for patterns, coordinates and drawing." },
  { id: "images", label: "Generated pictures only", note: "One page per picture ticked in Book images below. Other page types add the ticked pictures after their own pages." },
];

export interface PdfOptions {
  pattern: Pattern;
  pages: number;
  blankReverse: boolean;
  title: string;
  trim?: string;
}

// Page size in inches. Set from the book's trim size each time a PDF is built.
let W = 8.5;
let H = 11;
const M = 0.6; // safe margin in inches, well inside KDP's minimum for no-bleed interiors
const GRAY = 150;

function pageFrame(doc: jsPDF, heading: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(21, 56, 42);
  doc.text(heading, W / 2, M + 0.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Name: ______________________", M, M + 0.55);
}

function dashed(doc: jsPDF, on = 0.06, off = 0.09) {
  doc.setLineDashPattern([on, off], 0);
}
function solid(doc: jsPDF) {
  doc.setLineDashPattern([], 0);
}

function startDotArrow(doc: jsPDF, x: number, y: number, x2: number) {
  doc.setFillColor(194, 84, 31);
  doc.circle(x, y, 0.07, "F");
  doc.setDrawColor(194, 84, 31);
  doc.setLineWidth(0.02);
  solid(doc);
  doc.line(x2, y, x2 - 0.12, y - 0.07);
  doc.line(x2, y, x2 - 0.12, y + 0.07);
}

function dottedRows(doc: jsPDF, top: number, bottom: number, rowH: number) {
  for (let y = top; y + rowH <= bottom; y += rowH) {
    doc.setDrawColor(200);
    doc.setLineWidth(0.01);
    solid(doc);
    doc.line(M, y, W - M, y);
    doc.line(M, y + rowH * 0.9, W - M, y + rowH * 0.9);
    doc.setDrawColor(GRAY);
    doc.setLineWidth(0.035);
    dashed(doc);
    const mid = y + rowH * 0.45;
    doc.line(M + 0.3, mid, W - M - 0.3, mid);
    startDotArrow(doc, M + 0.2, mid, W - M - 0.1);
  }
  solid(doc);
}

function wavyRows(doc: jsPDF, top: number, bottom: number, rowH: number, variant: number) {
  let idx = 0;
  for (let y = top; y + rowH <= bottom; y += rowH, idx++) {
    const mid = y + rowH * 0.5;
    const amp = rowH * (0.18 + 0.05 * ((idx + variant) % 3));
    const waves = 3 + ((idx + variant) % 3);
    doc.setDrawColor(GRAY);
    doc.setLineWidth(0.035);
    dashed(doc, 0.05, 0.08);
    const x0 = M + 0.3;
    const x1 = W - M - 0.3;
    const steps = 120;
    let px = x0;
    let py = mid;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const yy = mid + Math.sin(t * Math.PI * 2 * waves) * amp;
      doc.line(px, py, x, yy);
      px = x;
      py = yy;
    }
    startDotArrow(doc, x0 - 0.1, mid, x1 + 0.2);
  }
  solid(doc);
}

function bigGlyph(doc: jsPDF, ch: string, top: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(250);
  doc.setLineWidth(0.04);
  doc.setDrawColor(GRAY);
  dashed(doc, 0.07, 0.09);
  doc.text(ch, W / 2, top + 3.4, { align: "center", renderingMode: "stroke" });
  solid(doc);
}

function alphabetPage(doc: jsPDF, i: number) {
  const ch = String.fromCharCode(65 + (i % 26));
  pageFrame(doc, `Trace the letter ${ch}${ch.toLowerCase()}`);
  bigGlyph(doc, ch, M + 0.9);
  dottedRows(doc, M + 4.6, H - M, 1.05);
}

function numbersPage(doc: jsPDF, i: number) {
  const n = i % 10;
  pageFrame(doc, `Trace the number ${n}`);
  bigGlyph(doc, String(n), M + 0.9);
  doc.setDrawColor(21, 56, 42);
  doc.setLineWidth(0.02);
  solid(doc);
  const count = Math.max(n, 1);
  for (let k = 0; k < count; k++) {
    doc.circle(M + 0.4 + k * 0.7, M + 5.0, 0.22, "S");
  }
  dottedRows(doc, M + 5.7, H - M, 1.05);
}

const SHAPES = ["circle", "square", "triangle"] as const;
function countingPage(doc: jsPDF, i: number) {
  pageFrame(doc, "Count and write the number");
  const rows = 6;
  const rowH = (H - 2 * M - 1.2) / rows;
  for (let r = 0; r < rows; r++) {
    const y = M + 1.0 + r * rowH;
    const count = 1 + ((i * 3 + r * 2) % 10);
    const shape = SHAPES[(i + r) % 3];
    doc.setDrawColor(21, 56, 42);
    doc.setFillColor(255, 201, 77);
    doc.setLineWidth(0.025);
    for (let k = 0; k < count; k++) {
      const cx = M + 0.35 + k * 0.5;
      const cy = y + rowH * 0.4;
      if (shape === "circle") doc.circle(cx, cy, 0.18, "FD");
      else if (shape === "square") doc.rect(cx - 0.17, cy - 0.17, 0.34, 0.34, "FD");
      else doc.triangle(cx, cy - 0.2, cx - 0.2, cy + 0.17, cx + 0.2, cy + 0.17, "FD");
    }
    doc.setDrawColor(GRAY);
    doc.roundedRect(W - M - 0.9, y + rowH * 0.1, 0.9, rowH * 0.62, 0.08, 0.08, "S");
  }
}

function gridPage(doc: jsPDF) {
  pageFrame(doc, "Grid page");
  const cell = 0.4;
  const left = (W - Math.floor((W - 2 * M) / cell) * cell) / 2;
  const cols = Math.floor((W - 2 * M) / cell);
  const top = M + 0.9;
  const rows = Math.floor((H - M - top) / cell);
  doc.setDrawColor(200);
  doc.setLineWidth(0.01);
  solid(doc);
  for (let c = 0; c <= cols; c++) doc.line(left + c * cell, top, left + c * cell, top + rows * cell);
  for (let r = 0; r <= rows; r++) doc.line(left, top + r * cell, left + cols * cell, top + r * cell);
}

/** One full page: the picture fitted inside the safe margins, never stretched or cropped. */
function imagePage(doc: jsPDF, img: ImagePage) {
  const boxW = W - 2 * M;
  const boxH = H - 2 * M;
  const scale = Math.min(boxW / img.w, boxH / img.h);
  const w = img.w * scale;
  const h = img.h * scale;
  doc.addImage(img.dataUrl, img.format, (W - w) / 2, (H - h) / 2, w, h);
}

export function buildActivityPdf(opts: PdfOptions, imagePages: ImagePage[] = []): Blob {
  const dim = trimDims(opts.trim);
  W = dim.w; H = dim.h;
  const doc = new jsPDF({ unit: "in", format: [W, H], orientation: "portrait" });
  const pages = opts.pattern === "images" ? 0 : Math.max(1, Math.min(200, Math.floor(opts.pages)));
  for (let i = 0; i < pages; i++) {
    if (i > 0) doc.addPage([W, H]);
    switch (opts.pattern) {
      case "dotted":
        pageFrame(doc, opts.title || "Trace the lines");
        dottedRows(doc, M + 0.9, H - M, 1.05);
        break;
      case "wavy":
        pageFrame(doc, opts.title || "Trace the waves");
        wavyRows(doc, M + 0.9, H - M, 1.05, i);
        break;
      case "alphabet": alphabetPage(doc, i); break;
      case "numbers": numbersPage(doc, i); break;
      case "counting": countingPage(doc, i); break;
      case "grid": gridPage(doc); break;
      case "images": break;
    }
    // A blank reverse stops marker bleed-through onto the next activity page.
    if (opts.blankReverse) doc.addPage([W, H]);
  }
  // Generated pictures: one page each, with the same blank reverse so markers do not bleed through.
  imagePages.forEach((img, i) => {
    if (pages > 0 || i > 0) doc.addPage([W, H]);
    imagePage(doc, img);
    if (opts.blankReverse) doc.addPage([W, H]);
  });
  return doc.output("blob");
}
