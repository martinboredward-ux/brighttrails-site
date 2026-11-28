import type { Book, RefKind } from "../types";
import { parseTagged } from "../printableBook";

const STOP = new Set(["Series", "Setting", "Cast", "Tone", "Format", "Book", "Ages", "Supporting", "Visual", "Voice", "Layout", "Notes", "Option", "Style", "Mode", "Audience", "Skill", "Trim", "Page", "Pages", "Chapter", "Part", "Never", "Avoid", "Story", "Case"]);

/** Words that make a capitalized phrase a PLACE, not a character. */
const PLACE_WORD = /\b(City|Cities|Bay|Island|Islands|Falls|Mountain|Mountains|Mount|Volcano|Hill|Hills|Sea|Ocean|Lagoon|Province|Garden|Gardens|Market|Trail|Trails|Beach|Reef|Park|South|North|East|West|Southern|Northern|Eastern|Western|River|Lake|Cove|Harbor|Harbour|Port|Town|Village|Barangay|Street|Road|Avenue|Cave|Forest|Valley|Strait|Gulf|Peak|Shore|Coast|Bridge|Plaza|School|Museum|Church|Temple|Cathedral|Airport|Philippines|Mindanao|Luzon|Visayas|Davao|Manila|Cebu|Hong Kong)\b/i;

/** Words that make a capitalized phrase a PAGE or TEMPLATE name (Domain Vision Canvas, Tactical Milestone Matrix), never a character. */
const PAGE_WORD = /\b(Canvas|Matrix|Planner|Checklist|Tracker|Dashboard|Map|Sheet|Spread|Board|Framework|Sprint|Funnel|Thermometer|Calendar|Worksheet|Template|Review|Roadmap|Pillars?|Milestones?|Goals?|Vision|Strategy|Strategic|Tactical|Domain|Quarter|Quarterly|Weekly|Monthly|Habit|Habits|Ritual|Reflection|Intro|Introduction|Overview|Prompts?|Letter|Quotes?|Affirmations?|Collage)\b/i;

export const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Candidate { name: string; kind: RefKind; detail: string }

const isPlaceOrNickname = (name: string, quoted: string) => PLACE_WORD.test(name) || PAGE_WORD.test(name) || quoted.toLowerCase().includes(name.toLowerCase());

/** Characters are names followed by a bracket (Mika Reyes (10, leader…)); badges end in Badge, Award, Stamp… Places and quoted nicknames are skipped. */
export function findCandidates(book: Book): Candidate[] {
  const src = `${book.styleBible}\n${book.notes}`;
  const quoted = [...src.matchAll(/["“”]([^"“”\n]{2,80})["“”]/g)].map((m) => m[1]).join(" | ");
  const titles = new Set(book.sections.map((x) => x.title.trim().toLowerCase()));
  const ignored = new Set((book.ignoredAssetNames ?? []).map((n) => n.toLowerCase()));
  const out = new Map<string, Candidate>();
  const chars = src.matchAll(/(?:^|[\s,.;:])((?:Mr|Mrs|Ms|Dr)\.? [A-Z][a-z]+(?: [A-Z][a-z]+)?|[A-Z][a-z]+(?: [A-Z][a-z]+)*) \(([^)]{0,200})\)/g);
  for (const m of chars) {
    const name = m[1].trim();
    if (STOP.has(name.split(" ")[0]) || name.length < 3 || isPlaceOrNickname(name, quoted) || titles.has(name.toLowerCase())) continue;
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name, kind: "character", detail: m[2].trim() });
  }
  const sections = book.sections.map((s) => `${s.title} ${s.summary} ${s.draft}`).join("\n");
  const badges = `${src}\n${sections}`.matchAll(/\b((?:[A-Z][a-z]+ ){1,2}(?:Badge|Award|Stamp|Patch|Emblem|Medal))\b/g);
  for (const m of badges) {
    const name = m[1].trim();
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name, kind: "badge", detail: "" });
  }
  return [...out.values()].filter((c) => !ignored.has(c.name.toLowerCase()));
}

export function sectionText(book: Book, i: number): string {
  const s = book.sections[i];
  const t = parseTagged(s.draft);
  return `${s.title}\n${s.summary}\n${t ? Object.values(t).join("\n") : s.draft}`;
}

export const mentions = (text: string, name: string) => {
  const first = name.replace(/^(Mr|Mrs|Ms|Dr)\.? /, "").split(" ")[0];
  return new RegExp(`\\b${esc(name)}\\b`, "i").test(text) || (first.length > 2 && new RegExp(`\\b${esc(first)}\\b`, "i").test(text));
};
