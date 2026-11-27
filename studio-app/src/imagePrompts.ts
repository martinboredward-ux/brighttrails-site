export const COVER_SAFE = "Bright, appealing children's book COVER artwork, no lettering of any kind. COMPOSITION CRITICAL: Place the character and kite (or other main subject) smaller in the LOWER 60% of the frame (below the horizontal midline). The entire TOP 35-40% MUST be completely empty open sky and soft clouds ONLY: no character head, hair, hands, kite tips or objects in the top 35%. Keep faces clear and fully visible, keep the bottom 12% a simple calm ground area, and make the scene still work if the edges are trimmed.";
import type { Section, StylePreset } from "./types";
import { parseTagged } from "./printableBook";

// Same wording the server wraps around prompts, so the free "copy prompt" button matches.
export const COLORING_WRAPPER = "Children's coloring book page ONLY: pure white background, hollow uncolored shapes ONLY, uniform 2-3pt clean black outlines ready for crayons. STRICTLY FORBIDDEN: solid black backgrounds, black night skies, heavy black ink fills, gray shading, stippling, crosshatching, numbered dot-to-dots, mazes, charts, or text.";

export const COLORING_GUARDRAIL = "One single full-page scene with generous margins.";


const PROSE_RULE = /\b(voice|reading level|lap-?read|read-?aloud|sentence fragments?|onomatop\w*|worksheets?|word bank|answer key|spelling|vocabulary|phonics|rhythm|narrat\w*|dialogue|story text|tone of|prose|writing|word count|paragraphs?)\b/i;

/** Keeps only the visual lines of a Style Bible (looks, colors, characters, setting). Writing rules are dropped. */
export function visualBible(bible: string | undefined): string {
  const keep: string[] = [];
  let skipping = false;
  for (const raw of (bible ?? "").split("\n")) {
    const line = raw.replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const isHeading = /^#{1,6}\s/.test(raw.trim()) || /^\*\*[^*]+\*\*:?\s*$/.test(raw.trim()) || /^[A-Z][A-Za-z &/-]{2,40}:$/.test(line);
    if (isHeading) { skipping = PROSE_RULE.test(line); continue; }
    if (skipping) continue;
    const kept = line.split(/(?<=[.!?])\s+/).filter((x) => !PROSE_RULE.test(x));
    if (kept.length) keep.push(kept.join(" "));
  }
  return keep.join(" ");
}

export function bibleSummary(bible: string | undefined): string {
  const flat = visualBible(bible) || (bible ?? "").replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  // Cut at a sentence end so a prompt never stops mid-sentence.
  let cut = flat;
  if (flat.length > 700) {
    const head = flat.slice(0, 700);
    const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
    cut = end > 250 ? head.slice(0, end + 1) : head.replace(/\s+\S*$/, "");
  }
  return `Book style and characters (follow exactly, never change a character's species or look): ${cut}\n\n`;
}

export function wrapPrompt(preset: StylePreset, prompt: string, styleBible?: string): string {
  return bibleSummary(styleBible) + wrapCore(preset, prompt);
}

function wrapCore(preset: StylePreset, prompt: string): string {
  const p = prompt.trim();
  switch (preset) {
    case "coloring": return `${COLORING_WRAPPER} ${COLORING_GUARDRAIL} Subject: ${p}`;
    case "library_bw": return `Black-and-white children's book art on a PURE WHITE background: clean uniform black outlines, hollow shapes ready for coloring, no gray shading, no stippling, no solid black fills, no lettering or numbers. Subject: ${p}`;
    case "library_color": return `Warm, friendly children's picture-book art on a plain white background: flat storybook colors, clean outlines, no lettering or numbers. Subject: ${p}`;
    case "cover": return `${COVER_SAFE} Subject: ${p}`;
    case "aplus": return `Clean marketing illustration for an online book listing, uncluttered, friendly, no text or lettering. Subject: ${p}`;
    default: return `Warm, friendly children's picture book illustration, soft colors, clear simple shapes, no text or lettering. Scene: ${p}`;
  }
}

const NOT_A_SCENE = /dot[- ]to[- ]dot|maze|sequenc|world map|\bmap\b|chart|inverted|black background|night sky|\b\d+(\.\d+)?\s*(pt|mm|in)\b|trim|gutter|stroke|margin|track width/i;

/** What the picture box starts with: the section's [IMAGE_PROMPT] if it has one, else a cleaned-up scene from its summary. */
export function defaultScenePrompt(s: Section): string {
  const tagged = parseTagged(s.draft)?.IMAGE_PROMPT?.replace(/\s+/g, " ").trim();
  if (tagged) return tagged;
  const sentences = `${s.summary}`.split(/(?<=[.!?])\s+/).filter((x) => x.trim() && !NOT_A_SCENE.test(x));
  return `${s.title}. ${sentences.slice(0, 2).join(" ")}`.trim();
}

export type LibKind = "character" | "badge" | "prop" | "cover" | "page" | "puzzle";

/** Smart starting prompts for the Library's "Generate with AI". */
export function libraryPrompt(kind: LibKind, name: string, detail = "", color = false): { prompt: string; preset: StylePreset } {
  const line: StylePreset = color ? "library_color" : "library_bw";
  const n = name.trim() || "the item";
  const d = detail.trim() ? ` ${detail.trim().replace(/\s+/g, " ")}` : "";
  switch (kind) {
    case "character":
      return { preset: line, prompt: `Character turnaround sheet of ${n}: the same character shown from the front, three-quarter and side view in one row on a white page, plus four small face expressions (happy, worried, surprised, proud). Full body, same outfit and proportions in every view.${color ? " Full color in the book's storybook palette." : ""}${d}` };
    case "badge":
      return { preset: line, prompt: `A single circular passport stamp badge for "${n}", centered, large, on a pure white background: a simple bold icon inside a round border with a dashed ring and small stars. Leave any banner or ribbon blank.${d}` };
    case "prop":
      return { preset: line, prompt: `One simple prop or corner emblem for the book: ${n}. Centered, bold outline, plenty of white space around it, readable when small (for example a compass rose with a blank circle at each point).${d}` };
    case "puzzle":
      return { preset: line, prompt: `One puzzle picture for the worksheet page: ${n}. Black-and-white coloring-book line art on pure white, wide shape, clear space around every object, NO letters or numbers anywhere (they are added later in code).${d}` };
    case "cover":
      return { preset: "library_color", prompt: `Cover style sample for "${n}": a bright, appealing cover scene with open sky or plain space across the top 30% for the title and a calm band at the bottom for the author name.${d}` };
    default:
      return { preset: line, prompt: `Page design for "${n}": a decorative full-page border or layout with an EMPTY center for text added later (for example a contents page or certificate).${d}` };
  }
}
