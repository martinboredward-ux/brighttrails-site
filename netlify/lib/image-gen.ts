import OpenAI, { toFile } from "openai";
import { GoogleGenAI } from "@google/genai";
import { IMAGE_ID_RE, imageStore, type ImageAspect, type ImageProvider, type StylePreset } from "./studio-store.ts";

export interface ImageRequest {
  provider: ImageProvider;
  quality: "low" | "medium";
  aspect: ImageAspect;
  stylePreset: StylePreset;
  prompt: string;
  /** Character Library pictures. Used by every engine. */
  references?: { id: string; name?: string; kind?: "character" | "badge" | "prop" | "cover" | "page" }[];
  /** Book style bible. Only sent for section pictures, so characters stay the same animal. */
  styleBible?: string;
}

export interface ImageResult {
  bytes: Uint8Array;
  contentType: string;
  modelUsed: string;
  notes: string[];
}

export const COLORING_WRAPPER =
  "Children's coloring book page ONLY: pure white background, hollow uncolored shapes ONLY, uniform 2-3pt clean black outlines ready for crayons. STRICTLY FORBIDDEN: solid black backgrounds, black night skies, heavy black ink fills, gray shading, stippling, crosshatching, numbered dot-to-dots, mazes, charts, or text.";
export const COLORING_GUARDRAIL = "One single full-page scene with generous margins.";

const WRAPPERS: Record<StylePreset, (p: string) => string> = {
  library_bw: (p) => `Black-and-white children's book art on a PURE WHITE background: clean uniform black outlines, hollow shapes ready for coloring, no gray shading, no stippling, no solid black fills, no lettering or numbers. Subject: ${p}`,
  library_color: (p) => `Warm, friendly children's picture-book art on a plain white background: flat storybook colors, clean outlines, no lettering or numbers. Subject: ${p}`,
  coloring: (p) => `${COLORING_WRAPPER} ${COLORING_GUARDRAIL} Subject: ${p}`,
  storybook: (p) => `Warm, friendly children's picture book illustration, soft colors, clear simple shapes, no text or lettering. Scene: ${p}`,
  cover: (p) => `Bright, appealing children's book COVER artwork, no lettering of any kind. COMPOSITION CRITICAL: Place the character and kite (or other main subject) smaller in the LOWER 60% of the frame (below the horizontal midline). The entire TOP 35-40% MUST be completely empty open sky and soft clouds ONLY: no character head, hair, hands, kite tips or objects in the top 35%. Keep faces clear and fully visible, keep the bottom 12% a simple calm ground area, and make the scene still work if the edges are trimmed. Subject: ${p}`,
  planner: (p) => `Modern full-color editorial illustration for an adult planner: refined palette, crisp elegant contours, generous negative space and margins, polished professional look. NOT a kids or cartoon style, no coloring-book outlines, no text or lettering. Subject: ${p}`,
  cutout: (p) => `Full-color cut-out clip-art sheet on a PURE WHITE background: several separate icons or badges with clean outlines, generous empty space between every item, nothing touching the page edge, one consistent refined palette, no text or lettering. Subject: ${p}`,
  aplus: (p) => `Clean marketing illustration for an online book listing, uncluttered, friendly, no text or lettering. Subject: ${p}`,
};


const PROSE_RULE = /\b(voice|reading level|lap-?read|read-?aloud|sentence fragments?|onomatop\w*|worksheets?|word bank|answer key|spelling|vocabulary|phonics|rhythm|narrat\w*|dialogue|story text|tone of|prose|writing|word count|paragraphs?|humou?r|(?<!skin )tone(?!s)|emotional beats?|affirmations?)\b/i;

/** Keeps only the visual lines of a Style Bible (looks, colors, characters, setting). Writing rules are dropped. */
export function visualBible(bible: string | undefined): string {
  const keep: string[] = [];
  let skipping = false;
  for (const raw of (bible ?? "").split("\n")) {
    const line = raw.replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const isHeading = /^#{1,6}\s/.test(raw.trim()) || /^\*\*[^*]+\*\*:?\s*$/.test(raw.trim()) || /^[A-Z][A-Za-z &/-]{2,40}:$/.test(line);
    if (isHeading) { skipping = PROSE_RULE.test(line); continue; }
    if (skipping) continue;
    const kept = line.split(/(?<=[.!?])\s+/).filter((x) => !PROSE_RULE.test(x));
    if (kept.length) keep.push(kept.join(" "));
  }
  return keep.join(" ");
}

