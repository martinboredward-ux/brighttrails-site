import { useState } from "react";
import type { Book, ImageProvider, RefKind } from "../types";
import { generateImage } from "../api";
import { libraryPrompt, wrapPrompt } from "../imagePrompts";
import { KIND_LABEL } from "./CharacterLibrary";
import { TooltipButton } from "./TooltipButton";

interface Props {
  book: Book;
  commit: (p: Partial<Book>) => Promise<void>;
  fail: (e: unknown) => void;
  /** Pre-filled values (used by the Missing from Library cards). */
  initial?: { name: string; kind: RefKind; detail?: string };
  /** Smaller layout inside a card. */
  compact?: boolean;
  onAdded?: (id: string) => void;
}

const ENGINES: { id: ImageProvider; label: string }[] = [
  { id: "openai-mini", label: "ChatGPT Mini [gpt-image-2.5-flare]" },
  { id: "openai-1.5", label: "ChatGPT 1.5" },
  { id: "nano-banana", label: "Nano Banana 2.1" },
];

/** Generate a character, badge or prop straight into the Library (or copy a free prompt). */
export default function LibraryGenerate({ book, commit, fail, initial, compact, onAdded }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<RefKind>(initial?.kind ?? "character");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [provider, setProvider] = useState<ImageProvider>("openai-mini");
  const [color, setColor] = useState(book.mode === "storybook");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const lib = book.characters ?? [];
  const spec = libraryPrompt(kind, name, detail, color);

  const run = async () => {
    if (!name.trim()) { setStatus("Type a name first."); return; }
    if (lib.length >= 40) { setStatus("The library holds up to 40 pictures."); return; }
    setBusy(true); setStatus("Starting…");
    try {
      // Other Library items are sent as references so the new picture matches the same cast.
      const refs = lib.filter((c) => c.kind === "character").slice(0, 3).map((c) => c.id);
      const { image } = await generateImage(
        { bookId: book.id, provider, quality: "low", aspect: kind === "character" ? "landscape" : "square", stylePreset: spec.preset, prompt: spec.prompt, referenceImageIds: kind === "character" ? [] : refs },
        (s) => setStatus(s === "queued" ? "Queued…" : "Drawing… up to a minute"),
      );
      const fresh = [...lib, { id: image.id, name: name.trim().slice(0, 40), kind }];
      await commit({ characters: fresh, images: [...book.images.filter((i) => i.id !== image.id), image], characterRefId: "" });
      setStatus(`Added ${name.trim()} to the Library (${image.modelUsed}).`);
      onAdded?.(image.id);
    } catch (e) { setStatus(""); fail(e); } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(wrapPrompt(spec.preset, spec.prompt, book.styleBible)); setStatus("Prompt copied. Paste it into ChatGPT or Gemini web, then upload the result."); } catch { setStatus("Could not copy."); }
  };

  return (
    <div className={`space-y-2 rounded-lg border border-line ${compact ? "p-2" : "p-3"}`}>
      {!compact && <h3 className="text-sm font-bold text-forest">Generate with AI</h3>}
      <div className="flex flex-wrap items-end gap-2">
        {!initial && (
          <>
            <label className="text-xs text-muted">Name
              <input className="field mt-1 !w-40" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Mr. Santos…" />
            </label>
            <label className="text-xs text-muted">Type
              <select className="field mt-1 !w-auto" value={kind} onChange={(e) => setKind(e.target.value as RefKind)}>
                {(Object.keys(KIND_LABEL) as RefKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="text-xs text-muted">Color style
          <select className="field mt-1 !w-auto" value={color ? "color" : "bw"} onChange={(e) => setColor(e.target.value === "color")}>
            <option value="color">Full Color Storybook</option>
            <option value="bw">B&amp;W Coloring Line Art</option>
          </select>
        </label>
        <label className="text-xs text-muted">Engine
          <select className="field mt-1 !w-auto" value={provider} onChange={(e) => setProvider(e.target.value as ImageProvider)}>
            {ENGINES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs text-muted">Describe it (optional)
        <textarea className="field mt-1 min-h-16" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Looks, clothes, colors, anything that must stay the same" />
      </label>
      <p className="hint">Preset: {kind === "character" ? "black-and-white turnaround sheet" : kind === "badge" ? "circular black-and-white passport stamp on pure white" : kind === "prop" ? "single black-and-white prop or compass" : kind === "cover" ? "color cover sample" : "page design"}.</p>
      <div className="flex flex-wrap items-center gap-2">
        <TooltipButton type="button" className="btn" onClick={run} disabled={busy}>{busy ? "Generating…" : "Generate to Library"}</TooltipButton>
        <TooltipButton type="button" className="btn-alt" onClick={copy}>$0 Copy Prompt</TooltipButton>
      </div>
      {status && <p className="text-xs font-semibold text-forest">{status}</p>}
    </div>
  );
}
