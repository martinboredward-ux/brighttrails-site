import { useState } from "react";
import type { Book, CoverIdea, CoverIdeas as Ideas, CoverSettings } from "../types";
import { coverIdeas, fetchImageBlob, listBooks, uploadImage } from "../api";
import { blobToImage, compressImage } from "../imageTools";
import { useBlobUrl } from "../blobUrl";
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

const MAX_REFS = 3;

/** A small JPEG (as base64) of a stored picture, to show the AI what the author's best covers look like. */
async function toJpegBase64(id: string): Promise<string> {
  const img = await blobToImage(await fetchImageBlob(id));
  const k = Math.min(1, 800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

function Pic({ id, label, onClick, small }: { id: string; label: string; onClick?: () => void; small?: boolean }) {
  const { url } = useBlobUrl(id);
  const box = `grid place-items-center overflow-hidden rounded-lg border border-line bg-white ${small ? "h-20 w-16" : "h-28 w-20"}`;
  const inner = url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted">…</span>;
  return onClick ? <button type="button" title={label} className={box} onClick={onClick}>{inner}</button> : <div className={box} title={label}>{inner}</div>;
}

/** Cover ideas: three concepts with paste-ready prompts for ChatGPT / Nano Banana, plus one-click layout settings. One small text call, no image model. */
export default function CoverIdeas({ book, s, aspect, set, commit, fail }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [sonnet, setSonnet] = useState(false);
  const ideas: Ideas | undefined = s.ideas;
  const refs = s.refCoverIds ?? [];
  const [others, setOthers] = useState<{ id: string; title: string; art: string }[] | null>(null);
  const [upBusy, setUpBusy] = useState("");

  const saveRefs = (next: string[]) => commit({ cover: { ...book.cover, ...s, refCoverIds: next.slice(0, MAX_REFS) } });
  const addRefFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setNote("Please choose a PNG or JPG picture."); return; }
    if (refs.length >= MAX_REFS) { setNote(`Up to ${MAX_REFS} reference covers. Remove one first.`); return; }
    setUpBusy("ref");
    try { const { blob } = await compressImage(f, 1200); await saveRefs([...refs, await uploadImage(book.id, blob)]); setNote("Added as a reference cover."); }
    catch (e) { fail(e); } finally { setUpBusy(""); }
  };
  const openOthers = async () => {
    if (others) { setOthers(null); return; }
    try {
      const all = await listBooks();
      setOthers(all.filter((x) => x.id !== book.id && (x.cover as CoverSettings | undefined)?.frontArtId).map((x) => ({ id: x.id, title: x.title, art: (x.cover as CoverSettings).frontArtId as string })));
    } catch (e) { fail(e); }
  };
  const uploadForIdea = async (i: number, f: File | undefined) => {
    if (!f || !ideas) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setNote("Please choose a PNG or JPG picture."); return; }
    setUpBusy(`idea${i}`);
    try {
      const { blob } = await compressImage(f, 2400);
      const id = await uploadImage(book.id, blob);
      const concepts = ideas.concepts.map((c, j) => (j === i ? { ...c, artId: id } : c));
      await commit({ cover: { ...book.cover, ...s, frontArtId: id, ideas: { ...ideas, concepts } } });
      setNote(`Your picture for "${ideas.concepts[i].name}" is now the cover art.`);
    } catch (e) { fail(e); } finally { setUpBusy(""); }
  };

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setNote(`Copied: ${what}. Paste it into ChatGPT or Nano Banana.`); }
    catch { setNote("Your browser blocked copying. Select the prompt text and copy it by hand."); }
  };

  const ask = async () => {
    if (ideas && !window.confirm("This asks the AI again (a small text call) and replaces the saved ideas. Continue?")) return;
    setBusy(true); setNote("");
    try {
      const refImages = await Promise.all(refs.map(toJpegBase64));
      const r = await coverIdeas({
        refs: refImages,
        title: s.title, subtitle: s.subtitle, audience: book.audience, mode: book.mode, styleBible: book.styleBible, seriesPill: s.seriesPill, trim: s.trim ?? book.trim,
        characters: (book.characters ?? []).filter((c) => c.kind === "character").map((c) => c.name),
        sections: book.sections.map((x) => ({ title: x.title, summary: x.summary })),
        model: sonnet ? "sonnet" : "haiku",
      });
      await commit({ cover: { ...book.cover, ...s, ideas: r } });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const apply = (c: CoverIdea) => { set({ ...c.layout }); setNote(`Applied the "${c.name}" layout. Check the previews below.`); };
  const look = ideas?.lookNotes;
  const free = coverPrompt(`The main character or subject of "${s.title}" in a happy pose, large and clear.`, aspect, book.styleBible, look);

  return (
    <details className="rounded-lg border border-line p-3" open>
      <summary className="cursor-pointer text-sm font-bold text-forest">Cover ideas: let Claude plan the cover</summary>
      <div className="mt-3 space-y-3">
        <p className="hint">Claude reads your title, style notes and sections and suggests three covers that stand out as a small Amazon thumbnail. Copy a prompt into ChatGPT or Nano Banana, upload the picture above, then press "Use this layout". This makes no pictures, so it only costs a small text call.</p>
        <div className="space-y-2 rounded-lg bg-sun/10 p-3">
          <p className="label">Match my best covers (up to {MAX_REFS})</p>
          <p className="hint">Add finished covers you love, such as a Little Scientist cover. Claude studies their look and every idea is planned to match. When you paste a prompt into ChatGPT or Nano Banana, attach the same cover too.</p>
          <div className="flex flex-wrap items-end gap-2">
            {refs.map((id) => (
              <div key={id} className="space-y-1 text-center"><Pic id={id} label="Reference cover" small />
                <button type="button" className="text-xs text-accent underline" onClick={() => void saveRefs(refs.filter((x) => x !== id))}>Remove</button></div>
            ))}
            {refs.length < MAX_REFS && (
              <label className={`btn-alt cursor-pointer ${upBusy === "ref" ? "pointer-events-none opacity-60" : ""}`}>{upBusy === "ref" ? "Uploading…" : "Upload a cover"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void addRefFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            )}
            {refs.length < MAX_REFS && <TooltipButton className="btn-alt" onClick={openOthers} tip="Lists covers from your other Studio books so you can borrow one as a reference." engine="$0 Free">{others ? "Hide other books" : "Borrow from another book"}</TooltipButton>}
          </div>
          {others && (others.length
            ? <ul className="flex flex-wrap gap-3">{others.map((o) => <li key={o.id} className="space-y-1 text-center"><Pic id={o.art} label={`Use ${o.title}`} small onClick={() => { void saveRefs([...refs, o.art]); setOthers(null); }} /><p className="w-16 truncate text-xs">{o.title}</p></li>)}</ul>
            : <p className="hint">No other Studio book has cover art yet. Use "Upload a cover" for covers made outside Studio.</p>)}
          {ideas?.lookNotes && <p className="text-xs text-muted"><b>The look Claude saw:</b> {ideas.lookNotes}</p>}
        </div>
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
                const p = coverPrompt(c.scene, aspect, book.styleBible, look);
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-line bg-white p-3">
                    <p className="font-bold text-forest">{i + 1}. {c.name}</p>
                    <p className="text-sm">{c.why}</p>
                    <p className="text-sm text-muted">{c.scene}</p>
                    <p className="text-xs text-muted">Layout: title {c.layout.titlePlacement}, {c.layout.scrim === "none" ? "no scrim" : `${c.layout.scrim} scrim`}, {c.layout.textEffect} text</p>
                    {c.artId && <div className="flex items-center gap-2"><Pic id={c.artId} label="Your picture for this idea" small /><TooltipButton className="btn-alt" onClick={() => set({ frontArtId: c.artId })} tip="Makes your picture for this idea the front cover art.">{s.frontArtId === c.artId ? "In use ✓" : "Use this picture"}</TooltipButton></div>}
                    <label className={`btn-alt cursor-pointer ${upBusy === `idea${i}` ? "pointer-events-none opacity-60" : ""}`}>{upBusy === `idea${i}` ? "Uploading…" : c.artId ? "Replace my picture" : "Upload my finished picture"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void uploadForIdea(i, e.target.files?.[0]); e.target.value = ""; }} /></label>
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
