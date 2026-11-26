import { useState } from "react";
import type { Book } from "../types";
import { compressImage } from "../imageTools";
import { deleteImage, uploadImage } from "../api";
import { useBlobUrl } from "../blobUrl";

interface Props {
  book: Book;
  commit: (p: Partial<Book>) => Promise<void>;
  fail: (e: unknown) => void;
  compact?: boolean;
}

/** Upload (or clear) the picture Nano Banana copies when Character Lock is on. */
export default function CharacterReference({ book, commit, fail, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const { url, error } = useBlobUrl(book.characterRefId || undefined);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setNote("Please choose a PNG or JPG picture."); return; }
    setBusy(true);
    setNote("");
    try {
      const { blob, note: n } = await compressImage(f, 1200);
      const id = await uploadImage(book.id, blob);
      const old = book.characterRefId;
      await commit({ characterRefId: id });
      // A previously uploaded reference is no longer needed. Generated pictures stay in Book images.
      if (old && !book.images.some((i) => i.id === old)) void deleteImage(old);
      setNote(`Saved as the character reference (${n}).`);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const clear = async () => {
    const old = book.characterRefId;
    if (!old) return;
    try {
      await commit({ characterRefId: "" });
      if (!book.images.some((i) => i.id === old)) void deleteImage(old);
      setNote("Character reference cleared.");
    } catch (e) { fail(e); }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 ${compact ? "" : ""}`}>
      {book.characterRefId && (
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded border border-line bg-white">
          {url ? <img src={url} alt="Character reference" className="max-h-full max-w-full object-contain" /> : <span className="px-1 text-center text-[11px] text-muted">{error || "Loading…"}</span>}
        </div>
      )}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? "Uploading…" : "Upload Character Reference (PNG/JPG)"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy}
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {book.characterRefId && <button className="btn-alt" onClick={clear}>Clear Reference</button>}
        </div>
        <p className="hint">Used automatically by Nano Banana 2.1 (Character Lock), for example your barnaby_head.png. Shrunk to 1200 px first.</p>
        {note && <p className="text-xs font-semibold text-forest">{note}</p>}
      </div>
    </div>
  );
}
