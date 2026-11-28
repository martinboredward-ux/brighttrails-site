export const COVER_SAFE = "Bright, appealing children's book COVER artwork, no lettering of any kind. COMPOSITION CRITICAL: Place the character and kite (or other main subject) smaller in the LOWER 60% of the frame (below the horizontal midline). The entire TOP 35-40% MUST be completely empty open sky and soft clouds ONLY: no character head, hair, hands, kite tips or objects in the top 35%. Keep faces clear and fully visible, keep the bottom 12% a simple calm ground area, and make the scene still work if the edges are trimmed. FULL SUBJECT IN FRAME (critical): show the WHOLE subject, never cropped by any edge: for a vehicle, every wheel, the bumper and the ground under it must be visible with clear empty ground below it (at least 10% of the picture height) and clear space on both sides; zoom OUT and draw the subject smaller rather than let any part touch or leave the bottom or side edges.";
import { LETTER_WORDS } from "../../netlify/lib/templates";
import type { Section, StylePreset } from "./types";
import { parseTagged } from "./printableBook";

// Same wording the server wraps around prompts, so the free "copy prompt" button matches.
export const COLORING_WRAPPER = "Children's coloring book page ONLY: pure white background, hollow uncolored shapes ONLY, uniform 2-3pt clean black outlines ready for crayons. STRICTLY FORBIDDEN: solid black backgrounds, black night skies, heavy black ink fills, gray shading, stippling, crosshatching, numbered dot-to-dots, mazes, charts, or text.";

export const COLORING_GUARDRAIL = "One single full-page scene with generous margins.";


const PROSE_RULE = /\b(voice|reading level|lap-?read|read-?aloud|sentence fragments?|onomatop\w*|worksheets?|word bank|answer key|spelling|vocabulary|phonics|rhythm|narrat\w*|dialogue|story text|tone of|prose|writing|word count|paragraphs?|humou?r|(?<!skin )tone(?!s)|emotional beats?|affirmations?|layout|tiers?|vertical hierarchy|facing spreads?|gutter|safety margin|dashed|dotted|tracing|stroke vocabulary|directional|movement verbs?|practice (?:lines|boxes))\b/i;

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

const AVOID_LINE = /^(avoid|never|do not|don't|no |not )/i;

export function bibleSummary(bible: string | undefined, cap = 1200): string {
  const flat = visualBible(bible) || (bible ?? "").replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  // The Avoid / Never lines are always kept: they are what stops wrong styles, so they must not be cut off the end.
  const sentences = flat.split(/(?<=[.!?])\s+/);
  const avoid = sentences.filter((x) => AVOID_LINE.test(x.trim())).join(" ").slice(0, 320);
  const rest = sentences.filter((x) => !AVOID_LINE.test(x.trim())).join(" ");
  const room = Math.max(250, cap - avoid.length - 1);
  let cut = rest;
  if (rest.length > room) {
    const head = rest.slice(0, room);
    const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
    cut = end > 200 ? head.slice(0, end + 1) : head.replace(/\s+\S*$/, "");
  }
  return `Book style and characters (follow exactly, never change a character's species or look): ${cut}${avoid ? ` ${avoid}` : ""}\n\n`;
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
    case "planner": return `Modern full-color editorial illustration for an adult planner: refined palette, crisp elegant contours, generous negative space and margins, polished professional look. NOT a kids or cartoon style, no coloring-book outlines, no text or lettering. Subject: ${p}`;
    case "cutout": return `Full-color cut-out clip-art sheet on a PURE WHITE background: several separate icons or badges with clean outlines, generous empty space between every item, nothing touching the page edge, one consistent refined palette, no text or lettering. Subject: ${p}`;
    case "aplus": return `Clean marketing illustration for an online book listing, uncluttered, friendly, no text or lettering. Subject: ${p}`;
    default: return `Warm, friendly children's picture book illustration, soft colors, clear simple shapes, no text or lettering. Scene: ${p}`;
  }
}

const NOT_A_SCENE = /dot[- ]to[- ]dot|maze|sequenc|world map|\bmap\b|chart|inverted|black background|night sky|\b\d+(\.\d+)?\s*(pt|mm|in)\b|trim|gutter|stroke|margin|track width/i;

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUM = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2})";
const COUNT_RE = new RegExp(`\\b(?:count|find|spot|see|look for|circle|point to|can you find|there (?:are|is)|how many)\\b[^.?!\\n]{0,40}?\\b(${NUM})\\s+((?:[a-z-]+\\s){0,2}[a-z-]{3,})`, "gi");
const NOT_A_THING = /^(?:of|the|more|times|different|ways|steps|things|minutes?|seconds?|pages?|words?|letters?|colors?|colours?|questions?)$/i;

