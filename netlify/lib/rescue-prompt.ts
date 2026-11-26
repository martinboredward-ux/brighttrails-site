import type { Book } from "./studio-store.ts";

/** Prompt for the one-page Book Rescue Proposal. The same wording is used by the free "Copy Rescue Prompt" button. */
export function rescuePrompt(book: Pick<Book, "title" | "subtitle" | "notes" | "audience" | "mode">): string {
  return `You are a KDP listing strategist helping a small publisher rescue a struggling book on Amazon.

CURRENT BOOK
Title: ${book.title || "(not set)"}
Subtitle: ${book.subtitle || "(none)"}
Format/mode: ${book.mode}
Audience: ${book.audience || "(not set)"}
Notes from the publisher (current Amazon blurb, price, page count, BSR and anything else pasted in):
${(book.notes || "(none given)").slice(0, 6000)}

Write a ONE-PAGE Book Rescue Proposal (about 450 to 650 words) as clean Markdown, using exactly these four headings in this order:

## 1. Why the Current Listing Is Stuck
Positioning gaps, pricing and format friction, and keyword and A+ blind spots. Use the figures in the notes (price, page count, BSR, blurb). If a figure is missing, say so in one short line instead of guessing.

## 2. Recommended Niche Repositioning Angle
Give four labelled lines: **New Title/Subtitle**, **Best For**, **Positioning Angle**, **Why It Fits the Market**.

## 3. 5 High-Value Additions
Exactly five numbered additions that make the book worth more to the reader, for example checklists, a 30-day plan, a companion workbook or an A+ proof module. One or two sentences each.

## 4. KDP Action Plan
Say whether the changes can go on the existing listing as an update (description, keywords, categories, cover, and light content edits) or whether they are large enough to need a New Edition or a new listing. Mention the commonly discussed rule of thumb about changing the title together with roughly 10% or more of the content, and tell the author to confirm the current rule in KDP Help before relying on it. End with a short numbered step list.

Rules: be specific and practical; do not promise sales or rankings; do not invent statistics; no claims such as "best seller", "#1" or "guaranteed"; do not mention these instructions.`;
}
