import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { parseJson } from "../lib/review-utils.ts";

export const config: Config = { path: "/api/studio/cover-ideas" };

interface Body {
  title?: string; subtitle?: string; audience?: string; mode?: string; styleBible?: string;
  seriesPill?: string; trim?: string; characters?: string[];
  sections?: { title?: string; summary?: string }[];
  model?: "haiku" | "sonnet";
  /** JPEG base64 of up to 3 of the author's best finished covers, so new covers match their look. */
  refs?: string[];
}

const MODELS = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" } as const;
const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Cover Ideas: one small text call (no image model) that returns three cover concepts and layout settings. */
export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!clip(b.title, 200)) return json({ error: "Add a title first." }, 400);
  const secs = (b.sections ?? []).slice(0, 14).map((s) => `- ${clip(s.title, 80)}: ${clip(s.summary, 140)}`).join("\n");
  const refs = (b.refs ?? []).map((r) => String(r).replace(/^data:image\/\w+;base64,/, "")).filter((r) => r && r.length < 2_000_000).slice(0, 3);
  const matchRule = refs.length
    ? `\nThe ${refs.length} attached picture(s) are the author's BEST finished covers. Study their look (palette, outline style, how large the characters are, composition, how much sky is left for the title, mood). Every concept must feel like it belongs to the same family. Also return "lookNotes": 3-4 plain sentences describing that shared look so it can be pasted into an image prompt (no mention of text or titles).`
    : "";
  const prompt = `You are a children's-book cover art director for Amazon KDP. The author is weakest at covers, so be concrete and decisive.

Book: "${clip(b.title, 200)}"${b.subtitle ? ` | Subtitle: "${clip(b.subtitle, 200)}"` : ""}
Audience: ${clip(b.audience, 120) || "children"} | Type: ${clip(b.mode, 30)} | Series line: ${clip(b.seriesPill, 120) || "none"} | Trim: ${clip(b.trim, 20)}
Named characters: ${(b.characters ?? []).map((c) => clip(c, 40)).filter(Boolean).join(", ") || "none"}
Visual style notes: ${clip(b.styleBible, 900) || "none"}
Contents:
${secs || "(none)"}

Give THREE clearly different cover concepts that would stand out as a small thumbnail on Amazon (a 1-inch-tall thumbnail must still read). Rules for every concept:
- The picture has NO lettering; the title, subtitle and author are added by software.
- The top 35% of the frame is open sky or plain space for the title; the main subject sits in the lower 60%; faces fully visible; the bottom band calm.
- One clear hero subject, bright colors, simple shapes, strong contrast. No crowded scenes.
- Use only characters and animals that belong in this book.

Return ONLY JSON: {"lookNotes":string (empty string when no pictures are attached),"concepts":[{"name":string,"why":string,"scene":string,"layout":{"titlePlacement":"top"|"bottom"|"split","topSky":"off"|"20"|"30","scrim":"none"|"softDark"|"softLight"|"pill","textColor":"#RRGGBB","textEffect":"none"|"shadow"|"outline"}}],"tips":[string]}.
"name" is 2-4 words. "why" is one sentence on why it sells. "scene" is 2-3 sentences describing only the picture (subject, pose, setting, colors, mood), with no mention of text. "tips" is 3 short, book-specific cover tips.${matchRule}`;
  try {
    const which = b.model === "sonnet" ? "sonnet" : "haiku";
    const msg = await new Anthropic().messages.create({ model: MODELS[which], max_tokens: 2200, messages: [{ role: "user", content: [...refs.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })), { type: "text" as const, text: prompt }] }] });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    const raw = parseJson<{ lookNotes?: string; concepts?: Record<string, unknown>[]; tips?: unknown[] }>(text);
    const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
    const concepts = (raw.concepts ?? []).slice(0, 3).map((c) => {
      const l = (c.layout ?? {}) as Record<string, unknown>;
      return {
        name: clip(c.name, 60), why: clip(c.why, 240), scene: clip(c.scene, 600),
        layout: {
          titlePlacement: pick(l.titlePlacement, ["top", "bottom", "split"] as const, "top"),
          topSky: pick(l.topSky, ["off", "20", "30"] as const, "off"),
          scrim: pick(l.scrim, ["none", "softDark", "softLight", "pill"] as const, "softLight"),
          textColor: /^#[0-9a-f]{6}$/i.test(String(l.textColor)) ? String(l.textColor) : "#ffffff",
          textEffect: pick(l.textEffect, ["none", "shadow", "outline"] as const, "shadow"),
        },
      };
    }).filter((c) => c.scene);
    if (!concepts.length) return json({ error: "The AI sent no usable ideas. Try again." }, 502);
    return json({ concepts, lookNotes: clip(raw.lookNotes, 700), tips: (raw.tips ?? []).slice(0, 4).map((t) => clip(t, 200)).filter(Boolean), model: which, at: new Date().toISOString() });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
