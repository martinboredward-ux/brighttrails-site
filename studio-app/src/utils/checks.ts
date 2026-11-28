import type { Book, GeneratedImage, Section } from "../types";
import { trimDims } from "./trims";
import { countCues } from "../imagePrompts";
import { matterOf } from "./matter";
import { mascotName } from "../imagePrompts";

export interface Finding { sectionId?: string; where: string; level: "fix" | "note"; text: string }

export const pagePicture = (book: Book, s: Section): GeneratedImage | undefined =>
  book.images.filter((i) => i.sectionId === s.id && i.slot !== "puzzle").slice(-1)[0];
export const puzzlePicture = (book: Book, s: Section): GeneratedImage | undefined =>
  book.images.filter((i) => i.sectionId === s.id && i.slot === "puzzle").slice(-1)[0];

const has = (t: string, re: RegExp) => re.test(t);

/** PROMISE CHECK (free): every "count / trace / press / color" the page promises has something on the page that delivers it. */
export function promiseCheck(book: Book): Finding[] {
  const out: Finding[] = [];
  book.sections.forEach((s, i) => {
    const where = `Section ${i + 1}: ${s.title}`;
    const t = `${s.title}\n${s.summary}\n${s.draft}`.toLowerCase();
    const w = s.widget ?? "wordbank";
    const puzzle = !!puzzlePicture(book, s);
    const pic = !!pagePicture(book, s);
    const add = (text: string, level: Finding["level"] = "fix") => out.push({ sectionId: s.id, where, level, text });
    if (s.kind === "template" || s.kind === "cutout" || s.kind === "picture") return;
    if (book.mode !== "nonfiction" && s.draft.trim() && !pic) add("No picture on this page yet.", "note");
    if (book.mode === "activity" && s.kind !== "coloring") {
      if (has(t, /dot[- ]?markers?|press (a |your )?(dot|marker)|round targets?|dab/) && w !== "dotmarker" && !puzzle) add("The text asks for dot markers, but no Dot-Marker Targets widget or puzzle picture is on this page. Pick the widget in Tab 2.");
      if (has(t, /\btrace\b|tracing|dashed (path|line)|follow the (path|line)/) && w !== "tracing" && !puzzle) add("The text asks the child to trace, but no tracing widget or puzzle picture is on this page.");
      if (has(t, /connect the dots|dot[- ]to[- ]dot/) && w !== "dots" && !puzzle) add("The text asks for dot-to-dot, but no Dot-to-Dot widget is on this page.");
      if (has(t, /compass rose|label the compass|north.*south.*east.*west/) && w !== "compass" && !puzzle) add("The text mentions the compass rose, but the Compass widget is not on this page.", "note");
      if (has(t, /map key|grid/) && has(t, /\bmap\b/) && w !== "mapgrid" && !puzzle) add("The text mentions a map grid, but the Map Key Grid widget is not on this page.", "note");
    }
    for (const c of countCues(s)) {
      if (!pic) add(`The text asks the child to find ${c.n} ${c.thing}, but this page has no picture to check.`, "note");
      else add(`Check the picture shows exactly ${c.n} ${c.thing}. (Use "Picture matches the page?" on this section.)`, "note");
    }
    if (s.kind === "coloring" && !pic) add("This is a coloring page but it has no picture yet.");
    if (s.kind !== "coloring" && book.mode !== "nonfiction" && !s.draft.trim()) add("Not drafted yet.", "note");
  });
  return out;
}

