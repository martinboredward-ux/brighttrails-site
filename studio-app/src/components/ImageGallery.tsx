import type { Book, GeneratedImage } from "../types";
import { useBlobUrl } from "../blobUrl";
import { fetchImageBlob, deleteImage } from "../api";
import { download } from "../exportZip";

function Thumb({ img, book, selected, onToggle, onCharacter, onRemoved, onUse, useLabel, fail }: {
  img: GeneratedImage; book: Book; selected?: boolean; onToggle?: () => void;
  onCharacter: (id: string) => void; onRemoved: (id: string) => void; onUse?: (img: GeneratedImage) => void; useLabel?: string; fail: (e: unknown) => void;
}) {
  const { url, error } = useBlobUrl(img.id);
  const isRef = book.characterRefId === img.id;
  return (
    <li className="w-44 space-y-2 rounded-lg border border-line bg-surface p-2">
      <div className="grid aspect-square place-items-center overflow-hidden rounded bg-white">
        {url ? <img src={url} alt={img.prompt.slice(0, 120)} className="max-h-full max-w-full object-contain" /> : <span className="px-2 text-center text-xs text-muted">{error || "Loading…"}</span>}
      </div>
      <p className="line-clamp-2 text-xs text-muted" title={img.prompt}>{img.prompt}</p>
      <p className="text-[11px] text-muted">{img.modelUsed}</p>
      {onToggle && (
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!selected} onChange={onToggle} /> Use in PDF</label>
      )}
      <div className="flex flex-wrap gap-1">
        {onUse && <button className="btn !px-2 !py-1 !text-xs" onClick={() => onUse(img)}>{useLabel ?? "Use"}</button>}
        <button className={`btn-alt !px-2 !py-1 !text-xs ${isRef ? "!border-sun" : ""}`} onClick={() => onCharacter(isRef ? "" : img.id)}>{isRef ? "Character reference ✓" : "Set as Character Reference"}</button>
        <button className="btn-alt !px-2 !py-1 !text-xs" onClick={async () => { try { download(`${book.slug}-${img.id.slice(-8)}.png`, await fetchImageBlob(img.id)); } catch (e) { fail(e); } }}>Download</button>
        <button className="btn-alt !px-2 !py-1 !text-xs !text-accent" onClick={async () => { if (confirm("Delete this picture?")) { await deleteImage(img.id); onRemoved(img.id); } }}>Delete</button>
      </div>
    </li>
  );
}

export default function ImageGallery({ book, images, selected, onToggle, onCharacter, onRemoved, onUse, useLabel, fail }: {
  book: Book; images: GeneratedImage[]; selected?: Set<string>; onToggle?: (id: string) => void;
  onCharacter: (id: string) => void; onRemoved: (id: string) => void; onUse?: (img: GeneratedImage) => void; useLabel?: string; fail: (e: unknown) => void;
}) {
  if (!images.length) return <p className="hint">No pictures yet.</p>;
  return (
    <ul className="flex flex-wrap gap-3">
      {images.map((img) => (
        <Thumb key={img.id} img={img} book={book} selected={selected?.has(img.id)} onToggle={onToggle ? () => onToggle(img.id) : undefined}
          onCharacter={onCharacter} onRemoved={onRemoved} onUse={onUse} useLabel={useLabel} fail={fail} />
      ))}
    </ul>
  );
}
