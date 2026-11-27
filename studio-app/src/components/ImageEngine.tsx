import { useState } from "react";
import type { Book, CharacterRef, GeneratedImage, ImageAspect, ImageProvider, StylePreset } from "../types";
import { generateImage, uploadSectionImage } from "../api";
import { compressImage } from "../imageTools";
import { wrapPrompt } from "../imagePrompts";
import { trimAspect } from "../utils/trims";
import CharacterLibrary, { KIND_LABEL } from "./CharacterLibrary";
import PutOnPage from "./PutOnPage";
import { useBlobUrl } from "../blobUrl";
import { TooltipButton } from "./TooltipButton";

interface Props {
  book: Book;
  sectionId?: string;
  initialPrompt?: string;
  defaultAspect?: ImageAspect;
  defaultPreset?: StylePreset;
  onDone: (image: GeneratedImage) => void;
  fail: (e: unknown) => void;
  /** When given, an upload box for the Character Library is shown under the picture options. */
  commit?: (p: Partial<Book>) => Promise<void>;
  /** Library items ticked from the asset detector. */
  pinned?: string[];
}

const ENGINES: { id: ImageProvider; label: string; sub: string }[] = [
  { id: "openai-mini", label: "ChatGPT Mini", sub: "Low Cost" },
  { id: "openai-1.5", label: "ChatGPT 1.5", sub: "Better detail" },
  { id: "nano-banana", label: "Nano Banana 2.1", sub: "Strong match" },
];

