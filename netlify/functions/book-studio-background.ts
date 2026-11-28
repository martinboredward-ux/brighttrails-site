import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { geminiGenerate } from "../lib/gemini.ts";
import { getReserved, logUsage, reservedPromptBlock } from "../lib/studio-settings.ts";
import { getBook, putBook, type Book, type Section } from "../lib/studio-store.ts";
import { seriesContext } from "../lib/series-context.ts";
import { TEMPLATES, tplDef } from "../lib/templates.ts";
import { automatedChecks, cleanFixes, diffSummary, parseJson } from "../lib/review-utils.ts";

// Background function (15-minute limit). Invoked at /.netlify/functions/book-studio-background.
// Netlify answers the HTTP call with 202 straight away; progress is written to the book's jobStatus.
export const config: Config = {};

const MODELS = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" } as const;
type Action = "generate_outline" | "draft_section" | "draft_all" | "review_book" | "extract_workbook" | "market_research" | "pre_review" | "apply_review" | "apply_polish" | "import_review" | "title_ideas" | "originality_review" | "fill_template" | "fill_details" | "shorten_section" | "split_section";

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
    "A picture book. Sections are spreads. A spread spec gives the story text (short, read-aloud rhythm), what the illustration shows, the camera/composition, and any interactive prompt for the reader. For ages 1-4 each spread has only 5-7 punchy lines of text (never 12+), so it breathes on a square page.",
  planner:
    "A FULL-COLOR adult planner / guided workbook (not a kids book). Most pages are code-drawn templates (guided prompts, checklists, trackers, sprints, collage canvases, cut-out sheets). You write only the words that go on them: inspiring, professional, commercially focused, executive adult reading level. Never write coloring-book or child wording.",
  gamebook:
    "An interactive trivia gamebook for ages 9-12 (map, checkpoint, gate, victory and detour pages). Each page is short and snappy. Choices point to other pages with a link written exactly as [GO: section-id]. Every explanation is under 50 words. Every multiple-choice question has a deductive clue in the question or answers; no obscure recall.",
  tracing:
    "A preschool letter-tracing book for ages 4-6 with a friendly animal mascot named in the Style Bible. Letter spreads are code-drawn templates; you write only the short story cue and the parent prompt (max 2 sentences). Direction words are ONLY: Pull down, Slide right, Hop over, Loop around. Never make medical, therapy or ADHD claims.",
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

let currentAction = "job";
const gemini = (prompt: string, json = false) => geminiGenerate(prompt, { json, label: currentAction });

let lastStop: string | null = null;
const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

