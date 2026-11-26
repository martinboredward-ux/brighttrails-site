import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Action, Book, GeneratedImage } from "../types";
import { startJob } from "../api";
import { PATTERNS, buildActivityPdf, type ImagePage, type Pattern } from "../activityPdf";
import { fetchImageBlob } from "../api";
import { blobToImage } from "../imageTools";
import { buildPrintableBook, parseTagged } from "../printableBook";
import { defaultScenePrompt } from "../imagePrompts";
import { CLEAN_RULES, TAG_FORMAT, isTaggedMode } from "../draftFormat";
import ImageEngine from "../components/ImageEngine";
import ImageGallery from "../components/ImageGallery";
import { download, type ExportAssets } from "../exportZip";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
  save: () => Promise<Book | null>;
  setBook: Dispatch<SetStateAction<Book | null>>;
  assets: RefObject<ExportAssets>;
  fail: (e: unknown) => void;
}

const LABEL: Record<string, string> = {
  generate_outline: "Generating outline (Gemini)",
  draft_section: "Drafting section (Claude)",
  draft_all: "Drafting all sections (Claude)",
  review_book: "Reviewing manuscript (Gemini)",
  extract_workbook: "Extracting workbook (Claude)",
};

export default function Tab2Builder({ book, update, commit, save, setBook, assets, fail }: Props) {
  const [model, setModel] = useState<"haiku" | "sonnet">("haiku");
  const [pattern, setPattern] = useState<Pattern>("dotted");
  const [pages, setPages] = useState(26);
  const [blank, setBlank] = useState(true);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfMsg, setPdfMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const running = book.jobStatus === "running";
  const [pdfPick, setPdfPick] = useState<Set<string>>(new Set());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [backing, setBacking] = useState(false);
  const makeHtml = async () => {
    setHtmlBusy(true);
    try {
      const html = await buildPrintableBook(book, { backingPages: backing });
      download(`${book.slug}-printable-book.html`, new Blob([html], { type: "text/html" }));
    } catch (e) { fail(e); } finally { setHtmlBusy(false); }
  };

  // New pictures arrive from the server (already saved there), so they are added without marking the book unsaved.
  const addImage = (img: GeneratedImage) => {
    setBook((b) => (b ? { ...b, images: [...b.images.filter((i) => i.id !== img.id), img] } : b));
    if (img.stylePreset === "coloring") setPdfPick((s) => new Set(s).add(img.id));
  };
  const removeImage = (id: string) => {
    setBook((b) => (b ? { ...b, images: b.images.filter((i) => i.id !== id), characterRefId: b.characterRefId === id ? "" : b.characterRefId } : b));
    setPdfPick((s) => { const n = new Set(s); n.delete(id); return n; });
  };
  const togglePick = (id: string) => setPdfPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = async (action: Action, sectionId?: string, onlyEmpty?: boolean) => {
    const saved = await save();
    if (!saved) return;
    try {
      setBook((b) => (b ? { ...b, jobStatus: "running", jobAction: action, jobError: "" } : b));
      await startJob({ bookId: book.id, action, sectionId, model, onlyEmpty });
    } catch (e) {
      setBook((b) => (b ? { ...b, jobStatus: "error", jobError: e instanceof Error ? e.message : "Could not start" } : b));
      fail(e);
    }
  };

  const tagged = isTaggedMode(book.mode);
  const untagged = book.sections.filter((s) => s.draft.trim() && !parseTagged(s.draft)).length;
  const empty = book.sections.filter((s) => !s.draft.trim()).length;
  const draftAll = () => {
    if (!book.sections.length) return;
    let onlyEmpty = true;
    if (empty === 0 || untagged > 0 || book.sections.some((s) => s.draft.trim())) {
      if (empty === book.sections.length) onlyEmpty = true;
      else {
        const redo = confirm(`${book.sections.length - empty} section${book.sections.length - empty === 1 ? " already has" : "s already have"} a draft${untagged ? ` (${untagged} in the older format that the printable book cannot fill in)` : ""}.\n\nOK = redraft ALL sections now (replaces existing drafts).\nCancel = only draft the ${empty} empty section${empty === 1 ? "" : "s"}.`);
        onlyEmpty = !redo;
        if (onlyEmpty && empty === 0) return;
      }
    }
    void run("draft_all", undefined, onlyEmpty);
  };
  const manuscript = book.sections.map((s) => `## ${s.title}\n${s.draft || s.summary}`).join("\n\n");
  const hybridPrompt = (kind: "outline" | "section" | "review", s?: { title: string; summary: string }) => {
    const head = `Book: ${book.title}${book.subtitle ? `: ${book.subtitle}` : ""}\nMode: ${book.mode}\nAudience: ${book.audience}\nTrim size: ${book.trim}\nNotes: ${book.notes}\n\nStyle Bible:\n${book.styleBible || "(none yet)"}\n`;
    if (kind === "outline") return `${head}\nCreate a style bible (200-400 words) and 8-16 sections with 1-3 sentence summaries for this book. Return Markdown.`;
    if (kind === "review") return `${head}\nManuscript:\n${manuscript}\n\nGive a developmental review: what works, structure and pacing, continuity, audience fit, and a prioritized fix list (max 10).`;
    return `${head}\nWrite the content for this section, keeping to the style bible.\nSection: ${s?.title}\nSummary: ${s?.summary}${tagged ? `\n\n${TAG_FORMAT}\n\n${CLEAN_RULES}` : ""}`;
  };
  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1500); } catch { /* clipboard blocked */ }
  };

  const makePdf = async () => {
    setPdfBusy(true);
    try {
      const chosen = book.images.filter((i) => pdfPick.has(i.id));
      if (pattern === "images" && !chosen.length) { setPdfMsg("Tick at least one picture under Book images first."); return; }
      const imagePages: ImagePage[] = [];
      for (const img of chosen) {
        const blob = await fetchImageBlob(img.id);
        const el = await blobToImage(blob);
        const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Could not read a picture")); r.readAsDataURL(blob); });
        imagePages.push({ dataUrl, format: blob.type === "image/jpeg" ? "JPEG" : "PNG", w: el.naturalWidth, h: el.naturalHeight });
      }
      const blob = buildActivityPdf({ pattern, pages, blankReverse: blank, title: pdfTitle }, imagePages);
      assets.current.pdf = blob;
      const patternPages = pattern === "images" ? 0 : pages;
      const total = (patternPages + imagePages.length) * (blank ? 2 : 1);
      setPdfMsg(`Built ${patternPages + imagePages.length} activity page${patternPages + imagePages.length === 1 ? "" : "s"}${imagePages.length ? ` (${imagePages.length} from your pictures)` : ""}${blank ? `, ${total} pages with blank reverses` : ""}.`);
      download(`${book.slug}-${pattern}-interior.pdf`, blob);
    } catch (e) { fail(e); } finally { setPdfBusy(false); }
  };

  const setSection = (id: string, patch: Partial<Book["sections"][number]>) =>
    update({ sections: book.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-forest">AI Builder</h2>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Claude model
            <select className="field !w-auto" value={model} onChange={(e) => setModel(e.target.value as "haiku" | "sonnet")}>
              <option value="haiku">Haiku 5.5 (lowest cost)</option>
              <option value="sonnet">Sonnet 5.5 (better writing)</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">Outline and review use Gemini Flash. Section drafts and workbook extraction use the Claude model you pick. These run on Netlify AI Gateway and use Netlify credits. The “copy prompt” buttons cost nothing: paste into your Claude or Gemini web chat.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={running} onClick={() => run("generate_outline")}>Generate outline + style bible</button>
          <button className="btn" disabled={running || !book.sections.length} onClick={draftAll}>Draft all sections</button>
          <button className="btn" disabled={running || !book.sections.length} onClick={() => run("review_book")}>Review manuscript</button>
          {book.mode === "nonfiction" && <button className="btn" disabled={running || !book.sections.length} onClick={() => run("extract_workbook")}>Extract companion workbook</button>}
          <button className="btn-alt" onClick={() => copy("outline", hybridPrompt("outline"))}>{copied === "outline" ? "Copied" : "$0 copy outline prompt"}</button>
          <button className="btn-alt" disabled={!book.sections.length} onClick={() => copy("review", hybridPrompt("review"))}>{copied === "review" ? "Copied" : "$0 copy review prompt"}</button>
        </div>
        {running && <p className="rounded-lg bg-sun/30 px-3 py-2 text-sm font-semibold text-forest">{book.jobAction.startsWith("draft_all:") ? `${LABEL.draft_all}, section ${book.jobAction.split(":")[1]}` : (LABEL[book.jobAction] ?? "Working")}… checking every 3 seconds. You can leave this page open.</p>}
        {book.jobStatus === "error" && <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">Job failed: {book.jobError}</p>}
        {book.jobStatus === "done" && <p className="text-xs text-green">Last job finished: {LABEL[book.jobAction.split(":")[0]]?.split(" (")[0] ?? book.jobAction}.</p>}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-forest">Sections ({book.sections.length})</h2>
          <button className="btn-alt" disabled={running} onClick={() => update({ sections: [...book.sections, { id: `s${Date.now().toString(36)}`, title: "New section", summary: "", draft: "" }] })}>+ Add section</button>
        </div>
        {!book.sections.length && <p className="text-sm text-muted">No sections yet. Generate an outline or add sections by hand.</p>}
        <ul className="space-y-2">
          {book.sections.map((s, i) => (
            <li key={s.id} className="rounded-lg border border-line">
              <div className="flex flex-wrap items-center gap-2 p-2">
                <button className="flex-1 text-left text-sm font-semibold" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {i + 1}. {s.title} {s.draft ? <span className="text-xs font-normal text-green">· drafted</span> : null}
                </button>
                <button className="btn-alt !px-3 !py-1" disabled={running} onClick={() => run("draft_section", s.id)}>Draft</button>
                <button className="btn-alt !px-3 !py-1" onClick={() => copy(s.id, hybridPrompt("section", s))}>{copied === s.id ? "Copied" : "$0 prompt"}</button>
                <button className="text-xs text-accent underline" disabled={running} onClick={() => update({ sections: book.sections.filter((x) => x.id !== s.id) })}>Remove</button>
              </div>
              {open === s.id && (
                <div className="space-y-2 border-t border-line p-3">
                  <input className="field" value={s.title} readOnly={running} onChange={(e) => setSection(s.id, { title: e.target.value })} />
                  <textarea className="field min-h-16" value={s.summary} readOnly={running} onChange={(e) => setSection(s.id, { summary: e.target.value })} placeholder="Summary" />
                  <textarea className="field min-h-48 font-mono" value={s.draft} readOnly={running} onChange={(e) => setSection(s.id, { draft: e.target.value })} placeholder="Draft spec (paste from your web chat or let the Draft button write it)" />
                  <h3 className="pt-1 text-sm font-bold text-forest">Pictures for this section</h3>
                  <ImageEngine key={`${s.id}:${defaultScenePrompt(s)}`} book={book} sectionId={s.id} initialPrompt={defaultScenePrompt(s)} defaultAspect={book.mode === "activity" ? "portrait" : "landscape"} defaultPreset={book.mode === "activity" ? "coloring" : "storybook"} onDone={addImage} fail={fail} commit={commit} />
                  <ImageGallery book={book} images={book.images.filter((i) => i.sectionId === s.id)} selected={pdfPick} onToggle={togglePick} onCharacter={(id) => void commit({ characterRefId: id })} onRemoved={removeImage} fail={fail} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(book.review || book.workbook) && (
        <section className="card space-y-3">
          {book.review && (<><h2 className="text-base font-bold text-forest">Developmental review</h2><textarea className="field min-h-48 font-mono" value={book.review} onChange={(e) => update({ review: e.target.value })} /></>)}
          {book.workbook && (<><h2 className="text-base font-bold text-forest">Companion workbook</h2><textarea className="field min-h-48 font-mono" value={book.workbook} onChange={(e) => update({ workbook: e.target.value })} /></>)}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Book images ({book.images.length})</h2>
        <p className="hint">Every picture you generate is kept here, saved separately from the book text. Pick a character reference for Nano Banana, tick pictures for the PDF, or download them.</p>
        <ImageGallery book={book} images={book.images} selected={pdfPick} onToggle={togglePick} onCharacter={(id) => void commit({ characterRefId: id })} onRemoved={removeImage} fail={fail} />
      </section>

      {(book.mode === "activity" || book.mode === "storybook") && (
        <section className="card space-y-3">
          <h2 className="text-base font-bold text-forest">Printable book (8.5 × 11 in HTML)</h2>
          <p className="hint">Turns your drafted sections and their pictures into a title page, then a story page and an activity page for each section. {book.sections.length ? `${book.sections.length} section${book.sections.length === 1 ? "" : "s"} ready.` : "Add sections first."}</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={backing} onChange={(e) => setBacking(e.target.checked)} /> Insert a blank backing page after every page (stops marker bleed-through)</label>
          {(untagged > 0 || empty > 0) && <p className="rounded-lg bg-sun/30 px-3 py-2 text-sm text-forest">{empty > 0 ? `${empty} section${empty === 1 ? " has" : "s have"} no draft yet. ` : ""}{untagged > 0 ? `${untagged} section${untagged === 1 ? " is" : "s are"} in the older draft format, so some boxes would print empty. ` : ""}Use “Draft all sections” above to fill them in.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn" onClick={makeHtml} disabled={htmlBusy || !book.sections.length}>{htmlBusy ? "Building…" : "Export Printable Book (.HTML)"}</button>
            <span className="hint">Open the downloaded HTML in Chrome/Edge and press Ctrl+P → Save as PDF (Margins: None, Size: Letter) for a print-ready KDP interior!</span>
          </div>
        </section>
      )}

      {book.mode === "activity" && (
        <section className="card space-y-3">
          <h2 className="text-base font-bold text-forest">Vector Activity PDF generator <span className="text-xs font-normal text-green">· runs in your browser, $0</span></h2>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="label">Page type</label>
              <select className="field" value={pattern} onChange={(e) => setPattern(e.target.value as Pattern)}>
                {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">{PATTERNS.find((p) => p.id === pattern)?.note}</p>
            </div>
            <div>
              <label className="label">Activity pages</label>
              <input type="number" min={1} max={200} className="field" value={pages} onChange={(e) => setPages(Number(e.target.value) || 1)} />
            </div>
            <div>
              <label className="label">Heading (optional)</label>
              <input className="field" value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={blank} onChange={(e) => setBlank(e.target.checked)} />
            Insert a blank reverse page after every activity page (stops marker bleed-through)
          </label>
          <div className="flex items-center gap-3">
            <button className="btn" onClick={makePdf} disabled={pdfBusy}>{pdfBusy ? "Building…" : "Build 8.5 × 11 in PDF"}</button>
            {pdfMsg && <span className="text-xs text-green">{pdfMsg} Included in the ZIP export.</span>}
          </div>
          <p className="text-xs text-muted">KDP needs at least 24 pages, an even page count works best, and the interior must be 8.5 × 11 in without bleed. Add your own cover and run KDP’s previewer before ordering a proof.</p>
        </section>
      )}
    </div>
  );
}
