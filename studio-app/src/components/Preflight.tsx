import { useEffect, useState } from "react";
import type { Book, Section } from "../types";
import { createBook, getSettings, type Reserved } from "../api";
import { reservedFor } from "../utils/reserved";
import { BOOK_TYPES, INTERIOR_LABEL, KDP_REMINDERS, bookType, isLargeTrim, printCost, seasonPlan } from "../utils/studioMeta";
import { PLANNER_PACK, letterPack, type PackItem } from "../../../netlify/lib/templates";
import { TooltipButton } from "./TooltipButton";

const toSections = (pack: PackItem[]): Section[] => pack.map((p, i) => ({ id: `s${Date.now().toString(36)}${i}`, title: p.title, summary: p.summary ?? "", draft: "", kind: p.kind, tpl: p.tpl, data: p.data }));

/** New-book preflight: pick the kind of book and Studio sets up the trim, bible starter, cost warning, asset list and checks. */
export default function Preflight({ onCreated, onCancel, fail }: { onCreated: (b: Book) => void; onCancel: () => void; fail: (e: unknown) => void }) {
  const [typeId, setTypeId] = useState("activity");
  const [title, setTitle] = useState("");
  const [series, setSeries] = useState("");
  const [lead, setLead] = useState("");
  const [animal, setAnimal] = useState("");
  const [target, setTarget] = useState("");
  const [reserved, setReserved] = useState<Reserved | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getSettings().then((s) => setReserved(s.reserved)).catch(() => undefined); }, []);
  const t = bookType(typeId)!;
  const large = isLargeTrim(t.trim);
  const lo = printCost(t.interior, t.pages[0], large), hi = printCost(t.interior, t.pages[1], large);
  const f = reserved ? reservedFor(reserved, { title, seriesName: series, slug: "" }) : { names: [], animals: [] };
  const hitName = lead.trim() && f.names.find((n) => n.name.toLowerCase() === lead.trim().toLowerCase());
  const hitAnimal = animal.trim() && f.animals.find((a) => animal.toLowerCase().includes(a.name.toLowerCase()));
  const plan = seasonPlan(target);
  const amazon = [title && `"${title}"`, title && `"${title}" book`, t.label.split(" (")[0] + " " + new Date().getFullYear() + 1].filter(Boolean) as string[];

  const create = async () => {
    setBusy(true);
    try {
      const sections = typeId === "planner" || typeId === "cutout" ? toSections(PLANNER_PACK.filter((p) => typeId === "planner" || p.kind === "cutout" || p.tpl === "quotes")) : typeId === "tracing" ? toSections(letterPack()) : [];
      const b = await createBook({
        title: title.trim() || "New book", mode: t.mode, trim: t.trim, aiDisclosure: t.ai, seriesName: series.trim(), sections,
        styleBible: t.bible.replace("<name and species, outfit>", [lead, animal].filter(Boolean).join(", ") || "<name and species, outfit>"),
        notes: [lead && `Lead character: ${lead}${animal ? ` (${animal})` : ""}`, `Book type: ${t.label}`].filter(Boolean).join("\n"),
        studio: { bookType: typeId, targetDate: target },
      });
      onCreated(b);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-3"><h2 className="text-base font-bold text-forest">New book preflight</h2><TooltipButton className="ml-auto text-xs underline" onClick={onCancel}>Cancel</TooltipButton></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {BOOK_TYPES.map((b) => (
          <label key={b.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${typeId === b.id ? "border-sun bg-sun/15" : "border-line"}`}>
            <input type="radio" name="btype" checked={typeId === b.id} onChange={() => setTypeId(b.id)} className="mt-1" /><span><b>{b.label}</b><br /><span className="text-xs text-muted">{b.trim} · {INTERIOR_LABEL[b.interior]} · {b.pages[0]}-{b.pages[1]} pages</span></span>
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className="label">Working title</label><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label">Series (optional)</label><input className="field" value={series} onChange={(e) => setSeries(e.target.value)} /></div>
        <div><label className="label">Lead character name</label><input className="field" value={lead} onChange={(e) => setLead(e.target.value)} /></div>
        <div><label className="label">Lead animal (if any)</label><input className="field" value={animal} onChange={(e) => setAnimal(e.target.value)} /></div>
        <div><label className="label">Must be live by (optional)</label><input type="date" className="field" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
      </div>
      {hitName && <p className="rounded border border-accent/40 bg-accent/10 p-2 text-sm text-accent">“{hitName.name}” is reserved{hitName.owner ? ` for the ${hitName.owner} book` : ""}. Pick another name.</p>}
      {hitAnimal && <p className="rounded border border-accent/40 bg-accent/10 p-2 text-sm text-accent">A {hitAnimal.name} already leads another Bright Trails book. Pick a different lead animal (allowed: {reserved?.allowed.join(", ") || "none listed"}).</p>}
      <div className="space-y-1 rounded-lg border border-line p-3 text-sm">
        <p><b>Setup for this type:</b> {t.mode} mode, trim {t.trim}, AI disclosure “{t.ai}”.</p>
        <p><b>Print cost:</b> {INTERIOR_LABEL[t.interior]} ({large ? "large" : "regular"} trim): {lo === null ? "n/a" : `$${lo.toFixed(2)}`} at {t.pages[0]} pages to {hi === null ? "n/a" : `$${hi.toFixed(2)}`} at {t.pages[1]} pages. Minimum list price is that divided by 0.6.</p>
        <p className="text-muted">{t.notes}</p>
        <p><b>Make these pictures outside first:</b> {t.assets.join(", ")}.</p>
        <p><b>Search Amazon for:</b> {amazon.join(" · ")}</p>
        {plan && <p className={plan.late ? "text-accent" : ""}><b>Countdown:</b> {plan.daysLeft} days left; start building by {plan.startBy}{plan.late ? " (already late)" : ""}.</p>}
        <ul className="list-disc pl-5 text-xs text-muted">{KDP_REMINDERS.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <TooltipButton className="btn" disabled={busy || !!hitName || !!hitAnimal} onClick={create}>{busy ? "Creating…" : "Create the book"}</TooltipButton>
    </section>
  );
}
