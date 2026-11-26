import { useState } from "react";
import type { Book } from "../types";
import CharacterReference from "../components/CharacterReference";

interface Props { book: Book; books: Book[]; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; fail: (e: unknown) => void; locked: boolean }

const MAX_IMPORT = 300_000; // characters; keeps the saved book comfortably small

export default function Tab1Details({ book, books, update, commit, fail, locked }: Props) {
  const [target, setTarget] = useState<"notes" | "styleBible">("notes");
  const [importMsg, setImportMsg] = useState("");
  const others = books.filter((b) => b.id !== book.id);
  const linked = new Set(book.linkedBookIds ?? []);

  const toggleLink = (id: string) => {
    const next = new Set(linked);
    if (next.has(id)) next.delete(id); else next.add(id);
    update({ linkedBookIds: [...next] });
  };

  const importText = async (f: File | undefined) => {
    if (!f) return;
    setImportMsg("");
    try {
      let text = (await f.text()).replace(/\r\n/g, "\n").trim();
      if (!text) { setImportMsg("That file is empty."); return; }
      let trimmed = false;
      if (text.length > MAX_IMPORT) { text = text.slice(0, MAX_IMPORT); trimmed = true; }
      const block = `\n\n--- Imported from ${f.name} ---\n${text}\n`;
      update(target === "notes" ? { notes: `${book.notes}${block}`.trimStart() } : { styleBible: `${book.styleBible}${block}`.trimStart() });
      setImportMsg(`Added ${text.length.toLocaleString()} characters to ${target === "notes" ? "Notes" : "the Style Bible"}${trimmed ? ` (cut at ${MAX_IMPORT.toLocaleString()} characters)` : ""}. Press Save.`);
    } catch { setImportMsg("Could not read that file."); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Book details</h2>
        <div>
          <label className="label">Title</label>
          <input className="field" value={book.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">Subtitle</label>
          <input className="field" value={book.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Studio mode</label>
            <select className="field" value={book.mode} onChange={(e) => update({ mode: e.target.value as Book["mode"] })}>
              <option value="activity">Activity (coloring, tracing, STEM)</option>
              <option value="storybook">Storybook</option>
              <option value="nonfiction">Nonfiction / workbook</option>
            </select>
          </div>
          <div>
            <label className="label">Trim size</label>
            <select className="field" value={book.trim} onChange={(e) => update({ trim: e.target.value as Book["trim"] })}>
              <option value="8.5x11">8.5 × 11 in</option>
              <option value="6x9">6 × 9 in</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Audience</label>
          <input className="field" value={book.audience} onChange={(e) => update({ audience: e.target.value })} placeholder="e.g. ages 3–5, parents of toddlers" />
        </div>
        <div>
          <label className="label">KDP AI disclosure</label>
          <select className="field" value={book.aiDisclosure} onChange={(e) => update({ aiDisclosure: e.target.value as Book["aiDisclosure"] })}>
            <option value="none">None: no AI-generated content</option>
            <option value="assisted">AI-assisted (I edited or created the content)</option>
            <option value="generated">AI-generated (disclose to KDP)</option>
          </select>
          <p className="mt-1 text-xs text-muted">KDP asks you to disclose AI-generated text, images or translations when you publish. Choose what applies and answer the question in KDP accordingly.</p>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="field min-h-24" value={book.notes} readOnly={locked} onChange={(e) => update({ notes: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-3 lg:col-span-2">
        <h2 className="text-base font-bold text-forest">Series memory</h2>
        <p className="hint">Link earlier books so Outline, Draft, Review and the KDP package keep characters, facts and voice consistent. Their title, style bible, notes and section summaries are sent along as series context.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="series-name">Series name</label>
              <input id="series-name" className="field" value={book.seriesName ?? ""} onChange={(e) => update({ seriesName: e.target.value })} placeholder="e.g. Barnaby, or Steady Under Pressure" />
            </div>
            <div>
              <label className="label">Link previous / reference books</label>
              {others.length === 0 ? (
                <p className="hint">No other books in the Studio yet.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto rounded-lg border border-line p-2">
                  {others.map((b) => (
                    <li key={b.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-forest/10">
                        <input type="checkbox" checked={linked.has(b.id)} onChange={() => toggleLink(b.id)} />
                        <span className="flex-1">{b.title}</span>
                        <span className="text-xs text-muted">{b.mode}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint mt-1">{linked.size} linked{linked.size > 6 ? ". Only the first 6 are sent to the AI." : "."}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Import text from an earlier book (.txt or .md)</label>
              <div className="flex flex-wrap items-center gap-2">
                <select className="field !w-auto" value={target} onChange={(e) => setTarget(e.target.value as "notes" | "styleBible")} aria-label="Where to add the text">
                  <option value="notes">Add to Notes</option>
                  <option value="styleBible">Add to Style Bible</option>
                </select>
                <label className="btn-alt">
                  Import Text (.txt / .md)
                  <input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => { void importText(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
              {importMsg && <p className="hint mt-1">{importMsg}</p>}
              <p className="hint mt-1">Appends to what is already there. Pasting straight into the boxes works too.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-bold text-forest">Style Bible</h2>
        <p className="text-xs text-muted">Voice, visuals, characters and layout rules. The Book Builder sends this with every section it drafts. {locked && "Locked while an AI job is running."}</p>
        <CharacterReference book={book} commit={commit} fail={fail} />
        <textarea className="field min-h-[26rem] font-mono" value={book.styleBible} readOnly={locked} onChange={(e) => update({ styleBible: e.target.value })} placeholder="Generate an outline in the Book Builder to draft this, or write your own." />
      </section>
    </div>
  );
}
