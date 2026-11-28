import type { Section } from "../types";
import { tplDef, LETTER_STROKES, NUM_STROKES, WARMUPS, CLAIM_WORDS, OTHER_DIRECTION } from "../../../netlify/lib/templates";

/** Editor for the words on a template page (planner, tracing). The page itself is drawn by code at export. */
export default function TemplateSection({ s, onChange, locked, onFill }: { s: Section; onChange: (p: Partial<Section>) => void; locked: boolean; onFill?: () => void }) {
  const def = tplDef(s.tpl);
  if (!def) return null;
  const set = (k: string, v: string) => onChange({ data: { ...(s.data ?? {}), [k]: v } });
  const all = Object.values(s.data ?? {}).join(" ");
  const warns: string[] = [];
  if (s.tpl && ["letter", "number", "warmup", "name", "certificate"].includes(s.tpl)) {
    if (CLAIM_WORDS.test(all)) warns.push("Remove medical or therapy wording (preschool books must not make those claims).");
    if (OTHER_DIRECTION.test(all)) warns.push("Use only these direction phrases: Pull down, Slide right, Hop over, Loop around.");
    const parent = (s.data?.parent ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
    if (parent.length > 2) warns.push(`The parent prompt has ${parent.length} sentences; the limit is 2.`);
  }
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-bold text-forest">{def.label} <span className="font-normal text-muted">· the page is drawn by Studio; you only edit the words</span></p>
      {s.tpl === "letter" && (
        <label className="text-xs text-muted">Letter
          <select className="field mt-1 !w-24" value={s.data?.letter ?? "A"} disabled={locked} onChange={(e) => set("letter", e.target.value)}>
            {Object.keys(LETTER_STROKES).map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      )}
      {s.tpl === "number" && (
        <label className="text-xs text-muted">Number
          <select className="field mt-1 !w-24" value={s.data?.n ?? "1"} disabled={locked} onChange={(e) => set("n", e.target.value)}>
            {Object.keys(NUM_STROKES).map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      )}
      {s.tpl === "warmup" && (
        <label className="text-xs text-muted">Stroke
          <select className="field mt-1 !w-48" value={s.data?.move ?? "pull"} disabled={locked} onChange={(e) => set("move", e.target.value)}>
            {Object.entries(WARMUPS).map(([k, w]) => <option key={k} value={k}>{w.verb}</option>)}
          </select>
        </label>
      )}
      {def.fields.map((f) => (
        <label key={f.key} className="block text-xs text-muted">{f.label}
          <textarea className="field mt-1 min-h-14" rows={f.lines ?? 2} readOnly={locked} value={s.data?.[f.key] ?? ""} placeholder={f.hint} onChange={(e) => set(f.key, e.target.value)} />
        </label>
      ))}
      {onFill && (
        <button type="button" className="btn-alt !px-3 !py-1 text-xs" disabled={locked} onClick={() => { if (def.fields.some((f) => (s.data?.[f.key] ?? "").trim()) && !confirm("Replace the words on this page with new AI words?")) return; onFill(); }}>Fill this page with AI</button>
      )}
      {warns.map((w) => <p key={w} className="text-xs text-accent">✗ {w}</p>)}
    </div>
  );
}
