import type { Book, Section } from "./types";
import { fetchImageBlob } from "./api";
import { trimDims, trimLabel } from "./utils/trims";
import { rankText, widgetSvg } from "./utils/activitySvgWidgets";

export interface PrintableOptions {
  /** Insert a blank page behind every printed page so markers do not bleed through. */
  backingPages: boolean;
  /** "page": each picture gets a full page of its own (best for coloring). "inline": picture shares the story page. */
  pictureLayout?: "page" | "inline";
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

export type Tag =
  | "STORY_TEXT" | "WHILE_YOU_LISTEN" | "GUIDE_TIME" | "GUIDE_SKILL" | "GUIDE_MATERIALS" | "GUIDE_SAY" | "GUIDE_DO"
  | "GUIDE_CHECK" | "GUIDE_TIP" | "WORKSHEET_INSTRUCTIONS" | "WORKSHEET_BODY" | "WORD_BANK" | "BONUS_DOODLE" | "ANSWER_KEY" | "IMAGE_PROMPT";
export const TAGS: Tag[] = ["STORY_TEXT", "WHILE_YOU_LISTEN", "GUIDE_TIME", "GUIDE_SKILL", "GUIDE_MATERIALS", "GUIDE_SAY", "GUIDE_DO", "GUIDE_CHECK", "GUIDE_TIP", "WORKSHEET_INSTRUCTIONS", "WORKSHEET_BODY", "WORD_BANK", "BONUS_DOODLE", "ANSWER_KEY", "IMAGE_PROMPT"];
/** Tolerant tag line: "[TAG] text", "[TAG", "[[TAG]]", "**[TAG]**", "TAG:" and "## [TAG]" all count. Only real tag names match. */
const TAG_RE = /^\s*(?:#{1,6}\s*)?(?:[*_]{1,3})?\s*\[{0,2}\s*([A-Z][A-Z_]{3,})\s*(?:\]{1,2})?\s*(?:[*_]{1,3})?\s*:?\s*(.*)$/;
const STRAY = /^\s*[[\]]+\s*$/;

/** Reads the [TAG] blocks written by the drafting step. Returns null when the draft has none (an older draft). */
export function parseTagged(draft: string): Partial<Record<Tag, string>> | null {
  const out: Partial<Record<Tag, string[]>> = {};
  let cur: Tag | null = null;
  let found = false;
  for (const line of (draft || "").split("\n")) {
    const m = TAG_RE.exec(line);
    const delimited = !!m && (/\[/.test(line.slice(0, line.indexOf(m[1]))) || /[\]:]/.test(line.slice(line.indexOf(m[1]) + m[1].length)) || !m[2].trim());
    if (m && delimited && (TAGS as string[]).includes(m[1])) {
      cur = m[1] as Tag;
      found = true;
      (out[cur] ??= []);
      if (m[2].trim()) out[cur]!.push(m[2].trim());
      continue;
    }
    if (cur && !STRAY.test(line)) out[cur]!.push(line);
  }
  if (!found) return null;
  const res: Partial<Record<Tag, string>> = {};
  for (const [k, v] of Object.entries(out)) { const t = (v ?? []).join("\n").trim(); if (t) res[k as Tag] = t; }
  return res;
}

/** Print and layout notes that must never reach a child's page (used only for older, untagged drafts). */
const SPEC_LINE = /\b(trim( size)?|gutter|bleed|margin|stroke|track width|line weight|dpi)\b|\b\d+(\.\d+)?\s*(pt|mm|in|inch|inches)\b/i;

/** Everything one section needs for its three pages, whether the draft is tagged or an older free-form one. */
export function sectionParts(s: Section): Partial<Record<Tag, string>> {
  const tagged = parseTagged(s.draft);
  if (tagged) return tagged;
  const old = parseSection(s);
  const clean = (t?: string) => (t ?? "").split("\n").filter((l) => !SPEC_LINE.test(l)).join("\n").trim();
  const res: Partial<Record<Tag, string>> = {};
  if (clean(old.story)) res.STORY_TEXT = clean(old.story);
  if (clean(old.listen)) res.WHILE_YOU_LISTEN = clean(old.listen);
  if (clean(old.say)) res.GUIDE_SAY = clean(old.say);
  if (clean(old.do)) res.GUIDE_DO = clean(old.do);
  if (clean(old.check)) res.GUIDE_CHECK = clean(old.check);
  if (clean(old.words)) res.WORD_BANK = clean(old.words);
  if (clean(old.doodle)) res.BONUS_DOODLE = clean(old.doodle);
  return res;
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


function wordList(text: string | undefined): string[] {
  return (text ?? "").split(/[\n,;•]|(?:^|\s)[-*]\s/).map((w) => w.replace(/[*_`]/g, "").trim()).filter(Boolean).slice(0, 8);
}

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) ?? []);

/** Picture for each section: its own newest one, else an orphan from an earlier outline whose prompt clearly matches. */
function pickPictures(book: Book): Map<string, string> {
  // A storybook page never borrows another page's picture: no picture of its own means a clear placeholder.
  const strict = book.mode === "storybook";
  const byId = new Map<string, string>();
  const sectionIds = new Set(book.sections.map((s) => s.id));
  for (const s of book.sections) {
    const own = book.images.filter((i) => i.sectionId === s.id);
    if (own.length) byId.set(s.id, own[own.length - 1].id);
  }
  const orphans = book.images.filter((i) => !i.sectionId || !sectionIds.has(i.sectionId));
  for (const s of book.sections) {
    if (strict || byId.has(s.id) || !orphans.length) continue;
    const parts = sectionParts(s);
    const want = words(`${s.title} ${s.summary} ${parts.IMAGE_PROMPT ?? ""}`);
    let best: { id: string; score: number } | null = null;
    for (const o of orphans) {
      const score = [...words(o.prompt)].filter((w) => want.has(w)).length;
      if (score >= 2 && (!best || score >= best.score)) best = { id: o.id, score };
    }
    if (best) byId.set(s.id, best.id);
  }
  return byId;
}

/** Splits a story into pages and picks a font size so STORY TIME and the Point, Count & Play box always fit inside the page. */
export function fitStory(story: string, play: string, w: number, h: number): { paras: string[]; pt: number }[] {
  const pad = w * h < 80 ? 0.45 : 0.6;
  const innerW = w - 2 * pad, innerH = h - 2 * pad;
  const paras = story.split(/\n+/).map((x) => x.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
  if (!paras.length) return [{ paras: [""], pt: 15 }];
  const LH = 1.42, GAP = 0.06, CHAR = 0.56, SAFETY = 1.1;
  const lines = (t: string, pt: number) => Math.max(1, Math.ceil((t.length * pt * CHAR) / 72 / innerW));
  const need = (ps: string[], pt: number) => (ps.reduce((n, x) => n + lines(x, pt), 0) * pt * LH) / 72 * SAFETY + Math.max(0, ps.length - 1) * GAP;
  // Fixed parts: "STORY TIME" label + gaps, and the play box (label, text, padding, border).
  const playH = (0.2 * 2 + 0.08 + 0.06) + (16 * 1.3) / 72 + (Math.ceil((play.length * 17 * CHAR) / 72 / (innerW - 0.7)) * 17 * 1.35) / 72;
  const headH = (16 * 1.4) / 72 + 0.5;
  const budget = (withPlay: boolean) => innerH - headH - (withPlay ? playH : 0);
  const SIZES = [15, 14, 13, 12];
  const fits = (ps: string[], withPlay: boolean) => SIZES.find((pt) => need(ps, pt) <= budget(withPlay));
  const whole = fits(paras, true);
  if (whole) return [{ paras, pt: whole }];
  // Too long for one page: split into balanced pages (at most 4), the play box goes on the last one.
  for (let n = 2; n <= 4; n++) {
    const per = Math.ceil(paras.length / n);
    const groups = Array.from({ length: n }, (_, k) => paras.slice(k * per, (k + 1) * per)).filter((g) => g.length);
    const sizes = groups.map((g, k) => fits(g, k === groups.length - 1));
    if (sizes.every(Boolean)) return groups.map((g) => ({ paras: g, pt: Math.min(...(sizes as number[])) }));
  }
  return [{ paras, pt: 12 }];
}

const WIDGET_TITLE: Record<string, string> = { compass: "Compass rose", mapgrid: "Map key grid", steps: "Step grid", dots: "Dot-to-dot", tracing: "Trace and count" };

const cssFor = (w: number, h: number) => `
@page { size: ${w}in ${h}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #e9e9e9; }
body { font-family: 'Nunito', 'Segoe UI', Arial, Helvetica, sans-serif; color: #000; }
h1, h2, h3, .label { font-family: 'Fredoka', 'Nunito', 'Segoe UI', Arial, sans-serif; }
.tip { max-width: ${w}in; margin: 12px auto; padding: 10px 14px; background: #fff8dc; border: 1px solid #c9a400; border-radius: 8px; font: 14px/1.4 Arial, sans-serif; }
.page { width: ${w}in; height: ${h}in; padding: ${w * h < 80 ? "0.45" : "0.6"}in; margin: 0 auto 12px; background: #fff; position: relative; overflow: hidden; page-break-after: always; break-after: page; display: flex; flex-direction: column; gap: 0.18in; }
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
.kicker { font-family: 'Fredoka', sans-serif; font-size: 13pt; margin: -0.06in 0 0; }
.meta { display: grid; grid-template-columns: 0.7fr 1.3fr 1fr; gap: 0.14in; }
.meta p { margin: 0; font-size: 12pt; }
.instr { font-size: 14pt; margin: 0; }
.ws { font-size: 14pt; line-height: 1.9; }
.ws p, .ws li { margin: 0 0 0.08in; }
.ws ol, .ws ul { margin: 0 0 0 0.3in; padding: 0; }
.guide .blk { min-height: 0; }
.badges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.14in; align-content: start; flex: 1; }
.badge { text-align: center; padding: 0.12in; }
.stamp { width: 0.95in; height: 0.95in; border: 3px dashed #000; border-radius: 50%; margin: 0 auto 0.08in; display: flex; align-items: center; justify-content: center; font-family: 'Fredoka', sans-serif; font-size: 20pt; }
.stamp.art { border: none; width: 1.15in; height: 1.15in; }
.stamp.art img { max-width: 100%; max-height: 100%; object-fit: contain; }
.bt { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 11pt; line-height: 1.15; }
.bs { font-size: 9pt; margin-top: 0.04in; }
.keys { display: grid; grid-template-columns: 1fr 1fr; gap: 0.14in; align-content: start; }
.key { font-size: 11pt; line-height: 1.35; min-height: 0; }
.key p, .key li { margin: 0 0 0.03in; }
${w * h < 90 ? `.story { font-size: 12pt; } .head h2 { font-size: 20pt; } .title-page h1 { font-size: 32pt; } .guide .blk, .ws, .instr { font-size: 11pt; } .words { grid-template-columns: repeat(3, 1fr); } .badges { grid-template-columns: repeat(2, 1fr); } .keys { grid-template-columns: 1fr; }` : ""}
/* Corner prop and rank badge */
.corner { position: absolute; top: 0.18in; right: 0.28in; display: flex; align-items: center; gap: 0.08in; }
.corner img { width: 0.55in; height: 0.55in; object-fit: contain; }
.corner .rk { font-family: 'Fredoka', sans-serif; font-size: 10pt; border: 2px solid #000; border-radius: 999px; padding: 0.02in 0.1in; background: #fff; }
.widget { flex: 0 0 auto; padding: 0.1in 0.14in; }
.widget svg { width: 100%; height: auto; max-height: 3.6in; }
.sb-art { align-items: center; justify-content: center; }
.sb-art .frame.pic { flex: 1 1 auto; width: 100%; border-width: 5px; border-radius: 0.3in; }
.sb-story { gap: 0.2in; }
.sb-story .big { font-family: 'Fredoka', sans-serif; font-size: 15pt; line-height: 1.42; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
.sb-story .big p { margin: 0 0 0.06in; }
.sb-story .stl { font-family: 'Fredoka', sans-serif; font-size: 16pt; letter-spacing: 2px; text-align: center; margin: 0; }
.play { flex: 0 0 auto; border: 4px dashed #000; border-radius: 0.3in; padding: 0.2in 0.28in; }
.play .ph { font-family: 'Fredoka', sans-serif; font-size: 16pt; letter-spacing: 1px; margin: 0 0 0.08in; }
.play p { font-size: 17pt; line-height: 1.35; margin: 0; }
@media print {
  html, body { background: #fff; }
  .page { margin: 0; }
  .tip { display: none; }
}
`;

/** Builds a self-contained HTML book at the book's trim size from the drafted sections and generated pictures. */
export async function buildPrintableBook(book: Book, opts: PrintableOptions): Promise<string> {
  const { w: tw, h: th } = trimDims(book.trim);
  const chosen = pickPictures(book);
  const pics = new Map<string, string>();
  for (const [sectionId, imageId] of chosen) {
    try { pics.set(sectionId, await blobToDataUrl(await fetchImageBlob(imageId))); } catch { /* leave the frame empty */ }
  }

  const storybook = book.mode === "storybook";
  // Corner prop (a Library item of type Prop) and rank badge, stamped on every page of a section.
  let propUrl = "";
  if (book.mode === "activity" && book.cornerPropId) { try { propUrl = await blobToDataUrl(await fetchImageBlob(book.cornerPropId)); } catch { /* no corner prop */ } }
  const corner = (rank?: number) => {
    const r = rankText(rank);
    return propUrl || r ? `<div class="corner">${propUrl ? `<img src="${propUrl}" alt="">` : ""}${r ? `<span class="rk">${r}</span>` : ""}</div>` : "";
  };
  const pages: string[] = [];
  const add = (html: string) => {
    pages.push(html);
    if (opts.backingPages) pages.push(`<section class="page blank" aria-label="Blank backing page"></section>`);
  };
  const frame = (label: string, body: string, cls = "") => `<div class="frame blk ${cls}"><div class="label">${label}</div>${body}</div>`;
  const md = (t?: string) => (t ? mdToHtml(t) : "");

  add(`<section class="page title-page">
  <h1>${esc(book.title || "Untitled")}</h1>
  ${book.subtitle ? `<p class="sub">${esc(book.subtitle)}</p>` : ""}
  ${storybook ? "" : `<div class="frame belongs"><div class="label">This ${esc(book.nameplateLabel?.trim() || "Explorer Guide")} belongs to:</div><div class="line"></div></div>`}
  <div class="pub">Bright Trails Publishing</div>
</section>`);

  const parts = book.sections.map((s) => sectionParts(s));

  if (storybook) {
    // Toddler picture book: one picture page and one big-print story page per section. No worksheets, word banks, answer keys or Name/Date lines.
    const PLAY = ["Point to the happy faces. Can you count them?", "Can you find something round? Point and say what it is!", "Point to something blue. How many can you count?", "Can you wave hello to the picture?"];
    book.sections.forEach((s, i) => {
      const p = parts[i];
      const pic = pics.get(s.id);
      add(`<section class="page sb-art" aria-label="${esc(s.title)} illustration">
  <div class="frame pic">${pic ? `<img src="${pic}" alt="${esc(s.title)}">` : `<div class="none">Illustration not generated yet for: ${esc(s.title)}</div>`}</div>
</section>`);
      const story = p.STORY_TEXT ?? s.summary;
      const firstLine = (t?: string) => (t ?? "").split("\n").map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim()).find(Boolean);
      const play = firstLine(p.WHILE_YOU_LISTEN) ?? firstLine(p.GUIDE_DO) ?? PLAY[i % PLAY.length];
      // Fit the text on its page: biggest toddler-friendly size that fits, else split onto a second page. Never clipped.
      const chunks = fitStory(story, play, tw, th);
      chunks.forEach((c, k) => {
        const last = k === chunks.length - 1;
        add(`<section class="page sb-story">
  <p class="stl">STORY TIME${chunks.length > 1 ? ` (${k + 1} of ${chunks.length})` : ""}</p>
  <div class="big" style="font-size:${c.pt}pt">${c.paras.map((x) => `<p>${md(x).replace(/^<p>|<\/p>$/g, "")}</p>`).join("")}</div>
  ${last ? `<div class="play"><div class="ph">POINT, COUNT &amp; PLAY</div><p>${esc(play)}</p></div>` : ""}
</section>`);
      });
    });
  } else {
  book.sections.forEach((s, i) => {
    const p = parts[i];
    const pic = pics.get(s.id);
    const num = `<span class="num">${i + 1}</span>`;
    const story = p.STORY_TEXT ?? (p.WHILE_YOU_LISTEN || p.GUIDE_SAY ? "" : s.summary);

    // Page 1: story time. A portrait picture is tiny when it shares a page with the text, so the
    // default gives it a page of its own and puts the story on the next page.
    const picHtml = `<div class="frame pic">${pic ? `<img src="${pic}" alt="${esc(s.title)}">` : `<div class="none">Illustration not generated yet for: ${esc(s.title)}</div>`}</div>`;
    const textBlocks = `${story ? `<div class="frame story"><div class="label">Story time</div>${md(story)}</div>` : ""}
  ${p.WHILE_YOU_LISTEN ? frame("While you listen", `<div class="listen">${md(p.WHILE_YOU_LISTEN)}</div>`) : ""}`;
    if (opts.pictureLayout === "inline") {
      add(`<section class="page">
  <div class="head">${num}<h2>${esc(s.title)}</h2></div>
  ${picHtml}
  ${textBlocks}
  ${corner(s.rank)}
</section>`);
    } else {
      add(`<section class="page">
  <div class="head">${num}<h2>${esc(s.title)}</h2></div>
  ${picHtml}
  ${corner(s.rank)}
</section>`);
      if (story || p.WHILE_YOU_LISTEN) {
        add(`<section class="page">
  <div class="head">${num}<h2>${esc(s.title)}</h2></div>
  ${textBlocks}
  ${corner(s.rank)}
</section>`);
      }
    }

    // Page 2: parent and teacher quick-prep guide.
    const meta = [["Time", p.GUIDE_TIME], ["Skill", p.GUIDE_SKILL], ["Materials", p.GUIDE_MATERIALS]].filter(([, v]) => v);
    const guide = [
      meta.length ? `<div class="meta">${meta.map(([k, v]) => `<div class="frame"><div class="label">${k}</div><p>${esc(String(v).replace(/\n+/g, " "))}</p></div>`).join("")}</div>` : "",
      p.GUIDE_SAY ? frame("Say", md(p.GUIDE_SAY)) : "",
      p.GUIDE_DO ? frame("Do", md(p.GUIDE_DO)) : "",
      p.GUIDE_CHECK ? frame("Check", md(p.GUIDE_CHECK)) : "",
      p.GUIDE_TIP ? frame("Tip", md(p.GUIDE_TIP)) : "",
    ].join("");
    if (guide) {
      add(`<section class="page">
  <div class="head">${num}<h2>${esc(s.title)}</h2></div>
  <div class="kicker">Parent &amp; Teacher Quick-Prep Guide</div>
  <div class="guide">${guide}</div>
  ${corner(s.rank)}
</section>`);
    }

    // Page 3: the child's explorer worksheet.
    const svg = widgetSvg(s.widget, i);
    const bank = svg ? [] : wordList(p.WORD_BANK);
    if (p.WORKSHEET_BODY || p.WORKSHEET_INSTRUCTIONS || bank.length || svg || p.BONUS_DOODLE) {
      add(`<section class="page">
  <div class="head">${num}<h2>${esc(s.title)}: Explorer Worksheet</h2></div>
  <div class="namedate"><div>Name:</div><div>Date:</div></div>
  ${corner(s.rank)}
  ${p.WORKSHEET_INSTRUCTIONS ? `<p class="instr">${esc(p.WORKSHEET_INSTRUCTIONS.replace(/\n+/g, " "))}</p>` : ""}
  ${p.WORKSHEET_BODY ? `<div class="frame ws">${md(p.WORKSHEET_BODY)}</div>` : ""}
  ${svg ? `<div class="frame widget"><div class="label">${esc(WIDGET_TITLE[s.widget as string] ?? "Activity")}</div>${svg}</div>` : bank.length ? `<div class="frame"><div class="label">Word bank</div><div class="words">${bank.map((w) => `<div class="word">${esc(w)}</div>`).join("")}</div></div>` : ""}
  ${p.BONUS_DOODLE ? `<div class="frame doodle"><div class="label">Bonus doodle</div><p class="prompt">${esc(p.BONUS_DOODLE.replace(/\n+/g, " "))}</p><div class="area"></div></div>` : ""}
</section>`);
    }
  });

  // Explorer Passport: one badge per section. Library badges (type Badge) fill the stamps in order.
  const libBadges = new Map<number, string>();
  const badgeRefs = (book.characters ?? []).filter((c) => c.kind === "badge");
  for (let i = 0; i < Math.min(badgeRefs.length, book.sections.length); i++) {
    try { libBadges.set(i, await blobToDataUrl(await fetchImageBlob(badgeRefs[i].id))); } catch { /* plain stamp */ }
  }
  if (book.sections.length) {
    const brand = book.nameplateLabel?.trim() ? book.nameplateLabel.trim() : /barnaby/i.test(`${book.title} ${book.seriesName ?? ""} ${book.styleBible}`) ? "Barnaby Explorer Passport" : "Explorer Passport";
    const badges = book.sections.map((s, i) => `<div class="frame badge"><div class="stamp${libBadges.has(i) ? " art" : ""}">${libBadges.has(i) ? `<img src="${libBadges.get(i)}" alt="">` : `<span>${i + 1}</span>`}</div><div class="bt">${esc(s.title)}</div><div class="bs">${parts[i].GUIDE_SKILL ? esc(parts[i].GUIDE_SKILL!.replace(/\n+/g, " ")) : "Stamp when finished"}</div></div>`).join("");
    add(`<section class="page">
  <div class="head"><h2>${brand}</h2></div>
  <div class="kicker">${esc(book.title || "")}: collect a stamp for every adventure.</div>
  <div class="badges">${badges}</div>
  <div class="namedate"><div>Explorer name:</div><div>Date:</div></div>
</section>`);
  }

  // Answer key, six sections to a page.
  const keyed = book.sections.map((s, i) => ({ s, i, key: parts[i].ANSWER_KEY })).filter((x) => x.key);
  for (let c = 0; c < keyed.length; c += 6) {
    const chunk = keyed.slice(c, c + 6);
    add(`<section class="page">
  <div class="head"><h2>Parent &amp; Teacher Answer Key</h2></div>
  <div class="keys">${chunk.map((x) => `<div class="frame key"><div class="label">${x.i + 1}. ${esc(x.s.title)}</div>${md(x.key)}</div>`).join("")}</div>
</section>`);
  }

  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(book.title || "Printable book")} (${esc(trimLabel(book.trim).split(" (")[0])} interior)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
<style>${cssFor(tw, th)}</style></head>
<body>
<div class="tip">Press Ctrl+P (Cmd+P on Mac), choose Save as PDF, set the paper size to ${tw} × ${th} in (Custom, or the closest) and Margins to None, and turn Background graphics on. This note does not print.</div>
${pages.join("\n")}
</body></html>`;
}
