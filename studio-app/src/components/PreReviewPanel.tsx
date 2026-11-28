import type { Action, Book } from "../types";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";
import ReviewFixPicker, { type CompareItem } from "./ReviewFixPicker";

interface Props { book: Book; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; run: (a: Action) => Promise<void> }

/** Review #1: Idea, Market & Age-Fit Review. Runs before outlining on Market Research + Notes + Style Bible + audience. */
export default function PreReviewPanel({ book, update, commit, run }: Props) {
  const running = book.jobStatus === "running";
  const canUndo = book.previousNotesBackup !== null || book.previousStyleBibleBackup !== null;
  const applied = book.lastApplied?.kind === "idea" ? book.lastApplied : null;
  const compare: CompareItem[] = [];
  if (applied && book.previousNotesBackup !== null && book.previousNotesBackup !== book.notes) compare.push({ label: "Notes", before: book.previousNotesBackup, after: book.notes });
  if (applied && book.previousStyleBibleBackup !== null && book.previousStyleBibleBackup !== book.styleBible) compare.push({ label: "Style Bible", before: book.previousStyleBibleBackup, after: book.styleBible });
  const undo = () => void commit({
    notes: book.previousNotesBackup ?? book.notes,
    styleBible: book.previousStyleBibleBackup ?? book.styleBible,
    previousNotesBackup: null,
    previousStyleBibleBackup: null,
    lastApplied: null,
  });
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Steps 5-6 · Review #1: Idea, Market &amp; Age-Fit Review, then apply the fixes</h2>
      <p className="hint">Runs before outlining on Market Research + Notes + Style Bible + the target age. It judges market positioning, the hook, storyline options (Option A vs B), age-appropriateness (an 18-month to 4-year-old toddler needs very different text than a Grade 1-3 reader), pacing and character roles. The later proofread is a separate review at the end of tab 2.</p>
      <div>
        <label className="label" htmlFor="rq">Quick question (optional)</label>
        <input id="rq" className="field" value={book.reviewQuestion} readOnly={running} onChange={(e) => update({ reviewQuestion: e.target.value })} placeholder="e.g. Which storyline is better and why?" />
      </div>
      <div className="flex flex-wrap gap-2">
        <TooltipButton className="btn" disabled={running} onClick={() => run("pre_review")}>Run Idea, Market &amp; Age-Fit Review</TooltipButton>
      </div>
      <JobStatus book={book} only={["pre_review", "apply_review"]} />
      {book.preReview.trim() && (
        <>
          <textarea className="field min-h-72" value={book.preReview} readOnly aria-label="Idea, market and age-fit review" />
          <ReviewFixPicker
            fixes={book.preReviewFixes ?? []}
            selected={book.preReviewSelected ?? []}
            onSelect={(ids) => update({ preReviewSelected: ids })}
            extra={book.reviewDirection}
            onExtra={(t) => update({ reviewDirection: t })}
            extraPlaceholder="e.g. Go with Option B. Keep Jun as the fixer. Make the reading level Grade 1."
            busy={running}
            onApply={() => run("apply_review")}
            applied={applied}
            compare={compare}
            canUndo={canUndo}
            onUndo={undo}
          />
        </>
      )}
    </section>
  );
}
