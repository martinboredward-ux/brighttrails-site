import type { StylePreset } from "./types";

// Same wording the server wraps around prompts, so the free "copy prompt" button matches.
export const COLORING_WRAPPER = "Clean black and white coloring book page, thick bold closed outlines, pure white background, no gray shading, no text, generous margins";

export const COLORING_GUARDRAIL = "One single full-page children's coloring scene ONLY. NO comic panels, NO multi-box grids, NO charts, NO maps with small labels, NO text.";

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
    case "coloring": return `${COLORING_WRAPPER}. ${COLORING_GUARDRAIL} Subject: ${p}`;
    case "cover": return `Bright, appealing book cover artwork with a clear focal subject and space for a title, no lettering. Subject: ${p}`;
    case "aplus": return `Clean marketing illustration for an online book listing, uncluttered, friendly, no text or lettering. Subject: ${p}`;
    default: return `Warm, friendly children's picture book illustration, soft colors, clear simple shapes, no text or lettering. Scene: ${p}`;
  }
}
