import { useState } from "react";
import type { Book, GeneratedImage, RefKind } from "../types";
import { useBlobUrl } from "../blobUrl";
import { fetchImageBlob, deleteImage } from "../api";
import { download } from "../exportZip";
import { TooltipButton } from "./TooltipButton";

function Thumb({ img, book, selected, onToggle, onCharacter, onRemoved, onUse, useLabel, fail }: {
  img: GeneratedImage; book: Book; selected?: boolean; onToggle?: () => void;
  onCharacter: (id: string, kind: RefKind, inLibrary: boolean) => void; onRemoved: (id: string) => void; onUse?: (img: GeneratedImage) => void; useLabel?: string; fail: (e: unknown) => void;
}) {
  const { url, error } = useBlobUrl(img.id);
  const isRef = (book.characters ?? []).some((c) => c.id === img.id);
  const [kind, setKind] = useState<RefKind>("character");
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
        {onUse && <TooltipButton className="btn !px-2 !py-1 !text-xs" onClick={() => onUse(img)}>{useLabel ?? "Use"}</TooltipButton>}
        {!isRef && (
          <select className="field !w-auto !px-1 !py-1 !text-xs" value={kind} onChange={(e) => setKind(e.target.value as RefKind)} aria-label="Library type">
            <option value="character">Character</option>
            <option value="badge">Badge</option>
            <option value="prop">Prop / place</option>
            <option value="cover">Cover style</option>
            <option value="page">Page design</option>
          </select>
        )}
        <TooltipButton className={`btn-alt !px-2 !py-1 !text-xs ${isRef ? "!border-sun" : ""}`} onClick={() => onCharacter(img.id, kind, isRef)}>{isRef ? "In library ✓ (remove)" : "Add to Library"}</TooltipButton>
        <TooltipButton className="btn-alt !px-2 !py-1 !text-xs" onClick={async () => { try { download(`${book.slug}-${img.id.slice(-8)}.png`, await fetchImageBlob(img.id)); } catch (e) { fail(e); } }}>Download</TooltipButton>
        <TooltipButton className="btn-alt !px-2 !py-1 !text-xs !text-accent" onClick={async () => { if (confirm("Delete this picture?")) { await deleteImage(img.id); onRemoved(img.id); } }}>Delete</TooltipButton>
      </div>
    </li>
  );
}

export default function ImageGallery({ book, images, selected, onToggle, onCharacter, onRemoved, onUse, useLabel, fail }: {
  book: Book; images: GeneratedImage[]; selected?: Set<string>; onToggle?: (id: string) => void;
  onCharacter: (id: string, kind: RefKind, inLibrary: boolean) => void; onRemoved: (id: string) => void; onUse?: (img: GeneratedImage) => void; useLabel?: string; fail: (e: unknown) => void;
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
