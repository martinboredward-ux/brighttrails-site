import type { Action, Book } from "../types";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";

interface Props { book: Book; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; run: (a: Action) => Promise<void> }

/** Optional: review the drafted sections, then apply the fixes you accept. Undo restores the originals. */
export default function PolishPanel({ book, update, commit, run }: Props) {
  const running = book.jobStatus === "running";
  const drafted = book.sections.filter((s) => s.draft.trim()).length;
  const canUndo = !!book.previousSectionsBackup;
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Post-draft polish (optional)</h2>
      <p className="hint">Runs on your drafted sections. Review first, then apply the fixes you accept. Only sections the fixes affect change, and a backup lets you undo. {drafted} of {book.sections.length} sections drafted.</p>
      <div className="flex flex-wrap gap-2">
        <TooltipButton className="btn" disabled={running || !drafted} onClick={() => run("review_book")}>Review manuscript</TooltipButton>
      </div>
      <JobStatus book={book} only={["review_book", "apply_polish"]} />
      {book.review.trim() && (
        <>
          <textarea className="field min-h-56 font-mono" value={book.review} readOnly={running} onChange={(e) => update({ review: e.target.value })} aria-label="Developmental review" />
          <div>
            <label className="label" htmlFor="pd">Fixes to apply / skip (optional)</label>
            <textarea id="pd" className="field min-h-20" value={book.polishDirection} readOnly={running} onChange={(e) => update({ polishDirection: e.target.value })} placeholder="e.g. Apply fixes 1, 3 and 5. Skip 2. Keep the ending as it is." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipButton className="btn" disabled={running || !drafted} onClick={() => run("apply_polish")}>Apply Polish to drafted sections</TooltipButton>
            {canUndo && <TooltipButton className="btn-alt" disabled={running} onClick={() => commit({ sections: book.previousSectionsBackup ?? book.sections, previousSectionsBackup: null })}>Undo polish (restore sections)</TooltipButton>}
          </div>
        </>
      )}
      {book.workbook && (<><h3 className="text-sm font-bold text-forest">Companion workbook</h3><textarea className="field min-h-48 font-mono" value={book.workbook} onChange={(e) => update({ workbook: e.target.value })} /></>)}
    </section>
  );
}
