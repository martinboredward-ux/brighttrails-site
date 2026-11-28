import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { IMAGE_ID_RE, getBook, imageStore } from "../lib/studio-store.ts";
import { imageCap, logUsage } from "../lib/studio-settings.ts";

// POST validates the request and starts a background job (pictures can take a minute or more,
// longer than a normal function may run). GET ?jobId= reports progress.
export const config: Config = { path: "/api/studio/generate-image" };

const PROVIDERS = ["openai-mini", "openai-1.5", "nano-banana"];
const QUALITIES = ["low", "medium"];
const ASPECTS = ["portrait", "square", "landscape"];
const PRESETS = ["coloring", "storybook", "cover", "aplus", "library_bw", "library_color"];
const MAX_REFS = 6;
const JOB_ID_RE = /^[0-9a-f-]{36}$/;

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  const store = imageStore();

  try {
    if (req.method === "GET") {
      const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
      if (!JOB_ID_RE.test(jobId)) return json({ error: "Bad job id" }, 400);
      const job = await store.get(`job__${jobId}`, { type: "json" });
      return job ? json({ job }) : json({ error: "Not found" }, 404);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bookId = String(body.bookId ?? "");
    const book = await getBook(bookId);
    if (!book) return json({ error: "Book not found" }, 404);
    const provider = String(body.provider ?? "");
    const quality = String(body.quality ?? "low");
    const aspect = String(body.aspect ?? "square");
    const stylePreset = String(body.stylePreset ?? "storybook");
    const prompt = String(body.prompt ?? "").trim();
    if (!PROVIDERS.includes(provider)) return json({ error: "Unknown image engine" }, 400);
    if (!QUALITIES.includes(quality)) return json({ error: "Quality must be low or medium" }, 400);
    if (!ASPECTS.includes(aspect)) return json({ error: "Unknown aspect" }, 400);
    if (!PRESETS.includes(stylePreset)) return json({ error: "Unknown style preset" }, 400);
    if (!prompt) return json({ error: "Write a prompt first" }, 400);
    if (prompt.length > 3000) return json({ error: "Prompt is too long (3000 characters max)" }, 400);
    // Character Library pictures (several allowed). The old single referenceImageId still works.
    const rawRefs = Array.isArray(body.referenceImageIds) ? body.referenceImageIds : [];
    if (body.referenceImageId) rawRefs.push(body.referenceImageId);
    const referenceImageIds = [...new Set(rawRefs.map(String))].slice(0, MAX_REFS);
    for (const r of referenceImageIds) {
      if (!IMAGE_ID_RE.test(r) || !r.startsWith(`${bookId}__`)) return json({ error: "Reference images must belong to this book" }, 400);
    }
    const sectionId = body.sectionId ? String(body.sectionId).slice(0, 60) : undefined;

    const cap = await imageCap();
    if (!cap.ok) return json({ error: `Daily picture limit reached (${cap.used} of ${cap.cap} today). Make the picture in ChatGPT or Nano Banana and upload it, or raise the limit in Studio settings.` }, 429);
    await logUsage(`image:${provider}:${stylePreset}`, { image: true });

    const jobId = crypto.randomUUID();
    const job = { id: jobId, bookId, status: "queued", createdAt: new Date().toISOString() };
    await store.setJSON(`job__${jobId}`, job);

    const payload = { jobId, bookId, provider, quality, aspect, stylePreset, prompt, referenceImageIds, sectionId };
    const start = await fetch(new URL("/.netlify/functions/studio-generate-image-background", req.url), {
      method: "POST",
      headers: { "content-type": "application/json", "x-studio-password": req.headers.get("x-studio-password") ?? "" },
      body: JSON.stringify(payload),
    });
    if (!start.ok && start.status !== 202) {
      await store.setJSON(`job__${jobId}`, { ...job, status: "error", error: `Could not start the image job (${start.status})` });
      return json({ error: `Could not start the image job (${start.status})` }, 502);
    }
    return json({ jobId }, 202);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
