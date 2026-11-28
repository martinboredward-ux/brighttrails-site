import type { Book } from "../types";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";
import type { Action } from "../types";

interface Props { book: Book; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; run: (a: Action) => Promise<void> }

const MARK = "--- MARKET POSITIONING ---";

export default function ResearchPanel({ book, update, commit, run }: Props) {
  const running = book.jobStatus === "running";
  const applied = book.notes.includes(MARK);
  const apply = () => {
    const base = book.notes.split(MARK)[0].trimEnd();
    void commit({ notes: `${base}\n\n${MARK}\n${book.research.trim()}\n`.trimStart() });
  };
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Steps 2-3 · Market research &amp; positioning</h2>
      <p className="hint">Gemini reads your title, audience, notes and series and writes a niche analysis: target buyer, positioning angle, market fit, 5 must-include features and keyword gaps. It has no live Amazon data, so check the competing books yourself before you commit.</p>
      <div className="flex flex-wrap gap-2">
        <TooltipButton className="btn" disabled={running} onClick={() => run("market_research")}>Run Market Research</TooltipButton>
        <TooltipButton className="btn-alt" disabled={!book.research.trim() || running} onClick={apply}>{applied ? "Update in Notes & KDP" : "Apply to Notes & KDP"}</TooltipButton>
      </div>
      <JobStatus book={book} only={["market_research"]} />
      {book.research.trim() && (
        <textarea className="field min-h-56" value={book.research} readOnly={running} onChange={(e) => update({ research: e.target.value })} aria-label="Market research" />
      )}
      {applied && <p className="hint">Applied: the research is in Notes under “MARKET POSITIONING”, and the KDP package writer also reads it.</p>}
    </section>
  );
}
