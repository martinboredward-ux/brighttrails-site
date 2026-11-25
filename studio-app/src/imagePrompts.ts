import type { StylePreset } from "./types";

// Same wording the server wraps around prompts, so the free "copy prompt" button matches.
export const COLORING_WRAPPER = "Clean black and white coloring book page, thick bold closed outlines, pure white background, no gray shading, no text, generous margins";

export function wrapPrompt(preset: StylePreset, prompt: string): string {
  const p = prompt.trim();
  switch (preset) {
    case "coloring": return `${COLORING_WRAPPER}. Subject: ${p}`;
    case "cover": return `Bright, appealing book cover artwork with a clear focal subject and space for a title, no lettering. Subject: ${p}`;
    case "aplus": return `Clean marketing illustration for an online book listing, uncluttered, friendly, no text or lettering. Subject: ${p}`;
    default: return `Warm, friendly children's picture book illustration, soft colors, clear simple shapes, no text or lettering. Scene: ${p}`;
  }
}
