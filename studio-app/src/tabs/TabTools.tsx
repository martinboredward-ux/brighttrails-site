import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Book } from "../types";
import { createBook } from "../api";
import { useRunJob } from "../hooks/useRunJob";
import JobStatus from "../components/JobStatus";
import { TooltipButton } from "../components/TooltipButton";
import { download } from "../exportZip";
import { scanBanned } from "../banned";
import { defaultScenePrompt, wrapPrompt } from "../imagePrompts";
import { findCandidates } from "../utils/assetDetector";
import { pagePicture } from "../utils/checks";
import { DEFAULT_LEAD, INTERIOR_LABEL, KDP_COST_NOTE, KDP_REMINDERS, LAUNCH_STEPS, addFlag, bookType, flagsText, isLargeTrim, launchProgress, meta, minPrice, printCost, removeFlag, restoreSnapshot, royalty, seasonPlan, setFlagDone, withSnapshot, type InteriorType } from "../utils/studioMeta";
import { CLAIM_WORDS } from "../../../netlify/lib/templates";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
  save: () => Promise<Book | null>;
  setBook: Dispatch<SetStateAction<Book | null>>;
  fail: (e: unknown) => void;
  onNewBook: (b: Book) => void;
}

const copy = (t: string) => void navigator.clipboard?.writeText(t);

function Flags({ book, commit }: Pick<Props, "book" | "commit">) {
  const [note, setNote] = useState("");
  const flags = meta(book).flags ?? [];
  const text = flagsText(book);
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Flagged for Claude ({flags.filter((f) => !f.done).length} open)</h2>
      <p className="hint">Use “Flag for Claude” on any section in Tab 2, or add a note here. Copy the list into a Claude session and we work through it together.</p>
      <div className="flex gap-2"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note about the whole book" /><TooltipButton className="btn-alt" disabled={!note.trim()} onClick={() => { void commit({ studio: addFlag(book, undefined, "Whole book", note) }); setNote(""); }}>Add</TooltipButton></div>
      <ul className="space-y-1 text-sm">
        {flags.map((f) => (
          <li key={f.id} className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={!!f.done} onChange={(e) => void commit({ studio: setFlagDone(book, f.id, e.target.checked) })} />
            <span className={f.done ? "line-through opacity-60" : ""}><b>{f.where}:</b> {f.note}</span>
            <button type="button" className="ml-auto text-xs text-accent underline" onClick={() => void commit({ studio: removeFlag(book, f.id) })}>Remove</button></li>
        ))}
      </ul>
      {text && <TooltipButton className="btn" onClick={() => copy(text)}>Copy the open list for Claude</TooltipButton>}
    </section>
  );
}

function Snapshots({ book, commit }: Pick<Props, "book" | "commit">) {
  const snaps = (meta(book).snapshots ?? []).slice().reverse();
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Restore points</h2>
      <p className="hint">Studio saves one automatically before it applies fixes or redrafts text. Restoring keeps a restore point of the current text too, so nothing is lost.</p>
      <TooltipButton className="btn-alt" onClick={() => void commit({ studio: withSnapshot(book, "Saved by me") })}>Save a restore point now</TooltipButton>
      <ul className="space-y-1 text-sm">
        {snaps.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2"><span>{new Date(s.at).toLocaleString()} · {s.label} · {s.sections.length} sections</span>
            <TooltipButton className="btn-alt !px-2 !py-0.5 !text-xs" onClick={() => { if (confirm("Restore this version of the title, notes, style bible and sections?")) { const p = restoreSnapshot(book, s.id); if (p) void commit(p); } }}>Restore</TooltipButton></li>
        ))}
        {!snaps.length && <li className="text-muted">No restore points yet.</li>}
      </ul>
    </section>
  );
}

function OutsideReview({ book, commit, run }: Pick<Props, "book" | "commit"> & { run: ReturnType<typeof useRunJob> }) {
  const [text, setText] = useState(meta(book).outsideReview ?? "");
  const running = book.jobStatus === "running";
  const go = async () => { await commit({ studio: { ...meta(book), outsideReview: text } }); await run("import_review"); };
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Outside review box</h2>
      <p className="hint">Paste a reviewer's checklist (from Gemini, ChatGPT or a person). Studio turns it into separate fixes you can tick. They load into the “Review #2” fix list in Tab 2, where Apply works exactly as usual. A restore point is saved first.</p>
      <textarea className="field min-h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the reviewer's notes here" />
      <TooltipButton className="btn" disabled={running || !text.trim()} onClick={go}>Turn into fixes</TooltipButton>
      <JobStatus book={book} only={["import_review"]} />
      {book.reviewFixes?.length > 0 && <p className="text-sm text-green">{book.reviewFixes.length} fixes are ready in Tab 2 under Review #2.</p>}
    </section>
  );
}

