import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { geminiGenerate } from "../lib/gemini.ts";
import { parseJson } from "../lib/review-utils.ts";
import { IMAGE_ID_RE, getBook, imageStore } from "../lib/studio-store.ts";

export const config: Config = { path: "/api/studio/picture-check" };

const clean = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** "Picture matches the page?": Gemini looks at one section's picture and compares it with that section's text and worksheet. */
export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = (await req.json().catch(() => ({}))) as { bookId?: string; sectionId?: string; imageId?: string };
  const imageId = String(b.imageId ?? "");
  if (!IMAGE_ID_RE.test(imageId) || !imageId.startsWith(`${b.bookId}__`)) return json({ error: "Bad picture id" }, 400);
  try {
    const book = await getBook(String(b.bookId));
    const sec = book?.sections.find((s) => s.id === b.sectionId);
    if (!book || !sec) return json({ error: "Section not found" }, 404);
    const store = imageStore();
    const got = await store.getWithMetadata(imageId, { type: "arrayBuffer" });
    if (!got) return json({ error: "Picture not found" }, 404);
    if (got.data.byteLength > 6_000_000) return json({ error: "That picture is too large to check (over about 6 MB). Resize it first." }, 400);
    const data = Buffer.from(got.data).toString("base64");
    const mimeType = String((got.metadata as Record<string, unknown> | null)?.contentType ?? "image/png");
    const text = await geminiGenerate(
      `You are checking that a page's picture matches its text, for a children's activity book (${clean(book.audience, 80) || "kids"}).
SECTION TITLE: ${clean(sec.title, 120)}
SECTION SUMMARY: ${clean(sec.summary, 500)}
PAGE TEXT AND WORKSHEET:
${String(sec.draft ?? "").slice(0, 3500)}

Look at the attached picture. Find everything the text asks the child to count, find, spot, color, trace or press, and check the picture really shows it (exact counts matter: if the text says three cones, count the cones in the picture). Also report anything in the picture that contradicts the text, shows lettering or numbers that should not be there, or has a character that looks different from the book's cast.

Return ONLY JSON: {"ok": boolean, "summary": string, "checks": [{"what": string, "wanted": string, "seen": string, "pass": boolean}], "fix": string}. "fix" is one short sentence to add to the picture prompt to correct it, or "" when ok. "ok" is true only when every check passes. Maximum 8 checks.`,
      { json: true, label: "picture_check", image: { mimeType, data } },
    );
    return json(parseJson(text));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
