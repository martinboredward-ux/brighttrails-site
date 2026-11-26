import { GoogleGenAI } from "@google/genai";

// Model IDs the AI Gateway has announced, in the order we try them.
// GEMINI_MODEL (Netlify environment variable) is always tried first, so the model can be
// changed in the Netlify dashboard without a new deploy.
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-4-hydrogen", "gemini-3-flash-preview"];

// Remembered between calls while the function instance stays warm.
let working: string | null = null;

function candidates(): string[] {
  const out: string[] = [];
  for (const m of [working, process.env.GEMINI_MODEL?.trim(), ...DEFAULT_MODELS]) {
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

function isModelNotFound(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  if (e?.status === 404 || e?.code === 404) return true;
  return /NOT_FOUND|\b404\b|is not found|not supported for generateContent/i.test(e?.message ?? "");
}

export async function geminiGenerate(prompt: string, opts: { json?: boolean; temperature?: number; image?: { mimeType: string; data: string } } = {}): Promise<string> {
  const ai = new GoogleGenAI({});
  const config: Record<string, unknown> = {};
  if (opts.json) config.responseMimeType = "application/json";
  if (opts.temperature !== undefined) config.temperature = opts.temperature;

  const tried: string[] = [];
  let lastError: unknown;
  for (const model of candidates()) {
    try {
      const contents = opts.image ? [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } }] }] : prompt;
      const res = await ai.models.generateContent({ model, contents, config });
      working = model;
      return (res.text ?? "").trim();
    } catch (err) {
      if (!isModelNotFound(err)) throw err; // quota, auth, bad request: do not hide these
      tried.push(model);
      lastError = err;
      if (working === model) working = null;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`No Gemini model worked through AI Gateway (tried ${tried.join(", ")}). Set GEMINI_MODEL in Netlify environment variables to a model your gateway lists. Last error: ${detail}`);
}
