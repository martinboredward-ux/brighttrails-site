import type { Book } from "../types";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";

const MARK = "--- MARKET POSITIONING ---";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
  run: (a: "market_research" | "fill_details") => void;
  locked: boolean;
}

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** The order to work Tab 1 in, with a tick for each step that looks done and a Notes box that comes first. */
export default function StepGuide({ book, update, run, locked }: Props) {
  const running = book.jobStatus === "running";
  const applied = book.notes.includes(MARK);
  const reviewDone = !!book.preReview.trim();
  const fixesApplied = book.lastApplied?.kind === "idea";
  const detailsDone = !!(book.title.trim() && book.subtitle?.trim() && book.audience?.trim() && book.styleBible.trim());
  const fill = book.studio?.detailsFill;
  const steps: { n: string; label: string; done: boolean; target: string }[] = [
    { n: "1", label: "Put your idea in Notes", done: book.notes.trim().length > 20, target: "step-notes" },
    { n: "2", label: "Run Market Research", done: !!book.research.trim(), target: "step-research" },
    { n: "3", label: "Apply to Notes & KDP", done: applied, target: "step-research" },
    { n: "4", label: "Fill title, subtitle, audience, type and Style Bible", done: detailsDone, target: "step-details" },
    { n: "5", label: "Run Idea, Market & Age-Fit Review", done: reviewDone, target: "step-review" },
    { n: "6", label: "Tick fixes and Apply them", done: fixesApplied, target: "step-review" },
  ];
  const next = steps.find((s) => !s.done);
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Tab 1 order: work down this list, then go to tab 2</h2>
      <ol className="grid gap-1 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.n}>
            <button type="button" onClick={() => go(s.target)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-forest/10 ${next?.n === s.n ? "bg-sun/30 font-semibold" : ""}`}>
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-forest text-white" : "border border-forest text-forest"}`}>{s.done ? "✓" : s.n}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>
      <p className="hint">{next ? `Next: step ${next.n}, ${next.label.toLowerCase()}.` : "All six steps look done. Go to tab 2 · Book Builder."} Ticks are a guide only; you can skip steps you do not need.</p>
      <div id="step-notes" className="scroll-mt-4">
        <label className="label">Step 1 · Notes (your idea, rough is fine)</label>
        <textarea className="field min-h-48" value={book.notes} readOnly={locked} onChange={(e) => update({ notes: e.target.value })}
          placeholder={"Type messy ideas here. Or write storyline choices like:\nOption A: ...\nOption B: ...\nThe review in step 5 compares them and recommends one."} />
      </div>
      <div id="step-details" className="scroll-mt-4 space-y-2 rounded-lg border border-line p-3">
        <h3 className="text-sm font-bold text-forest">Step 4 · Fill the details</h3>
        <p className="hint">Reads your Notes and the market research, then fills ONLY the empty boxes below: Subtitle, Audience (with age range) and the Style Bible. It never overwrites what you typed. A better title or Studio type is only suggested, never changed. A restore point is saved first. You can also type all of these yourself in Core inputs below.</p>
        <TooltipButton className="btn" disabled={running || !book.notes.trim()} onClick={() => run("fill_details")}>Suggest details &amp; Style Bible</TooltipButton>
        <JobStatus book={book} only={["fill_details"]} />
        {fill && (
          <div className="rounded bg-forest/5 px-3 py-2 text-sm">
            {fill.filled.length ? <p>Filled: {fill.filled.join(", ")}.</p> : <p>Nothing was empty, so nothing was filled.</p>}
            {fill.kept.length > 0 && <p>Kept what you wrote: {fill.kept.join(", ")}.</p>}
            {fill.ideas.map((t) => <p key={t}>{t} (not applied; change it in Core inputs if you like it).</p>)}
          </div>
        )}
      </div>
    </section>
  );
}
