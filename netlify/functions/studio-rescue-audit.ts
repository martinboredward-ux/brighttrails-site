import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { geminiGenerate } from "../lib/gemini.ts";
import { rescuePrompt } from "../lib/rescue-prompt.ts";
import { getBook, putBook } from "../lib/studio-store.ts";

export const config: Config = { path: "/api/studio/rescue-audit" };

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as { bookId?: string };
    const book = body.bookId ? await getBook(body.bookId) : null;
    if (!book) return json({ error: "Book not found" }, 404);

    const text = (await geminiGenerate(rescuePrompt(book), { temperature: 0.6, label: "rescue_audit" })).replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
    if (!text) return json({ error: "The model returned nothing. Try again." }, 502);

    // Re-read so a save that happened while Gemini was working is not overwritten.
    const fresh = (await getBook(book.id)) ?? book;
    fresh.rescueAudit = text.slice(0, 20000);
    fresh.updatedAt = new Date().toISOString();
    await putBook(fresh);
    return json({ rescueAudit: fresh.rescueAudit });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
