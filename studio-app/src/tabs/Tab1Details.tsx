import { TRIMS } from "../utils/trims";
import BibleHealth from "../components/BibleHealth";
import { useState } from "react";
import type { Book, GuideChar } from "../types";
import CharacterLibrary from "../components/CharacterLibrary";

interface Props { book: Book; books: Book[]; update: (p: Partial<Book>) => void; commit: (p: Partial<Book>) => Promise<void>; fail: (e: unknown) => void; locked: boolean }

const DEFAULT_GUIDE: GuideChar = {
  on: false,
  name: "Maya",
  look: "Maya, polished female founder: sleek high topknot, tailored blazer over silk blouse, trousers, gold hoop earrings, smart wristwatch.",
  voice: "Maya is the narrator. She speaks directly to the reader in a warm, confident, first-person voice (\"Hi, I'm Maya...\") and appears on guided and phase pages as the guide.",
};

const MAX_IMPORT = 300_000; // characters; keeps the saved book comfortably small

export default function Tab1Details({ book, books, update, commit, fail, locked }: Props) {
  const [target, setTarget] = useState<"notes" | "styleBible">("notes");
  const g: GuideChar = { ...DEFAULT_GUIDE, ...(book.studio?.guide ?? {}) };
  const [guideMsg, setGuideMsg] = useState("");
  const setGuide = (next: GuideChar, patch: Partial<Book> = {}) => update({ ...patch, studio: { ...(book.studio ?? {}), guide: next } });
  const strip = (text: string, line: string) => (line.trim() && text.includes(line.trim()) ? text.replace(line.trim(), "").replace(/\n{3,}/g, "\n\n").trim() : text);
  const add = (text: string, line: string) => (line.trim() && !text.includes(line.trim()) ? `${text.trim()}${text.trim() ? "\n\n" : ""}${line.trim()}` : text);
  const toggleGuide = (on: boolean) => {
    if (locked) return;
    if (on) { setGuide({ ...g, on }, { styleBible: add(book.styleBible, g.look), notes: add(book.notes, g.voice) }); setGuideMsg(`${g.name} is ON: her look was added to the Style Bible and her voice to the notes.`); }
    else {
      const sb = strip(book.styleBible, g.look), nt = strip(book.notes, g.voice);
      setGuide({ ...g, on }, { styleBible: sb, notes: nt });
      setGuideMsg(sb === book.styleBible && nt === book.notes ? `${g.name} is OFF. Her lines were not found in the Style Bible or notes (already removed or edited by hand).` : `${g.name} is OFF: her lines were removed from the Style Bible and notes.`);
    }
  };
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
        <h2 className="text-base font-bold text-forest">Core inputs (step 4: type these, or use Suggest details above)</h2>
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
              <option value="planner">Planner / guided workbook (full color)</option>
              <option value="gamebook">Trivia gamebook (ages 9-12)</option>
              <option value="tracing">Preschool letter tracing</option>
            </select>
          </div>
          <div>
            <label className="label">Trim size</label>
            <select className="field" value={book.trim} onChange={(e) => update({ trim: e.target.value as Book["trim"] })}>
              {TRIMS.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.use})</option>)}
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
      </section>

      <section className="card space-y-3 lg:col-span-2">
        <h2 className="text-base font-bold text-forest">Series memory</h2>
        <p className="hint">Link earlier books so Outline, Draft, Review and the KDP package keep characters, facts and voice consistent. Their title, style bible, notes and section summaries are sent along as series context.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="series-name">Series name</label>
              <input id="series-name" className="field" value={book.seriesName ?? ""} onChange={(e) => update({ seriesName: e.target.value })} placeholder="e.g. Lanternside Mysteries, or Steady Under Pressure" />
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
        <div className="rounded-lg border border-line p-3 space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={g.on} disabled={locked} onChange={(e) => toggleGuide(e.target.checked)} />
            Narrator / guide character: {g.name || "guide"} {g.on ? "(ON)" : "(OFF)"}
          </label>
          <p className="hint">ON adds her look to the Style Bible (so picture prompts include her) and her voice to the notes (so the AI writes in her voice). OFF removes exactly those lines. After switching, run Fill the words again on pages you want rewritten.</p>
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-forest">Edit her name, look and voice</summary>
            <div className="mt-2 space-y-2">
              <input className="field" value={g.name} disabled={g.on} onChange={(e) => setGuide({ ...g, name: e.target.value })} aria-label="Guide name" />
              <textarea className="field min-h-[3.5rem]" value={g.look} disabled={g.on} onChange={(e) => setGuide({ ...g, look: e.target.value })} aria-label="Guide look" />
              <textarea className="field min-h-[3.5rem]" value={g.voice} disabled={g.on} onChange={(e) => setGuide({ ...g, voice: e.target.value })} aria-label="Guide voice" />
              {g.on && <p className="hint">Switch her OFF to edit these, then ON again.</p>}
            </div>
          </details>
          {guideMsg && <p className="hint">{guideMsg}</p>}
        </div>
        <p className="text-xs text-muted">Voice, visuals, characters and layout rules. The Book Builder sends this with every section it drafts. {locked && "Locked while an AI job is running."}</p>
        <textarea className="field min-h-[26rem] font-mono" value={book.styleBible} readOnly={locked} onChange={(e) => update({ styleBible: e.target.value })} placeholder="Generate an outline in the Book Builder to draft this, or write your own." />
        <BibleHealth bible={book.styleBible} />
      </section>

      <section className="card space-y-2 lg:col-span-2">
        <h2 className="text-base font-bold text-forest">Character Library</h2>
        <p className="text-xs text-muted">Upload every character sheet, badge and prop once, with a name. When you generate a picture, ChatGPT and Nano Banana both receive the ones you pick (or the ones named in your prompt), so the cast and badges stay the same across the whole book.</p>
        <CharacterLibrary book={book} commit={commit} fail={fail} />
      </section>
    </div>
  );
}
