import type { Book, Section } from "./types";
import { fetchImageBlob } from "./api";

export interface PrintableOptions {
  /** Insert a blank page behind every printed page so markers do not bleed through. */
  backingPages: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Very small Markdown to HTML: bold, italic, bullet and numbered lists, paragraphs. Everything is escaped first. */
export function mdToHtml(md: string): string {
  const inline = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "$1");
  const out: string[] = [];
  let list: "ul" | "ol" | "" = "";
  const close = () => { if (list) { out.push(`</${list}>`); list = ""; } };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    const li = /^(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const kind = li[1] ? "ol" : "ul";
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(li[2])}</li>`);
      continue;
    }
    close();
    out.push(`<p>${inline(line.replace(/^#{1,6}\s*/, ""))}</p>`);
  }
  close();
  return out.join("");
}

type Part = "story" | "listen" | "say" | "do" | "check" | "words" | "doodle";
const LABELS: Record<string, Part> = {
  "story text": "story", story: "story", text: "story", "read aloud": "story", "read-aloud": "story",
  "while you listen": "listen", say: "say", do: "do", check: "check",
  "word bank": "words", "bonus doodle": "doodle",
};
const NAMES = "story text|read[- ]aloud|story|text|while you listen|say|do|check|word bank|bonus doodle";
const LABEL_RE = new RegExp(`^(${NAMES})(\\*\\*|__)?\\s*(:|—|–|-)?\\s*(\\*\\*|__)?\\s*(.*)$`, "i");

/** Recognises "## Say", "**Say:** text", "- Do: text" and a bare "Check". A line such as "Do you see it?" is not a label. */
function matchLabel(line: string): { part: Part; rest: string } | null {
  let t = line.trim();
  const heading = /^#{1,6}\s+/.test(t);
  t = t.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "");
  const opened = /^(\*\*|__)/.test(t);
  t = t.replace(/^(\*\*|__)\s*/, "");
  const m = LABEL_RE.exec(t);
  if (!m) return null;
  const [, name, closeA, sep, closeB, rest] = m;
  const ok = !!sep || !rest.trim() || ((heading || opened) && !!(closeA || closeB));
  if (!ok) return null;
  const key = name.toLowerCase().replace(/[- ]+/g, " ");
  const part = LABELS[key] ?? LABELS[key.replace("read aloud", "read-aloud")] ?? "story";
  return { part, rest: rest.trim() };
}

/** Splits a drafted section into the printable parts. Free text before any label counts as story text. */
export function parseSection(s: Section): Partial<Record<Part, string>> {
  const text = (s.draft || "").trim() || s.summary.trim();
  const parts: Partial<Record<Part, string[]>> = {};
  let cur: Part = "story";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^#{1,6}\s/.test(trimmed) && !matchLabel(trimmed)) {
      // A heading that is not one of the labels: skip the book's own title lines, keep other headings as story text.
      if (trimmed.replace(/^#+\s*/, "").toLowerCase().includes(s.title.toLowerCase())) continue;
    }
    const m = matchLabel(line);
    if (m) {
      cur = m.part;
      (parts[cur] ??= []);
      if (m.rest) parts[cur]!.push(m.rest);
      continue;
    }
    (parts[cur] ??= []).push(line);
  }
  const res: Partial<Record<Part, string>> = {};
  for (const [k, v] of Object.entries(parts)) { const t = (v ?? []).join("\n").trim(); if (t) res[k as Part] = t; }
  return res;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Could not read a picture")); r.readAsDataURL(blob); });
}

const lines = (n: number) => Array.from({ length: n }, () => `<div class="rule"></div>`).join("");

function wordBank(text: string | undefined): string {
  const words = (text ?? "").split(/[\n,;•]|(?:^|\s)[-*]\s/).map((w) => w.replace(/[*_`]/g, "").trim()).filter(Boolean).slice(0, 8);
  const cells = Array.from({ length: 8 }, (_, i) => `<div class="word">${esc(words[i] ?? "")}</div>`);
  return cells.join("");
}

const CSS = `
@page { size: 8.5in 11in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #e9e9e9; }
body { font-family: 'Nunito', 'Segoe UI', Arial, Helvetica, sans-serif; color: #000; }
h1, h2, h3, .label { font-family: 'Fredoka', 'Nunito', 'Segoe UI', Arial, sans-serif; }
.tip { max-width: 8.5in; margin: 12px auto; padding: 10px 14px; background: #fff8dc; border: 1px solid #c9a400; border-radius: 8px; font: 14px/1.4 Arial, sans-serif; }
.page { width: 8.5in; height: 11in; padding: 0.6in; margin: 0 auto 12px; background: #fff; position: relative; overflow: hidden; page-break-after: always; break-after: page; display: flex; flex-direction: column; gap: 0.18in; }
.page.blank { background: #fff; }
.frame { border: 3px solid #000; border-radius: 0.22in; padding: 0.16in 0.2in; background: #fff; }
.pic { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
.pic img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.pic .none { color: #666; font-size: 13pt; text-align: center; }
.title-page { align-items: center; justify-content: center; text-align: center; gap: 0.3in; }
.title-page h1 { font-size: 44pt; line-height: 1.05; margin: 0; }
.title-page .sub { font-size: 18pt; margin: 0; }
.belongs { width: 6in; margin-top: 0.5in; padding: 0.3in; }
.belongs .label { font-size: 17pt; letter-spacing: 1px; }
.belongs .line { border-bottom: 3px solid #000; height: 0.7in; margin-top: 0.1in; }
.pub { position: absolute; bottom: 0.45in; left: 0; right: 0; font-size: 11pt; }
.head { display: flex; align-items: baseline; gap: 0.15in; }
.head h2 { font-size: 26pt; margin: 0; line-height: 1.05; }
.head .num { font-family: 'Fredoka', sans-serif; font-size: 14pt; border: 3px solid #000; border-radius: 999px; padding: 0 0.14in; }
.story { font-size: 14pt; line-height: 1.45; }
.story p { margin: 0 0 0.08in; }
.story ul, .story ol { margin: 0.04in 0 0.08in 0.25in; padding: 0; }
.label { font-weight: 600; font-size: 13pt; letter-spacing: 0.5px; text-transform: uppercase; margin: 0 0 0.06in; }
.listen { font-size: 13pt; line-height: 1.4; }
.listen ul { margin: 0 0 0 0.25in; padding: 0; }
.rule { border-bottom: 2px solid #000; height: 0.3in; }
.guide { display: grid; grid-template-columns: 1fr; gap: 0.14in; }
.guide .blk { font-size: 12.5pt; line-height: 1.4; min-height: 1.1in; }
.guide .blk p { margin: 0 0 0.05in; }
.guide .blk ul, .guide .blk ol { margin: 0 0 0 0.25in; padding: 0; }
.namedate { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.2in; }
.namedate div { border-bottom: 3px solid #000; padding-top: 0.28in; font-family: 'Fredoka', sans-serif; font-size: 13pt; }
.words { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.1in; }
.word { border: 2px solid #000; border-radius: 0.12in; height: 0.5in; display: flex; align-items: center; justify-content: center; font-size: 13pt; text-align: center; padding: 0 0.05in; }
.doodle { flex: 1 1 auto; min-height: 1.5in; display: flex; flex-direction: column; }
.doodle .area { flex: 1; border: 2px dashed #000; border-radius: 0.14in; margin-top: 0.04in; }
.doodle .prompt { font-size: 12pt; margin: 0; }
@media print {
  html, body { background: #fff; }
  .page { margin: 0; }
  .tip { display: none; }
}
`;

/** Builds a self-contained 8.5 x 11 in HTML book from the drafted sections and generated pictures. */
export async function buildPrintableBook(book: Book, opts: PrintableOptions): Promise<string> {
  // Newest picture per section, embedded so the file works on its own.
  const pics = new Map<string, string>();
  for (const s of book.sections) {
    const imgs = book.images.filter((i) => i.sectionId === s.id);
    const last = imgs[imgs.length - 1];
    if (!last) continue;
    try { pics.set(s.id, await blobToDataUrl(await fetchImageBlob(last.id))); } catch { /* leave the frame empty */ }
  }

  const pages: string[] = [];
  const add = (html: string) => {
    pages.push(html);
    if (opts.backingPages) pages.push(`<section class="page blank" aria-label="Blank backing page"></section>`);
  };

  add(`<section class="page title-page">
  <h1>${esc(book.title || "Untitled")}</h1>
  ${book.subtitle ? `<p class="sub">${esc(book.subtitle)}</p>` : ""}
  <div class="frame belongs"><div class="label">This Explorer Guide belongs to:</div><div class="line"></div></div>
  <div class="pub">Bright Trails Publishing</div>
</section>`);

  book.sections.forEach((s, i) => {
    const p = parseSection(s);
    const pic = pics.get(s.id);
    const story = p.story ? mdToHtml(p.story) : "";
    const listenBody = p.listen ? `<div class="listen">${mdToHtml(p.listen)}</div>` : `<div class="listen">${lines(2)}</div>`;
    add(`<section class="page">
  <div class="head"><span class="num">${i + 1}</span><h2>${esc(s.title)}</h2></div>
  <div class="frame pic">${pic ? `<img src="${pic}" alt="${esc(s.title)}">` : `<div class="none">Picture for this page</div>`}</div>
  ${story ? `<div class="frame story">${story}</div>` : ""}
  <div class="frame"><div class="label">While you listen</div>${listenBody}</div>
</section>`);

    const block = (label: string, body: string | undefined) =>
      `<div class="frame blk"><div class="label">${label}</div>${body ? mdToHtml(body) : lines(2)}</div>`;
    add(`<section class="page">
  <div class="head"><span class="num">${i + 1}</span><h2>${esc(s.title)}: Explorer Activity</h2></div>
  <div class="guide">
    ${block("Say", p.say)}
    ${block("Do", p.do)}
    ${block("Check", p.check)}
  </div>
  <div class="namedate"><div>Name:</div><div>Date:</div></div>
  <div class="frame"><div class="label">Word bank</div><div class="words">${wordBank(p.words)}</div></div>
  <div class="frame doodle"><div class="label">Bonus doodle</div>${p.doodle ? `<p class="prompt">${esc(p.doodle.replace(/\n+/g, " "))}</p>` : ""}<div class="area"></div></div>
</section>`);
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(book.title || "Printable book")} (8.5 x 11 in interior)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body>
<div class="tip">Press Ctrl+P (Cmd+P on Mac), choose Save as PDF, set Paper size to Letter and Margins to None, and turn Background graphics on. This note does not print.</div>
${pages.join("\n")}
</body></html>`;
}
