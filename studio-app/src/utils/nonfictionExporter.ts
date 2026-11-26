import type { Book } from "../types";
import { trimDims } from "./trims";

/** One block of simple Markdown. */
type Blk =
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "p"; text: string }
  | { t: "li"; text: string; ordered: boolean; n: number; check: boolean }
  | { t: "quote"; text: string };

export function parseMd(md: string): Blk[] {
  const out: Blk[] = [];
  let n = 0;
  for (const raw of (md || "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { n = 0; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (h) { out.push({ t: "h", level: Math.min(3, h[1].length) as 1 | 2 | 3, text: h[2].trim() }); n = 0; continue; }
    const q = /^>\s?(.*)$/.exec(line.trim());
    if (q) { out.push({ t: "quote", text: q[1] }); continue; }
    const li = /^(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(line.trim());
    if (li) {
      const check = /^\[( |x)\]\s*/i.test(li[3]);
      n = li[2] ? Number(li[2]) : n + 1;
      out.push({ t: "li", text: li[3].replace(/^\[( |x)\]\s*/i, ""), ordered: !!li[2], n, check });
      continue;
    }
    out.push({ t: "p", text: line.trim() });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inlineHtml = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "$1");

const author = (b: Book) => String((b.cover as { author?: string })?.author ?? "").trim();
const REFLECT = /reflect|scenario|journal|prompt|write|your turn/i;

/** The pieces both exports share. */
function parts(book: Book) {
  const chapters = book.sections.map((s, i) => ({ n: i + 1, title: s.title, blocks: parseMd(s.draft?.trim() ? s.draft : s.summary) }));
  // The drafted chapter often repeats its own title as the first heading; drop it.
  chapters.forEach((c) => { const f = c.blocks[0]; if (f && f.t === "h" && f.text.toLowerCase().includes(c.title.toLowerCase())) c.blocks.shift(); });
  return { chapters, workbook: parseMd(book.workbook || "") };
}

const copyright = (book: Book) => {
  const a = author(book) || "The Author";
  return [`Copyright © ${new Date().getFullYear()} ${a}`, "All rights reserved. No part of this book may be reproduced without written permission, except for short quotations in a review.", "Published by Bright Trails Publishing", "This book is for general information and is not professional, legal or medical advice."];
};

/* ------------------------------ Print interior (HTML) ------------------------------ */

export function buildPrintInterior(book: Book): string {
  const { w, h } = trimDims(book.trim);
  const { chapters, workbook } = parts(book);
  const a = author(book);
  const render = (bl: Blk[], withReflect = false) => {
    let html = "", list = "";
    const close = () => { if (list) { html += `</${list}>`; list = ""; } };
    let ruled = false;
    for (const b of bl) {
      if (b.t === "li") {
        const kind = b.ordered ? "ol" : "ul";
        if (list !== kind) { close(); html += `<${kind}${b.ordered ? ` start="${b.n}"` : ""}>`; list = kind; }
        html += `<li class="${b.check ? "check" : ""}">${b.check ? "<span class=\"box\"></span>" : ""}${inlineHtml(b.text)}</li>`;
        continue;
      }
      close();
      if (ruled && b.t === "h") { html += `<div class="rule"></div><div class="rule"></div><div class="rule"></div>`; ruled = false; }
      if (b.t === "h") { html += `<h${b.level + 1}>${inlineHtml(b.text)}</h${b.level + 1}>`; ruled = withReflect && REFLECT.test(b.text); }
      else if (b.t === "quote") html += `<aside class="callout">${inlineHtml(b.text)}</aside>`;
      else html += `<p>${inlineHtml(b.text)}</p>`;
    }
    close();
    if (ruled) html += `<div class="rule"></div><div class="rule"></div><div class="rule"></div>`;
    return html;
  };
  const toc = [...chapters.map((c) => `<li><a href="#ch${c.n}"><span class="n">${c.n}</span> ${esc(c.title)}</a></li>`), ...(workbook.length ? [`<li><a href="#wb">Companion Workbook</a></li>`] : [])].join("");
  const css = `
@page { size: ${w}in ${h}in; }
@page :right { margin: 0.8in 0.6in 0.85in 0.85in; @top-right { content: "${esc(a || book.title)}"; font: 9pt Georgia, serif; color: #555; } @bottom-center { content: counter(page); font: 10pt Georgia, serif; } }
@page :left { margin: 0.8in 0.85in 0.85in 0.6in; @top-left { content: "${esc(book.title)}"; font: 9pt Georgia, serif; color: #555; } @bottom-center { content: counter(page); font: 10pt Georgia, serif; } }
@page front { @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }
* { box-sizing: border-box; }
body { font: ${w < 6 ? "10.5" : "11.5"}pt/1.5 Georgia, 'Times New Roman', serif; color: #000; margin: 0; }
.tip { font: 14px/1.4 Arial, sans-serif; background: #fff8dc; border: 1px solid #c9a400; border-radius: 8px; padding: 10px 14px; margin: 12px auto; max-width: ${w}in; }
section { break-before: page; }
.front { page: front; }
h1, h2, h3, h4 { font-family: Georgia, serif; line-height: 1.2; break-after: avoid; }
.title { text-align: center; padding-top: ${h * 0.22}in; }
.title h1 { font-size: ${w < 6 ? 26 : 32}pt; margin: 0 0 0.2in; }
.title .sub { font-size: 14pt; font-style: italic; margin: 0 0 0.6in; }
.title .by { font-size: 13pt; letter-spacing: 1px; text-transform: uppercase; }
.title .pub { margin-top: 1.6in; font-size: 10pt; }
.copy { font-size: 9pt; padding-top: ${h * 0.55}in; }
.copy p { margin: 0 0 0.08in; }
.toc h2 { font-size: 20pt; margin: 0.2in 0 0.3in; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 0 0 0.12in; font-size: 12pt; }
.toc a { color: inherit; text-decoration: none; }
.toc .n { display: inline-block; width: 0.35in; font-weight: bold; }
.chap h2 { font-size: 22pt; margin: 0.9in 0 0.3in; }
.chap .num { display: block; font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; color: #555; margin-bottom: 0.1in; }
h3 { font-size: 14pt; margin: 0.25in 0 0.1in; }
h4 { font-size: 12pt; margin: 0.2in 0 0.08in; }
p { margin: 0 0 0.12in; orphans: 3; widows: 3; text-align: left; }
ul, ol { margin: 0 0 0.14in 0.25in; padding: 0; }
li { margin: 0 0 0.05in; }
li.check { list-style: none; margin-left: -0.05in; }
.box { display: inline-block; width: 0.14in; height: 0.14in; border: 1.5px solid #000; margin-right: 0.1in; vertical-align: -1px; }
.callout { border-left: 4px solid #000; background: #f2f2f2; padding: 0.1in 0.18in; margin: 0.14in 0; break-inside: avoid; font-style: italic; }
.rule { border-bottom: 1px solid #000; height: 0.3in; }
.wb h2 { font-size: 22pt; margin: 0.9in 0 0.3in; }
@media screen { body { background: #e9e9e9; } section { background: #fff; max-width: ${w}in; margin: 12px auto; padding: 0.8in; } }
@media print { .tip { display: none; } }
`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(book.title)} (${w} x ${h} in interior)</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>
<div class="tip">Press Ctrl+P (Cmd+P on Mac), choose Save as PDF, set the paper size to ${w} × ${h} in (Custom), Margins "Default" (the book sets its own), and turn Background graphics on. This note does not print. Page numbers and running headers need a recent Chrome or Edge.</div>
<section class="front title"><h1>${esc(book.title)}</h1>${book.subtitle ? `<p class="sub">${esc(book.subtitle)}</p>` : ""}${a ? `<p class="by">${esc(a)}</p>` : ""}<p class="pub">Bright Trails Publishing</p></section>
<section class="front copy">${copyright(book).map((l) => `<p>${esc(l)}</p>`).join("")}</section>
<section class="front toc"><h2>Contents</h2><ol>${toc}</ol></section>
${chapters.map((c) => `<section class="chap" id="ch${c.n}"><h2><span class="num">Chapter ${c.n}</span>${esc(c.title)}</h2>${render(c.blocks)}</section>`).join("\n")}
${workbook.length ? `<section class="wb" id="wb"><h2>Companion Workbook</h2>${render(workbook, true)}</section>` : ""}
</body></html>`;
}

/* ------------------------------------ Word (.docx) ----------------------------------- */

export async function buildDocx(book: Book): Promise<Blob> {
  const D = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, BorderStyle } = D;
  const { chapters, workbook } = parts(book);
  const a = author(book);
  const FONT = "Georgia";

  const runs = (text: string, base: { size?: number; italics?: boolean; bold?: boolean } = {}) => {
    const out: InstanceType<typeof TextRun>[] = [];
    const re = /\*\*(.+?)\*\*|\*(?!\s)(.+?)\*|`([^`]+)`/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
      if (m[1]) out.push(new TextRun({ text: m[1], font: FONT, ...base, bold: true }));
      else if (m[2]) out.push(new TextRun({ text: m[2], font: FONT, ...base, italics: true }));
      else out.push(new TextRun({ text: m[3], font: FONT, ...base }));
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
    return out;
  };
  const HL = [HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
  const rule = () => new Paragraph({ spacing: { before: 120, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 12 } }, children: [] });

  const render = (bl: Blk[], withReflect = false) => {
    const out: InstanceType<typeof Paragraph>[] = [];
    let ruled = false;
    const flushRules = () => { if (ruled) { out.push(rule(), rule(), rule()); ruled = false; } };
    for (const b of bl) {
      if (b.t === "h") {
        flushRules();
        out.push(new Paragraph({ heading: HL[b.level - 1], spacing: { before: 240, after: 100 }, children: runs(b.text, { bold: true }) }));
        ruled = withReflect && REFLECT.test(b.text);
      } else if (b.t === "li") {
        out.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360, hanging: 260 }, children: [new TextRun({ text: b.check ? "☐  " : b.ordered ? `${b.n}.  ` : "•  ", font: FONT }), ...runs(b.text)] }));
      } else if (b.t === "quote") {
        out.push(new Paragraph({ spacing: { before: 120, after: 120 }, indent: { left: 300 }, shading: { fill: "F2F2F2" }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: "000000", space: 8 } }, children: runs(b.text, { italics: true }) }));
      } else out.push(new Paragraph({ spacing: { after: 120 }, children: runs(b.text) }));
    }
    flushRules();
    return out;
  };
  const brk = () => new Paragraph({ children: [new PageBreak()] });
  const center = (text: string, size: number, opts: { bold?: boolean; italics?: boolean; before?: number } = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: opts.before ?? 0, after: 160 }, children: [new TextRun({ text, font: FONT, size, bold: opts.bold, italics: opts.italics })] });

  const front = [
    center("", 24, { before: 2600 }),
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: book.title, font: FONT, size: 64, bold: true })] }),
    ...(book.subtitle ? [center(book.subtitle, 28, { italics: true })] : []),
    ...(a ? [center(a.toUpperCase(), 26, { before: 800 })] : []),
    center("Bright Trails Publishing", 20, { before: 2400 }),
    brk(),
    center("", 20, { before: 4800 }),
    ...copyright(book).map((l) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: l, font: FONT, size: 18 })] })),
    brk(),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 240 }, children: [new TextRun({ text: "Contents", font: FONT, bold: true })] }),
    ...chapters.map((c) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `${c.n}.  ${c.title}`, font: FONT, size: 24 })] })),
    ...(workbook.length ? [new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Companion Workbook", font: FONT, size: 24 })] })] : []),
  ];
  const body = chapters.flatMap((c) => [
    brk(),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 240 }, children: [new TextRun({ text: `Chapter ${c.n}: ${c.title}`, font: FONT, bold: true })] }),
    ...render(c.blocks),
  ]);
  const wb = workbook.length ? [brk(), new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 240 }, children: [new TextRun({ text: "Companion Workbook", font: FONT, bold: true })] }), ...render(workbook, true)] : [];

  const { w, h } = trimDims(book.trim);
  const twip = (inch: number) => Math.round(inch * 1440);
  const doc = new Document({
    creator: a || "Bright Trails Publishing",
    title: book.title,
    styles: { default: { document: { run: { font: FONT, size: 23 } } } },
    sections: [{
      properties: { page: { size: { width: twip(w), height: twip(h) }, margin: { top: twip(0.8), bottom: twip(0.85), left: twip(0.85), right: twip(0.7), gutter: twip(0.15) } } },
      children: [...front, ...body, ...wb],
    }],
  });
  return Packer.toBlob(doc);
}