function RefChip({ c, on, onToggle }: { c: CharacterRef; on: boolean; onToggle: () => void }) {
  const { url } = useBlobUrl(c.id);
  return (
    <li>
      <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1 pr-2 text-sm ${on ? "border-sun bg-sun/20" : "border-line"}`}>
        <input type="checkbox" checked={on} onChange={onToggle} />
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded border border-line bg-white">{url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : null}</span>
        <span className="leading-tight"><span className="block font-semibold">{c.name}</span><span className="block text-[11px] text-muted">{KIND_LABEL[c.kind]}</span></span>
      </label>
    </li>
  );
}

export default function ImageEngine({ book, sectionId, initialPrompt = "", defaultAspect = "portrait", defaultPreset = "coloring", onDone, fail, commit, pinned }: Props) {
  const [provider, setProvider] = useState<ImageProvider>("openai-mini");
  const [quality, setQuality] = useState<"low" | "medium">("low");
  const [aspect, setAspect] = useState<ImageAspect>(defaultAspect);
  const [preset, setPreset] = useState<StylePreset>(defaultPreset);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [useRef, setUseRef] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const lib = book.characters ?? [];
  const [manual, setManual] = useState<Set<string> | null>(null);
  const mentioned = (c: CharacterRef) => {
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const first = c.name.trim().split(/\s+/)[0] ?? "";
    return new RegExp(`\\b${esc(c.name.trim())}\\b`, "i").test(prompt) || (first.length > 2 && new RegExp(`\\b${esc(first)}\\b`, "i").test(prompt));
  };
  const auto = new Set([...lib.filter(mentioned).map((c) => c.id), ...(pinned ?? [])]);
  const chosen = useRef ? [...(manual ?? auto)].filter((id) => lib.some((c) => c.id === id)) : [];
  const toggle = (id: string) => { const n = new Set(manual ?? auto); if (n.has(id)) n.delete(id); else n.add(id); setManual(n); };

  const run = async () => {
    if (!prompt.trim()) { setStatus("Write a prompt first."); return; }
    setBusy(true);
    setNotes([]);
    setStatus("Starting…");
    try {
      const { job, image } = await generateImage(
        { bookId: book.id, provider, quality, aspect, stylePreset: preset, prompt, sectionId, referenceImageIds: chosen.slice(0, 6) },
        (s) => setStatus(s === "queued" ? "Queued…" : "Drawing… this can take up to a minute"),
      );
      setNotes(job.notes ?? []);
      setStatus(`Done with ${image.modelUsed}.`);
      onDone(image);
    } catch (e) {
      setStatus("");
      fail(e);
    } finally { setBusy(false); }
  };

  const [upBusy, setUpBusy] = useState(false);
  const attachOwn = async (f: File | undefined) => {
    if (!f || !sectionId) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setStatus("Please choose a PNG or JPG picture."); return; }
    setUpBusy(true); setStatus("Uploading your picture…");
    try {
      const { blob } = await compressImage(f, 1600);
      const bmp = await createImageBitmap(blob);
      const r = bmp.width / bmp.height; bmp.close();
      const shape: ImageAspect = r > 1.15 ? "landscape" : r < 0.87 ? "portrait" : "square";
      const image = await uploadSectionImage(book.id, sectionId, blob, shape, preset);
      setStatus("Your picture is now on this page.");
      onDone(image);
    } catch (e) { setStatus(""); fail(e); } finally { setUpBusy(false); }
  };

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(wrapPrompt(preset, prompt, sectionId ? book.styleBible : undefined)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div role="group" aria-label="Image engine" className="flex flex-wrap items-stretch gap-2">
        {ENGINES.map((e) => (
          <TooltipButton key={e.id} type="button" onClick={() => setProvider(e.id)} aria-pressed={provider === e.id}
            className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${provider === e.id ? "border-sun bg-sun text-onsun" : "border-line text-forest hover:bg-forest/10"}`}>
            {e.label}
            <span className="block text-xs font-normal opacity-80">{e.sub}</span>
          </TooltipButton>
        ))}
        <TooltipButton type="button" className="btn-alt" onClick={copyPrompt}>{copied ? "Copied" : "$0 Copy Image Prompt"}</TooltipButton>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">Style
          <select className="field mt-1" value={preset} onChange={(e) => { const v = e.target.value as StylePreset; setPreset(v); if (v === "cover") setAspect(trimAspect(book.trim)); }}>
            <option value="coloring">Coloring page (black and white)</option>
            <option value="storybook">Storybook</option>
            <option value="cover">Cover</option>
            <option value="aplus">A+ illustration</option>
          </select>
        </label>
        <label className="text-xs text-muted">Shape
          <select className="field mt-1" value={aspect} onChange={(e) => setAspect(e.target.value as ImageAspect)}>
            <option value="portrait">Portrait</option>
            <option value="square">Square</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label className="text-xs text-muted">Quality
          <select className="field mt-1" value={quality} onChange={(e) => setQuality(e.target.value as "low" | "medium")}>
            <option value="low">Low (cheapest)</option>
            <option value="medium">Medium</option>
          </select>
        </label>
      </div>
      <textarea className="field min-h-20" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the picture. The style wording above is added for you." />
      {lib.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-line p-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-forest"><input type="checkbox" checked={useRef} onChange={(e) => setUseRef(e.target.checked)} /> Use my Character Library ({provider === "nano-banana" ? "Nano Banana" : "ChatGPT"} copies the ones ticked)</label>
          {useRef && (
            <>
              <ul className="flex flex-wrap gap-2">
                {lib.map((c) => <RefChip key={c.id} c={c} on={chosen.includes(c.id)} onToggle={() => toggle(c.id)} />)}
              </ul>
              <p className="hint">{manual ? "Your own picks. " : "Auto: characters named in your prompt are ticked. "}{chosen.length > 6 ? "Only the first 6 are sent. " : ""}{manual && <TooltipButton type="button" className="underline" onClick={() => setManual(null)}>Back to auto</TooltipButton>}</p>
            </>
          )}
        </div>
      ) : <p className="hint">Add your characters and badges to the Character Library on the Details tab, or below, and both ChatGPT and Nano Banana will copy them.</p>}
      {sectionId && (
        <div className="space-y-1 rounded-lg border border-sun p-2">
          <label className={`btn cursor-pointer ${upBusy ? "pointer-events-none opacity-60" : ""}`}>
            {upBusy ? "Uploading…" : "Use my own picture for this page (from ChatGPT)"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={upBusy}
              onChange={(e) => { void attachOwn(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <p className="hint">This puts the picture on this page. It shows in the pictures below and is the one the PDF and printable book use. The newest picture on a page wins.</p>
          <p className="pt-1 text-xs font-semibold text-forest">Or put a picture from the Character Library on this page</p>
          <PutOnPage book={book} sectionId={sectionId} preset={preset} onDone={onDone} fail={fail} />
        </div>
      )}
      {commit && <CharacterLibrary book={book} commit={commit} fail={fail} compact />}
      <div className="flex flex-wrap items-center gap-3">
        <TooltipButton className="btn" onClick={run} disabled={busy}>{busy ? "Generating…" : "Generate image"}</TooltipButton>
        <span className="hint">Uses Netlify credits. Save your free web-chat quota with the $0 prompt button.</span>
      </div>
      {status && <p className="text-sm font-semibold text-forest">{status}</p>}
      {notes.map((n) => <p key={n} className="hint">{n}</p>)}
    </div>
  );
}