const AVOID_LINE = /^(avoid|never|do not|don't|no |not )/i;

export function bibleSummary(bible: string | undefined, cap = 1200): string {
  const flat = visualBible(bible) || (bible ?? "").replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  // The Avoid / Never lines are always kept: they are what stops wrong styles, so they must not be cut off the end.
  const sentences = flat.split(/(?<=[.!?])\s+/);
  const avoid = sentences.filter((x) => AVOID_LINE.test(x.trim())).join(" ").slice(0, 320);
  const rest = sentences.filter((x) => !AVOID_LINE.test(x.trim())).join(" ");
  const room = Math.max(250, cap - avoid.length - 1);
  let cut = rest;
  if (rest.length > room) {
    const head = rest.slice(0, room);
    const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
    cut = end > 200 ? head.slice(0, end + 1) : head.replace(/\s+\S*$/, "");
  }
  return `Book style and characters (follow exactly, never change a character's species or look): ${cut}${avoid ? ` ${avoid}` : ""}\n\n`;
}

export function wrapPrompt(preset: StylePreset, prompt: string, styleBible?: string): string {
  return bibleSummary(styleBible) + (WRAPPERS[preset] ?? WRAPPERS.storybook)(prompt.trim());
}

// Models tried in order. An environment variable is always tried first, so a model can be
// changed in Netlify without a deploy. Only "model not found" moves on to the next one.
const OPENAI_MODELS: Record<"openai-mini" | "openai-1.5", string[]> = {
  "openai-mini": ["gpt-image-2.5-flare", "gpt-image-1-mini", "gpt-image-1"],
  "openai-1.5": ["gpt-image-1.5", "gpt-image-2", "gpt-image-1"],
};
const GEMINI_IMAGE_MODELS = ["gemini-nano-banana-2.1", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"];

function isModelNotFound(err: unknown): boolean {
  const e = err as { status?: number; code?: number | string; message?: string };
  if (e?.status === 404 || e?.code === 404 || e?.code === "model_not_found") return true;
  return /model_not_found|NOT_FOUND|\b404\b|does not exist|is not found|not supported/i.test(e?.message ?? "");
}

function order(env: string | undefined, list: string[]): string[] {
  const out: string[] = [];
  for (const m of [env?.trim(), ...list]) if (m && !out.includes(m)) out.push(m);
  return out;
}

const SIZES: Record<ImageAspect, "1024x1536" | "1536x1024" | "1024x1024"> = {
  portrait: "1024x1536",
  landscape: "1536x1024",
  square: "1024x1024",
};
const RATIOS: Record<ImageAspect, string> = { portrait: "3:4", landscape: "4:3", square: "1:1" };

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}


interface LoadedRef { name: string; kind: "character" | "badge" | "prop" | "cover" | "page"; type: string; bytes: Buffer }

/** Reads the character pictures from the image store. Missing ones are skipped with a note. */
async function loadRefs(req: ImageRequest, notes: string[]): Promise<LoadedRef[]> {
  const out: LoadedRef[] = [];
  for (const r of (req.references ?? []).slice(0, 6)) {
    if (!IMAGE_ID_RE.test(r.id)) throw new Error("Bad reference image id");
    const hit = await imageStore().getWithMetadata(r.id, { type: "arrayBuffer" });
    if (!hit) { notes.push(`A saved character picture${r.name ? ` (${r.name})` : ""} could not be found, so it was not used.`); continue; }
    const type = String((hit.metadata as { contentType?: string } | null)?.contentType ?? "image/png");
    out.push({ name: r.name?.trim() || `Reference ${out.length + 1}`, kind: r.kind ?? "character", type, bytes: Buffer.from(hit.data as ArrayBuffer) });
  }
  return out;
}

/** Text that tells the engine what the attached pictures are. */
function refInstruction(refs: LoadedRef[]): string {
  const list = refs.map((r, i) => `picture ${i + 1} is ${({ character: "the character ", badge: "the badge ", prop: "the prop ", cover: "the cover style ", page: "the page design " })[r.kind]}${r.name}`).join("; ");
  const chars = refs.some((r) => r.kind === "character")
    ? "Draw each named character exactly as in its reference: same face, hair, skin tone, outfit and proportions. Do not add characters that are not named in the scene. "
    : "";
  const items = refs.some((r) => r.kind !== "character")
    ? "Reproduce each badge, prop, cover or page design with the same shape, symbols, layout, borders and style as its reference, so the whole book looks like one family. "
    : "";
  return `Reference pictures are attached (${list}). ${chars}${items}Do not copy a reference's pose or background unless the scene asks for it. If the style asks for black-and-white line art, redraw the references as clean outline art without changing their design. New picture: `;
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function viaOpenAI(req: ImageRequest, prompt: string): Promise<ImageResult> {
  const provider = req.provider as "openai-mini" | "openai-1.5";
  const client = new OpenAI();
  const notes: string[] = [];
  const refs = await loadRefs(req, notes);
  const models = order(process.env.OPENAI_IMAGE_MODEL, OPENAI_MODELS[provider]);
  const tried: string[] = [];
  let last: unknown;
  for (const model of models) {
    try {
      // Do not pass response_format: GPT image models always return base64 in data[0].b64_json.
      let res;
      if (refs.length) {
        // With character pictures, the image edit endpoint draws the new scene from the references.
        const image = await Promise.all(refs.map((r, i) => toFile(r.bytes, `character-${i + 1}.${EXT[r.type] ?? "png"}`, { type: r.type })));
        res = await client.images.edit({ model, image, prompt: refInstruction(refs) + prompt, size: SIZES[req.aspect], quality: req.quality });
      } else {
        res = await client.images.generate({ model, prompt, size: SIZES[req.aspect], quality: req.quality });
      }
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("The image model returned no picture.");
      if (tried.length) notes.push(`${tried.join(", ")} not available; used ${model}.`);
      return { bytes: b64ToBytes(b64), contentType: "image/png", modelUsed: model, notes };
    } catch (err) {
      if (!isModelNotFound(err)) throw err;
      tried.push(model);
      last = err;
    }
  }
  throw new Error(`No ChatGPT image model worked through AI Gateway (tried ${tried.join(", ")}). Set OPENAI_IMAGE_MODEL in Netlify environment variables. Last error: ${last instanceof Error ? last.message : String(last)}`);
}

async function viaNanoBanana(req: ImageRequest, prompt: string): Promise<ImageResult> {
  const ai = new GoogleGenAI({});
  const notes: string[] = [];
  const parts: Record<string, unknown>[] = [];
  const refs = await loadRefs(req, notes);
  for (const r of refs) {
    parts.push({ text: `${r.name}:` });
    parts.push({ inlineData: { mimeType: r.type, data: r.bytes.toString("base64") } });
  }
  if (refs.length) parts.push({ text: refInstruction(refs) });
  parts.push({ text: prompt });

  const models = order(process.env.GEMINI_IMAGE_MODEL, GEMINI_IMAGE_MODELS);
  const tried: string[] = [];
  let last: unknown;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: { imageConfig: { aspectRatio: RATIOS[req.aspect] } },
      });
      const out = res.candidates?.[0]?.content?.parts ?? [];
      const img = out.find((p) => p.inlineData?.data);
      if (!img?.inlineData?.data) {
        const said = out.map((p) => p.text).filter(Boolean).join(" ").slice(0, 200);
        throw new Error(`Nano Banana returned no picture.${said ? ` It said: ${said}` : ""}`);
      }
      if (tried.length) notes.push(`${tried.join(", ")} not available; used ${model}.`);
      return { bytes: b64ToBytes(img.inlineData.data), contentType: img.inlineData.mimeType || "image/png", modelUsed: model, notes };
    } catch (err) {
      if (!isModelNotFound(err)) throw err;
      tried.push(model);
      last = err;
    }
  }
  throw new Error(`No Nano Banana model worked through AI Gateway (tried ${tried.join(", ")}). Set GEMINI_IMAGE_MODEL in Netlify environment variables. Last error: ${last instanceof Error ? last.message : String(last)}`);
}

export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  const prompt = wrapPrompt(req.stylePreset, req.prompt, req.styleBible);
  return req.provider === "nano-banana" ? viaNanoBanana(req, prompt) : viaOpenAI(req, prompt);
}
