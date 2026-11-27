import { useState } from "react";
import type { Book, CoverIdea, CoverIdeas as Ideas, CoverSettings } from "../types";
import { coverIdeas } from "../api";
import { coverPrompt } from "../imagePrompts";
import { TooltipButton } from "./TooltipButton";

interface Props {
  book: Book;
  s: CoverSettings;
  aspect: "portrait" | "square" | "landscape";
  set: (p: Partial<CoverSettings>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
  fail: (e: unknown) => void;
}

/** Cover ideas: three concepts with paste-ready prompts for ChatGPT / Nano Banana, plus one-click layout settings. One small text call, no image model. */
export default function CoverIdeas({ book, s, aspect, set, commit, fail }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [sonnet, setSonnet] = useState(false);
  const ideas: Ideas | undefined = s.ideas;

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setNote(`Copied: ${what}. Paste it into ChatGPT or Nano Banana.`); }
    catch { setNote("Your browser blocked copying. Select the prompt text and copy it by hand."); }
  };

  const ask = async () => {
    if (ideas && !window.confirm("This asks the AI again (a small text call) and replaces the saved ideas. Continue?")) return;
    setBusy(true); setNote("");
    try {
      const r = await coverIdeas({
        title: s.title, subtitle: s.subtitle, audience: book.audience, mode: book.mode, styleBible: book.styleBible, seriesPill: s.seriesPill, trim: s.trim ?? book.trim,
        characters: (book.characters ?? []).filter((c) => c.kind === "character").map((c) => c.name),
        sections: book.sections.map((x) => ({ title: x.title, summary: x.summary })),
        model: sonnet ? "sonnet" : "haiku",
      });
      await commit({ cover: { ...book.cover, ...s, ideas: r } });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const apply = (c: CoverIdea) => { set({ ...c.layout }); setNote(`Applied the "${c.name}" layout. Check the previews below.`); };
  const free = coverPrompt(`The main character or subject of "${s.title}" in a happy pose, large and clear.`, aspect, book.styleBible);

  return (
    <details className="rounded-lg border border-line p-3" open>
      <summary className="cursor-pointer text-sm font-bold text-forest">Cover ideas: let Claude plan the cover</summary>
      <div className="mt-3 space-y-3">
        <p className="hint">Claude reads your title, style notes and sections and suggests three covers that stand out as a small Amazon thumbnail. Copy a prompt into ChatGPT or Nano Banana, upload the picture above, then press "Use this layout". This makes no pictures, so it only costs a small text call.</p>
        <div className="flex flex-wrap items-center gap-3">
          <TooltipButton className="btn" disabled={busy} onClick={ask} tip="Asks Claude for three cover concepts. A small text call, no image model." engine="Claude Haiku · pennies">{busy ? "Thinking…" : ideas ? "Get new ideas" : "Suggest 3 covers"}</TooltipButton>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sonnet} onChange={(e) => setSonnet(e.target.checked)} /> Use Sonnet (better ideas, costs more)</label>
          <TooltipButton className="btn-alt" onClick={() => void copy(free, "a basic cover prompt")} tip="Copies a safe cover prompt built from your style notes. No AI call." engine="$0 Free">Copy a basic prompt (free)</TooltipButton>
        </div>
        {note && <p className="text-sm font-semibold text-forest">{note}</p>}
        {ideas && (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {ideas.concepts.map((c, i) => {
                const p = coverPrompt(c.scene, aspect, book.styleBible);
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-line bg-white p-3">
                    <p className="font-bold text-forest">{i + 1}. {c.name}</p>
                    <p className="text-sm">{c.why}</p>
                    <p className="text-sm text-muted">{c.scene}</p>
                    <p className="text-xs text-muted">Layout: title {c.layout.titlePlacement}, {c.layout.scrim === "none" ? "no scrim" : `${c.layout.scrim} scrim`}, {c.layout.textEffect} text</p>
                    <div className="flex flex-wrap gap-2">
                      <TooltipButton className="btn" onClick={() => void copy(p, c.name)} tip="Copies the full picture prompt, with the sky-space rules built in.">Copy picture prompt</TooltipButton>
                      <TooltipButton className="btn-alt" onClick={() => apply(c)} tip="Sets title placement, scrim, text color and effect to match this idea.">Use this layout</TooltipButton>
                    </div>
                  </div>
                );
              })}
            </div>
            {ideas.tips.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{ideas.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            {ideas.at && <p className="text-xs text-muted">Saved with this book ({new Date(ideas.at).toLocaleString()}), so reopening it costs nothing.</p>}
          </>
        )}
      </div>
    </details>
  );
}
