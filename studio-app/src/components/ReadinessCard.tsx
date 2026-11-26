import type { Book } from "../types";
import { readiness } from "../utils/readiness";
import { TooltipButton } from "./TooltipButton";

interface Props { book: Book; commit: (p: Partial<Book>) => Promise<void>; compact?: boolean }

/** Live status pills for the four gates, plus the Stamp Final Approval button (full size, tab 5). */
export default function ReadinessCard({ book, commit, compact }: Props) {
  const { pills, allOk } = readiness(book);
  const stamped = !!book.approvedAt;
  const pillEls = pills.map((p) => (
    <span key={p.key} title={p.ok ? "Done" : p.why} className={`rounded-full px-3 py-1 text-xs font-bold ${p.ok ? "bg-green/20 text-green" : "bg-accent/10 text-accent"}`}>{p.ok ? "✓" : "○"} {p.label}</span>
  ));
  if (compact) return <div className="flex flex-wrap items-center gap-1.5">{stamped && <span className="rounded-full bg-green px-3 py-1 text-xs font-extrabold text-white">APPROVED FOR KDP</span>}{pillEls}</div>;
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Publish readiness</h2>
      <div className="flex flex-wrap gap-1.5">{pillEls}</div>
      {!allOk && <ul className="list-disc pl-5 text-sm text-muted">{pills.filter((p) => !p.ok).map((p) => <li key={p.key}><b>{p.label}:</b> {p.why}</li>)}</ul>}
      {stamped ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-green px-4 py-2 text-sm font-extrabold tracking-wide text-white">APPROVED FOR KDP</span>
          <span className="text-sm text-muted">Stamped {new Date(book.approvedAt).toLocaleString()}. An approval-certificate.txt goes into the .ZIP bundle.</span>
          <TooltipButton className="btn-alt" onClick={() => void commit({ approvedAt: "" })}>Remove stamp</TooltipButton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <TooltipButton className="btn" disabled={!allOk} onClick={() => void commit({ approvedAt: new Date().toISOString() })}>Stamp Final Approval</TooltipButton>
          {!allOk && <span className="text-sm text-muted">All four checks must be green first.</span>}
        </div>
      )}
    </section>
  );
}
