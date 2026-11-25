import { getBook, type Book } from "./studio-store.ts";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function summarise(b: Book): string {
  const sections = b.sections
    .map((s) => `- ${s.title}: ${clip((s.summary || s.draft || "").replace(/\s+/g, " "), 160)}`)
    .join("\n");
  return [
    `### ${b.title}${b.subtitle ? `: ${b.subtitle}` : ""}${b.seriesName ? ` (series: ${b.seriesName})` : ""}`,
    b.audience ? `Audience: ${b.audience}` : "",
    b.styleBible ? `Style bible:\n${clip(b.styleBible, 2200)}` : "",
    b.notes ? `Notes: ${clip(b.notes.replace(/\s+/g, " "), 1200)}` : "",
    sections ? `Sections:\n${clip(sections, 2000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Text block describing the books this book is linked to, for use in prompts.
 * Returns "" when nothing is linked. Capped so prompts stay a sensible size.
 */
export async function seriesContext(book: Book): Promise<string> {
  const ids = (book.linkedBookIds ?? []).filter((id) => id && id !== book.id).slice(0, 6);
  if (!ids.length && !book.seriesName) return "";
  const linked = (await Promise.all(ids.map((id) => getBook(id)))).filter((b): b is Book => !!b);
  const head = book.seriesName ? `Series name: ${book.seriesName}\n` : "";
  if (!linked.length) return `\nSERIES CONTEXT\n${head}`;
  return `\nSERIES CONTEXT (earlier or related books in the same series. Keep characters, facts, voice and terms consistent with them. Do not copy their text.)\n${head}${clip(linked.map(summarise).join("\n\n"), 11000)}\n`;
}
