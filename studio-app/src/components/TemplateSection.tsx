import type { Section } from "../types";
import { tplDef, LETTER_STROKES, CLAIM_WORDS, OTHER_DIRECTION } from "../../../netlify/lib/templates";

/** Editor for the words on a template page (planner, tracing). The page itself is drawn by code at export. */
export default function TemplateSection({ s, onChange, locked }: { s: Section; onChange: (p: Partial<Section>) => void; locked: boolean }) {
  const def = tplDef(s.tpl);
  if (!def) return null;
  const set = (k: string, v: string) => onChange({ data: { ...(s.data ?? {}), [k]: v } });
  const all = Object.values(s.data ?? {}).join(" ");
  const warns: string[] = [];
  if (s.tpl === "letter") {
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
      {def.fields.map((f) => (
        <label key={f.key} className="block text-xs text-muted">{f.label}
          <textarea className="field mt-1 min-h-14" rows={f.lines ?? 2} readOnly={locked} value={s.data?.[f.key] ?? ""} placeholder={f.hint} onChange={(e) => set(f.key, e.target.value)} />
        </label>
      ))}
      {warns.map((w) => <p key={w} className="text-xs text-accent">✗ {w}</p>)}
    </div>
  );
}
