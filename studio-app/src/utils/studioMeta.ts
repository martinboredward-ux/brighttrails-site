import type { Book, BookStudio, Flag, Snapshot } from "../types";

export const meta = (b: Book): BookStudio => b.studio ?? {};
const uid = () => Math.random().toString(36).slice(2, 10);

/** Adds a restore point (kept: newest 8). Returns the new studio object to save. */
export function withSnapshot(book: Book, label: string): BookStudio {
  const m = meta(book);
  const snap: Snapshot = { id: uid(), at: new Date().toISOString(), label, title: book.title, subtitle: book.subtitle, notes: book.notes, styleBible: book.styleBible, sections: book.sections.map((s) => ({ ...s })) };
  return { ...m, snapshots: [...(m.snapshots ?? []), snap].slice(-8) };
}

export function restoreSnapshot(book: Book, id: string): Partial<Book> | null {
  const snap = (meta(book).snapshots ?? []).find((s) => s.id === id);
  if (!snap) return null;
  // The state before the restore is itself kept, so a restore can be undone.
  return { title: snap.title, subtitle: snap.subtitle, notes: snap.notes, styleBible: snap.styleBible, sections: snap.sections, studio: withSnapshot(book, "Before restoring " + new Date(snap.at).toLocaleString()) };
}

export function addFlag(book: Book, sectionId: string | undefined, where: string, note: string): BookStudio {
  const m = meta(book);
  const f: Flag = { id: uid(), sectionId, where, note: note.trim().slice(0, 500), at: new Date().toISOString() };
  return { ...m, flags: [...(m.flags ?? []), f] };
}
export const setFlagDone = (book: Book, id: string, done: boolean): BookStudio => ({ ...meta(book), flags: (meta(book).flags ?? []).map((f) => (f.id === id ? { ...f, done } : f)) });
export const removeFlag = (book: Book, id: string): BookStudio => ({ ...meta(book), flags: (meta(book).flags ?? []).filter((f) => f.id !== id) });

/** The refinement queue as plain text to paste into a Claude session. */
export function flagsText(book: Book): string {
  const open = (meta(book).flags ?? []).filter((f) => !f.done);
  if (!open.length) return "";
  return [`Flagged for Claude: ${book.title}`, ...open.map((f, i) => `${i + 1}. ${f.where}: ${f.note}`)].join("\n");
}

// ---- launch checklist and season countdown ----
export const LAUNCH_STEPS: { key: string; label: string }[] = [
  { key: "manuscript", label: "Manuscript drafted, Polish and Review #2 done" },
  { key: "pictures", label: "Every page picture added and checked" },
  { key: "checks", label: "Checks & preview panel shows all clear" },
  { key: "interior", label: "Printable interior exported, page count set in Cover Studio" },
  { key: "cover", label: "Cover approved and wrap PDF/PNG downloaded" },
  { key: "kdp", label: "KDP package made: keywords, description, categories" },
  { key: "disclosure", label: "AI-content disclosure answered in KDP" },
  { key: "price", label: "Price set above the print cost (see calculator)" },
  { key: "proof", label: "Proof copy ordered" },
  { key: "proofin", label: "Proof received and inspected by my friend in the US" },
  { key: "proofok", label: "Proof approved, fixes (if any) uploaded" },
  { key: "aplus", label: "A+ content added" },
  { key: "series", label: "Series page / Also-by page updated" },
  { key: "published", label: "Published on KDP" },
];
export const launchProgress = (b: Book) => { const l = meta(b).launch ?? {}; return { done: LAUNCH_STEPS.filter((s) => l[s.key]).length, total: LAUNCH_STEPS.length }; };
export const nextAction = (b: Book): string => { const l = meta(b).launch ?? {}; return LAUNCH_STEPS.find((s) => !l[s.key])?.label ?? "Done"; };

