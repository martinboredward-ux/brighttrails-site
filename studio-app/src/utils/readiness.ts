import type { Book } from "../types";
import { scanBanned } from "../banned";
import { checkKeywords } from "../kdpCheck";
import { coverApproved, coverDefaults } from "./coverComposer";
import { trimLabel } from "./trims";

export interface Pill { key: string; label: string; ok: boolean; why: string }

/** The four gates behind "Stamp Final Approval". All live, nothing stored except the final stamp. */
export function readiness(book: Book): { pills: Pill[]; allOk: boolean } {
  const drafted = book.sections.filter((s) => s.draft.trim()).length;
  const k = book.kdp;
  const kdpProblems: string[] = [];
  if (!k) kdpProblems.push("make the KDP package (tab 4)");
  else {
    if (!k.keywords.length) kdpProblems.push("no keywords yet");
    if (checkKeywords(k.keywords, book.title, book.subtitle).some((x) => x.tooLong)) kdpProblems.push("a keyword is over 50 characters");
    const text = [book.title, book.subtitle, k.htmlDescription, ...k.keywords, ...k.aPlusModules.flatMap((m) => [m.headline, m.body])].join(" ");
    const hits = scanBanned(text);
    if (hits.length) kdpProblems.push(`banned or risky words: ${[...new Set(hits)].slice(0, 5).join(", ")}`);
    if (!k.aPlusModules.some((m) => m.imageId)) kdpProblems.push("no A+ module has a picture yet (tab 5)");
  }
  const pills: Pill[] = [
    { key: "idea", label: "Idea & Age-Fit Reviewed", ok: !!book.preReview.trim(), why: "Run Review #1 on tab 1." },
    { key: "proof", label: "Manuscript Proofread & Formatted", ok: !!book.review.trim() && drafted > 0 && drafted === book.sections.length, why: drafted < book.sections.length ? "Draft every section, then run Review #2 at the end of tab 2." : "Run Review #2 at the end of tab 2." },
    { key: "cover", label: "Cover Checked & Approved", ok: coverApproved(coverDefaults(book)), why: "Open tab 3 and press Mark Cover Approved." },
    { key: "kdp", label: "KDP Keywords & A+ Policy Clear", ok: kdpProblems.length === 0, why: kdpProblems.join("; ") },
  ];
  return { pills, allOk: pills.every((p) => p.ok) };
}

export function certificateText(book: Book): string {
  const { pills } = readiness(book);
  const c = coverDefaults(book);
  return [
    "APPROVED FOR KDP",
    "=================",
    `Book: ${book.title}${book.subtitle ? `: ${book.subtitle}` : ""}`,
    `Series: ${book.seriesName || "(none)"}`,
    `Mode: ${book.mode} · Trim: ${trimLabel(book.trim)} · Pages on cover: ${c.pageCount}`,
    `AI disclosure: ${book.aiDisclosure}`,
    `Approved at: ${book.approvedAt || "(not stamped yet)"}`,
    "",
    "Checks at export time",
    ...pills.map((p) => `- [${p.ok ? "x" : " "}] ${p.label}${p.ok ? "" : ` (${p.why})`}`),
    c.approvedAt ? `Cover approved: ${c.approvedAt}` : "",
    c.checkNotes ? `Last cover quality check: ${c.checkNotes}` : "",
    book.lastApplied ? `Last applied review fixes (${book.lastApplied.kind === "idea" ? "idea review" : "proofread QA"}, ${book.lastApplied.at}): ${book.lastApplied.changes.length} changes` : "",
    "",
    "This certificate records the author's own sign-off in Bright Trails Studio. It is not an approval from Amazon KDP.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}
