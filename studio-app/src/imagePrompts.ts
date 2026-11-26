import type { Section, StylePreset } from "./types";
import { parseTagged } from "./printableBook";

// Same wording the server wraps around prompts, so the free "copy prompt" button matches.
export const COLORING_WRAPPER = "Children's coloring book page ONLY: pure white background, hollow uncolored shapes ONLY, uniform 2-3pt clean black outlines ready for crayons. STRICTLY FORBIDDEN: solid black backgrounds, black night skies, heavy black ink fills, gray shading, stippling, crosshatching, numbered dot-to-dots, mazes, charts, or text.";

export const COLORING_GUARDRAIL = "One single full-page scene with generous margins.";

export function bibleSummary(bible: string | undefined): string {
  const flat = (bible ?? "").replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const cut = flat.length > 500 ? `${flat.slice(0, 500).replace(/\s+\S*$/, "")}…` : flat;
  return `Book style and characters (follow exactly, never change a character's species or look): ${cut}\n\n`;
}

export function wrapPrompt(preset: StylePreset, prompt: string, styleBible?: string): string {
  return bibleSummary(styleBible) + wrapCore(preset, prompt);
}

function wrapCore(preset: StylePreset, prompt: string): string {
  const p = prompt.trim();
  switch (preset) {
    case "coloring": return `${COLORING_WRAPPER} ${COLORING_GUARDRAIL} Subject: ${p}`;
    case "cover": return `Bright, appealing book cover artwork with a clear focal subject and space for a title, no lettering. Subject: ${p}`;
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
