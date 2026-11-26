import type { Dispatch, SetStateAction } from "react";
import type { Action, Book } from "../types";
import { startJob } from "../api";

interface Args { book: Book; save: () => Promise<Book | null>; setBook: Dispatch<SetStateAction<Book | null>>; fail: (e: unknown) => void }

/** Saves the book, then starts a background AI job on it. The app polls until the job finishes. */
export function useRunJob({ book, save, setBook, fail }: Args) {
  return async (action: Action, opts: { sectionId?: string; model?: "haiku" | "sonnet"; onlyEmpty?: boolean } = {}) => {
    const saved = await save();
    if (!saved) return;
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
  draft_section: "Drafting section (Claude)",
  draft_all: "Drafting all sections (Claude)",
  review_book: "Reviewing manuscript (Gemini)",
  extract_workbook: "Extracting workbook (Claude)",
  market_research: "Researching the market (Gemini)",
  pre_review: "Reviewing notes before outlining (Gemini)",
  apply_review: "Applying review changes to Notes and Style Bible (Gemini)",
  apply_polish: "Polishing drafted sections (Claude)",
};
