import { useState } from "react";
import type { Book, CharacterRef, GeneratedImage, ImageAspect, RefKind, StylePreset } from "../types";
import { copyLibraryToSection, fetchImageBlob } from "../api";
import { TooltipButton } from "./TooltipButton";
import { KIND_LABEL } from "./CharacterLibrary";

interface Props {
  book: Book;
  sectionId: string;
  /** Only show these kinds (for example badges). Omit for everything in the Library. */
  kinds?: RefKind[];
  preset: StylePreset;
  onDone: (img: GeneratedImage) => void;
  fail: (e: unknown) => void;
}

/** Pick a Library item and put it on this page. Free: the server copies the picture, nothing is generated. */
export default function PutOnPage({ book, sectionId, kinds, preset, onDone, fail }: Props) {
  const lib = (book.characters ?? []).filter((c) => !kinds || kinds.includes(c.kind));
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!lib.length) return <p className="hint">Nothing of this type in the Library yet.</p>;
  const chosen: CharacterRef | undefined = lib.find((c) => c.id === pick);

  const go = async () => {
    if (!chosen) { setMsg("Choose a Library picture first."); return; }
    setBusy(true); setMsg("Putting it on the page…");
    try {
      const blob = await fetchImageBlob(chosen.id);
      const bmp = await createImageBitmap(blob);
      const r = bmp.width / bmp.height; bmp.close();
      const shape: ImageAspect = r > 1.15 ? "landscape" : r < 0.87 ? "portrait" : "square";
      const image = await copyLibraryToSection(book.id, sectionId, chosen.id, chosen.name, shape, preset);
      setMsg(`${chosen.name} is now on this page.`);
      onDone(image);
    } catch (e) { setMsg(""); fail(e); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field !w-auto" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Library picture">
          <option value="">Choose from the Library…</option>
          {lib.map((c) => <option key={c.id} value={c.id}>{c.name} ({KIND_LABEL[c.kind].split(" (")[0]})</option>)}
        </select>
        <TooltipButton type="button" className="btn-alt" disabled={busy || !pick} tip="Copies the picture onto this page. The Library item stays as it is." engine="$0 Free · No picture is generated" onClick={go}>{busy ? "Working…" : "Put on this page"}</TooltipButton>
      </div>
      {msg && <p className="text-xs font-semibold text-forest">{msg}</p>}
    </div>
  );
}
