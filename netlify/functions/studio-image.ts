import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { IMAGE_ID_RE, getBook, imageStore, putBook } from "../lib/studio-store.ts";

export const config: Config = { path: "/api/studio/image" };

const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 1_500_000; // pictures are shrunk to well under 400 KB in the browser; this is a safety cap

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const store = imageStore();
  try {
    if (req.method === "GET") {
      const id = url.searchParams.get("id") ?? "";
      if (!IMAGE_ID_RE.test(id)) return json({ error: "Bad image id" }, 400);
      const hit = await store.getWithMetadata(id, { type: "arrayBuffer" });
      if (!hit) return json({ error: "Not found" }, 404);
      const type = String((hit.metadata as { contentType?: string } | null)?.contentType ?? "image/png");
      return new Response(hit.data, { headers: { "content-type": type, "cache-control": "private, max-age=86400" } });
    }

    if (req.method === "POST") {
      const bookId = url.searchParams.get("bookId") ?? "";
      if (!(await getBook(bookId))) return json({ error: "Book not found" }, 404);
      const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!TYPES.has(type)) return json({ error: "Only PNG, JPEG or WebP images" }, 415);
      const bytes = await req.arrayBuffer();
      if (bytes.byteLength === 0) return json({ error: "Empty upload" }, 400);
      if (bytes.byteLength > MAX_BYTES) return json({ error: "Image is too large. The Studio shrinks images in your browser first; try a smaller one." }, 413);
      const id = `${bookId}__${crypto.randomUUID()}`;
      await store.set(id, bytes, { metadata: { contentType: type, bookId, bytes: bytes.byteLength } });
      return json({ id }, 201);
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id") ?? "";
      if (!IMAGE_ID_RE.test(id)) return json({ error: "Bad image id" }, 400);
      await store.delete(id);
      // Drop it from the book's list of generated pictures too.
      const book = await getBook(id.split("__")[0]);
      if (book) {
        const before = book.images.length;
        book.images = book.images.filter((i) => i.id !== id);
        const hadChars = book.characters.length;
        book.characters = book.characters.filter((c) => c.id !== id);
        if (book.characterRefId === id) book.characterRefId = "";
        if (book.images.length !== before || book.characters.length !== hadChars) {
          book.updatedAt = new Date().toISOString();
          await putBook(book);
        }
      }
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
