import type { Dispatch, SetStateAction } from "react";
import type { Action, Book } from "../types";
import { startJob } from "../api";
import { withSnapshot } from "../utils/studioMeta";

interface Args { book: Book; save: () => Promise<Book | null>; setBook: Dispatch<SetStateAction<Book | null>>; fail: (e: unknown) => void; commit?: (p: Partial<Book>) => Promise<void> }

/** Actions that rewrite the author's text: a restore point is saved first. */
const SNAPSHOT_BEFORE: Action[] = ["apply_review", "apply_polish", "fill_template", "fill_details"];

/** Saves the book, then starts a background AI job on it. The app polls until the job finishes. */
/** What each AI review looked at the last time it ran this visit, so an unchanged book is not reviewed twice. */
const lastRun = new Map<string, string>();
const REPEAT_GUARD: Action[] = ["review_book", "pre_review", "market_research", "extract_workbook"];
const signature = (b: Book) => {
  const t = JSON.stringify([b.notes, b.styleBible, b.sections.map((s) => [s.title, s.summary, s.draft])]);
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${t.length}:${h}`;
};

export function useRunJob({ book, save, setBook, fail, commit }: Args) {
  return async (action: Action, opts: { sectionId?: string; model?: "haiku" | "sonnet"; onlyEmpty?: boolean } = {}) => {
    const key = `${book.id}:${action}`;
    const sig = signature(book);
    if (REPEAT_GUARD.includes(action) && lastRun.get(key) === sig
      && !confirm("Nothing in the notes, style bible or sections has changed since this ran. Running it again uses Netlify credits and gives the same kind of answer. Run it anyway?")) return;
    if (commit && (SNAPSHOT_BEFORE.includes(action) || (action === "draft_all" && opts.onlyEmpty === false))) {
      await commit({ studio: withSnapshot(book, `Before ${(JOB_LABEL[action] ?? action).split(" (")[0].toLowerCase()}`) });
    }
    const saved = await save();
    if (!saved) return;
    lastRun.set(key, sig);
    try {
      setBook((b) => (b ? { ...b, jobStatus: "running", jobAction: action, jobError: "" } : b));
      await startJob({ bookId: book.id, action, ...opts });
    } catch (e) {
      setBook((b) => (b ? { ...b, jobStatus: "error", jobError: e instanceof Error ? e.message : "Could not start" } : b));
      fail(e);
    }
  };
}

export const JOB_LABEL: Record<string, string> = {
  generate_outline: "Generating outline (Gemini)",
  fill_details: "Suggesting title, subtitle, audience and Style Bible (Gemini)",
  draft_section: "Drafting section (Claude)",
  draft_all: "Drafting all sections (Claude)",
  review_book: "Proofreading and formatting QA (Gemini)",
  extract_workbook: "Extracting workbook (Claude)",
  market_research: "Researching the market (Gemini)",
  pre_review: "Idea, market and age-fit review (Gemini)",
  apply_review: "Applying the selected fixes to Notes and Style Bible (Gemini)",
  apply_polish: "Applying the selected fixes to your sections (Claude)",
  import_review: "Turning the outside review into fixes (Gemini)",
  title_ideas: "Finding title and subtitle options (Gemini)",
  originality_review: "Reviewing originality risk (Gemini)",
  fill_template: "Writing the words for the template pages (Claude)",
};