function ArtPack({ book }: { book: Book }) {
  const build = () => {
    const preset = book.mode === "activity" ? "coloring" : "storybook";
    const lib = book.characters ?? [];
    const cands = findCandidates(book);
    const lines: string[] = [`ART PACK: ${book.title}`, `Make these pictures in ChatGPT or Nano Banana, name the files exactly as shown, then drop them into Bulk upload in Tab 2.`, "", "== STYLE (paste first, once) ==", book.styleBible.slice(0, 1500) || "(no style bible yet)", ""];
    lines.push("== LIBRARY FIRST (make these before the pages) ==");
    if (lib.length) lines.push(`Already in your Library: ${lib.map((c) => `${c.name} (${c.kind})`).join(", ")}`);
    cands.filter((c) => !lib.some((l) => l.name.toLowerCase() === c.name.toLowerCase())).forEach((c) => lines.push(`- ${c.name} (${c.kind}) ${c.detail ? "- " + c.detail : ""}`));
    lines.push("");
    lines.push("== PAGES ==");
    book.sections.forEach((s, i) => {
      if (s.kind === "template") return;
      const n = String(i + 1).padStart(2, "0");
      const have = pagePicture(book, s) ? " (already has a picture)" : "";
      const refs = lib.filter((c) => new RegExp(`\\b${c.name.split(" ")[0]}\\b`, "i").test(`${s.title} ${s.summary} ${s.draft}`)).map((c) => c.name);
      lines.push(`\n[${n}-${s.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "")}.png]${have}`);
      if (refs.length) lines.push(`Attach reference pictures: ${refs.join(", ")}`);
      lines.push(wrapPrompt(preset, defaultScenePrompt(s), book.styleBible));
    });
    download(`${book.slug}-art-pack.txt`, new Blob([lines.join("\n")], { type: "text/plain" }));
  };
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Art pack for pictures made outside Studio</h2>
      <p className="hint">One text file with the style, the Library items to make first, and every page prompt in order with the file name to save it as. Exact counts (like “exactly 3 traffic cones”) are already in the prompts. Free: no AI.</p>
      <TooltipButton className="btn" onClick={build}>Download art pack (.txt)</TooltipButton>
    </section>
  );
}

function TitlePanel({ book, update, commit, run }: Pick<Props, "book" | "update" | "commit"> & { run: ReturnType<typeof useRunJob> }) {
  const ti = meta(book).titleIdeas;
  const running = book.jobStatus === "running";
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Topic &amp; title help</h2>
      <p className="hint">Studio cannot browse Amazon. It suggests titles and gives you exact search phrases; you type them into Amazon and paste what you found.</p>
      <TooltipButton className="btn" disabled={running} onClick={() => void run("title_ideas")}>Suggest 10 titles</TooltipButton>
      <JobStatus book={book} only={["title_ideas"]} />
      {ti && (
        <>
          <ul className="space-y-1 text-sm">
            {ti.options.map((o, i) => (
              <li key={i} className="rounded border border-line p-2"><b>{o.title}</b>{o.subtitle ? `: ${o.subtitle}` : ""} <span className="text-xs text-muted">({(o.title + o.subtitle).length} chars)</span><br /><span className="text-muted">{o.why}</span>
                <br /><button type="button" className="underline" onClick={() => update({ title: o.title, subtitle: o.subtitle })}>Use this title</button></li>
            ))}
          </ul>
          <p className="label">Search these on Amazon first</p>
          <ul className="list-disc pl-5 text-sm">{ti.searches.map((q) => <li key={q}>{q} <button type="button" className="underline text-xs" onClick={() => copy(q)}>copy</button></li>)}</ul>
          <textarea className="field min-h-24" defaultValue={ti.results ?? ""} placeholder="Paste what you found: competing titles, how many, their rank and price" onBlur={(e) => void commit({ studio: { ...meta(book), titleIdeas: { ...ti, results: e.target.value } } })} />
        </>
      )}
    </section>
  );
}

