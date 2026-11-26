import { useState } from "react";
import type { Book, GeneratedImage, ImageAspect, ImageProvider, StylePreset } from "../types";
import { generateImage } from "../api";
import { wrapPrompt } from "../imagePrompts";
import CharacterReference from "./CharacterReference";

interface Props {
  book: Book;
  sectionId?: string;
  initialPrompt?: string;
  defaultAspect?: ImageAspect;
  defaultPreset?: StylePreset;
  onDone: (image: GeneratedImage) => void;
  fail: (e: unknown) => void;
  /** When given, the character reference uploader is shown next to the Character Lock note. */
  commit?: (p: Partial<Book>) => Promise<void>;
}

const ENGINES: { id: ImageProvider; label: string; sub: string }[] = [
  { id: "openai-mini", label: "ChatGPT Mini", sub: "Low Cost" },
  { id: "openai-1.5", label: "ChatGPT 1.5", sub: "Better detail" },
  { id: "nano-banana", label: "Nano Banana 2.1", sub: "Character Lock" },
];

export default function ImageEngine({ book, sectionId, initialPrompt = "", defaultAspect = "portrait", defaultPreset = "coloring", onDone, fail, commit }: Props) {
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
  const canLock = provider === "nano-banana" && !!book.characterRefId;

  const run = async () => {
    if (!prompt.trim()) { setStatus("Write a prompt first."); return; }
    setBusy(true);
    setNotes([]);
    setStatus("Starting…");
    try {
      const { job, image } = await generateImage(
        { bookId: book.id, provider, quality, aspect, stylePreset: preset, prompt, sectionId, referenceImageId: canLock && useRef ? book.characterRefId : undefined },
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

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(wrapPrompt(preset, prompt, sectionId ? book.styleBible : undefined)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div role="group" aria-label="Image engine" className="flex flex-wrap items-stretch gap-2">
        {ENGINES.map((e) => (
          <button key={e.id} type="button" onClick={() => setProvider(e.id)} aria-pressed={provider === e.id}
            className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${provider === e.id ? "border-sun bg-sun text-onsun" : "border-line text-forest hover:bg-forest/10"}`}>
            {e.label}
            <span className="block text-xs font-normal opacity-80">{e.sub}</span>
          </button>
        ))}
        <button type="button" className="btn-alt" onClick={copyPrompt}>{copied ? "Copied" : "$0 Copy Image Prompt"}</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">Style
          <select className="field mt-1" value={preset} onChange={(e) => setPreset(e.target.value as StylePreset)}>
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
      {provider === "nano-banana" && (
        book.characterRefId ? (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useRef} onChange={(e) => setUseRef(e.target.checked)} /> Keep the saved character reference</label>
        ) : (
          <p className="hint">Character Lock: upload your character picture below, or generate one and press “Set as Character Reference” under it. Later Nano Banana pictures will copy that character.</p>
        )
      )}
      {commit && <CharacterReference book={book} commit={commit} fail={fail} />}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Generating…" : "Generate image"}</button>
        <span className="hint">Uses Netlify credits. Save your free web-chat quota with the $0 prompt button.</span>
      </div>
      {status && <p className="text-sm font-semibold text-forest">{status}</p>}
      {notes.map((n) => <p key={n} className="hint">{n}</p>)}
    </div>
  );
}
