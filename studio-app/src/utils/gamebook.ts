import type { Book, Section } from "../types";
import type { Finding } from "./checks";

export const GO_RE = /\[GO:\s*([^\]\s]+)\s*\]/gi;
export const linksOf = (s: Section): string[] => [...s.draft.matchAll(GO_RE)].map((m) => m[1]);
const ENDING = /victory|finish|ending|summit|treasure|you win|the end|champion|reached/i;
export const isEnding = (s: Section) => ENDING.test(s.title) || /\[END\]/i.test(s.draft);

/** Path checker: dead links, orphan pages, dead ends, loops with no exit, endings you can never reach. Free (code). */
export function pathCheck(book: Book): Finding[] {
  const out: Finding[] = [];
  const secs = book.sections;
  if (!secs.length) return out;
  const ids = new Map(secs.map((s) => [s.id, s]));
  const where = (s: Section) => `Page ${secs.indexOf(s) + 1}: ${s.title}`;
  const add = (s: Section, text: string, level: Finding["level"] = "fix") => out.push({ sectionId: s.id, where: where(s), level, text });
  const edges = new Map<string, string[]>();
  for (const s of secs) {
    const to = linksOf(s);
    edges.set(s.id, to.filter((t) => ids.has(t)));
    for (const t of to) if (!ids.has(t)) add(s, `Links to “${t}”, which is not a page id in this book. Use the id shown next to the page title.`);
    if (!to.length && !isEnding(s) && s.draft.trim()) add(s, "This page has no [GO: …] link and is not marked as an ending (title with Victory/Finish, or [END] in the text). Readers get stuck here.");
  }
  const start = secs[0].id;
  const seen = new Set<string>([start]);
  const q = [start];
  while (q.length) { const c = q.shift()!; for (const n of edges.get(c) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  for (const s of secs) if (!seen.has(s.id)) add(s, "Orphan page: no path from the first page leads here.");
  // Can every reachable page still reach an ending? (catches loops with no exit)
  const rev = new Map<string, string[]>();
  for (const [a, tos] of edges) for (const t of tos) rev.set(t, [...(rev.get(t) ?? []), a]);
  const good = new Set<string>(secs.filter(isEnding).map((s) => s.id));
  const rq = [...good];
  while (rq.length) { const c = rq.shift()!; for (const p of rev.get(c) ?? []) if (!good.has(p)) { good.add(p); rq.push(p); } }
  if (!secs.some(isEnding)) out.push({ where: "Whole book", level: "fix", text: "No ending page found. Name one “Victory” (or put [END] in it)." });
  for (const s of secs) if (seen.has(s.id) && !good.has(s.id) && !isEnding(s) && edges.get(s.id)?.length) add(s, "A reader can enter this page and never reach an ending (a loop with no exit). Add a way back or on.");
  // Detours should lead back.
  for (const s of secs) if (s.kind === "detour" && !(edges.get(s.id)?.length)) add(s, "A detour page should link back with [GO: …].", "note");
  return out;
}

/** Explanations over 50 words (the style bible's rule). Looks at lines that start with Explanation, Why, Fact, Answer, Fun fact. */
export function fiftyWordCheck(book: Book): Finding[] {
  const out: Finding[] = [];
  book.sections.forEach((s, i) => {
    for (const line of s.draft.split("\n")) {
      const m = /^\s*(?:[-*]\s*)?(?:\*\*)?(explanation|why|fact|fun fact|answer|did you know)\b[^:]*:?(?:\*\*)?\s*(.*)$/i.exec(line);
      const text = (m ? m[2] : "").trim();
      const n = text.split(/\s+/).filter(Boolean).length;
      if (m && n > 50) out.push({ sectionId: s.id, where: `Page ${i + 1}: ${s.title}`, level: "fix", text: `An explanation is ${n} words; the limit is 50.` });
    }
    const big = s.draft.split(/\n{2,}/).find((p) => p.split(/\s+/).length > 90);
    if (big) out.push({ sectionId: s.id, where: `Page ${i + 1}: ${s.title}`, level: "note", text: "A long text block (90+ words). Gamebook pages should be snappy." });
  });
  return out;
}

/** Page number each section will have when printed (front pages come first). */
export function pageNumbers(book: Book, frontPages: number): Map<string, number> {
  const m = new Map<string, number>();
  let n = frontPages;
  for (const s of book.sections) { n += 1; m.set(s.id, n); if (s.kind === "cutout") n += 1; }
  return m;
}

const plain = (s: string) => s.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();

/**
 * Gamebook drafts are written as page specs: meta lines, map notes and an illustration brief for the artist, then the text the reader sees.
 * The printed page must carry only the reader's parts (page text, field fact, question, choices). Drafts in other shapes print unchanged.
 */
export function readerText(draft: string): string {
  if (!/^\s*(?:[-*_]{3,})\s*$/m.test(draft)) return draft;
  const blocks = draft.split(/\n\s*(?:[-*_]{3,})\s*\n/);
  const keep: string[] = [];
  for (const b of blocks) {
    const lines = b.split("\n");
    const first = plain(lines.find((l) => l.trim()) ?? "").toLowerCase();
    if (!first) continue;
    if (/page id\b|page type\b/i.test(b) && !/\bchoice\b/i.test(first)) continue; // title + meta block
    if (/^(visual progress map|illustration|art notes?|image prompt|artist|map notes?)\b/.test(first)) continue;
    const labelled = /^(page text|story|text|field fact|[a-z' ]*field fact|[a-z' ]*micro-explanation|choices?|your choice|question|trivia|gate|checkpoint|clue)\b/.test(first) && plain(lines.find((l) => l.trim()) ?? "").length < 80;
    let body = lines.slice(lines.findIndex((l) => l.trim()) + (labelled ? 1 : 0)).join("\n");
    body = body.replace(/^[\s*_]*\(?\s*word count:?\s*\d+\s*\)?[\s*_]*$/gim, "").replace(/[*_]*\(\s*word count:?\s*\d+\s*\)[*_]*/gi, "").trim();
    if (!body) continue;
    let head = "";
    if (labelled) {
      if (/field fact|micro-explanation/.test(first)) head = "**Field Fact**\n\n";
      else if (/^(choices?|your choice)/.test(first)) head = "**What will you do?**\n\n";
      else if (/^(question|trivia|gate|checkpoint|clue)/.test(first)) head = `**${plain(lines.find((l) => l.trim()) ?? "").replace(/\(.*\)/, "").trim()}**\n\n`;
    }
    keep.push(head + body);
  }
  return keep.length ? keep.join("\n\n") : draft;
}

/** Page text that stops mid-sentence: the AI ran out of room. */
export function cutOffCheck(book: Book): Finding[] {
  const out: Finding[] = [];
  book.sections.forEach((s, i) => {
    const d = s.draft.trim();
    if (d.length < 200) return;
    const last = d.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
    if (!/[.!?:"”)\]*_>-]$/.test(last)) out.push({ sectionId: s.id, where: `Page ${i + 1}: ${s.title}`, level: "fix", text: "This page ends mid-sentence (the AI ran out of room). Redraft it or finish it by hand." });
  });
  return out;
}