function Originality({ book, run }: { book: Book; run: ReturnType<typeof useRunJob> }) {
  const code = useMemo(() => {
    const out: string[] = [];
    const sentences = new Map<string, number>();
    for (const s of book.sections) for (const x of s.draft.split(/(?<=[.!?])\s+/)) { const k = x.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim(); if (k.split(" ").length >= 7) sentences.set(k, (sentences.get(k) ?? 0) + 1); }
    const rep = [...sentences].filter(([, n]) => n > 2).slice(0, 5);
    if (rep.length) out.push(`${rep.length} long sentence(s) appear 3+ times (repetitive text), for example: "${rep[0][0].slice(0, 80)}…"`);
    const all = book.sections.map((s) => `${s.title} ${s.summary} ${s.draft}`).join(" ");
    const banned = scanBanned(`${book.title} ${book.subtitle} ${all}`);
    if (banned.length) out.push(`Risky or banned words: ${[...new Set(banned)].slice(0, 8).join(", ")}`);
    if (book.mode === "tracing" || /preschool|ages? 4/i.test(book.audience)) { const c = all.match(new RegExp(CLAIM_WORDS.source, "gi")); if (c) out.push(`Medical or therapy claim words found: ${[...new Set(c.map((x) => x.toLowerCase()))].join(", ")}. A preschool tracing book must not claim to treat or help any condition.`); }
    const brands = all.match(/\b(Disney|Marvel|Pokemon|Pokémon|Minecraft|Barbie|Hello Kitty|Mickey|Frozen|Bluey|Peppa|Harry Potter|Nike|Coca-Cola|Starbucks)\b/gi);
    if (brands) out.push(`Brand or character names to remove: ${[...new Set(brands)].join(", ")}`);
    return out;
  }, [book]);
  const ai = meta(book).originality;
  const running = book.jobStatus === "running";
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Quality &amp; originality check</h2>
      <p className="hint">No tool can prove a book is plagiarism-free. These checks flag risk: free code checks first, then an AI review that points at passages worth searching.</p>
      <ul className="space-y-1 text-sm">{code.length ? code.map((c) => <li key={c} className="text-accent">✗ {c}</li>) : <li className="text-green">✓ No repeated sentences, risky words or brand names found.</li>}</ul>
      <TooltipButton className="btn-alt" disabled={running} onClick={() => void run("originality_review")}>AI originality-risk review (uses a little credit)</TooltipButton>
      <JobStatus book={book} only={["originality_review"]} />
      {ai && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border border-line bg-surface p-2 text-xs">{ai}</pre>}
    </section>
  );
}

