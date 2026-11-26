import type { Action, Book } from "../types";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";

interface Props { book: Book; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; run: (a: Action) => Promise<void> }

/** Runs on Notes + Style Bible + Series Memory BEFORE outlining. Doubles as a storyline coach when Notes hold options. */
export default function PreReviewPanel({ book, update, commit, run }: Props) {
  const running = book.jobStatus === "running";
  const canUndo = book.previousNotesBackup !== null || book.previousStyleBibleBackup !== null;
  const undo = () => {
    void commit({
      notes: book.previousNotesBackup ?? book.notes,
      styleBible: book.previousStyleBibleBackup ?? book.styleBible,
      previousNotesBackup: null,
      previousStyleBibleBackup: null,
    });
  };
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Pre-outline continuity &amp; style review</h2>
      <p className="hint">Runs on Notes + Style Bible + Series Memory before you outline. With one plan it checks timeline conflicts, missing character roles, reading level and page budget. If Notes hold two or more storyline options (Option A vs Option B) or rough ideas, it acts as a story coach: it compares them head to head on reader appeal, pacing, market fit and illustration/activity potential, says which is stronger and why, and suggests improvements.</p>
      <div>
        <label className="label" htmlFor="rq">Quick question (optional)</label>
        <input id="rq" className="field" value={book.reviewQuestion} readOnly={running} onChange={(e) => update({ reviewQuestion: e.target.value })} placeholder="e.g. Which storyline is better and why?" />
      </div>
      <div className="flex flex-wrap gap-2">
        <TooltipButton className="btn" disabled={running} onClick={() => run("pre_review")}>Run Pre-Outline Review</TooltipButton>
      </div>
      <JobStatus book={book} only={["pre_review", "apply_review"]} />
      {book.preReview.trim() && (
        <>
          <textarea className="field min-h-72" value={book.preReview} readOnly aria-label="Pre-outline review" />
          <div>
            <label className="label" htmlFor="rd">Fixes / direction to apply (optional)</label>
            <textarea id="rd" className="field min-h-24" value={book.reviewDirection} readOnly={running} onChange={(e) => update({ reviewDirection: e.target.value })}
              placeholder={"e.g. Go with Option B. Apply fixes 1, 2 and 4. Skip 3. Keep Jun as the fixer."} />
            <p className="hint mt-1">Leave empty to apply every suggested fix and the recommendation. Whatever you type here overrides the review, including which storyline wins.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipButton className="btn" disabled={running} onClick={() => run("apply_review")}>Apply Review Changes to Notes &amp; Style Bible</TooltipButton>
            {canUndo && <TooltipButton className="btn-alt" disabled={running} onClick={undo}>Undo last apply (restore Notes &amp; Style Bible)</TooltipButton>}
          </div>
          {canUndo && <p className="hint">A backup of the previous Notes and Style Bible is saved, so one click restores them.</p>}
        </>
      )}
    </section>
  );
}
