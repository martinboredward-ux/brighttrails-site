import type { Book } from "../types";
import type { Reserved, ReservedItem } from "../api";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reserved items that apply to this book: everything except the items the book itself owns. */
export function reservedFor(r: Reserved, book: Pick<Book, "title" | "seriesName" | "slug">): { names: ReservedItem[]; animals: ReservedItem[] } {
  const hay = `${book.title ?? ""} ${book.seriesName ?? ""} ${book.slug ?? ""}`.toLowerCase();
  const applies = (i: ReservedItem) => !i.owner || !hay.includes(i.owner);
  return { names: r.names.filter(applies), animals: r.animals.filter(applies) };
}

export interface ReservedHit { word: string; kind: "name" | "animal"; where: string; owner?: string }

/** Finds reserved names and lead animals in the book's notes, section titles, summaries and drafts. */
export function scanReserved(book: Book, r: Reserved): ReservedHit[] {
  const f = reservedFor(r, book);
  const spots: { where: string; text: string }[] = [
    { where: "Notes", text: book.notes ?? "" },
    ...book.sections.flatMap((s, i) => [
      { where: `Section ${i + 1} (${s.title || "untitled"})`, text: `${s.title} ${s.summary} ${s.draft}` },
    ]),
  ];
  const hits: ReservedHit[] = [];
  const test = (i: ReservedItem, kind: ReservedHit["kind"]) => {
    const plural = kind === "animal" ? "(?:s|es)?" : "";
    // Names are matched exactly as written (capitalized), so the ordinary word "dot" or "dash" is not mistaken for a character. Animals match in any case.
    const re = new RegExp(`\\b${esc(i.name)}${plural}\\b`, kind === "name" ? "" : "i");
    for (const sp of spots) if (re.test(sp.text)) hits.push({ word: i.name, kind, where: sp.where, owner: i.owner });
  };
  f.names.forEach((i) => test(i, "name"));
  f.animals.forEach((i) => test(i, "animal"));
  return hits;
}
