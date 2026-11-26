import type { Book } from "./types";

// Same wording as the drafting step on the server (netlify/functions/book-studio-background.ts),
// so the free "$0 prompt" for a section produces text the printable-book exporter can read.
export const STORYBOOK_FORMAT = `Return ONLY the tagged blocks below, in this order. Each tag goes on its own line, followed by its content. Do not add closing tags, headings, preambles or notes.

[STORY_TEXT]
The read-aloud text for this spread: 5 to 7 short punchy lines (never more than 7), one short sentence or sound-word line each, about 35-70 words in total, with rhythm a toddler can echo. No long paragraphs.
[WHILE_YOU_LISTEN]
ONE short "point, count and play" prompt for the child about the picture (for example "Point to the kite. Can you count the clouds?"), one line, no list.
[IMAGE_PROMPT]
ONE sentence describing the single illustration for this spread: the main character and the setting only (what they are doing, where). No text or lettering in the picture.`;
export const formatFor = (mode: Book["mode"]) => (mode === "storybook" ? STORYBOOK_FORMAT : TAG_FORMAT);

export const TAG_FORMAT = `Return ONLY the tagged blocks below, in this order. Each tag goes on its own line, followed by its content. Do not add closing tags, headings, preambles or notes.

[STORY_TEXT]
The read-aloud story for this section, 70-140 words, short sentences, warm and clear, matching the audience reading level.
[WHILE_YOU_LISTEN]
3 short listening prompts for the child, one per line, each starting with "- ".
[GUIDE_TIME]
Time needed, for example "15 minutes".
[GUIDE_SKILL]
The one skill this section builds, in one short line.
[GUIDE_MATERIALS]
Materials, comma-separated (for example "crayons, pencil").
[GUIDE_SAY]
2-3 lines a parent or teacher can say aloud, one per line.
[GUIDE_DO]
2-3 short steps for the adult, one per line.
[GUIDE_CHECK]
What to look for or ask to check understanding, one to three lines.
[GUIDE_TIP]
One practical tip, one or two sentences.
[WORKSHEET_INSTRUCTIONS]
One sentence telling the child what to do.
[WORKSHEET_BODY]
4-6 numbered items the child completes: real fill-in-the-blank sentences using ___ for the gap (answers come from the word bank), or matching items, or simple math questions that fit this section. Never leave this as a placeholder.
[WORD_BANK]
Exactly 8 words separated by commas. Every blank in the worksheet must be answerable from these words.
[BONUS_DOODLE]
One sentence inviting the child to draw something related to the story.
[ANSWER_KEY]
The answers for the worksheet, numbered to match, one per line.
[IMAGE_PROMPT]
ONE sentence describing a single story coloring scene: the main character and the setting only (what they are doing, where). Do NOT mention a dot-to-dot, maze, sequencing chart, world map, black background or inverted coloring, labels or text.`;

export const CLEAN_RULES = `STRICT RULES
- Never write internal layout or print specifications into any block (no stroke widths such as "2 pt", no "8 mm track width", no gutter or margin sizes, no trim size). The style bible may mention layout rules; those are for the designer and must not be copied.
- Do not invent costume, gear or props (for example goggles, hats or backpacks) unless they are written in the style bible.
- Keep the main character exactly as described in the style bible.
- Write only content the child or the adult will read or use.`;

export const isTaggedMode = (m: Book["mode"]) => m === "activity" || m === "storybook";
