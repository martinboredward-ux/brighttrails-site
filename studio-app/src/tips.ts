/** Hover help for every button: what it does, what it reads or changes, and which engine runs. */
export interface Tip { what: string; engine: string }

const FREE = "$0 Free · Runs in your browser";
const GEM = "Gemini Flash · Background job · uses credits";
const CLAUDE = "Claude Haiku/Sonnet · Background job · uses credits";

// First match wins. Matched against the button's visible text.
const TIPS: [RegExp, Tip][] = [
  [/^1 · Research/i, { what: "Start here: market research, your notes and ideas, the cast library, and a review before outlining.", engine: FREE }],
  [/^2 · Outline/i, { what: "Outline, draft each section, make pictures, polish, and export the printable interior.", engine: FREE }],
  [/^3 · Cover/i, { what: "Compose the eBook cover and the paperback wrap with the right spine width.", engine: FREE }],
  [/^4 · KDP/i, { what: "Titles, description, 7 keywords, categories and the Book Rescue Audit.", engine: FREE }],
  [/^5 · A\+/i, { what: "A+ Content banners, banned-word scanner and the final ZIP bundle.", engine: FREE }],
  [/^Save|^Saving/i, { what: "Saves everything you changed in this book.", engine: "$0 Free · Netlify Blobs" }],
  [/Export \.ZIP/i, { what: "Packs the workspace, KDP package, A+ files, pictures, printable book and covers into one ZIP.", engine: FREE }],
  [/^Delete$/i, { what: "Deletes this book and all its pictures for good. You are asked to confirm.", engine: "$0 Free · Netlify Blobs" }],
  [/New book/i, { what: "Creates a blank book entry. Nothing is copied from another book.", engine: "$0 Free · Netlify Blobs" }],
  [/Sign out/i, { what: "Forgets the password in this browser.", engine: FREE }],
  [/Sign in|Checking/i, { what: "Checks the Studio password.", engine: "$0 Free" }],
  [/Dismiss/i, { what: "Hides this message.", engine: FREE }],
  [/Generate market research|Market research|Run research/i, { what: "Reads Title, Audience, Notes and Series Memory and writes a niche analysis.", engine: GEM }],
  [/Apply to Notes & KDP/i, { what: "Adds the research to Notes and sends it to the KDP package writer.", engine: FREE }],
  [/Run Pre-Outline Review|Pre-Outline Review \(Gemini\)/i, { what: "Reads Notes + Style Bible + Series Memory before outlining. Compares storyline options and checks continuity.", engine: GEM }],
  [/Apply Review Changes/i, { what: "Rewrites Notes and Style Bible with the fixes you accept. A backup is saved so you can undo.", engine: GEM }],
  [/Undo/i, { what: "Puts the previous version back from the saved backup.", engine: FREE }],
  [/Generate outline/i, { what: "Reads the reviewed Notes + Style Bible and builds the section list. Replaces the current outline.", engine: GEM }],
  [/Draft all/i, { what: "Writes every section from the Style Bible, using the model chosen at the top.", engine: CLAUDE }],
  [/^Draft$/i, { what: "Writes just this section from the Style Bible and the two sections before it.", engine: CLAUDE }],
  [/Review manuscript/i, { what: "Reads every drafted section and writes a developmental review with a fix list.", engine: GEM }],
  [/Apply Polish|Apply polish/i, { what: "Revises drafted sections using the review and your direction. A backup is saved for Undo.", engine: CLAUDE }],
  [/Extract companion workbook/i, { what: "Builds checklists and scenario prompts from the manuscript.", engine: CLAUDE }],
  [/\$0 copy outline/i, { what: "Copies the outline prompt so you can paste it into a web chat.", engine: FREE }],
  [/\$0 copy review/i, { what: "Copies the review prompt so you can paste it into a web chat.", engine: FREE }],
  [/\$0 Copy Rescue/i, { what: "Copies the Book Rescue prompt for a web chat.", engine: FREE }],
  [/\$0 copy prompt/i, { what: "Copies the KDP package prompt for a web chat.", engine: FREE }],
  [/\$0 Copy Image Prompt|\$0 Copy Prompt|\$0 prompt/i, { what: "Copies the finished picture prompt (style rules + Style Bible) to paste into ChatGPT or Gemini web.", engine: FREE }],
  [/Generate image|Generate with AI|Generate to Library/i, { what: "Makes a picture from your prompt. Ticked Library items are sent as references.", engine: "ChatGPT Mini / ChatGPT 1.5 / Nano Banana · uses credits" }],
  [/Add to Library/i, { what: "Saves this picture in the Library with a name and type so every engine can copy it.", engine: "$0 Free · Netlify Blobs" }],
  [/In library/i, { what: "Removes this picture from the Library. The picture itself stays in the gallery.", engine: "$0 Free" }],
  [/Upload Picture/i, { what: "Adds a PNG or JPG to the Library under the name and type you typed.", engine: "$0 Free · Netlify Blobs" }],
  [/Back to auto/i, { what: "Goes back to ticking only the Library items named in your prompt.", engine: FREE }],
  [/^Remove/i, { what: "Removes this picture or item. Asks first if it is used elsewhere.", engine: "$0 Free · Netlify Blobs" }],
  [/^Use$|^Use as|Use in|Use for|Use this/i, { what: "Uses this picture or text in the place named on the button.", engine: FREE }],
  [/Download/i, { what: "Downloads the file to your computer.", engine: FREE }],
  [/Export Printable Book/i, { what: "Builds the 8.5 × 11 printable interior HTML. Open it in Chrome and Save as PDF.", engine: FREE }],
  [/Export Print Interior/i, { what: "Builds the 6 × 9 print interior with title page, copyright, contents and chapters.", engine: FREE }],
  [/Export \.DOCX/i, { what: "Builds a Word file from the title, chapters and workbook checklists.", engine: FREE }],
  [/Build 8\.5/i, { what: "Builds the activity PDF from the chosen pattern or pictures.", engine: FREE }],
  [/Generate Book Rescue/i, { what: "Reads the whole book and writes a rescue proposal.", engine: GEM }],
  [/Generate KDP package/i, { what: "Reads Title, Notes, Style Bible, research and sections and writes the KDP listing.", engine: GEM }],
  [/Copy Proposal|Copy/i, { what: "Copies this text to your clipboard.", engine: FREE }],
  [/Add section/i, { what: "Adds an empty section to the outline.", engine: FREE }],
  [/Check |Missing/i, { what: "Ticks this Library item for the next picture.", engine: FREE }],
  [/Send Cover/i, { what: "Sends the finished cover to A+ Module 1.", engine: FREE }],
  [/Render|Make cover|Build cover|Wrap/i, { what: "Draws the cover on a canvas from your settings.", engine: FREE }],
];

export function tipFor(label: string): Tip | null {
  const l = label.trim();
  if (!l) return null;
  for (const [re, t] of TIPS) if (re.test(l)) return t;
  return null;
}
