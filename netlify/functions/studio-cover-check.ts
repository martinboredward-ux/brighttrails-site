import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { geminiGenerate } from "../lib/gemini.ts";
import { parseJson } from "../lib/review-utils.ts";

export const config: Config = { path: "/api/studio/cover-check" };

interface Body {
  imageBase64?: string; // JPEG of the rendered front cover
  title?: string; subtitle?: string; author?: string;
  trim?: string; paper?: string; pageCount?: number; aiDisclosure?: string; audience?: string;
  layout?: Record<string, unknown>;
}

/** Cover Quality Check: Gemini looks at the rendered front cover and reports on spelling, contrast, face overlap and KDP basics. */
export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = (await req.json().catch(() => ({}))) as Body;
  const data = (b.imageBase64 ?? "").replace(/^data:image\/\w+;base64,/, "");
  if (!data || data.length > 6_000_000) return json({ error: "Send the cover as a JPEG under about 4 MB." }, 400);
  try {
    const text = await geminiGenerate(
      `You are a careful KDP cover reviewer. The attached picture is the FRONT cover as the author's Studio rendered it.
Intended text: Title "${b.title ?? ""}"; Subtitle "${b.subtitle ?? ""}"; Author "${b.author ?? ""}".
Trim ${b.trim ?? "?"}, paper ${b.paper ?? "?"}, ${b.pageCount ?? "?"} pages, audience ${b.audience || "n/a"}, AI disclosure setting: ${b.aiDisclosure ?? "none"}.
Layout settings used: ${JSON.stringify(b.layout ?? {})}.

Check, looking at the picture itself:
1. spelling: read the title, subtitle and author on the cover and compare letter by letter with the intended text;
2. readability and contrast of each line of text;
3. whether any text overlaps a character's face or the main subject;
4. KDP basics: text well inside the edges (about 0.25 in), nothing important near the trim, no barcode/ISBN or price printed on the art, no unreadable tiny text, and whether artwork looks AI-generated in a way that needs the AI disclosure answered "yes" in KDP.

Return ONLY JSON: {"ok": boolean, "summary": string, "checks": [{"name": string, "pass": boolean, "note": string}]}. Use exactly the four check names "Spelling", "Readability & contrast", "Text vs faces", "KDP trim & AI compliance". Be concrete: say what you see and what to change. "ok" is true only when all four pass.`,
      { json: true, image: { mimeType: "image/jpeg", data } },
    );
    return json(parseJson(text));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
