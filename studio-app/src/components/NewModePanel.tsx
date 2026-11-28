import type { Action, Book, Section } from "../types";
import { PLANNER_PACK, letterPack, type PackItem } from "../../../netlify/lib/templates";
import { TooltipButton } from "./TooltipButton";
import JobStatus from "./JobStatus";
import { pathCheck, fiftyWordCheck } from "../utils/gamebook";
import { MATTER_STARTERS, matterOf, type Matter } from "../utils/matter";
import { meta } from "../utils/studioMeta";

const toSections = (pack: PackItem[]): Section[] => pack.map((p, i) => ({ id: `s${Date.now().toString(36)}${i}`, title: p.title, summary: p.summary ?? "", draft: "", kind: p.kind, tpl: p.tpl, data: p.data }));

interface Props { book: Book; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; run: (a: Action) => Promise<void> }

const MATTER_LABEL: Record<keyof Matter, string> = { dedication: "Dedication", howTo: "How to use this book", about: "About the author", alsoBy: "Also by / more books", review: "Review request" };

/** Planner, tracing and gamebook helpers: template packs, AI words, gamebook path checker and the front/back matter pages. */
export default function NewModePanel({ book, update, commit, run }: Props) {
  const running = book.jobStatus === "running";
  const mode = book.mode;
  const m = matterOf(book);
  const setMatter = (k: keyof Matter, v: string) => update({ studio: { ...meta(book), matter: { ...m, [k]: v } } as Book["studio"] });
  const gb = mode === "gamebook" ? [...pathCheck(book), ...fiftyWordCheck(book)] : [];
  const add = (pack: PackItem[]) => update({ sections: [...book.sections, ...toSections(pack)] });
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">{mode === "planner" ? "Planner tools" : mode === "tracing" ? "Letter-spread tools" : "Gamebook tools"}</h2>
      {mode === "planner" && (
        <>
          <p className="hint">A full-color planner: Studio draws the pages (prompts, checklists, thermometer, funnel, sprints, weekly sheet, KPI table, collage canvas, cut-out quote boxes). AI writes only the words. Cut-out sheets are picture pages with a blank back. Remember: KDP prints every page in color for a color interior (see the calculator in Tab 6).</p>
          <div className="flex flex-wrap gap-2">
            <TooltipButton className="btn" disabled={running} onClick={() => add(PLANNER_PACK)}>Insert the full 2027 planner pack ({PLANNER_PACK.length} pages)</TooltipButton>
            <TooltipButton className="btn-alt" disabled={running} tip="For pictures you made in ChatGPT that are already finished pages. Each page with a picture is printed as that picture alone, full page, with no heading or notes. Cut-out sheets and template pages are left alone." engine="$0 Free · Runs in your browser" onClick={() => {
              const hit = book.sections.filter((x) => !x.kind && book.images.some((im) => im.sectionId === x.id));
              if (!hit.length) { alert("No written page has a picture yet."); return; }
              if (!confirm(`Make ${hit.length} page(s) full-page picture pages? Their written notes stay saved but will not print.`)) return;
              update({ sections: book.sections.map((x) => (hit.includes(x) ? { ...x, kind: "picture" as const } : x)) });
            }}>Make every page that has a picture a full-page picture</TooltipButton>
            <TooltipButton className="btn-alt" disabled={running} onClick={() => add(PLANNER_PACK.filter((p) => p.kind === "cutout" || p.tpl === "quotes"))}>Insert cut-out sheets only</TooltipButton>
            <TooltipButton className="btn-alt" disabled={running} onClick={() => update({ sections: [...book.sections, { id: `s${Date.now().toString(36)}`, title: "Cut-out sheet", summary: "Full-color single-sided cut-out sheet.", draft: "", kind: "cutout" }] })}>+ one cut-out sheet</TooltipButton>
          </div>
        </>
      )}
      {mode === "tracing" && (
        <>
          <p className="hint">One two-page spread per letter. Page A: story cue, big letter with numbered 3-4pt stroke paths and arrows, Dash pose picture, parent prompt. Page B: exactly 3 practice lines and a target box. Upload a Dash pose as the page picture of each letter section. 0.75 in margins are built in.</p>
          <TooltipButton className="btn" disabled={running} onClick={() => add(letterPack())}>Insert letters A-Z (26 spreads)</TooltipButton>
        </>
      )}
      {mode === "gamebook" && (
        <>
          <p className="hint">Write choices as [GO: page-id] (the id is shown next to each page title). At export Studio prints the real page numbers. A page whose title says Victory, or that contains [END], is an ending. Detour pages get a caution-tape border.</p>
          <div className="space-y-1 text-sm">
            <p className="label">Path &amp; rules check</p>
            {gb.length ? <ul className="space-y-1">{gb.map((f, i) => <li key={i} className={f.level === "fix" ? "text-accent" : "text-muted"}>{f.level === "fix" ? "✗" : "○"} <b>{f.where}:</b> {f.text}</li>)}</ul> : <p className="text-green">✓ Every page can be reached and every reader can finish.</p>}
          </div>
        </>
      )}
      {mode !== "gamebook" && book.sections.some((s) => s.tpl) && (
        <div className="flex flex-wrap items-center gap-2">
          <TooltipButton className="btn" disabled={running} onClick={() => void run("fill_template")}>Fill the words with AI (empty pages only)</TooltipButton>
          <span className="hint">A restore point is saved first. Edit any page's words afterwards.</span>
        </div>
      )}
      <JobStatus book={book} only={["fill_template"]} />

      <details className="rounded-lg border border-line p-2">
        <summary className="cursor-pointer text-sm font-semibold text-forest">Front &amp; back matter pages (all book types)</summary>
        <div className="mt-2 space-y-2">
          {(Object.keys(MATTER_LABEL) as (keyof Matter)[]).map((k) => (
            <label key={k} className="block text-xs text-muted">{MATTER_LABEL[k]}
              <textarea className="field mt-1 min-h-14" value={m[k]} onChange={(e) => setMatter(k, e.target.value)} placeholder={MATTER_STARTERS[k]} />
              {!m[k] && <button type="button" className="underline" onClick={() => setMatter(k, MATTER_STARTERS[k])}>Use the starter text</button>}
            </label>
          ))}
          <p className="hint">Filled pages are added to the printable book: dedication and how-to after the copyright page; about, also-by and review request at the end. Leave a box empty to skip that page.</p>
          <TooltipButton className="btn-alt" onClick={() => void commit({ studio: book.studio })}>Save</TooltipButton>
        </div>
      </details>
    </section>
  );
}
