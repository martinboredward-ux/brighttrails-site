import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { generateImage, type ImageRequest } from "../lib/image-gen.ts";
import { getBook, imageStore, putBook, type GeneratedImage } from "../lib/studio-store.ts";

// Background function (15-minute limit): /.netlify/functions/studio-generate-image-background
export const config: Config = {};

interface Payload extends Omit<ImageRequest, "references"> {
  referenceImageIds?: string[];
  jobId: string;
  bookId: string;
  sectionId?: string;
}

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const p = (await req.json().catch(() => null)) as Payload | null;
  if (!p?.jobId || !p.bookId) return json({ error: "Bad request" }, 400);

  const store = imageStore();
  const jobKey = `job__${p.jobId}`;
  const base = { id: p.jobId, bookId: p.bookId, createdAt: new Date().toISOString() };
  await store.setJSON(jobKey, { ...base, status: "running" });

  try {
    // Section pictures get a short style-bible summary so characters keep the same look across engines.
    const bookNow = await getBook(p.bookId);
    const lib = new Map((bookNow?.characters ?? []).map((c) => [c.id, c]));
    const references = (p.referenceImageIds ?? []).map((id) => ({ id, name: lib.get(id)?.name, kind: lib.get(id)?.kind }));
    const result = await generateImage({ ...p, references, styleBible: p.sectionId || String(p.stylePreset).startsWith("library") ? bookNow?.styleBible : undefined });
    const imageId = `${p.bookId}__${crypto.randomUUID()}`;
    await store.set(imageId, result.bytes, { metadata: { contentType: result.contentType, bookId: p.bookId, bytes: result.bytes.byteLength } });

    const meta: GeneratedImage = {
      id: imageId,
      sectionId: p.sectionId,
      prompt: p.prompt,
      provider: p.provider,
      modelUsed: result.modelUsed,
      aspect: p.aspect,
      stylePreset: p.stylePreset,
      quality: p.quality,
      createdAt: new Date().toISOString(),
    };
    // Record the picture on the book right away so it is never lost if the browser is closed.
    const book = await getBook(p.bookId);
    if (book) {
      book.images = [...book.images, meta].slice(-200);
      book.updatedAt = new Date().toISOString();
      await putBook(book);
    }
    await store.setJSON(jobKey, { ...base, status: "done", imageId, image: meta, notes: result.notes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[studio-image] job ${p.jobId} failed (${p.provider}, ${p.stylePreset}, ${p.aspect}): ${msg}`);
    await store.setJSON(jobKey, { ...base, status: "error", error: msg });
  }
  return json({ ok: true });
};
