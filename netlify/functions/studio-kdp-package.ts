import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { geminiGenerate } from "../lib/gemini.ts";
import { scanBanned } from "../lib/banned-words.ts";
import { getBook, putBook, type APlusModule, type KdpPackage } from "../lib/studio-store.ts";
import { seriesContext } from "../lib/series-context.ts";

export const config: Config = { path: "/api/studio/generate-kdp-package" };

const ALLOWED_TAGS = new Set(["b", "i", "br", "p", "ul", "li", "h4"]);
const SIZES: APlusModule["size"][] = ["970x600", "970x300", "300x300"];

/** Keep only KDP-safe tags, and strip every attribute. */
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (m, tag: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      return m.startsWith("</") ? `</${t}>` : t === "br" ? "<br>" : `<${t}>`;
    })
    .trim();
}

function cleanKeywords(list: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const k = String(raw).replace(/\s+/g, " ").trim().slice(0, 50).trim();
    const lower = k.toLowerCase();
    if (!k || seen.has(lower)) continue;
    seen.add(lower);
    out.push(k);
  }
  while (out.length < 7) out.push("");
  return out.slice(0, 7);
}

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as { bookId?: string };
    const book = body.bookId ? await getBook(body.bookId) : null;
    if (!book) return json({ error: "Book not found" }, 404);

    const series = await seriesContext(book);
    const prompt = `You prepare Amazon KDP listings for Bright Trails Publishing, a small kids/adult activity and story book imprint.

BOOK
Title: ${book.title}
Subtitle: ${book.subtitle || "(none yet)"}
Mode: ${book.mode} (activity = coloring/tracing/activity books, storybook = picture books, nonfiction = guides and workbooks)
Audience: ${book.audience || "(not set)"}
Trim size: ${book.trim}
Notes: ${book.notes || "(none)"}${book.research ? `\nMarket positioning (from research): ${book.research.slice(0, 2500)}` : ""}
Style bible / outline summary: ${(book.styleBible || "").slice(0, 3000)}
Sections: ${book.sections.map((s) => s.title).join("; ").slice(0, 1500) || "(none yet)"}
${series}
${series ? "If related books are listed above, the 300x300 or 970x300 A+ module may mention the series or name a sibling title as a quiet cross-sell, in plain words and with none of the banned words below.\n" : ""}
Return ONLY a JSON object with exactly these keys:
- "titleIdeas": array of exactly 3 title or title+subtitle ideas (strings). Do not use sticker claims, "#1", "best seller" or "free".
- "htmlDescription": the Amazon book description as HTML using ONLY these tags: <b>, <i>, <br>, <p>, <ul>, <li>, <h4>. No attributes, no other tags. 150-250 words, honest about contents, no price or promotion claims.
- "keywords": array of exactly 7 strings for KDP's seven keyword boxes. Each 50 characters or fewer. No duplicate keywords. Do not repeat words that are already in the title or subtitle. Do not use other brand names.
- "categories": array of exactly 3 Amazon category paths (strings, e.g. "Books > Children's Books > Activities, Crafts & Games > Coloring Books").
- "isLowContent": boolean. Coloring books, line-tracing books, activity books, storybooks and workbooks are NOT low-content: answer false for them. Answer true only for blank journals, notebooks, planners, logbooks with no authored content.
- "aPlusModules": array of exactly 3 objects, in this order, each {"size","headline","body"}: sizes "970x600", "970x300", "300x300". Headline 60 characters or fewer, body 200 characters or fewer. Never use any of these words or phrases: free, bonus, affordable, cheap, discount, sale, buy now, order now, add to cart, best seller, #1, guarantee, new, latest, review, 5 star.`;

    const text = (await geminiGenerate(prompt, { json: true, temperature: 0.7, label: "kdp_package" })).replace(/^```(?:json)?|```$/g, "").trim();
    const raw = JSON.parse(text) as Partial<KdpPackage>;

    const warnings: string[] = [];
    const modules: APlusModule[] = SIZES.map((size, i) => {
      const m = (raw.aPlusModules ?? [])[i] ?? ({} as Partial<APlusModule>);
      const headline = String(m.headline ?? "").slice(0, 60);
      const bodyText = String(m.body ?? "").slice(0, 200);
      const hits = scanBanned(`${headline} ${bodyText}`);
      if (hits.length) warnings.push(`A+ ${size}: contains banned word(s): ${hits.join(", ")}. Edit before use.`);
      const old = book.kdp?.aPlusModules?.find((x) => x.size === size);
      return { size, headline, body: bodyText, ...(old?.imageId ? { imageId: old.imageId } : {}), ...(old?.fit ? { fit: old.fit } : {}), ...(old?.textBar !== undefined ? { textBar: old.textBar } : {}) };
    });

    const pkg: KdpPackage = {
      titleIdeas: (raw.titleIdeas ?? []).map(String).slice(0, 3),
      htmlDescription: cleanHtml(String(raw.htmlDescription ?? "")),
      keywords: cleanKeywords(raw.keywords),
      categories: (raw.categories ?? []).map(String).slice(0, 3),
      // Coloring, tracing, activity books, storybooks and workbooks are never low-content.
      isLowContent: false,
      aPlusModules: modules,
      warnings,
    };

    const fresh = (await getBook(book.id)) ?? book;
    fresh.kdp = pkg;
    fresh.updatedAt = new Date().toISOString();
    await putBook(fresh);
    return json({ kdp: pkg });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
