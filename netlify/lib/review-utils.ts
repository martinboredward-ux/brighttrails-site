import type { Book, ReviewFix } from "./studio-store.ts";

/** Cleans the fixes the AI returned: unique ids, short strings, at most 12, valid targets only. */
export function cleanFixes(raw: unknown, targets: ReviewFix["target"][]): ReviewFix[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReviewFix[] = [];
  raw.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const title = String(o.title ?? "").trim().slice(0, 140);
    const detail = String(o.detail ?? "").trim().slice(0, 700);
    if (!title) return;
    let id = String(o.id ?? `fix-${i + 1}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || `fix-${i + 1}`;
    while (seen.has(id)) id += "x";
    seen.add(id);
    const t = String(o.target ?? targets[0]) as ReviewFix["target"];
    out.push({ id, title, detail, target: targets.includes(t) ? t : targets[0] });
  });
  return out.slice(0, 12);
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as T;
}

/** Word-level before/after summary, computed here so the change log is proof and not the AI's say-so. */
export function diffSummary(before: string, after: string, label: string, max = 8): string[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  if (a.length > 2500 || b.length > 2500) return a.join(" ") === b.join(" ") ? [] : [`${label}: large rewrite (${a.length} → ${b.length} words)`];
  const n = a.length, m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hunks: string[] = [];
  let i = 0, j = 0, del: string[] = [], add: string[] = [];
  const flush = () => {
    if (del.length || add.length) {
      const cut = (w: string[]) => { const t = w.join(" "); return t.length > 70 ? `${t.slice(0, 67)}…` : t; };
      hunks.push(del.length && add.length ? `“${cut(del)}” → “${cut(add)}”` : del.length ? `removed “${cut(del)}”` : `added “${cut(add)}”`);
    }
    del = []; add = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) add.push(b[j++]);
    else del.push(a[i++]);
  }
  flush();
  if (!hunks.length) return [];
  const shown = hunks.slice(0, max).map((h) => `${label}: ${h}`);
  if (hunks.length > max) shown.push(`${label}: …and ${hunks.length - max} more edits`);
  return shown;
}

const EXPECT: Record<string, string[]> = {
  activity: ["STORY_TEXT", "WORKSHEET_BODY", "ANSWER_KEY"],
  storybook: ["STORY_TEXT"],
  nonfiction: [],
};

/** Mechanical checks that need no AI: stray brackets, missing tags, missing artwork. */
export function automatedChecks(book: Book): string {
  const lines: string[] = [];
  const known = /^(STORY_TEXT|WHILE_YOU_LISTEN|GUIDE_TIME|GUIDE_SKILL|GUIDE_MATERIALS|GUIDE_SAY|GUIDE_DO|GUIDE_CHECK|GUIDE_TIP|WORKSHEET_INSTRUCTIONS|WORKSHEET_BODY|WORD_BANK|BONUS_DOODLE|ANSWER_KEY|IMAGE_PROMPT)$/;
  book.sections.forEach((s, i) => {
    const where = `Section ${i + 1} "${s.title}"`;
    if (!s.draft.trim()) { lines.push(`${where}: not drafted yet`); return; }
    const tags = new Set<string>();
    for (const ln of s.draft.split("\n")) {
      const m = /^\s*(?:#{1,6}\s*)?[*_]*\[{0,2}\s*([A-Z_]{4,})\s*:?\s*\]{0,2}[*_]*/.exec(ln);
      if (m && known.test(m[1])) {
        tags.add(m[1]);
        const opens = (ln.match(/\[/g) ?? []).length, closes = (ln.match(/\]/g) ?? []).length;
        if (opens !== closes || /^\s*[*_#\s]*\[\[|\]\]/.test(ln.slice(0, 40))) lines.push(`${where}: broken bracket on the line "${ln.trim().slice(0, 50)}"`);
      }
    }
    for (const t of EXPECT[book.mode] ?? []) if (!tags.has(t)) lines.push(`${where}: missing ${t} block`);
    if (book.mode === "storybook") for (const t of ["WORD_BANK", "ANSWER_KEY", "WORKSHEET_BODY"]) if (tags.has(t)) lines.push(`${where}: has a ${t} block, which a toddler storybook must not have`);
    if (!book.images.some((im) => im.sectionId === s.id)) lines.push(`${where}: no picture yet`);
  });
  return lines.length ? lines.map((l) => `- ${l}`).join("\n") : "- none found";
}