async function claude(prompt: string, which: keyof typeof MODELS, maxTokens = 4000): Promise<string> {
  const client = new Anthropic();
  await logUsage(`text:${MODELS[which] ?? MODELS.haiku}:${currentAction}`);
  const msg = await client.messages.create({
    model: MODELS[which] ?? MODELS.haiku,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  lastStop = msg.stop_reason ?? null;
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

const STORYBOOK_FORMAT = `Return ONLY the tagged blocks below, in this order. Each tag goes on its own line, followed by its content. Do not add closing tags, headings, preambles or notes.

[STORY_TEXT]
The read-aloud text for this spread: 5 to 7 short punchy lines (never more than 7), one short sentence or sound-word line each, about 35-70 words in total, with rhythm a toddler can echo. No long paragraphs.
[WHILE_YOU_LISTEN]
ONE short "point, count and play" prompt for the child about the picture (for example "Point to the kite. Can you count the clouds?"), one line, no list.
[IMAGE_PROMPT]
ONE sentence describing the single illustration for this spread: the main character and the setting only (what they are doing, where). No text or lettering in the picture.`;

const formatFor = (mode: Book["mode"]) => (mode === "storybook" ? STORYBOOK_FORMAT : TAG_FORMAT);

const CLEAN_RULES = `STRICT RULES
- Never write internal layout or print specifications into any block (no stroke widths such as "2 pt", no "8 mm track width", no gutter or margin sizes, no trim size). The style bible may mention layout rules; those are for the designer and must not be copied.
- Do not invent costume, gear or props (for example goggles, hats or backpacks) unless they are written in the style bible.
- Keep the main character exactly as described in the style bible.
- Write only content the child or the adult will read or use.`;

/** Planner pages are single printed pages: about 250 words, never more than 300. */
const PLANNER_LIMIT = 300;
const PLANNER_PAGE_RULE = `PAGE BUDGET (hard rule): this section is ONE printed 8.5x11 page. Write at most 250 words, never more than ${PLANNER_LIMIT}. If the summary describes several pages, write only the first page's worth and finish cleanly; the other pages are separate sections. Always end on a complete sentence. No coloring-book or child wording.`;

/** Gamebook pages: short, reader parts first so a cut-off can never lose what the reader sees. */
const GAMEBOOK_PAGE_RULE = `PAGE FORMAT (hard rules): keep the page layout from the style bible but short. Separate parts with a line containing only ---. Order: (1) title line, then Page ID, Page Type, Series lines; (2) "Page Text": 40-80 words, snappy; (3) the field fact or explanation, under 50 words; (4) the question or the "Choice" lines, each choice ending with a [GO: page-id] link using the PAGE IDS above (an ending page uses [END] instead); (5) "Illustration": at most 2 sentences for the artist; (6) "Visual Progress Map": at most 3 short bullets. Whole page under 330 words. Always end on a complete line. Never repeat the mascot's full outfit more than once.`;

async function shortenText(text: string, limit: number, which: keyof typeof MODELS, title: string): Promise<string> {
  return claude(
    `Rewrite the text below so it fits ONE printed page: at most ${limit} words (aim for about ${Math.round(limit * 0.85)}).
Keep the same Markdown structure and headings style, keep the most useful guidance, drop repetition and filler. If the text is cut off mid-sentence or mid-table, finish the thought briefly and cleanly. Do not add a preamble or notes. Return ONLY the rewritten page.

PAGE TITLE: ${title}

TEXT:
${text}`,
    which,
    3000,
  );
}

async function draftOne(book: Book, idx: number, which: keyof typeof MODELS, ctx: string): Promise<string> {
  const section = book.sections[idx];
  const prev = book.sections
    .slice(Math.max(0, idx - 2), idx)
    .map((s) => `## ${s.title}\n${s.draft || s.summary}`)
    .join("\n\n");
  const tagged = TAGGED_MODES.has(book.mode);
  const planner = book.mode === "planner";
  const gamebook = book.mode === "gamebook";
  const prompt = (extra = "") => `${ctx}

STYLE BIBLE
${book.styleBible || "(none yet)"}

PREVIOUS SECTIONS
${prev || "(this is the first section)"}

WRITE THIS SECTION
Title: ${section.title}
Summary: ${section.summary}

${tagged ? `${formatFor(book.mode)}\n\n${CLEAN_RULES}` : "Write the full spec for this section as clean Markdown, following the mode guidance above. Keep to the style bible. Do not mention these instructions."}${planner ? `\n\n${PLANNER_PAGE_RULE}` : ""}${gamebook ? `\n\n${GAMEBOOK_PAGE_RULE}` : ""}${extra}`;
  const out = await claude(prompt(), which, planner ? 1800 : gamebook ? 2500 : 4000);
  // Safety net: if the AI ran out of room or wrote too much for one page, shorten it once.
  if (planner && (lastStop === "max_tokens" || wordCount(out) > PLANNER_LIMIT + 40)) return shortenText(out, PLANNER_LIMIT, which, section.title);
  // Gamebook: one retry asking for a shorter page if the first try was cut off.
  if (gamebook && lastStop === "max_tokens") return claude(prompt("\n\nYOUR LAST ATTEMPT WAS CUT OFF. Write a shorter page: whole page under 250 words, Illustration one sentence, Visual Progress Map two bullets."), which, 2500);
  return out;
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
  currentAction = p.action;
  const reserved = reservedPromptBlock(await getReserved(), book);
  const gbIds = book.mode === "gamebook" ? `\nPAGE IDS (use exactly these in [GO: id] links): ${book.sections.map((s, i) => `${i + 1}=${s.id} (${s.title})`).join("; ")}` : "";
  const ctx = bookContext(book) + (reserved ? `\n${reserved}` : "") + gbIds + (await seriesContext(book));

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

    case "shorten_section": {
      const idx = book.sections.findIndex((s) => s.id === p.sectionId);
      if (idx < 0) throw new Error("Section not found");
      const cur = book.sections[idx];
      if (!cur.draft.trim()) throw new Error("This section has no text to shorten.");
      const text = await shortenText(cur.draft, PLANNER_LIMIT, which, cur.title);
      if (!text) throw new Error("The AI returned nothing. Nothing was changed.");
      return { sections: book.sections.map((s, i) => (i === idx ? { ...s, draft: text } : s)) };
    }

    case "split_section": {
      const idx = book.sections.findIndex((s) => s.id === p.sectionId);
      if (idx < 0) throw new Error("Section not found");
      const cur = book.sections[idx];
      const source = (cur.draft.trim() || cur.summary).trim();
      if (wordCount(source) < 120) throw new Error("This section is short enough already.");
      const n = Math.min(6, Math.max(2, Math.ceil(wordCount(source) / 250)));
      const raw = await claude(
        `${ctx}

Split the planner section below into ${n} separate printed pages, in order. Each page: a short clear title, and at most 250 words of page text (never more than ${PLANNER_LIMIT}). Keep the same Markdown style. Keep the best guidance from the source; if the source is cut off mid-sentence or mid-table, finish that thought briefly. No coloring-book or child wording.
Return ONLY JSON: [{"title": string, "draft": string}] with exactly ${n} items.

SECTION TITLE: ${cur.title}

SOURCE:
${source}`,
        which,
        6000,
      );
      let parts: { title?: string; draft?: string }[];
      try { parts = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim()); } catch { throw new Error("The AI's answer could not be read. Nothing was changed; try again."); }
      parts = (Array.isArray(parts) ? parts : []).filter((x) => x && String(x.draft ?? "").trim());
      if (parts.length < 2) throw new Error("The AI did not split the section. Nothing was changed; try again.");
      const stamp = Date.now().toString(36);
      const made: Section[] = parts.map((x, k) => ({ ...cur, id: `${stamp}${k}`, title: String(x.title ?? `${cur.title} (${k + 1}/${parts.length})`).trim() || `${cur.title} (${k + 1})`, summary: k === 0 ? cur.summary : "", draft: String(x.draft).trim() }));
      return { sections: [...book.sections.slice(0, idx), ...made, ...book.sections.slice(idx + 1)] };
    }

    case "draft_all": {
      const todo = book.sections.map((s, i) => i).filter((i) => !["coloring", "template", "cutout", "picture"].includes(String(book.sections[i].kind)) && (p.onlyEmpty === false || !book.sections[i].draft.trim()));
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
      // Review #2: Pre-Cover Proofread & Formatting QA. Strictly spelling, tags, consistency, artwork and reading level.
      const manuscript = book.sections.map((sec, i) => `## SECTION ${i + 1}: ${sec.title}\n${sec.draft || sec.summary}`).join("\n\n");
      const toddler = book.mode === "storybook";
      const text = await gemini(
        `${ctx}

STYLE BIBLE
${book.styleBible || "(none)"}

AUTOMATED CHECKS (already run by the Studio, treat as facts)
${automatedChecks(book)}

MANUSCRIPT
${manuscript || "(no sections yet)"}

You are a proofreader and print-formatting QA editor running just BEFORE the cover. Stay strictly inside: spelling, grammar and typos; consistency of names and Tagalog or other special terms; broken "[" brackets or missing [TAG] blocks; Answer Key vs Worksheet accuracy (every answer must match its question); missing section artwork; reading-level and format consistency for the audience "${book.audience || "not set"}". ${toddler ? "This is a toddler STORYBOOK: it must contain NO elementary fill-in Word Bank drills, no spelling worksheets and no answer keys; flag any that exist and any wording too hard for the age." : ""} Do NOT comment on plot, market or structure.

Return ONLY JSON: {"review": string, "reviewFixes": [{"id": string, "title": string, "detail": string, "target": "sections"}]}.
"review" is readable Markdown QA notes with headings "## Spelling & grammar", "## Names & special terms", "## Tags & formatting", "## Answer Key vs Worksheet", "## Artwork", "## Reading level" (write "No problems found." under a heading that is clean). Mention sections by number and title.
"reviewFixes" has at most 12 specific, separate fixes (a short imperative title and a detail naming the section and the exact words). Empty array if nothing needs fixing.`,
        true,
      );
      const data = parseJson<{ review?: string; reviewFixes?: unknown }>(text);
      return { review: String(data.review ?? "").trim() || "No problems found.", reviewFixes: cleanFixes(data.reviewFixes, ["sections"]), reviewSelected: [] };
    }

    case "fill_details": {
      const text = await gemini(
        `${ctx}

NOTES AND IDEAS
${book.notes || "(none yet)"}

MARKET RESEARCH
${book.research || "(none yet)"}

Suggest the core details for this book from the notes and research. Return ONLY JSON: {"title": string, "subtitle": string, "audience": string, "mode": "activity"|"storybook"|"nonfiction"|"planner"|"gamebook"|"tracing", "styleBible": string}.
- title: a strong, searchable title (max 8 words). subtitle: keyword-rich, under 150 characters, says who it is for and what is inside, no claims we cannot deliver.
- audience: plain words, include the age range (for example "Girls ages 8-12, and the parents who buy for them").
- mode: the best-fitting book type.
- styleBible: 200-400 words covering voice, reading level, visual style, recurring characters or motifs, layout rules for the trim size, and a line starting "Avoid:" with things never to do. Use the reserved-names rules above; never reuse a reserved name or animal.`,
      );
      const d = parseJson<{ title?: string; subtitle?: string; audience?: string; mode?: string; styleBible?: string }>(text);
      const patch: Partial<Book> = {};
      const filled: string[] = [], kept: string[] = [];
      const sub = String(d.subtitle ?? "").trim().slice(0, 200);
      if (!book.subtitle?.trim() && sub) { patch.subtitle = sub; filled.push("Subtitle"); } else if (book.subtitle?.trim()) kept.push("Subtitle");
      const aud = String(d.audience ?? "").trim().slice(0, 200);
      if (!book.audience?.trim() && aud) { patch.audience = aud; filled.push("Audience"); } else if (book.audience?.trim()) kept.push("Audience");
      const sb = String(d.styleBible ?? "").trim().slice(0, 8000);
      if (!book.styleBible?.trim() && sb) { patch.styleBible = sb; filled.push("Style Bible"); } else if (book.styleBible?.trim()) kept.push("Style Bible");
      const ideas: string[] = [];
      if (d.title && d.title.trim() && d.title.trim() !== book.title) ideas.push(`Title idea: ${d.title.trim()}`);
      if (d.mode && d.mode !== book.mode) ideas.push(`Studio type idea: ${d.mode}`);
      const prev = (book.studio ?? {}) as Record<string, unknown>;
      return { ...patch, studio: { ...prev, detailsFill: { at: new Date().toISOString(), filled, kept, ideas } } };
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
      // Review #1: Idea, Market & Age-Fit Review, before outlining.
      const text = await gemini(
        `${ctx}

MARKET RESEARCH
${book.research?.trim() || "(not run)"}

NOTES (rough ideas, storyline options, or a finished plan)
${book.notes || "(none yet)"}

STYLE BIBLE
${book.styleBible || "(none yet)"}

TARGET AGE / AUDIENCE: ${book.audience || "(not set)"}

AUTHOR'S QUESTION
${book.reviewQuestion?.trim() || "(none)"}

You are a story coach and market editor reviewing a book BEFORE it is outlined. Judge market positioning, the hook, storyline options, age-appropriateness for the stated audience (an 18-month to 4-year-old toddler needs very different text, length, vocabulary and activities than a Grade 1-3 reader), pacing, and character roles. Work only from the material above.

Inside "review" write Markdown. If the notes hold TWO OR MORE storyline options (Option A and Option B, or "either ... or"), include "## Head-to-head" (reader appeal, pacing, market fit, illustration and activity potential), then "## Recommendation" naming the stronger one and exactly WHY. If they hold one plan, include "## Continuity and style check". If they are messy rough ideas, start with "## What I understood" (3-5 bullets). Always include "## Market positioning and hook", "## Age fit" and "## Pacing and character roles". If the author asked a question, answer it under "## Answer to your question".

Return ONLY JSON: {"review": string, "reviewFixes": [{"id": string, "title": string, "detail": string, "target": "notes" | "styleBible"}]}.
"reviewFixes" has at most 10 concrete, separate changes. Each title starts with a verb. Use target "notes" for plot, storyline, structure or content changes and "styleBible" for voice, reading level, visual style, recurring characters or layout rules. Do not rewrite the whole notes.`,
        true,
      );
      const data = parseJson<{ review?: string; reviewFixes?: unknown }>(text);
      return { preReview: String(data.review ?? "").trim(), preReviewFixes: cleanFixes(data.reviewFixes, ["notes", "styleBible"]), preReviewSelected: [] };
    }

    case "apply_review": {
      const picked = (book.preReviewFixes ?? []).filter((f) => (book.preReviewSelected ?? []).includes(f.id));
      const extra = book.reviewDirection?.trim();
      if (!picked.length && !extra) throw new Error("Tick at least one fix, or type extra instructions, then apply.");
      const text = await gemini(
        `${ctx}

CURRENT NOTES
${book.notes || "(none)"}

CURRENT STYLE BIBLE
${book.styleBible || "(none)"}

REVIEW (for background only)
${book.preReview || "(none)"}

FIXES THE AUTHOR CHECKED (apply exactly these and nothing else from the review)
${picked.map((f, i) => `${i + 1}. [${f.target}] ${f.title}: ${f.detail}`).join("\n") || "(none checked)"}

EXTRA INSTRUCTIONS FROM THE AUTHOR (these override everything; if they name a winning storyline, lock it in and remove the losing options)
${extra || "(none)"}

Rewrite the NOTES and the STYLE BIBLE so they incorporate ONLY the checked fixes and the extra instructions. Rules: keep every fact, name and detail the author wrote unless a checked fix changes it; do not apply unchecked suggestions; do not invent new characters, places or plot; keep lists and headings readable; Notes under 7000 characters; Style Bible 200-400 words covering voice and reading level, visual style, recurring characters (with the exact names and details already given), layout rules, and things to avoid. Return ONLY JSON: {"notes": string, "styleBible": string, "appliedChanges": string[]} where appliedChanges is a bulleted-style list of short plain sentences, one per concrete change you really made (say what changed and where).`,
        true,
      );
      const data = parseJson<{ notes?: string; styleBible?: string; appliedChanges?: unknown }>(text);
      if (!data.notes?.trim() || !data.styleBible?.trim()) throw new Error("The AI returned an empty Notes or Style Bible. Nothing was changed.");
      const notes = String(data.notes).slice(0, 12000), styleBible = String(data.styleBible).slice(0, 8000);
      const claimed = Array.isArray(data.appliedChanges) ? data.appliedChanges.map((x) => String(x).slice(0, 220)).slice(0, 15) : [];
      const proof = [...(notes !== book.notes ? ["Notes updated"] : []), ...(styleBible !== book.styleBible ? ["Style Bible updated"] : [])];
      return {
        previousNotesBackup: book.notes,
        previousStyleBibleBackup: book.styleBible,
        notes,
        styleBible,
        lastApplied: { kind: "idea" as const, at: new Date().toISOString(), changes: [...proof, ...(claimed.length ? claimed : ["(the AI listed no individual changes)"])] },
      };
    }

    case "apply_polish": {
      const picked = (book.reviewFixes ?? []).filter((f) => (book.reviewSelected ?? []).includes(f.id));
      const extra = book.polishDirection?.trim();
      if (!picked.length && !extra) throw new Error("Tick at least one fix, or type extra instructions, then apply.");
      const todo = book.sections.map((_, i) => i).filter((i) => book.sections[i].draft.trim());
      if (!todo.length) throw new Error("There are no drafted sections to fix.");
      const backup = book.sections.map((sec) => ({ ...sec }));
      const log: string[] = [];
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

FIXES THE AUTHOR CHECKED (apply only these)
${picked.map((f, i) => `${i + 1}. ${f.title}: ${f.detail}`).join("\n") || "(none checked)"}

EXTRA INSTRUCTIONS FROM THE AUTHOR (override the fixes)
${extra || "(none)"}

SECTION ${idx + 1} TO FIX
Title: ${sec.title}
${sec.draft}

Change this section ONLY where a checked fix or the extra instructions affects it. If none affects it, return it exactly as it is. Keep everything else word for word. ${tagged ? `Return the same tagged blocks in the same order and format, nothing else.\n\n${formatFor(book.mode)}\n\n${CLEAN_RULES}` : "Return the full revised section as Markdown."}`,
            which,
          );
        } catch (err) {
          throw new Error(`Stopped at section ${idx + 1} (${sec.title}) after ${done} of ${todo.length}: ${err instanceof Error ? err.message : String(err)}. Fixed sections so far are saved; use Undo to restore the originals.`);
        }
        log.push(...diffSummary(sec.draft, text, `Section ${idx + 1} (${sec.title})`));
        book.sections = book.sections.map((x, i) => (i === idx ? { ...x, draft: text } : x));
        const fresh = await getBook(book.id);
        if (fresh) {
          fresh.sections = fresh.sections.map((x) => (x.id === sec.id ? { ...x, draft: text } : x));
          fresh.previousSectionsBackup = backup;
          fresh.updatedAt = new Date().toISOString();
          await putBook(fresh);
        }
        done++;
      }
      return { lastApplied: { kind: "qa" as const, at: new Date().toISOString(), changes: log.length ? log.slice(0, 60) : ["No section needed a change."] } };
    }

    case "fill_template": {
      const todo = book.sections.filter((s) => s.tpl && tplDef(s.tpl) && (p.sectionId ? s.id === p.sectionId : true));
      if (!todo.length) throw new Error("No template sections to fill.");
      let done = 0, skipped = 0;
      const sections = book.sections.map((s) => ({ ...s }));
      for (const sec of todo) {
        const def = tplDef(sec.tpl)!;
        // Only the template's own word fields count (a letter page always stores its letter, which must not make it look filled).
        const have = def.fields.some((f) => (sec.data?.[f.key] ?? "").trim()) && !p.sectionId;
        if (have) { skipped++; continue; }
        await setJob(book.id, { jobAction: `fill_template:${++done}/${todo.length}` });
        const out = await claude(
          `${ctx}

STYLE BIBLE (voice only matters here)
${book.styleBible || "(none yet)"}

PAGE: ${sec.title}
PAGE PURPOSE: ${sec.summary || "(none)"}
TEMPLATE: ${def.label}. ${def.ai}
${sec.data?.letter ? `LETTER: ${sec.data.letter} (upper and lower case)` : ""}

Return ONLY JSON with exactly these string fields: ${def.fields.map((f) => `"${f.key}" (${f.label})`).join(", ")}. Multi-line fields use "\n" between lines. No markdown, no numbering.`,
          which,
        );
        let data: Record<string, unknown> = {};
        try { data = parseJson<Record<string, unknown>>(out); } catch { throw new Error(`The AI answer for "${sec.title}" could not be read. Press Fill words again.`); }
        const idx = sections.findIndex((x) => x.id === sec.id);
        const merged: Record<string, string> = { ...(sec.data ?? {}) };
        for (const f of def.fields) merged[f.key] = String(data[f.key] ?? "").replace(/\r/g, "").trim().slice(0, 1500);
        sections[idx] = { ...sections[idx], data: merged };
        const fresh = await getBook(book.id);
        if (fresh) { fresh.sections = fresh.sections.map((x) => (x.id === sec.id ? { ...x, data: merged } : x)); await putBook(fresh); }
      }
      if (!done && skipped) throw new Error("Every template page already has words, so nothing was filled. To redo one page, open it and press its own Fill button.");
      return { sections };
    }

    case "import_review": {
      const pasted = String((book.studio as { outsideReview?: string } | undefined)?.outsideReview ?? "").trim();
      if (!pasted) throw new Error("Paste the reviewer's notes first.");
      const list = book.sections.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
      const text = await gemini(
        `${ctx}

SECTIONS OF THIS BOOK
${list || "(none)"}

AN OUTSIDE REVIEWER WROTE THIS ABOUT THE BOOK
${pasted.slice(0, 9000)}

Turn the reviewer's notes into separate, concrete, checkable fixes that the author can tick and apply to the SECTION TEXT. Skip anything that is only about pictures or the cover (the author fixes those by hand) and anything that is praise. Each fix names the section number(s) it touches in its title when it is specific to one.
Return ONLY JSON: {"summary": string (2-4 sentences, what the reviewer found), "fixes": [{"id": string, "title": string, "detail": string, "target": "sections"}]}. At most 15 fixes. Titles start with a verb.`,
        true,
      );
      const data = parseJson<{ summary?: string; fixes?: unknown }>(text);
      return { review: `Imported outside review\n\n${String(data.summary ?? "").trim()}`, reviewFixes: cleanFixes(data.fixes, ["sections"]), reviewSelected: [] };
    }

    case "title_ideas": {
      const text = await gemini(
        `${ctx}

NOTES
${book.notes.slice(0, 3000) || "(none)"}

MARKET RESEARCH
${(book.research || "(none)").slice(0, 3000)}

You are a KDP title strategist. Give 10 title and subtitle options for this book. Rules: the title is short and memorable; the subtitle carries the main search words naturally; no trademarks, no brand names, no "best", "#1" or price words; title + subtitle together under 200 characters; do not reuse character names reserved by other books.
Also give 6 exact Amazon search strings the author should type into Amazon to check for competing titles with the same name (for example "Vision Board 2027" clip art book).
Return ONLY JSON: {"options": [{"title": string, "subtitle": string, "why": string}], "searches": string[]}.`,
        true,
      );
      const data = parseJson<{ options?: unknown; searches?: unknown }>(text);
      const options = (Array.isArray(data.options) ? data.options : []).slice(0, 10).map((o) => { const r = (o ?? {}) as Record<string, unknown>; return { title: String(r.title ?? "").slice(0, 120), subtitle: String(r.subtitle ?? "").slice(0, 160), why: String(r.why ?? "").slice(0, 200) }; }).filter((o) => o.title);
      const searches = (Array.isArray(data.searches) ? data.searches : []).slice(0, 8).map((x) => String(x).slice(0, 120));
      const prev = (book.studio ?? {}) as Record<string, unknown>;
      return { studio: { ...prev, titleIdeas: { at: new Date().toISOString(), options, searches, results: (prev.titleIdeas as { results?: string } | undefined)?.results ?? "" } } };
    }

    case "originality_review": {
      const body = book.sections.map((s, i) => `## ${i + 1}. ${s.title}\n${s.draft || s.summary}`).join("\n\n").slice(0, 60000);
      if (!body.trim()) throw new Error("There is no text to review yet.");
      const text = await gemini(
        `You are an originality and copyright-risk reviewer for a self-published KDP book. No tool can prove a book is free of plagiarism, so you report RISK only.
BOOK: ${book.title} (${book.mode}). Audience: ${book.audience || "n/a"}.

TEXT
${body}

Report in Markdown with these sections: "## Overall risk" (Low, Medium or High, one sentence why), "## Passages that read like well-known material" (quote at most 12 words of each, say what it resembles and why; write "None found" if none), "## Generic or templated wording" (phrases an AI or template would repeat across many books), "## Names, brands and trademarks" (anything that needs checking), "## Facts to verify" (factual claims a reader could dispute), "## What to do next" (3-5 concrete steps, including pasting a few distinctive sentences into a search engine and a plagiarism checker you trust). Be honest and specific; do not invent matches.`,
      );
      const prev = (book.studio ?? {}) as Record<string, unknown>;
      return { studio: { ...prev, originality: `${new Date().toISOString().slice(0, 10)}\n\n${text.trim()}` } };
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
