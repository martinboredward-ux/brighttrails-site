import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Book, CoverSettings, GeneratedImage, PaperType } from "../types";
import { checkCover, fetchImageBlob, uploadImage, type CoverCheck } from "../api";
import { blobToImage, compressImage } from "../imageTools";
import { useBlobUrl } from "../blobUrl";
import { download } from "../exportZip";
import ImageEngine from "../components/ImageEngine";
import CoverIdeas from "../components/CoverIdeas";
import { TooltipButton, Tip } from "../components/TooltipButton";
import { TRIMS, trimAspect, trimDims, type Trim } from "../utils/trims";
import { PAPER_LABEL, coverApproved, coverDefaults, coverSig, renderCheckJpeg, renderEbookCanvas, renderEbookCover, renderPrintFront, renderPrintFrontCanvas, renderWrapCanvas, renderWrapPdf, renderWrapPng, spineWidth, wrapGeometry } from "../utils/coverComposer";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
  setBook: Dispatch<SetStateAction<Book | null>>;
  fail: (e: unknown) => void;
}

function Thumb({ id, on, onPick }: { id: string; on: boolean; onPick: () => void }) {
  const { url } = useBlobUrl(id);
  return (
    <li>
      <TooltipButton type="button" tip="Uses this picture as the front cover art." engine="$0 Free · Runs in your browser" onClick={onPick}
        className={`grid h-24 w-20 place-items-center overflow-hidden rounded-lg border-2 bg-white ${on ? "border-sun" : "border-line"}`}>
        {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted">…</span>}
      </TooltipButton>
    </li>
  );
}

function drawTo(canvas: HTMLCanvasElement | null, src: HTMLCanvasElement, width: number) {
  if (!canvas) return;
  const k = width / src.width;
  canvas.width = width; canvas.height = Math.round(src.height * k);
  canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
}

/** Tab 3 (Cover Studio): art, framing and contrast controls, the three cover files, an AI quality check and approval. */
/** KDP descriptions are HTML; the back cover needs plain paragraphs. Keeps list items as short lines. */
function htmlToPlain(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|div)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function TabCover({ book, update, commit, setBook, fail }: Props) {
  const s = coverDefaults(book);
  const set = (p: Partial<CoverSettings>) => update({ cover: { ...book.cover, ...s, ...p } });
  const [art, setArt] = useState<HTMLImageElement | null>(null);
  const [backArt, setBackArt] = useState<HTMLImageElement | null>(null);
  const [guides, setGuides] = useState(true);
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CoverCheck | null>(null);
  const printRef = useRef<HTMLCanvasElement>(null);
  const ebookRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLCanvasElement>(null);
  const geo = wrapGeometry(s, book.trim);
  const dims = trimDims(s.trim ?? book.trim);
  const approved = coverApproved(s);
  const warn: string[] = [];
  if ((s.pageCount ?? 0) < 24) warn.push("KDP needs at least 24 pages for a paperback.");
  if ((s.pageCount ?? 0) % 2) warn.push("Use an even page count: the interior prints in sheets.");
  if ((s.pageCount ?? 0) <= 79) warn.push("KDP does not allow spine text on books with 79 pages or fewer, so the spine stays plain.");
  if (s.trim && s.trim !== book.trim) warn.push(`The book's trim size (tab 1) is ${book.trim.replace("x", " × ")} but this cover is ${s.trim.replace("x", " × ")}. They must match.`);

  useEffect(() => {
    let live = true;
    setArt(null);
    if (!s.frontArtId) return;
    fetchImageBlob(s.frontArtId).then(blobToImage).then((img) => { if (live) setArt(img); }).catch(fail);
    return () => { live = false; };
  }, [s.frontArtId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setBackArt(null);
    if (!s.backArtId) return;
    fetchImageBlob(s.backArtId).then(blobToImage).then((img) => { if (live) setBackArt(img); }).catch(fail);
    return () => { live = false; };
  }, [s.backArtId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    drawTo(printRef.current, renderPrintFrontCanvas(s, book.trim, art), 420);
    drawTo(ebookRef.current, renderEbookCanvas(s, art), 360);
    drawTo(wrapRef.current, renderWrapCanvas(s, book.trim, art, { guides, backArt }), 900);
  }, [JSON.stringify(s), art, backArt, guides, book.trim]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadArt = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setMsg("Please choose a PNG or JPG picture."); return; }
    try {
      const { blob } = await compressImage(f, 2400);
      set({ frontArtId: await uploadImage(book.id, blob) });
      setMsg("Uploaded. It is saved with this book.");
    } catch (e) { fail(e); }
  };
  const addImage = (img: GeneratedImage) => {
    setBook((b) => (b ? { ...b, images: [...b.images.filter((i) => i.id !== img.id), img] } : b));
    set({ frontArtId: img.id });
  };

  const run = (fn: () => Promise<void> | void) => async () => { try { await fn(); } catch (e) { fail(e); } };
  const printPng = run(async () => download(`${book.slug}-print-front-${Math.round(dims.w * 300)}x${Math.round(dims.h * 300)}.png`, await renderPrintFront(s, book.trim, art)));
  const ebookPng = run(async () => download(`${book.slug}-ebook-cover-1600x2560.png`, await renderEbookCover(s, art)));
  const wrapPng = run(async () => download(`${book.slug}-paperback-wrap.png`, await renderWrapPng(s, book.trim, art, backArt)));
  const wrapPdf = run(() => download(`${book.slug}-paperback-wrap.pdf`, renderWrapPdf(s, book.trim, art, backArt)));
  const sendToAplus = run(async () => {
    if (!book.kdp?.aPlusModules?.length) { setMsg("Make the KDP package first (tab 4), then send the cover to A+ Module 1."); return; }
    const id = await uploadImage(book.id, await renderEbookCover(s, art));
    const mods = book.kdp.aPlusModules.map((m, i) => (i === 0 ? { ...m, imageId: id } : m));
    await commit({ kdp: { ...book.kdp, aPlusModules: mods }, cover: { ...book.cover, ...s } });
    setMsg("Sent: A+ Module 1 now uses this cover.");
  });

  const quality = async () => {
    setChecking(true); setResult(null);
    try {
      const imageBase64 = await renderCheckJpeg(s, book.trim, art);
      const r = await checkCover({ imageBase64, title: s.title, subtitle: s.subtitle, author: s.author, trim: s.trim, paper: s.paper, pageCount: s.pageCount, aiDisclosure: book.aiDisclosure, audience: book.audience, layout: { topSky: s.topSky, fit: s.fit, shift: s.shift, titlePlacement: s.titlePlacement, scrim: s.scrim, textEffect: s.textEffect } });
      setResult(r);
      await commit({ cover: { ...book.cover, ...s, checkNotes: r.summary, checkedAt: new Date().toISOString() } });
    } catch (e) { fail(e); } finally { setChecking(false); }
  };
  const approve = () => void commit({ cover: { ...book.cover, ...s, approvedSig: coverSig(s), approvedAt: new Date().toISOString() } });
  const unapprove = () => void commit({ cover: { ...book.cover, ...s, approvedSig: undefined, approvedAt: undefined } });

  const pictures = book.images.slice().reverse();
  const covers = (book.characters ?? []).filter((c) => c.kind === "cover");
  const Seg = <T extends string>({ value, opts, onPick, label }: { value: T; opts: [T, string][]; onPick: (v: T) => void; label: string }) => (
    <div><label className="label">{label}</label>
      <div className="flex flex-wrap gap-1">{opts.map(([v, t]) => (
        <TooltipButton key={v} type="button" onClick={() => onPick(v)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${value === v ? "border-sun bg-sun text-onsun" : "border-line hover:bg-forest/10"}`}>{t}</TooltipButton>
      ))}</div></div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Cover details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Title</label><input className="field" value={s.title} onChange={(e) => set({ title: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Subtitle</label><input className="field" value={s.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></div>
          <div><label className="label">Author name</label><input className="field" value={s.author} onChange={(e) => set({ author: e.target.value })} placeholder="Mary Jane Baga Martimbor" /></div>
          <div><label className="label">Series pill</label><input className="field" value={s.seriesPill} onChange={(e) => set({ seriesPill: e.target.value })} placeholder="HAPPY TRAILS COLLECTION · AGES 6–9" /></div>
          <div><label className="label">Trim size</label>
            <select className="field" value={s.trim} onChange={(e) => set({ trim: e.target.value as Trim })}>{TRIMS.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.use})</option>)}</select></div>
          <div><label className="label">Page count</label><input type="number" min={24} max={828} className="field" value={s.pageCount} onChange={(e) => set({ pageCount: Number(e.target.value) || 24 })} /><p className="hint">Type the real page count of your finished interior PDF. The starting number is only a guess, and it sets the spine width.</p></div>
          <div><label className="label">Interior paper</label>
            <select className="field" value={s.paper} onChange={(e) => set({ paper: e.target.value as PaperType })}>
              {(["standardColor", "premiumColor", "white", "cream"] as PaperType[]).map((p) => <option key={p} value={p}>{PAPER_LABEL[p]}</option>)}
            </select></div>
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.barcodeCorner !== false} onChange={(e) => set({ barcodeCorner: e.target.checked })} /> Keep the barcode corner open</label></div>
          <div className="sm:col-span-2 space-y-1">
            <label className="label">Back cover picture (optional, faint behind the blurb)</label>
            <div className="flex flex-wrap items-center gap-2">
              <select className="field !w-auto" value={s.backArtId ?? ""} onChange={(e) => set({ backArtId: e.target.value || undefined })}>
                <option value="">None (plain cream)</option>
                {pictures.map((i, n) => <option key={i.id} value={i.id}>Picture {n + 1}{i.id === s.frontArtId ? " (front cover)" : ""}</option>)}
              </select>
              {s.backArtId && <label className="flex items-center gap-2 text-sm">Strength {s.backArtStrength ?? 12}%<input type="range" min={3} max={20} value={s.backArtStrength ?? 12} onChange={(e) => set({ backArtStrength: Number(e.target.value) })} /></label>}
            </div>
            <p className="hint">Keep it faint (3-20%) so the blurb stays readable. The barcode box stays solid white.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Back cover blurb</label>
            <textarea className="field min-h-24" value={s.backBlurb} onChange={(e) => set({ backBlurb: e.target.value })} placeholder="Type or paste your back-cover text in plain text." />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-alt" disabled={!book.kdp?.htmlDescription?.trim()} onClick={() => {
                if (s.backBlurb?.trim() && !confirm("Replace the current blurb with your KDP description?")) return;
                set({ backBlurb: htmlToPlain(book.kdp?.htmlDescription ?? "") });
              }}>Fill from my KDP description (tab 4)</button>
              {!book.kdp?.htmlDescription?.trim() && <span className="hint">Make the KDP package in tab 4 first, or type the blurb here.</span>}
              {!s.backBlurb?.trim() && <span className="text-sm text-red-700">The back cover is empty. Studio does not write this for you automatically.</span>}
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-sun/20 px-3 py-2 text-sm">
          Spine width: <b>{spineWidth(s.pageCount ?? 0, s.paper).toFixed(3)} in</b> · Print front: <b>{Math.round(dims.w * 300)} × {Math.round(dims.h * 300)} px</b> · Full wrap: <b>{geo.totalW.toFixed(3)} × {geo.totalH.toFixed(3)} in</b> (0.125 in bleed).
          {warn.map((w) => <p key={w} className="mt-1 text-accent">{w}</p>)}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Framing &amp; contrast</h2>
        <Seg label="Picture" value={s.fit ?? "fill"} onPick={(v) => set({ fit: v })} opts={[["fill", "Fill (crop)"], ["fit", "Fit (with color pad)"]]} />
        {s.fit === "fit" && <div><label className="label">Pad color (sky)</label><input type="color" className="h-9 w-16 rounded border border-line" value={s.padColor} onChange={(e) => set({ padColor: e.target.value })} /></div>}
        <Seg label="Vertical image shift" value={s.shift ?? "center"} onPick={(v) => set({ shift: v })} opts={[["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]]} />
        <Seg label="Title placement" value={s.titlePlacement ?? "top"} onPick={(v) => set({ titlePlacement: v })} opts={[["top", "Top"], ["bottom", "Bottom"], ["split", "Split"]]} />
        {(s.titlePlacement ?? "top") !== "bottom" && <Seg label="Extra Top Sky Space (Shift Art Down)" value={s.topSky ?? "off"} onPick={(v) => set({ topSky: v })} opts={[["off", "Off"], ["20", "20%"], ["30", "30%"]]} />}
        <Seg label="Scrim behind text (never over the middle)" value={s.scrim ?? "softLight"} onPick={(v) => set({ scrim: v })} opts={[["none", "None"], ["softDark", "Soft Dark"], ["softLight", "Soft Light"], ["pill", "Banner Pill"]]} />
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="label">Text color</label><input type="color" className="h-9 w-16 rounded border border-line" value={s.textColor} onChange={(e) => set({ textColor: e.target.value })} /></div>
          <Seg label="Text effect" value={s.textEffect ?? "none"} onPick={(v) => set({ textEffect: v })} opts={[["none", "None"], ["shadow", "Shadow"], ["outline", "Outline"]]} />
        </div>
        <p className="hint">Wide art is cropped to the cover shape. If the sides of your picture are cut off, choose Fit with a sky color, or move the picture up or down with the shift buttons. The author name always sits at the bottom.</p>
      </section>

      <section className="card space-y-3 lg:col-span-2">
        <h2 className="text-base font-bold text-forest">Front cover art</h2>
        <p className="hint">Pick a picture from this book, upload your own, or make cover-safe art below. It leaves the top 30% as open sky for the title and keeps faces in the middle.</p>
        <CoverIdeas book={book} s={s} aspect={trimAspect(s.trim ?? book.trim)} set={set} commit={commit} fail={fail} />
        <Tip what="Uploads a PNG or JPG from your computer as the cover art." engine="$0 Free · Runs in your browser">
          <label className="btn-alt cursor-pointer">Upload cover art<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void uploadArt(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </Tip>
        {covers.length > 0 && (<><p className="label">Cover styles in your Library</p><ul className="flex flex-wrap gap-2">{covers.map((c) => <Thumb key={c.id} id={c.id} on={s.frontArtId === c.id} onPick={() => set({ frontArtId: c.id })} />)}</ul></>)}
        <p className="label">This book&rsquo;s pictures</p>
        {pictures.length ? <ul className="flex max-h-60 flex-wrap gap-2 overflow-auto">{pictures.map((i) => <Thumb key={i.id} id={i.id} on={s.frontArtId === i.id} onPick={() => set({ frontArtId: i.id })} />)}</ul> : <p className="hint">No pictures yet.</p>}
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-bold text-forest">Make cover-safe art with AI</summary>
          <div className="mt-3">
            <ImageEngine book={book} defaultPreset="cover" defaultAspect={trimAspect(s.trim ?? book.trim)} initialPrompt={`Cover scene for "${s.title}": the main characters happy and large in the middle of the picture, open sky above.`} onDone={addImage} fail={fail} commit={commit} />
          </div>
        </details>
        {msg && <p className="text-sm font-semibold text-forest">{msg}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Print front cover</h2>
        <canvas ref={printRef} className="max-h-[30rem] w-auto rounded-lg border border-line" aria-label="Print front cover preview" />
        <TooltipButton className="btn" onClick={printPng}>Download print front PNG ({Math.round(dims.w * 300)}×{Math.round(dims.h * 300)})</TooltipButton>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Kindle eBook cover (1600 × 2560)</h2>
        <canvas ref={ebookRef} className="max-h-[30rem] w-auto rounded-lg border border-line" aria-label="eBook cover preview" />
        <div className="flex flex-wrap gap-2">
          <TooltipButton className="btn" onClick={ebookPng}>Download eBook cover PNG</TooltipButton>
          <TooltipButton className="btn-alt" onClick={sendToAplus}>Send Cover to A+ Module 1</TooltipButton>
        </div>
      </section>

      <section className="card space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-forest">Paperback full wrap (back + spine + front)</h2>
          <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show bleed and safe-zone guides (preview only)</label>
        </div>
        <canvas ref={wrapRef} className="w-full max-w-4xl rounded-lg border border-line" aria-label="Paperback wrap preview" />
        <p className="hint">Red = trim edge, blue = safe zone, orange = spine folds. The guides are not in the downloaded files. Check the file in KDP&rsquo;s cover previewer before you order a proof.</p>
        <div className="flex flex-wrap gap-2">
          <TooltipButton className="btn" onClick={wrapPng}>Download wrap PNG</TooltipButton>
          <TooltipButton className="btn-alt" onClick={wrapPdf}>Download wrap PDF</TooltipButton>
        </div>
      </section>

      <section className="card space-y-3 lg:col-span-2">
        <h2 className="text-base font-bold text-forest">Cover quality check</h2>
        <p className="hint">Gemini looks at the rendered front cover and checks title and author spelling, text readability, whether text covers a face, and KDP trim and AI-disclosure basics. Costs a small Gemini call. Mark the cover approved when you are happy.</p>
        <div className="flex flex-wrap items-center gap-2">
          <TooltipButton className="btn" disabled={checking} onClick={quality}>{checking ? "Checking…" : "Check Cover Quality"}</TooltipButton>
          {approved
            ? <><span className="rounded-full bg-green/20 px-3 py-1 text-sm font-bold text-green">Cover Approved ✓</span><TooltipButton className="btn-alt" onClick={unapprove}>Remove approval</TooltipButton></>
            : <TooltipButton className="btn-alt" onClick={approve}>Mark Cover Approved ✓</TooltipButton>}
        </div>
        {s.approvedSig && !approved && <p className="text-sm text-accent">You changed the cover after approving it, so it needs approving again.</p>}
        {result && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <p className={`text-sm font-bold ${result.ok ? "text-green" : "text-accent"}`}>{result.ok ? "All checks passed." : "Needs a look."} <span className="font-normal">{result.summary}</span></p>
            <ul className="space-y-1 text-sm">{result.checks.map((c) => <li key={c.name}><b className={c.pass ? "text-green" : "text-accent"}>{c.pass ? "✓" : "✗"} {c.name}:</b> {c.note}</li>)}</ul>
          </div>
        )}
        {!result && s.checkNotes && <p className="text-xs text-muted">Last check ({s.checkedAt ? new Date(s.checkedAt).toLocaleString() : ""}): {s.checkNotes}</p>}
      </section>
    </div>
  );
}
