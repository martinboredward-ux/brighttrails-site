import { useState } from "react";
import type { Book, WidgetKind } from "../types";
import { WIDGETS, widgetSvg } from "../utils/activitySvgWidgets";
import { TooltipButton } from "./TooltipButton";

/** The contract a new widget must follow, so a function written in ChatGPT drops straight into Studio. */
export function widgetRequestPrompt(wish: string, book: Book): string {
  const have = WIDGETS.filter((w) => w.id !== "wordbank").map((w) => `${w.id} (${w.label})`).join("; ");
  return `You are writing ONE new page-widget for a children's activity-book maker called Bright Trails Studio. A widget is a small TypeScript function that draws one puzzle or activity as an SVG string. Code draws every letter, number, grid and label, so they are always exact. Do NOT use any image, font file or library.

WHAT TO BUILD
${wish.trim() || "(describe the puzzle here: what the child does, what is drawn, how many items, and what the answer is)"}

Book it is for: "${book.title || "untitled"}"${book.seriesName ? ` (series: ${book.seriesName})` : ""}, ${book.audience || "ages 6 to 9"}. Black-and-white coloring-book style.

RULES (follow every one)
1. Write one function: function myWidget(seed: number): string. Same seed must always give the same drawing (use the small seeded random helper: const rnd = (seed:number)=>{ let s=(seed*9301+49297)%233280; return ()=>((s=(s*9301+49297)%233280)/233280); }).
2. Return the string by calling wrap(inner, height). wrap puts the drawing in an SVG with viewBox 0 0 600 height. Draw everything inside x 0 to 600 and y 0 to height. Height is between 260 and 360.
3. Black on white only: stroke="#000", fill="#fff" or "#000". No gray, no color, no gradients, no shadows. Line width 2.5 to 3.
4. All text uses the font attribute string F (font-family Fredoka/Nunito). Text size 13 to 17 for labels, 30 for big arrows. Keep text short and inside the page.
5. Closed shapes with white fill so a child can color them. Keep at least 12 px of space between objects.
6. Leave an answer space for the child (a box, a line "______", or a blank circle). Never print the answer in the drawing.
7. Also return, after the function, a second tiny function myWidgetAnswer(seed: number): string that returns the answer in one short sentence, for the answer key.
8. No imports, no external calls, no randomness except through rnd(seed). Plain TypeScript, strict mode.
9. Do not copy these existing widgets: ${have}.

Return only the two functions in one code block, then one line: the label to show in the menu, for example "Spot the Differences (6)".`;
}

/** Shows every page widget with a live sample, and writes a ready prompt to have ChatGPT build a new one. */
export default function WidgetLibrary({ book }: { book: Book }) {
  const [seed, setSeed] = useState(1);
  const [wish, setWish] = useState("");
  const [copied, setCopied] = useState(false);
  const used = (id: WidgetKind) => book.sections.filter((s) => (s.widget ?? "wordbank") === id).length;

  const copy = async () => {
    try { await navigator.clipboard.writeText(widgetRequestPrompt(wish, book)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  return (
    <section className="card space-y-3">
      <details>
        <summary className="cursor-pointer text-base font-bold text-forest">Page widgets ({WIDGETS.length - 1} puzzle types) and how to add a new one</summary>
        <p className="hint mt-2">A widget is a puzzle or map that Studio draws in code, so letters, numbers and grids are always exact. Pick one per page under each section. Free: runs in your browser.</p>
        <div className="mt-2 flex items-center gap-2">
          <TooltipButton type="button" className="btn-alt" tip="Shows a different random sample of every widget." engine="$0 Free · Runs in your browser" onClick={() => setSeed((n) => n + 1)}>New samples</TooltipButton>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WIDGETS.filter((w) => w.id !== "wordbank").map((w) => (
            <li key={w.id} className="space-y-1 rounded-lg border border-line bg-white p-2">
              <div className="max-h-44 overflow-hidden" dangerouslySetInnerHTML={{ __html: widgetSvg(w.id, seed) }} />
              <p className="text-xs font-semibold text-forest">{w.label}</p>
              <p className="text-[11px] text-muted">Used on {used(w.id)} page{used(w.id) === 1 ? "" : "s"} in this book</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 rounded-lg border border-sun p-3">
          <h3 className="text-sm font-bold text-forest">Need a puzzle that isn&rsquo;t here? Have ChatGPT build it</h3>
          <label className="block text-xs text-muted">What should the new puzzle be?
            <textarea className="field mt-1 min-h-20" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Example: Spot the Differences. Two garden pictures side by side, six things changed in the second one, a box to write how many you found." />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipButton type="button" className="btn" tip="Copies a complete request with Studio's rules. Paste it into ChatGPT." engine="$0 Free · Copies a prompt" onClick={copy}>{copied ? "Copied" : "$0 Copy widget request for ChatGPT"}</TooltipButton>
          </div>
          <p className="hint">Paste it into ChatGPT, then paste ChatGPT&rsquo;s code back to Claude in the build chat. Claude adds it to Studio and it shows up here and in each section&rsquo;s menu after the next deploy. Studio never runs pasted code itself, so nothing unsafe can get in.</p>
        </div>
      </details>
    </section>
  );
}