/** Things the page asks the child to count or find, with the exact number, e.g. "3 traffic cones". Read from the whole section, not just the summary. */
export function countCues(s: Section): { n: number; thing: string }[] {
  const text = `${s.summary}\n${s.draft}`.replace(/[*_#`]/g, " ");
  const seen = new Map<string, number>();
  for (const m of text.matchAll(COUNT_RE)) {
    const n = NUM_WORDS[m[1].toLowerCase()] ?? Number(m[1]);
    const words = m[2].trim().toLowerCase().split(/\s+/);
    while (words.length > 1 && /^(?:along|on|in|at|near|by|with|around|down|up|from|to|and|that|the|a)$/.test(words[words.length - 1])) words.pop();
    const last = words[words.length - 1];
    if (!n || n > 12 || NOT_A_THING.test(last) || NOT_A_THING.test(words[0])) continue;
    const thing = words.join(" ");
    if (!seen.has(thing)) seen.set(thing, n);
  }
  return [...seen].map(([thing, n]) => ({ n, thing })).slice(0, 4);
}

/** "Exactly 3 traffic cones" style lines that go FIRST in the picture prompt so the picture matches the worksheet. */
export function countLine(s: Section): string {
  const c = countCues(s);
  if (!c.length) return "";
  return `MUST SHOW, clearly visible and separate from each other: ${c.map((x) => `exactly ${x.n} ${x.thing}`).join("; ")}. Do not draw more or fewer. `;
}

/** What the picture box starts with: the section's [IMAGE_PROMPT] if it has one, else a cleaned-up scene from its summary. Exact counts the page asks for always come first. */
/** The book's mascot: the first character in the Library, else a generic phrase. */
export function mascotName(book: { characters?: { name: string; kind?: string }[] }): string {
  return (book.characters ?? []).find((c) => (c.kind ?? "character") === "character")?.name?.trim() || "the mascot";
}

export function defaultScenePrompt(s: Section, mascot = ""): string {
  // Tracing letter pages: Studio draws the letter, strokes and practice rows in code, so the picture must be the mascot only.
  if (s.tpl === "letter") {
    const ch = (s.data?.letter ?? s.title.replace(/^Letter\s+/i, "")[0] ?? "A").toUpperCase();
    const word = LETTER_WORDS[ch] ?? "";
    const who = mascot || "the mascot";
    return `${who}, the book's friendly mascot character: copy the attached reference picture exactly (same animal, face, ears, headband and outfit; never change the species), standing full body in a happy pose with one hand pointing to the right${word ? `, beside one small ${word}` : ""}. Only ${who}${word ? ` and the ${word}` : ""}, centered on a plain pure white background with generous empty space around them. NO letters, NO numbers, NO words, NO arrows, NO dotted lines, NO tracing rows, NO boxes, NO frames, NO borders, NO second character. One single small picture, not a worksheet.`;
  }
  const tagged = parseTagged(s.draft)?.IMAGE_PROMPT?.replace(/\s+/g, " ").trim();
  const counts = countLine(s);
  if (tagged) return counts && !/exactly \d/i.test(tagged) ? counts + tagged : tagged;
  const sentences = `${s.summary}`.split(/(?<=[.!?])\s+/).filter((x) => x.trim() && !NOT_A_SCENE.test(x));
  return `${counts}${s.title}. ${sentences.slice(0, 2).join(" ")}`.trim();
}

export type LibKind = "character" | "badge" | "prop" | "cover" | "page" | "puzzle";

/** Smart starting prompts for the Library's "Generate with AI". */
export function libraryPrompt(kind: LibKind, name: string, detail = "", color = false, mode = ""): { prompt: string; preset: StylePreset } {
  const r = libraryPromptBase(kind, name, detail, color);
  // Adult planners: refined full-color planner art (badges and props as clean clip-art), never the kids' storybook style.
  if (mode === "planner" && kind !== "puzzle" && kind !== "cover") return { prompt: r.prompt.replace(/ Full color in the book's storybook palette\./, " Full color in a refined planner palette.").replace(/Black-and-white coloring-book line art on pure white/, "Refined full-color illustration on pure white"), preset: kind === "badge" || kind === "prop" ? "cutout" : "planner" };
  return r;
}

function libraryPromptBase(kind: LibKind, name: string, detail = "", color = false): { prompt: string; preset: StylePreset } {
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

/** A ready-to-paste cover picture prompt for ChatGPT or Nano Banana: the scene plus the cover-safe composition rules, in the book's style. */
export function coverPrompt(scene: string, aspect: "portrait" | "square" | "landscape", styleBible?: string, look?: string): string {
  const shape = aspect === "square" ? "SQUARE (1:1)" : aspect === "landscape" ? "LANDSCAPE (4:3)" : "TALL PORTRAIT (about 2:3)";
  return `${bibleSummary(styleBible)}Create a ${shape} children's book COVER illustration, bright and appealing, with NO lettering, words, logos or numbers anywhere. Scene: ${scene.trim()} COMPOSITION: the main subject sits in the LOWER 60% of the frame; the TOP 35% is completely empty open sky or plain space (nothing, not even a head or tip, enters it) because the title is added later; faces fully visible; a calm simple band across the bottom 12%; keep everything important away from the outer edges. FULL SUBJECT IN FRAME (critical): show the WHOLE subject, never cropped by any edge: for a vehicle, every wheel, the bumper and the ground under it must be visible with clear empty ground below it (at least 10% of the picture height) and clear space on both sides; zoom OUT and draw the subject smaller rather than let any part touch or leave the bottom or side edges. One clear hero subject, bold simple shapes, strong contrast, so it still reads as a small thumbnail.${look ? ` MATCH THE LOOK OF MY OTHER COVERS (reference pictures attached): ${look.trim()}` : ""}`;
}