/** Works backwards from the date the book must be live. Lead times are the author's own editable defaults. */
export interface Lead { review: number; proofShip: number; proofCheck: number; fixes: number; build: number }
export const DEFAULT_LEAD: Lead = { review: 3, proofShip: 14, proofCheck: 3, fixes: 3, build: 10 };
export function seasonPlan(target: string, lead: Lead = DEFAULT_LEAD, today = new Date()) {
  const t = new Date(target + "T00:00:00");
  if (!target || isNaN(t.getTime())) return null;
  const day = 86400000;
  const mustUpload = new Date(t.getTime() - lead.review * day);
  const proofApproved = new Date(mustUpload.getTime() - lead.fixes * day);
  const proofArrives = new Date(proofApproved.getTime() - lead.proofCheck * day);
  const orderProof = new Date(proofArrives.getTime() - lead.proofShip * day);
  const startBy = new Date(orderProof.getTime() - lead.build * day);
  const daysLeft = Math.ceil((t.getTime() - today.getTime()) / day);
  const late = startBy.getTime() < today.getTime();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startBy: fmt(startBy), orderProof: fmt(orderProof), proofArrives: fmt(proofArrives), proofApproved: fmt(proofApproved), mustUpload: fmt(mustUpload), live: fmt(t), daysLeft, late, daysToStart: Math.ceil((startBy.getTime() - today.getTime()) / day) };
}

// ---- KDP print cost and royalty ----
export type InteriorType = "bw" | "standardColor" | "premiumColor";
export const INTERIOR_LABEL: Record<InteriorType, string> = { bw: "Black & white (white paper)", standardColor: "Standard color", premiumColor: "Premium color" };
/** Large trim = wider than 6.12 in or taller than 9 in (KDP's rule). */
export const isLargeTrim = (trim: string) => { const [w, h] = trim.split("x").map(Number); return w > 6.12 || h > 9; };
/** Amazon.com paperback printing cost, from KDP's Paperback Printing Cost page (checked 28 Nov 2026). Always re-check kdp.amazon.com before pricing. */
export function printCost(type: InteriorType, pages: number, large: boolean): number | null {
  if (type === "bw") {
    if (pages < 24 || pages > 828) return null;
    if (pages <= 110) return large ? 2.84 : 2.3;
    return +(1 + pages * (large ? 0.017 : 0.012)).toFixed(2);
  }
  if (type === "standardColor") {
    if (pages < 72 || pages > 600) return null;
    return +(1 + pages * (large ? 0.0402 : 0.0255)).toFixed(2);
  }
  if (pages < 24 || pages > 828 || (pages > 40 && pages < 42)) return null;
  if (pages <= 40) return large ? 4.2 : 3.6;
  return +(1 + pages * (large ? 0.08 : 0.065)).toFixed(2);
}
/** Paperback royalty is 60% of list price minus printing cost. */
export function royalty(list: number, cost: number) { return +(list * 0.6 - cost).toFixed(2); }
export function minPrice(cost: number, wanted: number) { return +((cost + wanted) / 0.6).toFixed(2); }
export const KDP_COST_NOTE = "Rates: KDP Paperback Printing Cost page, Amazon.com, checked 28 Nov 2026. Other marketplaces and Expanded Distribution differ.";

