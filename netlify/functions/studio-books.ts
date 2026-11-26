import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import {
  IMAGE_ID_RE,
  JOB_FIELDS,
  deleteBook,
  deleteBookImages,
  getBook,
  listBooks,
  newBook,
  putBook,
  seedIfEmpty,
  slugify,
  type Book,
} from "../lib/studio-store.ts";

export const config: Config = { path: ["/api/studio/books", "/api/studio/books/*"] };

// Fields the browser may change. Job fields are owned by the background function.
const EDITABLE: (keyof Book)[] = [
  "title", "subtitle", "mode", "audience", "seriesName", "linkedBookIds", "trim", "aiDisclosure", "notes",
  "styleBible", "sections", "review", "workbook", "kdp", "characterRefId", "characters", "rescueAudit",
  "research", "preReview", "reviewQuestion", "reviewDirection", "polishDirection", "previousNotesBackup",
  "previousStyleBibleBackup", "previousSectionsBackup", "nameplateLabel", "cover",
  "preReviewFixes", "preReviewSelected", "reviewFixes", "reviewSelected", "lastApplied", "approvedAt",
];

function idFromPath(req: Request): string | null {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  // api / studio / books / :id
  return parts.length >= 4 ? decodeURIComponent(parts[3]) : null;
}

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;

  const id = idFromPath(req);
  try {
    if (req.method === "GET") {
      if (!id) return json({ books: await seedIfEmpty() });
      const book = await getBook(id);
      return book ? json({ book }) : json({ error: "Not found" }, 404);
    }

    if (req.method === "POST" && !id) {
      const body = (await req.json().catch(() => ({}))) as Partial<Book>;
      const book = newBook({ ...body, id: undefined, slug: undefined });
      await putBook(book);
      return json({ book }, 201);
    }

    if (req.method === "PUT" && id) {
      const current = await getBook(id);
      if (!current) return json({ error: "Not found" }, 404);
      const body = (await req.json().catch(() => ({}))) as Partial<Book>;
      const next: Book = { ...current };
      for (const k of EDITABLE) {
        if (k in body) (next as unknown as Record<string, unknown>)[k] = (body as Record<string, unknown>)[k];
      }
      next.linkedBookIds = Array.isArray(next.linkedBookIds)
        ? [...new Set(next.linkedBookIds.map(String))].filter((x) => x !== id).slice(0, 12)
        : [];
      next.seriesName = String(next.seriesName ?? "").slice(0, 120);
      // Character Library: only pictures that belong to this book, with a short name each.
      next.characters = Array.isArray(next.characters)
        ? next.characters
            .map((c) => ({ id: String(c?.id ?? ""), name: String(c?.name ?? "").trim().slice(0, 40), kind: (["badge", "prop", "cover", "page"].includes(String(c?.kind)) ? c.kind : "character") as "character" | "badge" | "prop" | "cover" | "page" }))
            .filter((c) => IMAGE_ID_RE.test(c.id) && c.id.startsWith(`${id}__`))
            .map((c) => ({ ...c, name: c.name || "Character" }))
            .slice(0, 40)
        : [];
      next.characterRefId = "";
      // Never let a browser save overwrite job state.
      for (const k of JOB_FIELDS) (next as unknown as Record<string, unknown>)[k] = current[k];
      next.slug = slugify(next.title);
      next.updatedAt = new Date().toISOString();
      await putBook(next);
      return json({ book: next });
    }

    if (req.method === "DELETE" && id) {
      await deleteBook(id);
      await deleteBookImages(id);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
