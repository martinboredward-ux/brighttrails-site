import { useState } from "react";
import type { Book, CharacterRef, RefKind } from "../types";
import { compressImage } from "../imageTools";
import { deleteImage, uploadImage } from "../api";
import { useBlobUrl } from "../blobUrl";

export const KIND_LABEL: Record<RefKind, string> = { character: "Character", badge: "Badge", prop: "Prop / place", cover: "Cover style", page: "Page design (contents, certificate…)" };
const MAX_LIBRARY = 40;

function Card({ c, book, onRename, onKind, onRemove }: { c: CharacterRef; book: Book; onRename: (n: string) => void; onKind: (k: RefKind) => void; onRemove: () => void }) {
  const { url, error } = useBlobUrl(c.id);
  const [draft, setDraft] = useState(c.name);
  return (
    <li className="w-44 space-y-2 rounded-lg border border-line bg-surface p-2">
      <div className="grid aspect-square place-items-center overflow-hidden rounded bg-white">
        {url ? <img src={url} alt={c.name} className="max-h-full max-w-full object-contain" /> : <span className="px-2 text-center text-xs text-muted">{error || "Loading…"}</span>}
      </div>
      <input className="field !py-1 text-sm" value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} onBlur={() => { const n = draft.trim() || c.name; setDraft(n); if (n !== c.name) onRename(n); }} aria-label="Name" />
      <select className="field !py-1 text-xs" value={c.kind} onChange={(e) => onKind(e.target.value as RefKind)} aria-label="Type">
        {(Object.keys(KIND_LABEL) as RefKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </select>
      <button className="btn-alt !px-2 !py-1 !text-xs !text-accent" onClick={onRemove}>Remove{book.images.some((i) => i.id === c.id) ? " from library" : ""}</button>
    </li>
  );
}

interface Props {
  book: Book;
  commit: (p: Partial<Book>) => Promise<void>;
  fail: (e: unknown) => void;
  /** Upload box only (used next to the image generator). */
  compact?: boolean;
}

/** The master area for reference pictures: characters, badges and props. Every image engine can use them. */
export default function CharacterLibrary({ book, commit, fail, compact }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RefKind>("character");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const lib = book.characters ?? [];

  const save = (next: CharacterRef[]) => commit({ characters: next, characterRefId: "" });

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!name.trim()) { setNote("Type a name first, for example Mika or Compass Badge."); return; }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setNote("Please choose a PNG or JPG picture."); return; }
    if (lib.length >= MAX_LIBRARY) { setNote(`The library holds up to ${MAX_LIBRARY} pictures.`); return; }
    setBusy(true); setNote("");
    try {
      const { blob, note: n } = await compressImage(f, 1200);
      const id = await uploadImage(book.id, blob);
      await save([...lib, { id, name: name.trim().slice(0, 40), kind }]);
      setNote(`Added ${name.trim()} (${n}).`);
      setName("");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const patch = (id: string, p: Partial<CharacterRef>) => void save(lib.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const remove = async (c: CharacterRef) => {
    try {
      await save(lib.filter((x) => x.id !== c.id));
      if (!book.images.some((i) => i.id === c.id)) void deleteImage(c.id);
    } catch (e) { fail(e); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">Name
          <input className="field mt-1 !w-44" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Mika, Compass Badge…" />
        </label>
        <label className="text-xs text-muted">Type
          <select className="field mt-1 !w-auto" value={kind} onChange={(e) => setKind(e.target.value as RefKind)}>
            {(Object.keys(KIND_LABEL) as RefKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className={`btn cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Uploading…" : "Upload Picture (PNG/JPG)"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy}
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {note && <p className="text-xs font-semibold text-forest">{note}</p>}
      {!compact && (
        lib.length ? (
          <ul className="flex flex-wrap gap-3">
            {lib.map((c) => (
              <Card key={c.id} c={c} book={book} onRename={(n) => patch(c.id, { name: n })} onKind={(k) => patch(c.id, { kind: k })} onRemove={() => void remove(c)} />
            ))}
          </ul>
        ) : <p className="hint">Nothing here yet. Upload each character sheet, badge or prop once, with a name.</p>
      )}
    </div>
  );
}
