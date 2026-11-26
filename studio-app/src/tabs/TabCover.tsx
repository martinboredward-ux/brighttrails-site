import { useEffect, useRef, useState } from "react";
import type { Book, CoverSettings } from "../types";
import { fetchImageBlob, uploadImage } from "../api";
import { blobToImage, compressImage } from "../imageTools";
import { useBlobUrl } from "../blobUrl";
import { download } from "../exportZip";
import { TooltipButton, Tip } from "../components/TooltipButton";
import { coverDefaults, renderEbookCover, renderWrapCanvas, renderWrapPdf, renderWrapPng, spineWidth, wrapGeometry } from "../utils/coverComposer";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
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

/** Tab 3 (Cover Studio): front art, title block, spine width and the two cover files. */
export default function TabCover({ book, update, commit, fail }: Props) {
  const s = coverDefaults(book);
  const set = (p: Partial<CoverSettings>) => update({ cover: { ...book.cover, ...s, ...p } });
  const [art, setArt] = useState<HTMLImageElement | null>(null);
  const [guides, setGuides] = useState(true);
  const [msg, setMsg] = useState("");
  const ebookRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLCanvasElement>(null);
  const geo = wrapGeometry(s, book.trim);
  const warn: string[] = [];
  if ((s.pageCount ?? 0) < 24) warn.push("KDP needs at least 24 pages for a paperback.");
  if ((s.pageCount ?? 0) % 2) warn.push("Use an even page count: the interior prints in sheets.");
  if ((s.pageCount ?? 0) <= 79) warn.push("KDP does not allow spine text on books with 79 pages or fewer, so the spine stays plain.");
  if (s.trim && s.trim !== book.trim) warn.push(`The book's trim size is ${book.trim.replace("x", " × ")} but this cover is ${s.trim.replace("x", " × ")}.`);

  // Load the chosen art.
  useEffect(() => {
    let live = true;
    setArt(null);
    if (!s.frontArtId) return;
    fetchImageBlob(s.frontArtId).then(blobToImage).then((img) => { if (live) setArt(img); }).catch(fail);
    return () => { live = false; };
  }, [s.frontArtId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw previews.
  useEffect(() => {
    const e = ebookRef.current, w = wrapRef.current;
    if (e) {
      renderEbookCover(s, art).then((b) => blobToImage(b)).then((img) => {
        e.width = 400; e.height = 640;
        e.getContext("2d")!.drawImage(img, 0, 0, 400, 640);
      }).catch(() => undefined);
    }
    if (w) {
      const c = renderWrapCanvas(s, book.trim, art, { guides });
      const scale = 900 / c.width;
      w.width = 900; w.height = Math.round(c.height * scale);
      w.getContext("2d")!.drawImage(c, 0, 0, w.width, w.height);
    }
  }, [JSON.stringify(s), art, guides, book.trim]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadArt = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setMsg("Please choose a PNG or JPG picture."); return; }
    try {
      const { blob } = await compressImage(f, 2400);
      const id = await uploadImage(book.id, blob);
      set({ frontArtId: id });
      setMsg("Uploaded. It is saved with this book.");
    } catch (e) { fail(e); }
  };

  const ebookPng = async () => { try { download(`${book.slug}-ebook-cover-1600x2560.png`, await renderEbookCover(s, art)); } catch (e) { fail(e); } };
  const wrapPng = async () => { try { download(`${book.slug}-paperback-wrap.png`, await renderWrapPng(s, book.trim, art)); } catch (e) { fail(e); } };
  const wrapPdf = () => { try { download(`${book.slug}-paperback-wrap.pdf`, renderWrapPdf(s, book.trim, art)); } catch (e) { fail(e); } };
  const sendToAplus = async () => {
    if (!book.kdp?.aPlusModules?.length) { setMsg("Make the KDP package first (tab 4), then send the cover to A+ Module 1."); return; }
    try {
      const id = await uploadImage(book.id, await renderEbookCover(s, art));
      const mods = book.kdp.aPlusModules.map((m, i) => (i === 0 ? { ...m, imageId: id } : m));
      await commit({ kdp: { ...book.kdp, aPlusModules: mods }, cover: { ...book.cover, ...s } });
      setMsg("Sent: A+ Module 1 now uses this cover.");
    } catch (e) { fail(e); }
  };

  const pictures = book.images.slice().reverse();
  const covers = (book.characters ?? []).filter((c) => c.kind === "cover");

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
            <select className="field" value={s.trim} onChange={(e) => set({ trim: e.target.value as "6x9" | "8.5x11" })}><option value="6x9">6 × 9 in</option><option value="8.5x11">8.5 × 11 in</option></select></div>
          <div><label className="label">Page count</label><input type="number" min={24} max={828} className="field" value={s.pageCount} onChange={(e) => set({ pageCount: Number(e.target.value) || 24 })} /></div>
          <div><label className="label">Paper</label>
            <select className="field" value={s.paper} onChange={(e) => set({ paper: e.target.value as CoverSettings["paper"] })}><option value="white">White paper, black ink</option><option value="cream">Cream paper</option><option value="color">Premium color</option></select></div>
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.barcodeCorner !== false} onChange={(e) => set({ barcodeCorner: e.target.checked })} /> Keep the barcode corner open</label></div>
          <div className="sm:col-span-2"><label className="label">Back cover blurb</label><textarea className="field min-h-28" value={s.backBlurb} onChange={(e) => set({ backBlurb: e.target.value })} placeholder="Paste your KDP description in plain text." /></div>
        </div>
        <div className="rounded-lg bg-sun/20 px-3 py-2 text-sm">
          Spine width: <b>{spineWidth(s.pageCount ?? 0, s.paper).toFixed(3)} in</b> · Full wrap: <b>{geo.totalW.toFixed(3)} × {geo.totalH.toFixed(3)} in</b> (includes 0.125 in bleed).
          {warn.map((w) => <p key={w} className="mt-1 text-accent">{w}</p>)}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Front cover art</h2>
        <p className="hint">Pick a picture from this book, or upload your own. Make cover art in tab 2 with the Cover style.</p>
        <Tip what="Uploads a PNG or JPG from your computer as the cover art." engine="$0 Free · Runs in your browser">
          <label className="btn-alt cursor-pointer">Upload cover art<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void uploadArt(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </Tip>
        {covers.length > 0 && (<><p className="label">Cover styles in your Library</p><ul className="flex flex-wrap gap-2">{covers.map((c) => <Thumb key={c.id} id={c.id} on={s.frontArtId === c.id} onPick={() => set({ frontArtId: c.id })} />)}</ul></>)}
        <p className="label">This book&rsquo;s pictures</p>
        {pictures.length ? <ul className="flex max-h-60 flex-wrap gap-2 overflow-auto">{pictures.map((i) => <Thumb key={i.id} id={i.id} on={s.frontArtId === i.id} onPick={() => set({ frontArtId: i.id })} />)}</ul> : <p className="hint">No pictures yet.</p>}
        {msg && <p className="text-sm font-semibold text-forest">{msg}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">eBook front cover (1600 × 2560)</h2>
        <canvas ref={ebookRef} className="max-h-[32rem] w-auto rounded-lg border border-line" aria-label="eBook cover preview" />
        <div className="flex flex-wrap gap-2">
          <TooltipButton className="btn" onClick={ebookPng}>Download eBook cover PNG</TooltipButton>
          <TooltipButton className="btn-alt" onClick={sendToAplus}>Send Cover to A+ Module 1</TooltipButton>
        </div>
      </section>

      <section className="card space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-forest">Paperback full wrap</h2>
          <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show bleed and safe-zone guides (preview only)</label>
        </div>
        <canvas ref={wrapRef} className="w-full max-w-4xl rounded-lg border border-line" aria-label="Paperback wrap preview" />
        <p className="hint">Red = trim edge, blue = safe zone, orange = spine folds. The guides are not in the downloaded files. Check the file in KDP&rsquo;s cover previewer before you order a proof.</p>
        <div className="flex flex-wrap gap-2">
          <TooltipButton className="btn" onClick={wrapPng}>Download wrap PNG</TooltipButton>
          <TooltipButton className="btn-alt" onClick={wrapPdf}>Download wrap PDF</TooltipButton>
        </div>
      </section>
    </div>
  );
}
