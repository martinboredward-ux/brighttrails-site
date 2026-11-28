import { useState } from "react";
import type { Book } from "../types";
import { pictureCheck, type PictureCheck as Result } from "../api";
import { TooltipButton } from "./TooltipButton";

/** "Picture matches the page?": Gemini compares this section's newest picture with its text and worksheet. */
export default function PictureCheck({ book, sectionId, fail }: { book: Book; sectionId: string; fail: (e: unknown) => void }) {
  const pics = book.images.filter((i) => i.sectionId === sectionId);
  const latest = pics[pics.length - 1];
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ id: string; r: Result } | null>(null);
  if (!latest) return null;
  const run = async () => {
    setBusy(true);
    try { setRes({ id: latest.id, r: await pictureCheck(book.id, sectionId, latest.id) }); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const r = res?.id === latest.id ? res.r : null;
  return (
    <div className="space-y-1 text-sm">
      <TooltipButton className="btn-alt" onClick={run} disabled={busy}>{busy ? "Checking…" : "Picture matches the page?"}</TooltipButton>
      <span className="hint ml-2">Checks the newest picture against this page's counts and worksheet (one small AI call).</span>
      {r && (
        <div className={`rounded-lg border p-2 ${r.ok ? "border-green/40 bg-green/10" : "border-accent/40 bg-accent/10"}`}>
          <p className="font-bold">{r.ok ? "✓ Matches" : "○ Does not match yet"}: <span className="font-normal">{r.summary}</span></p>
          <ul className="mt-1 space-y-0.5">
            {r.checks?.map((c, i) => <li key={i}>{c.pass ? "✓" : "✗"} <b>{c.what}</b>: wanted {c.wanted}; saw {c.seen}</li>)}
          </ul>
          {!r.ok && r.fix && (
            <p className="mt-1">Add to the picture prompt: <i>{r.fix}</i> <button type="button" className="underline" onClick={() => void navigator.clipboard?.writeText(r.fix)}>Copy</button></p>
          )}
        </div>
      )}
    </div>
  );
}