/** KDP file checks that need no pictures: page count, trim, cover match. */
export function structureCheck(book: Book, printedPages: number): Finding[] {
  const out: Finding[] = [];
  const cover = (book.cover ?? {}) as { pageCount?: number; trim?: string; frontArtId?: string; backBlurb?: string };
  if (printedPages % 2) out.push({ where: "Interior", level: "fix", text: `The interior has ${printedPages} pages (odd). KDP prints in sheets, so use an even number.` });
  if (printedPages && printedPages < 24) out.push({ where: "Interior", level: "fix", text: `KDP needs at least 24 pages; this has ${printedPages}.` });
  if (printedPages > 828) out.push({ where: "Interior", level: "fix", text: `KDP allows at most 828 pages; this has ${printedPages}.` });
  if (cover.pageCount && printedPages && cover.pageCount !== printedPages) out.push({ where: "Cover", level: "fix", text: `Cover Studio says ${cover.pageCount} pages but the interior has about ${printedPages}. The spine width depends on it, so set it and re-download the wrap.` });
  if (cover.trim && cover.trim !== book.trim) out.push({ where: "Cover", level: "fix", text: `Cover trim (${cover.trim}) does not match the book trim (${book.trim}).` });
  if (!cover.frontArtId) out.push({ where: "Cover", level: "note", text: "No front cover picture chosen yet." });
  if (!cover.backBlurb?.trim()) out.push({ where: "Cover", level: "note", text: "The back cover has no blurb text yet (Cover Studio: Fill from my KDP description)." });
  return out;
}

/** Counts printed pages the same way the printable book does, roughly: one per section, two for coloring pages (blank back), plus title, copyright and end matter. */
export function estimatePages(book: Book): number {
  let n = 2; // title + copyright
  const m = matterOf(book);
  n += [m.dedication, m.howTo, m.about, m.alsoBy, m.review].filter((x) => x.trim()).length;
  const tpl = book.mode === "planner" || book.mode === "tracing" || book.mode === "gamebook";
  for (const s of book.sections) {
    if (tpl) {
      if (s.kind === "cutout") n += 2;
      else if (s.tpl === "letter") n += 2;
      else if (s.tpl === "quotes") n += 2;
      else if (s.tpl === "checklist") n += Math.max(1, Math.ceil((s.data?.items ?? "").split("\n").filter((x) => x.trim()).length / 16));
      else n += 1;
    } else n += s.kind === "coloring" ? 2 : book.mode === "activity" ? 2 : 1;
  }
  return n + (n % 2);
}

export interface PicStats { w: number; h: number; dpi: number; darkFill: number; cornerWhite: boolean }

/** Looks at one picture in the browser: size, how many pixels are solid black, and whether the corners are white. */
export async function picStats(blob: Blob, trim: string): Promise<PicStats> {
  const bmp = await createImageBitmap(blob);
  const t = trimDims(trim);
  const dpi = Math.round(Math.min(bmp.width / t.w, bmp.height / t.h));
  const S = 96, c = document.createElement("canvas"); c.width = S; c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) dark++;
  const px = (x: number, y: number) => { const o = (y * S + x) * 4; return d[o] > 235 && d[o + 1] > 235 && d[o + 2] > 235; };
  const cornerWhite = px(2, 2) && px(S - 3, 2) && px(2, S - 3) && px(S - 3, S - 3);
  const out = { w: bmp.width, h: bmp.height, dpi, darkFill: dark / (S * S), cornerWhite };
  bmp.close();
  return out;
}

/** Turns picture stats into plain findings for one page. */
export function picFindings(book: Book, s: Section, st: PicStats, i: number): Finding[] {
  const where = `Section ${i + 1}: ${s.title}`;
  const out: Finding[] = [];
  const add = (text: string, level: Finding["level"] = "fix") => out.push({ sectionId: s.id, where, level, text });
  if (st.dpi < 150) add(`The picture is only about ${st.dpi} dpi at the trim size (${st.w}×${st.h}px). KDP wants about 300; it will print soft or pixelated.`);
  else if (st.dpi < 200) add(`The picture is about ${st.dpi} dpi at the trim size. Acceptable, but 300 is best.`, "note");
  const coloring = book.mode === "activity" || s.kind === "coloring";
  if (coloring && st.darkFill > 0.22) add(`About ${Math.round(st.darkFill * 100)}% of this picture is solid black. Coloring pages need white shapes to color; regenerate or fix it.`);
  if (coloring && !st.cornerWhite) add("The corners of this picture are not white. Coloring pages should sit on pure white.");
  const t = trimDims(book.trim), want = t.w / t.h, got = st.w / st.h;
  if (Math.abs(got - want) / want > 0.35 && s.kind !== "cutout") add(`The picture shape (${st.w}×${st.h}) is very different from the page shape, so it will be small or cropped.`, "note");
  return out;
}

