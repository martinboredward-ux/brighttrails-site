import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { geminiGenerate } from "../lib/gemini.ts";
import { getBook, putBook, type Book, type Section } from "../lib/studio-store.ts";
import { seriesContext } from "../lib/series-context.ts";

// Background function (15-minute limit). Invoked at /.netlify/functions/book-studio-background.
// Netlify answers the HTTP call with 202 straight away; progress is written to the book's jobStatus.
export const config: Config = {};

const MODELS = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" } as const;
type Action = "generate_outline" | "draft_section" | "draft_all" | "review_book" | "extract_workbook" | "market_research" | "pre_review" | "apply_review" | "apply_polish";

interface Payload {
  bookId: string;
  action: Action;
  sectionId?: string;
  model?: keyof typeof MODELS;
  /** draft_all only: false redrafts every section, otherwise only empty ones. */
  onlyEmpty?: boolean;
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

const gemini = (prompt: string, json = false) => geminiGenerate(prompt, { json });

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


/** Activity and storybook sections use tagged blocks that the printable-book exporter reads. */
const TAGGED_MODES = new Set<Book["mode"]>(["activity", "storybook"]);

const TAG_FORMAT = `Return ONLY the tagged blocks below, in this order. Each tag goes on its own line, followed by its content. Do not add closing tags, headings, preambles or notes.

[STORY_TEXT]
The read-aloud story for this section, 70-140 words, short sentences, warm and clear, matching the audience reading level.
[WHILE_YOU_LISTEN]
3 short listening prompts for the child, one per line, each starting with "- ".
[GUIDE_TIME]
Time needed, for example "15 minutes".
[GUIDE_SKILL]
The one skill this section builds, in one short line.
[GUIDE_MATERIALS]
Materials, comma-separated (for example "crayons, pencil").
[GUIDE_SAY]
2-3 lines a parent or teacher can say aloud, one per line.
[GUIDE_DO]
2-3 short steps for the adult, one per line.
[GUIDE_CHECK]
What to look for or ask to check understanding, one to three lines.
[GUIDE_TIP]
One practical tip, one or two sentences.
[WORKSHEET_INSTRUCTIONS]
One sentence telling the child what to do.
[WORKSHEET_BODY]
4-6 numbered items the child completes: real fill-in-the-blank sentences using ___ for the gap (answers come from the word bank), or matching items, or simple math questions that fit this section. Never leave this as a placeholder.
[WORD_BANK]
Exactly 8 words separated by commas. Every blank in the worksheet must be answerable from these words.
[BONUS_DOODLE]
One sentence inviting the child to draw something related to the story.
[ANSWER_KEY]
The answers for the worksheet, numbered to match, one per line.
[IMAGE_PROMPT]
ONE sentence describing a single story coloring scene: the main character and the setting only (what they are doing, where). Do NOT mention a dot-to-dot, maze, sequencing chart, world map, black background or inverted coloring, labels or text.`;

const CLEAN_RULES = `STRICT RULES
- Never write internal layout or print specifications into any block (no stroke widths such as "2 pt", no "8 mm track width", no gutter or margin sizes, no trim size). The style bible may mention layout rules; those are for the designer and must not be copied.
- Do not invent costume, gear or props (for example goggles, hats or backpacks) unless they are written in the style bible.
- Keep the main character exactly as described in the style bible.
- Write only content the child or the adult will read or use.`;

async function draftOne(book: Book, idx: number, which: keyof typeof MODELS, ctx: string): Promise<string> {
  const section = book.sections[idx];
  const prev = book.sections
    .slice(Math.max(0, idx - 2), idx)
    .map((s) => `## ${s.title}\n${s.draft || s.summary}`)
    .join("\n\n");
  const tagged = TAGGED_MODES.has(book.mode);
  return claude(
    `${ctx}

STYLE BIBLE
${book.styleBible || "(none yet)"}

PREVIOUS SECTIONS
${prev || "(this is the first section)"}

WRITE THIS SECTION
Title: ${section.title}
Summary: ${section.summary}

${tagged ? `${TAG_FORMAT}\n\n${CLEAN_RULES}` : "Write the full spec for this section as clean Markdown, following the mode guidance above. Keep to the style bible. Do not mention these instructions."}`,
    which,
  );
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
  // Linked books (series memory) travel with every prompt below.
  const ctx = bookContext(book) + (await seriesContext(book));

  switch (p.action) {
    case "generate_outline": {
      const text = await gemini(
        `${ctx}

Create the working plan for this book. Return ONLY JSON: {"styleBible": string, "sections": [{"title": string, "summary": string}]}.
- styleBible: 200-400 words covering voice, reading level, visual style, recurring characters or motifs, layout rules for the trim size, and things to avoid. It will be given to the writer for every section, so make it specific.
- sections: 8 to 16 sections that fit the mode. Each summary is 1-3 sentences of plain story or activity description.
- Never put print or layout specifications (stroke widths, track widths, gutters, margins, trim size) into any section summary, and never invent costume, gear or props that are not in the style bible.
- For activity and storybook books, every section is built around ONE single story scene with the main character in a setting; do not plan dot-to-dots, mazes, sequencing charts or world maps as the picture.`,
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
      const text = await draftOne(book, idx, which, ctx);
      const sections = book.sections.map((s, i) => (i === idx ? { ...s, draft: text } : s));
      return { sections };
    }

    case "draft_all": {
      const todo = book.sections.map((s, i) => i).filter((i) => p.onlyEmpty === false || !book.sections[i].draft.trim());
      if (!todo.length) throw new Error("Every section already has a draft.");
      let done = 0;
      for (const idx of todo) {
        await setJob(book.id, { jobAction: `draft_all:${done + 1}/${todo.length}` });
        let text: string;
        try {
          text = await draftOne(book, idx, which, ctx);
        } catch (err) {
          throw new Error(`Stopped at section ${idx + 1} (${book.sections[idx].title}) after ${done} of ${todo.length}: ${err instanceof Error ? err.message : String(err)}. Drafts so far are saved; press Draft all again to continue.`);
        }
        book.sections = book.sections.map((s, i) => (i === idx ? { ...s, draft: text } : s));
        // Save each section as it finishes, so nothing is lost if a later one fails.
        const fresh = await getBook(book.id);
        if (fresh) {
          fresh.sections = fresh.sections.map((s) => (s.id === book.sections[idx].id ? { ...s, draft: text } : s));
          fresh.updatedAt = new Date().toISOString();
          await putBook(fresh);
        }
        done++;
      }
      return {};
    }

    case "review_book": {
      const manuscript = book.sections.map((s) => `## ${s.title}\n${s.draft || s.summary}`).join("\n\n");
      const text = await gemini(
        `${ctx}

STYLE BIBLE
${book.styleBible || "(none)"}

MANUSCRIPT
${manuscript || "(no sections yet)"}

Give a developmental review as Markdown: 1) what works, 2) structure and pacing problems, 3) continuity or consistency issues, 4) audience fit and reading level, 5) a prioritized fix list of at most 10 items. Be specific and refer to sections by title.`,
      );
      return { review: text };
    }

    case "market_research": {
      const text = await gemini(
        `${ctx}

NOTES AND IDEAS
${book.notes || "(none yet)"}

You are a KDP market analyst for a small publisher. Using general knowledge of the Amazon KDP market (you have no live Amazon data, so say plainly where something should be checked on Amazon), write a niche analysis as Markdown with exactly these headings:
## Target Buyer
## Positioning Angle
## Market Fit
## 5 Must-Include Features
## Keyword Gaps
Be specific and short. In "Market Fit" say what competing books in this niche usually do and where this book can be different. Under "Keyword Gaps" list phrases buyers may search that the notes do not yet use. Never invent sales numbers.`,
      );
      return { research: text };
    }

    case "pre_review": {
      const text = await gemini(
        `${ctx}

NOTES (rough ideas, storyline options, or a finished plan)
${book.notes || "(none yet)"}

STYLE BIBLE
${book.styleBible || "(none yet)"}

AUTHOR'S QUESTION
${book.reviewQuestion?.trim() || "(none)"}

You are a story coach and developmental editor reviewing a book BEFORE it is outlined. Work only from the notes, style bible and series context above. Write Markdown.

Step 1. Decide what the notes contain.
- If they contain TWO OR MORE storyline options or rough alternatives (for example Option A and Option B, or "either ... or"), act as an interactive story coach: add a "## Head-to-head" section comparing the options on reader appeal, pacing, market fit, and illustration and activity potential (a short table is fine). Then "## Recommendation" naming the stronger storyline and exactly WHY, and what to borrow from the other one. Then suggest improvements to the winner.
- If they contain ONE plan, add "## Continuity and style check": timeline conflicts, missing or unclear character roles, reading level versus the audience, and page-budget gaps for the trim size and mode. If an element is fine, say so in one line.
- If the notes are messy rough ideas, first write "## What I understood" in 3-5 bullet points, then give the checks above.

Step 2. If the author asked a question, answer it directly under "## Answer to your question".

Step 3. Finish with "## Suggested fixes" as a numbered list of at most 10 concrete changes to the Notes or Style Bible. Each starts with a verb. Do not rewrite the whole notes.`,
      );
      return { preReview: text };
    }

    case "apply_review": {
      const text = await gemini(
        `${ctx}

CURRENT NOTES
${book.notes || "(none)"}

CURRENT STYLE BIBLE
${book.styleBible || "(none)"}

PRE-OUTLINE REVIEW
${book.preReview || "(none)"}

AUTHOR'S FIXES AND DIRECTION TO APPLY (this overrides the review; items the author says to skip must be skipped; if it names a winning storyline, lock that storyline in)
${book.reviewDirection?.trim() || "(none given: apply the review's numbered suggested fixes and its recommendation)"}

Rewrite the NOTES and the STYLE BIBLE so they incorporate the accepted fixes and lock in the chosen storyline. Rules: keep every fact, name and detail the author wrote unless a fix changes it; remove the losing storyline options once one is chosen; do not invent new characters, places or plot; keep lists and headings readable; Notes under 7000 characters; Style Bible 200-400 words covering voice and reading level, visual style, recurring characters (with the exact names and details already given), layout rules, and things to avoid. Return ONLY JSON: {"notes": string, "styleBible": string}.`,
        true,
      );
      const data = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as { notes?: string; styleBible?: string };
      if (!data.notes?.trim() || !data.styleBible?.trim()) throw new Error("The AI returned an empty Notes or Style Bible. Nothing was changed.");
      return {
        previousNotesBackup: book.notes,
        previousStyleBibleBackup: book.styleBible,
        notes: String(data.notes).slice(0, 12000),
        styleBible: String(data.styleBible).slice(0, 8000),
      };
    }

    case "apply_polish": {
      const todo = book.sections.map((s, i) => i).filter((i) => book.sections[i].draft.trim());
      if (!todo.length) throw new Error("There are no drafted sections to polish.");
      if (!book.review.trim()) throw new Error("Run Review manuscript first, then apply its fixes.");
      const backup = book.sections.map((s) => ({ ...s }));
      let done = 0;
      for (const idx of todo) {
        await setJob(book.id, { jobAction: `apply_polish:${done + 1}/${todo.length}` });
        const sec = book.sections[idx];
        const tagged = TAGGED_MODES.has(book.mode);
        let text: string;
        try {
          text = await claude(
            `${ctx}

STYLE BIBLE
${book.styleBible || "(none)"}

MANUSCRIPT REVIEW
${book.review.slice(0, 6000)}

AUTHOR'S DIRECTION (overrides the review; skip anything the author says to skip)
${book.polishDirection?.trim() || "(none: apply the review's fixes that concern this section)"}

SECTION TO POLISH
Title: ${sec.title}
${sec.draft}

Revise this section ONLY where the review or direction asks for a change that affects it. Keep everything else word for word. ${tagged ? `Return the same tagged blocks in the same order and format, nothing else.\n\n${TAG_FORMAT}\n\n${CLEAN_RULES}` : "Return the full revised section as Markdown."}`,
            which,
          );
        } catch (err) {
          throw new Error(`Stopped at section ${idx + 1} (${sec.title}) after ${done} of ${todo.length}: ${err instanceof Error ? err.message : String(err)}. Polished sections so far are saved; use Undo to restore the originals.`);
        }
        book.sections = book.sections.map((s, i) => (i === idx ? { ...s, draft: text } : s));
        const fresh = await getBook(book.id);
        if (fresh) {
          fresh.sections = fresh.sections.map((s) => (s.id === sec.id ? { ...s, draft: text } : s));
          fresh.previousSectionsBackup = backup;
          fresh.updatedAt = new Date().toISOString();
          await putBook(fresh);
        }
        done++;
      }
      return {};
    }

    case "extract_workbook": {
      const manuscript = book.sections.map((s) => `## ${s.title}\n${s.draft || s.summary}`).join("\n\n");
      const text = await claude(
        `${ctx}

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
