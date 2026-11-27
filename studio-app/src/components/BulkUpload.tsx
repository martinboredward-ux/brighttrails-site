import { useState } from "react";
import type { Book, GeneratedImage, ImageAspect, StylePreset } from "../types";
import { compressImage } from "../imageTools";
import { uploadSectionImage } from "../api";
import { TooltipButton } from "./TooltipButton";

interface Row { file: File; sectionId: string; puzzle: boolean }

/** Pick many pictures made outside Studio (for example in ChatGPT) and attach each to its page in one go. Free: nothing is generated. */
export default function BulkUpload({ book, onDone, fail }: { book: Book; onDone: (img: GeneratedImage) => void; fail: (e: unknown) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const preset: StylePreset = book.mode === "activity" ? "coloring" : "storybook";

  const choose = (list: FileList | null) => {
    if (!list || !book.sections.length) return;
    const files = [...list].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setRows(files.map((file, k) => {
      const n = Number(file.name.match(/(\d+)/)?.[1] ?? 0);
      const s = n >= 1 && n <= book.sections.length ? book.sections[n - 1] : book.sections[Math.min(k, book.sections.length - 1)];
      return { file, sectionId: s.id, puzzle: /puzzle/i.test(file.name) };
    }));
    setMsg(files.length ? `${files.length} picture${files.length === 1 ? "" : "s"} ready. Check the page for each one, then upload.` : "Please choose PNG or JPG pictures.");
  };

  const upload = async () => {
    setBusy(true);
    let done = 0;
    try {
      for (const r of rows) {
        setMsg(`Uploading ${done + 1} of ${rows.length}…`);
        const { blob } = await compressImage(r.file, 1600);
        const bmp = await createImageBitmap(blob);
        const ratio = bmp.width / bmp.height; bmp.close();
        const shape: ImageAspect = ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square";
        onDone(await uploadSectionImage(book.id, r.sectionId, blob, shape, preset, r.puzzle ? "puzzle" : undefined));
        done += 1;
      }
      setMsg(`Done. ${done} picture${done === 1 ? "" : "s"} attached to their pages.`);
      setRows([]);
    } catch (e) { setMsg(`Stopped after ${done} of ${rows.length}.`); fail(e); } finally { setBusy(false); }
  };

  if (!book.sections.length) return null;
  return (
    <section className="card space-y-2">
      <details>
        <summary className="cursor-pointer text-base font-bold text-forest">Upload many pictures at once (made in ChatGPT)</summary>
        <p className="hint mt-2">Choose several files. A number in the file name picks the page (spread-3.png goes to page 3); otherwise they go in order. Tick Puzzle for a worksheet puzzle picture. Free: nothing is generated.</p>
        <label className={`btn mt-2 inline-block cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          Choose pictures
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
        </label>
        {rows.length > 0 && (
          <ul className="mt-3 space-y-1">
            {rows.map((r, k) => (
              <li key={`${r.file.name}${k}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40 truncate font-semibold" title={r.file.name}>{r.file.name}</span>
                <select className="field !w-auto !py-1" value={r.sectionId} disabled={busy} onChange={(e) => setRows(rows.map((x, j) => (j === k ? { ...x, sectionId: e.target.value } : x)))} aria-label="Page">
                  {book.sections.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}
                </select>
                {book.mode === "activity" && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.puzzle} disabled={busy} onChange={(e) => setRows(rows.map((x, j) => (j === k ? { ...x, puzzle: e.target.checked } : x)))} /> Puzzle</label>}
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && <TooltipButton type="button" className="btn mt-2" disabled={busy} tip="Shrinks each picture in your browser and attaches it to its page." engine="$0 Free · No picture is generated" onClick={upload}>{busy ? "Uploading…" : `Upload ${rows.length} to pages`}</TooltipButton>}
        {msg && <p className="mt-2 text-sm font-semibold text-forest">{msg}</p>}
      </details>
    </section>
  );
}
