import { useState } from "react";
import { bibleSummary, visualBible } from "../imagePrompts";

/** Shows exactly what the picture engines will see from the Style Bible, and warns when the useful lines would be lost. */
export default function BibleHealth({ bible }: { bible: string }) {
  const [open, setOpen] = useState(false);
  if (!bible.trim()) return null;
  const vis = visualBible(bible);
  const sent = bibleSummary(bible).replace(/^Book style and characters \(follow exactly, never change a character's species or look\): /, "").trim();
  const warns: string[] = [];
  if (vis.length > 1200) warns.push(`The picture part of your bible is ${vis.length.toLocaleString()} characters; the picture engines use about 1,200. Put the look, characters, props and layout first and keep it short.`);
  if (!/\b(avoid|never|do not|don't)\b/i.test(vis)) warns.push("No \"Avoid\" line found in the picture part. Add one short line, for example: Avoid clutter, dark shading, text in the picture.");
  if (vis.length < 120) warns.push("Very little picture description found. Add the colors, character looks and props.");
  return (
    <div className="space-y-1 text-xs">
      {warns.map((w) => <p key={w} className="rounded border border-accent/40 bg-accent/10 p-2 text-accent">{w}</p>)}
      <button type="button" className="underline text-muted" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} what the picture engines see ({sent.length.toLocaleString()} characters)</button>
      {open && <p className="rounded border border-line p-2 font-mono">{sent || "(nothing)"}</p>}
    </div>
  );
}