import { pathCheck, fiftyWordCheck } from "./gamebook";
import { CLAIM_WORDS, OTHER_DIRECTION, tplDef } from "../../../netlify/lib/templates";
import { isLargeTrim, printCost } from "./studioMeta";

/** Checks that only apply to planner, preschool tracing and gamebook books. */
export function modeChecks(book: Book): Finding[] {
  const out: Finding[] = [];
  if (book.mode === "gamebook") return [...pathCheck(book), ...fiftyWordCheck(book)];
  if (book.mode === "planner") {
    book.sections.forEach((s, i) => {
      const where = `Page ${i + 1}: ${s.title}`;
      if (s.tpl && tplDef(s.tpl) && !Object.values(s.data ?? {}).some((v) => v.trim())) out.push({ sectionId: s.id, where, level: "fix", text: "This template page has no words yet. Use Fill the words with AI, or type them." });
      if (s.kind === "cutout" && !pagePicture(book, s)) out.push({ sectionId: s.id, where, level: "fix", text: "This cut-out sheet has no picture yet." });
      if (s.kind === "picture" && !pagePicture(book, s)) out.push({ sectionId: s.id, where, level: "fix", text: "This full-page picture page has no picture yet." });
    });
    const pages = estimatePages(book);
    const cost = printCost("standardColor", pages, isLargeTrim(book.trim));
    if (cost === null) out.push({ where: "Whole book", level: "note", text: `Standard color needs 72-600 pages (this is about ${pages}). Premium color or black and white follow different rules; check the calculator in Tab 6.` });
    else out.push({ where: "Whole book", level: "note", text: `Full-color interior at about ${pages} pages costs about $${cost.toFixed(2)} to print (standard color). Every page prints in color; check the price in Tab 6.` });
    const all = book.sections.map((s) => Object.values(s.data ?? {}).join(" ") + s.draft).join(" ");
    if (/\b202[0-5]\b/.test(all)) out.push({ where: "Whole book", level: "note", text: "Found an older year (2020-2025) in the text. A 2027 planner should not mention it." });
  }
  if (book.mode === "tracing") {
    book.sections.forEach((s, i) => {
      if (s.tpl !== "letter") return;
      const where = `Letter ${s.data?.letter ?? i + 1}`;
      const txt = Object.values(s.data ?? {}).join(" ");
      if (!txt.trim()) out.push({ sectionId: s.id, where, level: "fix", text: "No story cue or parent prompt yet." });
      if (CLAIM_WORDS.test(txt)) out.push({ sectionId: s.id, where, level: "fix", text: "Medical or therapy wording found. Preschool tracing books must not make those claims." });
      if (OTHER_DIRECTION.test(txt)) out.push({ sectionId: s.id, where, level: "fix", text: "Direction words must be only: Pull down, Slide right, Hop over, Loop around." });
      if ((s.data?.parent ?? "").split(/(?<=[.!?])\s+/).filter(Boolean).length > 2) out.push({ sectionId: s.id, where, level: "fix", text: "Parent prompt is longer than 2 sentences." });
      if (!pagePicture(book, s)) out.push({ sectionId: s.id, where, level: "note", text: `No ${mascotName(book)} pose picture on this letter yet.` });
    });
    const text = `${book.title} ${book.subtitle} ${book.kdp?.htmlDescription ?? ""} ${(book.kdp?.keywords ?? []).join(" ")}`;
    if (CLAIM_WORDS.test(text)) out.push({ where: "Title / KDP description", level: "fix", text: "Medical or therapy claim word in the title, subtitle, description or keywords." });
  }
  return out;
}
