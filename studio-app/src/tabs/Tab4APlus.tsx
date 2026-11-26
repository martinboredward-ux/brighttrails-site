import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { APlusModule, Book, GeneratedImage, KdpPackage } from "../types";
import ImageEngine from "../components/ImageEngine";
import { scanBanned } from "../banned";
import { DEFAULT_OPTIONS, SPECS, canvasToPng, drawBanner, type Spec } from "../aplus";
import { download } from "../exportZip";
import { compressImage, blobToImage } from "../imageTools";
import { getImage, primeImage } from "../imageCache";
import { uploadImage } from "../api";
import { TooltipButton } from "../components/TooltipButton";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  setBook: Dispatch<SetStateAction<Book | null>>;
  fail: (e: unknown) => void;
}

function Module({ spec, mod, onChange, book, onGenerated, fail }: {
  spec: Spec; mod: APlusModule; onChange: (patch: Partial<APlusModule>) => void; book: Book; onGenerated: (img: GeneratedImage) => void; fail: (e: unknown) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fit = mod.fit ?? DEFAULT_OPTIONS.fit;
  const textBar = mod.textBar ?? DEFAULT_OPTIONS.textBar;
  const hits = scanBanned(`${mod.headline} ${mod.body}`);

  // Load the saved picture for this module, if there is one.
  useEffect(() => {
    let live = true;
    if (!mod.imageId) { setImg(null); return; }
    getImage(mod.imageId).then((i) => { if (live) setImg(i); }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : "Could not load the saved image"); });
    return () => { live = false; };
  }, [mod.imageId]);

  useEffect(() => {
    if (canvas.current) drawBanner(canvas.current, spec, mod.headline, mod.body, img, { fit, textBar });
  }, [spec, mod.headline, mod.body, img, fit, textBar]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const { blob, note } = await compressImage(f);
      const id = await uploadImage(book.id, blob);
      primeImage(id, await blobToImage(blob));
      onChange({ imageId: id });
      setMsg(`${f.name}: ${note}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  };

  const png = async () => {
    if (canvas.current) download(`${book.slug}-aplus-${spec.size}.png`, await canvasToPng(canvas.current));
  };

  const square = spec.size === "300x300";
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Module {spec.size}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label">Headline ({mod.headline.length}/60)</label>
            <input className="field" maxLength={60} value={mod.headline} onChange={(e) => onChange({ headline: e.target.value })} />
          </div>
          <div>
            <label className="label">Body ({mod.body.length}/200)</label>
            <textarea className="field min-h-24" maxLength={200} value={mod.body} onChange={(e) => onChange({ body: e.target.value })} />
          </div>
          {hits.length > 0 ? (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">Banned in Amazon A+ content: {hits.join(", ")}. Reword before uploading.</p>
          ) : (
            <p className="text-xs text-green">No banned A+ words found.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className={`btn ${busy ? "pointer-events-none opacity-50" : ""}`}>
              {busy ? "Uploading…" : "Upload Cover / Page Image"}
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {mod.imageId && <TooltipButton className="btn-alt" onClick={() => { onChange({ imageId: undefined }); setImg(null); setMsg(""); }}>Remove image</TooltipButton>}
          </div>
          {msg && <p className="hint">Shrunk in your browser before saving: {msg}</p>}
          {err && <p className="text-xs text-accent">{err}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <fieldset className="flex items-center gap-1 rounded-lg border border-line p-1 text-sm" aria-label="Image placement">
              {(["fit", "fill"] as const).map((m) => (
                <label key={m} className={`cursor-pointer rounded-md px-3 py-1 font-semibold ${fit === m ? "bg-sun text-onsun" : "text-muted"}`}>
                  <input type="radio" className="sr-only" name={`fit-${spec.size}`} checked={fit === m} onChange={() => onChange({ fit: m })} />
                  {m === "fit" ? "Fit" : "Fill"}
                </label>
              ))}
            </fieldset>
            {square && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={textBar} onChange={(e) => onChange({ textBar: e.target.checked })} />
                Show Text Bar
              </label>
            )}
          </div>
          <p className="hint">
            {fit === "fit" ? "Fit shows the whole picture with padding, so nothing is cut off." : "Fill covers the whole frame and may crop the edges."}
            {square && (img ? (textBar ? " The headline sits in a bar under the picture." : " Picture only; turn on Show Text Bar for a caption.") : " Upload a picture to switch this tile to picture-only.")}
          </p>
          <TooltipButton className="btn-alt" onClick={png}>Download {spec.size} PNG</TooltipButton>

          <details className="rounded-lg border border-line p-2">
            <summary className="cursor-pointer text-sm font-semibold text-forest">Generate this picture with AI</summary>
            <div className="mt-2 space-y-2">
              <ImageEngine book={book} initialPrompt="" defaultAspect={square ? "square" : "landscape"} defaultPreset="aplus"
                onDone={(i) => { onGenerated(i); onChange({ imageId: i.id }); }} fail={fail} />
              {book.images.length > 0 && (
                <label className="block text-xs text-muted">Or use a picture from Book images
                  <select className="field mt-1" value="" onChange={(e) => { if (e.target.value) onChange({ imageId: e.target.value }); }}>
                    <option value="">Choose…</option>
                    {book.images.map((i) => <option key={i.id} value={i.id}>{i.prompt.slice(0, 60)} · {i.modelUsed}</option>)}
                  </select>
                </label>
              )}
            </div>
          </details>
        </div>
        <div className="self-start overflow-auto rounded-lg border border-line bg-surface p-2">
          <canvas ref={canvas} className="block h-auto" style={{ width: "100%", maxWidth: spec.w, aspectRatio: `${spec.w} / ${spec.h}` }} />
        </div>
      </div>
    </section>
  );
}

export default function Tab4APlus({ book, update, setBook, fail }: Props) {
  const modules = book.kdp?.aPlusModules ?? [];
  const setModule = (size: Spec["size"], patch: Partial<APlusModule>) => {
    const base: KdpPackage = book.kdp ?? {
      titleIdeas: [], htmlDescription: "", keywords: ["", "", "", "", "", "", ""], categories: ["", "", ""], isLowContent: false, aPlusModules: [],
    };
    const have = base.aPlusModules.some((m) => m.size === size);
    const next = have
      ? base.aPlusModules.map((m) => (m.size === size ? { ...m, ...patch } : m))
      : [...base.aPlusModules, { size, headline: "", body: "", ...patch }];
    update({ kdp: { ...base, aPlusModules: next } });
  };
  const all = modules.map((m) => `${m.headline} ${m.body}`).join(" ");
  const total = scanBanned(all);

  return (
    <div className="space-y-4">
      <section className="card text-sm">
        <h2 className="mb-1 text-base font-bold text-forest">A+ Content Builder</h2>
        <p className="text-muted">Upload a cover or interior page for each module and edit the copy. The banner is drawn in your browser as a clean opaque RGB PNG at the exact pixel size. Pictures are shrunk to under 400 KB first and saved with the book, so they are still here next time. Press Save to keep your choices. Generate the starting copy on tab 3.</p>
        {total.length > 0 && <p className="mt-2 font-semibold text-accent">Banned words across all modules: {total.join(", ")}</p>}
      </section>
      {SPECS.map((spec) => {
        const m = modules.find((x) => x.size === spec.size) ?? { size: spec.size, headline: "", body: "" };
        return <Module key={spec.size} spec={spec} mod={m} onChange={(p) => setModule(spec.size, p)} book={book} fail={fail}
          onGenerated={(img) => setBook((b) => (b ? { ...b, images: [...b.images.filter((i) => i.id !== img.id), img] } : b))} />;
      })}
    </div>
  );
}
