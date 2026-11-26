import type { Action, Book } from "../types";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";
import ReviewFixPicker, { type CompareItem } from "./ReviewFixPicker";

interface Props { book: Book; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; run: (a: Action) => Promise<void> }

/** Review #2: Pre-Cover Proofread & Formatting QA. Runs after drafting and pictures, just before the Cover Studio. */
export default function PolishPanel({ book, update, commit, run }: Props) {
  const running = book.jobStatus === "running";
  const drafted = book.sections.filter((s) => s.draft.trim()).length;
  const backup = book.previousSectionsBackup;
  const applied = book.lastApplied?.kind === "qa" ? book.lastApplied : null;
  const compare: CompareItem[] = [];
  if (applied && backup) {
    book.sections.forEach((s, i) => {
      const old = backup.find((b) => b.id === s.id);
      if (old && old.draft !== s.draft) compare.push({ label: `Section ${i + 1}: ${s.title}`, before: old.draft, after: s.draft });
    });
  }
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Review #2: Pre-Cover Proofread &amp; Formatting QA</h2>
      <p className="hint">Run this after drafting and pictures, just before the Cover Studio. It checks only spelling, grammar and typos, Tagalog and special-term consistency, broken [ brackets or missing tags, Answer Key vs Worksheet accuracy, missing section artwork, and reading level. A toddler Storybook should have no Word Bank drills. {drafted} of {book.sections.length} sections drafted.</p>
      <div className="flex flex-wrap gap-2">
        <TooltipButton className="btn" disabled={running || !drafted} onClick={() => run("review_book")}>Run Proofread &amp; Formatting QA</TooltipButton>
      </div>
      <JobStatus book={book} only={["review_book", "apply_polish"]} />
      {book.review.trim() && (
        <>
          <textarea className="field min-h-56 font-mono" value={book.review} readOnly aria-label="Proofread and formatting QA" />
          <ReviewFixPicker
            fixes={book.reviewFixes ?? []}
            selected={book.reviewSelected ?? []}
            onSelect={(ids) => update({ reviewSelected: ids })}
            extra={book.polishDirection}
            onExtra={(t) => update({ polishDirection: t })}
            extraPlaceholder="e.g. Also change every 'Mama' to 'Nanay'. Do not touch section 4."
            busy={running}
            onApply={() => run("apply_polish")}
            applied={applied}
            compare={compare}
            canUndo={!!backup}
            onUndo={() => void commit({ sections: backup ?? book.sections, previousSectionsBackup: null, lastApplied: null })}
          />
        </>
      )}
      {book.workbook && (<><h3 className="text-sm font-bold text-forest">Companion workbook</h3><textarea className="field min-h-48 font-mono" value={book.workbook} onChange={(e) => update({ workbook: e.target.value })} /></>)}
    </section>
  );
}
