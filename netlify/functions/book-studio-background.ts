import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { getBook, putBook, type Book, type Section } from "../lib/studio-store.ts";

// Background function (15-minute limit). Invoked at /.netlify/functions/book-studio-background.
// Netlify answers the HTTP call with 202 straight away; progress is written to the book's jobStatus.
export const config: Config = {};

const MODELS = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" } as const;
type Action = "generate_outline" | "draft_section" | "review_book" | "extract_workbook";

interface Payload {
  bookId: string;
  action: Action;
  sectionId?: string;
  model?: keyof typeof MODELS;
}

const MODE_GUIDE: Record<Book["mode"], string> = {
  activity:
    "An activity book (coloring, line tracing, dot markers, STEM counting). Each section is a themed set of pages. A page spec says what is drawn, the instruction line for the child, and difficulty. No stickers claims.",
  storybook:
    "A picture book. Sections are spreads. A spread spec gives the story text (short, read-aloud rhythm), what the illustration shows, the camera/composition, and any interactive prompt for the reader.",
  nonfiction:
    "A nonfiction guide. Sections are chapters. A chapter spec gives the chapter promise, key points, one real-world scenario, and an end-of-chapter takeaway.",
};

function bookContext(b: Book): string {
  return `BOOK
Title: ${b.title}
Subtitle: ${b.subtitle || "(none)"}
Mode: ${b.mode}. ${MODE_GUIDE[b.mode]}
Audience: ${b.audience || "(not set)"}
Trim size: ${b.trim}
AI disclosure setting: ${b.aiDisclosure}
Notes: ${b.notes || "(none)"}`;
}

async function gemini(prompt: string, json = false): Promise<string> {
  const ai = new GoogleGenAI({});
  const res = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: json ? { responseMimeType: "application/json" } : undefined,
  });
  return (res.text ?? "").trim();
}

async function claude(prompt: string, which: keyof typeof MODELS): Promise<string> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODELS[which] ?? MODELS.haiku,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
}

async function setJob(id: string, patch: Partial<Book>): Promise<Book | null> {
  const fresh = await getBook(id);
  if (!fresh) return null;
  const next = { ...fresh, ...patch, jobUpdatedAt: new Date().toISOString() } as Book;
  await putBook(next);
  return next;
}

async function run(p: Payload): Promise<Partial<Book>> {
  const book = await getBook(p.bookId);
  if (!book) throw new Error("Book not found");
  const which = p.model === "sonnet" ? "sonnet" : "haiku";

  switch (p.action) {
    case "generate_outline": {
      const text = await gemini(
        `${bookContext(book)}

Create the working plan for this book. Return ONLY JSON: {"styleBible": string, "sections": [{"title": string, "summary": string}]}.
- styleBible: 200-400 words covering voice, reading level, visual style, recurring characters or motifs, layout rules for the trim size, and things to avoid. It will be given to the writer for every section, so make it specific.
- sections: 8 to 16 sections that fit the mode. Each summary is 1-3 sentences.`,
        true,
      );
      const data = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as {
        styleBible?: string;
        sections?: { title?: string; summary?: string }[];
      };
      const sections: Section[] = (data.sections ?? []).map((s, i) => ({
        id: `s${Date.now().toString(36)}${i}`,
        title: String(s.title ?? `Section ${i + 1}`),
        summary: String(s.summary ?? ""),
        draft: "",
      }));
      return { styleBible: String(data.styleBible ?? ""), sections };
    }

    case "draft_section": {
      const idx = book.sections.findIndex((s) => s.id === p.sectionId);
      if (idx < 0) throw new Error("Section not found");
      const section = book.sections[idx];
      const prev = book.sections
        .slice(Math.max(0, idx - 2), idx)
        .map((s) => `## ${s.title}\n${s.draft || s.summary}`)
        .join("\n\n");
      const text = await claude(
        `${bookContext(book)}

STYLE BIBLE
${book.styleBible || "(none yet)"}

PREVIOUS SECTIONS
${prev || "(this is the first section)"}

WRITE THIS SECTION
Title: ${section.title}
Summary: ${section.summary}

Write the full spec for this section as clean Markdown, following the mode guidance above. Keep to the style bible. Do not mention these instructions.`,
        which,
      );
      const sections = book.sections.map((s, i) => (i === idx ? { ...s, draft: text } : s));
      return { sections };
    }

    case "review_book": {
      const manuscript = book.sections.map((s) => `## ${s.title}\n${s.draft || s.summary}`).join("\n\n");
      const text = await gemini(
        `${bookContext(book)}

STYLE BIBLE
${book.styleBible || "(none)"}

MANUSCRIPT
${manuscript || "(no sections yet)"}

Give a developmental review as Markdown: 1) what works, 2) structure and pacing problems, 3) continuity or consistency issues, 4) audience fit and reading level, 5) a prioritized fix list of at most 10 items. Be specific and refer to sections by title.`,
      );
      return { review: text };
    }

    case "extract_workbook": {
      const manuscript = book.sections.map((s) => `## ${s.title}\n${s.draft || s.summary}`).join("\n\n");
      const text = await claude(
        `${bookContext(book)}

SOURCE MANUSCRIPT
${manuscript || book.notes || "(no sections yet)"}

Build the companion workbook content as Markdown. For each chapter or section: 3 key takeaways, 2 scenario prompts ("It's 4:50 pm and ..."), a short self-check, and a one-page checklist. Finish with a one-page quick-reference. Use only ideas that appear in the source.`,
        which,
      );
      return { workbook: text };
    }
  }
}

export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  await setJob(payload.bookId, { jobStatus: "running", jobAction: payload.action, jobError: "" });
  try {
    const result = await run(payload);
    await setJob(payload.bookId, { ...result, jobStatus: "done", jobError: "" });
  } catch (err) {
    await setJob(payload.bookId, {
      jobStatus: "error",
      jobError: err instanceof Error ? err.message : String(err),
    });
  }
  return json({ ok: true });
};