function Launch({ book, commit, onNewBook, fail }: Pick<Props, "book" | "commit" | "onNewBook" | "fail">) {
  const m = meta(book);
  const prog = launchProgress(book);
  const plan = seasonPlan(m.targetDate ?? "", DEFAULT_LEAD);
  const cover = (book.cover ?? {}) as { pageCount?: number };
  const [type, setType] = useState<InteriorType>(((bookType(m.bookType)?.interior) ?? "bw"));
  const [pages, setPages] = useState(cover.pageCount ?? 100);
  const [list, setList] = useState(m.listPrice ?? 12.99);
  const large = isLargeTrim(book.trim);
  const cost = printCost(type, pages, large);
  const nextBook = async () => {
    try {
      const b = await createBook({ title: "New book", mode: book.mode, trim: book.trim, audience: book.audience, seriesName: book.seriesName, styleBible: book.styleBible, nameplateLabel: book.nameplateLabel, aiDisclosure: book.aiDisclosure, linkedBookIds: [book.id] });
      onNewBook(b);
    } catch (e) { fail(e); }
  };
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Launch checklist ({prog.done} of {prog.total})</h2>
      <ul className="grid gap-1 sm:grid-cols-2 text-sm">
        {LAUNCH_STEPS.map((s) => <li key={s.key}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={!!m.launch?.[s.key]} onChange={(e) => void commit({ studio: { ...m, launch: { ...(m.launch ?? {}), [s.key]: e.target.checked } } })} /> {s.label}</label></li>)}
      </ul>

      <h3 className="text-sm font-bold text-forest">Season countdown</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm"><label>Must be live by <input type="date" className="field !w-auto" value={m.targetDate ?? ""} onChange={(e) => void commit({ studio: { ...m, targetDate: e.target.value } })} /></label>
        <span className="hint">e.g. Valentine's 2027-02-14 or planner season 2026-12-20</span></div>
      {plan && (
        <div className={`rounded-lg border p-3 text-sm ${plan.late ? "border-accent/50 bg-accent/10" : "border-green/50 bg-green/10"}`}>
          <p className="font-bold">{plan.daysLeft} days to go. {plan.late ? "Already behind the plan: shorten the proof step or the build." : `Start by ${plan.startBy} (${plan.daysToStart} days from now).`}</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Build the book by {plan.orderProof}, order the proof copy that day</li>
            <li>Proof arrives in the US about {plan.proofArrives}; your friend inspects it</li>
            <li>Approve and upload fixes by {plan.proofApproved}</li>
            <li>Submit to KDP by {plan.mustUpload} (review can take up to 72 hours)</li>
            <li>Live by {plan.live}</li>
          </ul>
          <p className="hint">Lead times: build {DEFAULT_LEAD.build} days, proof shipping {DEFAULT_LEAD.proofShip}, inspection {DEFAULT_LEAD.proofCheck}, fixes {DEFAULT_LEAD.fixes}, KDP review {DEFAULT_LEAD.review}. These are planning guesses.</p>
        </div>
      )}

      <h3 className="text-sm font-bold text-forest">Print cost &amp; royalty calculator</h3>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>Interior<select className="field" value={type} onChange={(e) => setType(e.target.value as InteriorType)}>{(Object.keys(INTERIOR_LABEL) as InteriorType[]).map((k) => <option key={k} value={k}>{INTERIOR_LABEL[k]}</option>)}</select></label>
        <label>Pages<input className="field !w-24" type="number" min={24} value={pages} onChange={(e) => setPages(Number(e.target.value))} /></label>
        <label>List price $<input className="field !w-24" type="number" step="0.01" value={list} onChange={(e) => { setList(Number(e.target.value)); }} onBlur={() => void commit({ studio: { ...m, listPrice: list } })} /></label>
      </div>
      {cost === null ? <p className="text-accent text-sm">KDP does not offer this interior at {pages} pages (standard color needs 72-600, premium color 24-40 or 42-828, black and white 24-828).</p> : (
        <div className="text-sm">
          <p>Trim {book.trim} counts as a <b>{large ? "large" : "regular"}</b> trim. Printing cost: <b>${cost.toFixed(2)}</b>. Royalty at ${list.toFixed(2)}: <b className={royalty(list, cost) < 1 ? "text-accent" : "text-green"}>${royalty(list, cost).toFixed(2)}</b> per sale (60% minus print cost).</p>
          <p>Lowest price KDP allows: ${(cost / 0.6).toFixed(2)}. Price for a $2.00 royalty: <b>${minPrice(cost, 2).toFixed(2)}</b>. For $3.00: ${minPrice(cost, 3).toFixed(2)}.</p>
          <table className="mt-1 text-xs"><tbody>{(Object.keys(INTERIOR_LABEL) as InteriorType[]).map((k) => { const c = printCost(k, pages, large); return <tr key={k}><td className="pr-3">{INTERIOR_LABEL[k]}</td><td>{c === null ? "not offered at this page count" : `$${c.toFixed(2)} print cost → $${minPrice(c, 2).toFixed(2)} for a $2 royalty`}</td></tr>; })}</tbody></table>
        </div>
      )}
      <p className="hint">{KDP_COST_NOTE} Check the official KDP calculator before you set the price.</p>

      <h3 className="text-sm font-bold text-forest">Series kit</h3>
      <p className="hint">Start the next book with this book's style bible, trim, series name, audience and link, so book 2 begins at 80%. (Library pictures stay in this book; the new book reads this one as series memory.)</p>
      <TooltipButton className="btn-alt" onClick={nextBook}>Start the next book in this series</TooltipButton>
      <ul className="list-disc pl-5 text-xs text-muted">{KDP_REMINDERS.map((r) => <li key={r}>{r}</li>)}</ul>
    </section>
  );
}

export default function TabTools({ book, update, commit, save, setBook, fail, onNewBook }: Props) {
  const run = useRunJob({ book, save, setBook, fail, commit });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Flags book={book} commit={commit} />
      <Snapshots book={book} commit={commit} />
      <OutsideReview book={book} commit={commit} run={run} />
      <ArtPack book={book} />
      <TitlePanel book={book} update={update} commit={commit} run={run} />
      <Originality book={book} run={run} />
      <div className="lg:col-span-2"><Launch book={book} commit={commit} onNewBook={onNewBook} fail={fail} /></div>
    </div>
  );
}
