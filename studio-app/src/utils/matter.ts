import type { Book } from "../types";
import { meta } from "./studioMeta";

export interface Matter { dedication: string; howTo: string; about: string; alsoBy: string; review: string }
export const matterOf = (b: Book): Matter => ({ dedication: "", howTo: "", about: "", alsoBy: "", review: "", ...((meta(b) as { matter?: Partial<Matter> }).matter ?? {}) });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paras = (t: string) => t.split(/\n{2,}|\n/).filter((x) => x.trim()).map((x) => `<p>${esc(x.trim())}</p>`).join("");

/** Front and back matter pages as printable HTML sections (class "page matter"). Empty parts are skipped. */
export function matterPages(b: Book): { front: string[]; back: string[] } {
  const m = matterOf(b);
  const pg = (cls: string, inner: string) => `<section class="page matter ${cls}"><div class="mt">${inner}</div></section>`;
  const front: string[] = [], back: string[] = [];
  if (m.dedication.trim()) front.push(pg("ded", `<p class="ital">${esc(m.dedication.trim())}</p>`));
  if (m.howTo.trim()) front.push(pg("how", `<h2>How to use this book</h2>${paras(m.howTo)}`));
  if (m.about.trim()) back.push(pg("about", `<h2>About the author</h2>${paras(m.about)}`));
  if (m.alsoBy.trim()) back.push(pg("also", `<h2>More books from Bright Trails Publishing</h2>${paras(m.alsoBy)}`));
  if (m.review.trim()) back.push(pg("rev", `<h2>One small favor</h2>${paras(m.review)}`));
  return { front, back };
}
export const MATTER_CSS = `.matter { align-items: center; justify-content: center; text-align: center; }
.matter .mt { max-width: 5.4in; font-size: 13pt; line-height: 1.55; }
.matter h2 { font-family: 'Fredoka', sans-serif; font-size: 22pt; margin: 0 0 0.2in; }
.matter .ital { font-style: italic; font-size: 16pt; }`;

export const MATTER_STARTERS: Record<keyof Matter, string> = {
  dedication: "For ____________, who makes every page worth making.",
  howTo: "Welcome! Work through this book at your own pace.\nFollow each page's instructions, and come back to any page whenever you need it.\nWhen a page asks you to color, trace or cut, there is no wrong way. Have fun.",
  about: "Written by ____________ at Bright Trails Publishing in the Philippines. Add two or three friendly sentences about yourself and why you make these books.",
  alsoBy: "List your other titles here, one per line, so readers can find the next book.",
  review: "If this book was useful to you or your family, a short, honest review on Amazon helps other readers find it. Thank you for reading.",
};