// ---- preflight: what to set up for each type of book ----
export interface BookType { id: string; label: string; mode: Book["mode"]; trim: Book["trim"]; interior: InteriorType; pages: [number, number]; ai: Book["aiDisclosure"]; bible: string; assets: string[]; notes: string }
export const BOOK_TYPES: BookType[] = [
  { id: "activity", label: "Kids activity / coloring book", mode: "activity", trim: "8.5x11", interior: "bw", pages: [40, 100], ai: "assisted", assets: ["Main character sheet", "Rank badges", "Compass/props"], notes: "Coloring pages print black and white: the cheapest interior.",
    bible: "Look: friendly children's line art, clean uniform black outlines, hollow shapes, white background. Characters: <name and species, outfit>. Props: <3-5 props>. Layout: one full-page scene, generous margins. Avoid: gray shading, solid black fills, text in the picture, clutter." },
  { id: "storybook", label: "Toddler / picture storybook", mode: "storybook", trim: "8.5x8.5", interior: "standardColor", pages: [24, 40], ai: "assisted", assets: ["Main character sheet", "Side characters", "Setting reference"], notes: "Full-color interior: every page prints at the color rate, so keep page count lean.",
    bible: "Look: warm soft storybook illustration, flat colors, clear simple shapes. Characters: <name and species, signature item>. Setting: <where>. Layout: one illustration per spread, calm space for text. Avoid: clutter, scary imagery, text in the picture." },
  { id: "nonfiction", label: "Nonfiction guide / workbook", mode: "nonfiction", trim: "6x9", interior: "bw", pages: [80, 200], ai: "assisted", assets: ["Author photo (optional)"], notes: "Text-led: black and white is cheapest. Reflowable text can also go to Kindle (EPUB).",
    bible: "Voice: clear, practical, encouraging; short paragraphs; concrete examples. Reader: <who>. Avoid: jargon, hype, medical or income claims." },
  { id: "planner", label: "Planner / vision board (full color)", mode: "planner", trim: "8.5x11", interior: "standardColor", pages: [100, 150], ai: "assisted", assets: ["Icon and badge sheets", "Phase opener art", "Maya character sheet"], notes: "Full-color cut-outs mean EVERY page prints in color. Check the cost calculator before fixing the page count. Seasonal: demand peaks December to January.",
    bible: "Modern editorial illustration in a refined full-color palette (blush, sage, cream, gold), Scandinavian minimalism, crisp elegant contours. Maya: polished female founder, sleek high topknot, tailored blazer, gold hoop earrings. Props: leather planner, tablet, ceramic mug, laptop. Full-page portrait, generous margins. Avoid: cartoon look, clutter, heavy dark shading." },
  { id: "gamebook", label: "Trivia gamebook (ages 9-12)", mode: "gamebook", trim: "8.5x11", interior: "standardColor", pages: [60, 100], ai: "assisted", assets: ["Guide mascot sheet", "Map tracker art", "Caution-tape border"], notes: "Branching pages: Studio links pages by id and prints the real page numbers. Run the path checker before export.",
    bible: "Look: interactive gamebook, illustrated map tracker, badge checkpoints, caution-tape detour borders, witty gadget-toting explorer mascot. Voice: witty, energetic, explanations under 50 words. Avoid: text dumps, babyish framing, obscure recall questions." },
  { id: "tracing", label: "Preschool letter tracing (ages 4-6)", mode: "tracing", trim: "8.5x11", interior: "bw", pages: [60, 110], ai: "assisted", assets: ["Mascot character sheet (your mascot, e.g. Toby)", "4 action poses (slide, leap, pull down, stretch)"], notes: "Two-page spread per letter. No medical or therapy claims anywhere, including the KDP description.",
    bible: "Look: high-contrast, uncluttered, sensory-friendly. Mascot: (name and animal of your mascot, with sweatband and running shoes; keep the same animal on every page). Tracing lines bold 3-4pt, 0.75in safety margin. Avoid: clutter, stippling, decorative borders, medical claims." },
  { id: "cutout", label: "Seasonal cut-out book (Valentine's etc.)", mode: "planner", trim: "8.5x11", interior: "standardColor", pages: [40, 80], ai: "assisted", assets: ["Cut-out sheets (single-sided)", "Sticker/icon sheets"], notes: "Cut-out pages print single-sided with a blank back. Must be live well before the holiday (see the countdown).",
    bible: "Look: bright full-color cut-out clip art with clean outlines on white, one theme per sheet, generous spacing between shapes. Avoid: shapes touching the page edge, clutter, text in the picture." },
];
export const bookType = (id?: string) => BOOK_TYPES.find((t) => t.id === id);

export const KDP_REMINDERS = [
  "Answer the AI-content question in KDP honestly (text and images made with AI tools must be disclosed).",
  "Pick the interior type once: all pages color or all black and white.",
  "Price above print cost plus the royalty you want (use the calculator).",
  "Order a proof copy and have it checked in the US before approving.",
  "Search the exact title on Amazon first; do not use trademarks or reserved names.",
];
