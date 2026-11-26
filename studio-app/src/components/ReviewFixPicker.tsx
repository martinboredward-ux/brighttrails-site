import { useState } from "react";
import type { AppliedLog, ReviewFix } from "../types";
import { TooltipButton } from "./TooltipButton";

export interface CompareItem { label: string; before: string; after: string }

interface Props {
  fixes: ReviewFix[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  extra: string;
  onExtra: (t: string) => void;
  extraPlaceholder: string;
  busy: boolean;
  onApply: () => void;
  applyingLabel?: string;
  applied: AppliedLog | null;
  compare: CompareItem[];
  canUndo: boolean;
  onUndo: () => void;
  targetLabel?: (t: ReviewFix["target"]) => string;
}

const TARGET: Record<ReviewFix["target"], string> = { notes: "Notes", styleBible: "Style Bible", sections: "Sections" };

/** Shared by both reviews: pick fixes, apply only those, see the change log, compare before/after, undo. */
export default function ReviewFixPicker({ fixes, selected, onSelect, extra, onExtra, extraPlaceholder, busy, onApply, applied, compare, canUndo, onUndo }: Props) {
  const [showCompare, setShowCompare] = useState(false);
  const sel = new Set(selected);
  const toggle = (id: string) => onSelect(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const count = fixes.filter((f) => sel.has(f.id)).length;
  const canApply = !busy && (count > 0 || extra.trim().length > 0);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-forest">Do you want to apply any of these fixes?</h3>
      {fixes.length === 0 ? (
        <p className="hint">The review found no separate fixes. You can still type extra instructions below.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <TooltipButton type="button" className="btn-alt" disabled={busy} onClick={() => onSelect(fixes.map((f) => f.id))}>Select All</TooltipButton>
            <TooltipButton type="button" className="btn-alt" disabled={busy} onClick={() => onSelect([])}>Clear All</TooltipButton>
          </div>
          <ul className="space-y-2">
            {fixes.map((f) => (
              <li key={f.id}>
                <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${sel.has(f.id) ? "border-sun bg-sun/15" : "border-line"}`}>
                  <input type="checkbox" className="mt-1" checked={sel.has(f.id)} disabled={busy} onChange={() => toggle(f.id)} />
                  <span>
                    <span className="font-semibold">{f.title}</span> <span className="rounded bg-forest/10 px-1.5 text-[11px] text-muted">{TARGET[f.target]}</span>
                    {f.detail && <span className="block text-muted">{f.detail}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <div>
        <label className="label">Extra instructions (optional)</label>
        <textarea className="field min-h-20" value={extra} readOnly={busy} onChange={(e) => onExtra(e.target.value)} placeholder={extraPlaceholder} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TooltipButton className="btn" disabled={!canApply} onClick={onApply}>Apply Selected Fixes ({count} of {fixes.length})</TooltipButton>
        {canUndo && <TooltipButton className="btn-alt" disabled={busy} onClick={onUndo}>Undo</TooltipButton>}
      </div>
      {applied && (
        <div className="space-y-2 rounded-lg border border-green/50 bg-green/10 p-3" role="status">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-green">Last Applied Changes</h4>
            <span className="text-xs text-muted">{new Date(applied.at).toLocaleString()}</span>
            <div className="ml-auto flex gap-2">
              {compare.length > 0 && <TooltipButton type="button" className="btn-alt" onClick={() => setShowCompare((v) => !v)}>{showCompare ? "Hide Before / After" : "Compare Before / After"}</TooltipButton>}
              {canUndo && <TooltipButton type="button" className="btn-alt" disabled={busy} onClick={onUndo}>Undo</TooltipButton>}
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">{applied.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          {showCompare && (
            <div className="space-y-3">
              {compare.map((c) => (
                <div key={c.label}>
                  <p className="text-xs font-bold text-forest">{c.label}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div><p className="text-[11px] font-semibold text-muted">Before</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-line bg-surface p-2 text-xs">{c.before || "(empty)"}</pre></div>
                    <div><p className="text-[11px] font-semibold text-muted">After</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-green/50 bg-surface p-2 text-xs">{c.after || "(empty)"}</pre></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
