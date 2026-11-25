import type { Book } from "../types";

interface Props { book: Book; update: (p: Partial<Book>) => void; locked: boolean }

export default function Tab1Details({ book, update, locked }: Props) {
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
          <p className="mt-1 text-xs text-forest/60">KDP asks you to disclose AI-generated text, images or translations when you publish. Choose what applies and answer the question in KDP accordingly.</p>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="field min-h-24" value={book.notes} onChange={(e) => update({ notes: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-bold text-forest">Style Bible</h2>
        <p className="text-xs text-forest/60">Voice, visuals, characters and layout rules. The Book Builder sends this with every section it drafts. {locked && "Locked while an AI job is running."}</p>
        <textarea className="field min-h-[26rem] font-mono" value={book.styleBible} readOnly={locked} onChange={(e) => update({ styleBible: e.target.value })} placeholder="Generate an outline in the Book Builder to draft this, or write your own." />
      </section>
    </div>
  );
}
