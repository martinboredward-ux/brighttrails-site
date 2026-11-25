import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Book, KdpPackage } from "../types";
import { generateKdp } from "../api";
import { checkKeywords } from "../kdpCheck";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  save: () => Promise<Book | null>;
  setBook: Dispatch<SetStateAction<Book | null>>;
  fail: (e: unknown) => void;
}

const EMPTY: KdpPackage = {
  titleIdeas: [],
  htmlDescription: "",
  keywords: ["", "", "", "", "", "", ""],
  categories: ["", "", ""],
  isLowContent: false,
  aPlusModules: [
    { size: "970x600", headline: "", body: "" },
    { size: "970x300", headline: "", body: "" },
    { size: "300x300", headline: "", body: "" },
  ],
};

const ALLOWED = /^(b|i|br|p|ul|li|h4)$/i;

/** Preview only: keep the KDP-safe tags, drop their attributes and everything else. */
function previewHtml(html: string): string {
  return html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (m, tag: string) =>
    ALLOWED.test(tag) ? (m.startsWith("</") ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`) : "",
  );
}

export default function Tab3Kdp({ book, update, save, setBook, fail }: Props) {
  const [busy, setBusy] = useState(false);
  const kdp = book.kdp ?? EMPTY;
  const set = (patch: Partial<KdpPackage>) => update({ kdp: { ...kdp, ...patch } });

  const issues = useMemo(() => checkKeywords(kdp.keywords, book.title, book.subtitle), [kdp.keywords, book.title, book.subtitle]);
  const badTags = useMemo(() => {
    const found = new Set<string>();
    for (const m of kdp.htmlDescription.matchAll(/<\/?([a-z0-9]+)/gi)) if (!ALLOWED.test(m[1])) found.add(m[1].toLowerCase());
    return [...found];
  }, [kdp.htmlDescription]);

  const generate = async () => {
    if (book.kdp && !confirm("Replace the current KDP package with a new AI draft?")) return;
    setBusy(true);
    try {
      const saved = await save();
      if (!saved) return;
      const next = await generateKdp(book.id);
      setBook((b) => (b ? { ...b, kdp: next } : b));
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const copyPrompt = async () => {
    const text = `Create an Amazon KDP listing for: ${book.title}${book.subtitle ? `: ${book.subtitle}` : ""}. Mode: ${book.mode}. Audience: ${book.audience}. Notes: ${book.notes}.\nReturn: 3 title ideas; an HTML description using only <b>, <i>, <br>, <p>, <ul>, <li>, <h4>; exactly 7 keyword boxes (50 characters or fewer each, no duplicates, no words already in the title); 3 categories; whether it is low-content (coloring, tracing, activity books, storybooks and workbooks are not); 3 A+ content modules (970x600, 970x300, 300x300) with headline and body and none of: free, bonus, affordable, cheap, discount, sale, buy now, order now, add to cart, best seller, #1, guarantee, new, latest, review, 5 star.`;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-center gap-2">
        <button className="btn" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate KDP package (Gemini Flash)"}</button>
        <button className="btn-alt" onClick={copyPrompt}>$0 copy prompt for web chat</button>
        <span className="text-xs text-forest/60">Fills titles, description, 7 keywords, categories and A+ copy. Edit everything below.</span>
      </section>

      {kdp.warnings?.length ? (
        <section className="card border-accent/40 text-sm text-accent">{kdp.warnings.map((w) => <p key={w}>{w}</p>)}</section>
      ) : null}

      <section className="card space-y-2">
        <h2 className="text-base font-bold text-forest">Title ideas</h2>
        {kdp.titleIdeas.length === 0 && <p className="text-sm text-forest/60">None yet.</p>}
        <ul className="space-y-1 text-sm">
          {kdp.titleIdeas.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex-1">{t}</span>
              <button className="btn-alt !px-3 !py-1" onClick={() => update({ title: t })}>Use as title</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-forest">Seven keyword boxes</h2>
        {kdp.keywords.map((k, i) => {
          const is = issues[i];
          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-forest/60">{i + 1}</span>
                <input className={`field ${is.tooLong ? "!border-accent" : ""}`} value={k} onChange={(e) => set({ keywords: kdp.keywords.map((x, j) => (j === i ? e.target.value : x)) })} />
                <span className={`w-14 text-right text-xs font-semibold ${is.tooLong ? "text-accent" : is.length > 44 ? "text-sun" : "text-forest/60"}`}>{is.length}/50</span>
              </div>
              {(is.overTitle.length > 0 || is.overOthers.length > 0) && (
                <p className="ml-7 mt-1 text-xs text-accent">
                  {is.overTitle.length > 0 && <>Already in title/subtitle: {is.overTitle.join(", ")}. </>}
                  {is.overOthers.length > 0 && <>Repeated in another box: {is.overOthers.join(", ")}.</>}
                </p>
              )}
            </div>
          );
        })}
        <p className="text-xs text-forest/60">KDP allows 50 characters per box. Words already in your title or subtitle, or repeated across boxes, add nothing.</p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-bold text-forest">Description (HTML)</h2>
        <textarea className="field min-h-48 font-mono" value={kdp.htmlDescription} onChange={(e) => set({ htmlDescription: e.target.value })} />
        {badTags.length > 0 && <p className="text-xs text-accent">KDP-unsafe tags found: {badTags.map((t) => `<${t}>`).join(", ")}. Allowed: b, i, br, p, ul, li, h4.</p>}
        <details className="text-sm"><summary className="cursor-pointer text-forest/70">Preview</summary><div className="prose mt-2 rounded-lg bg-cream p-3 [&_h4]:font-bold [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: previewHtml(kdp.htmlDescription) }} /></details>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-bold text-forest">Categories</h2>
        {kdp.categories.map((c, i) => (
          <input key={i} className="field" value={c} placeholder={`Category ${i + 1}`} onChange={(e) => set({ categories: kdp.categories.map((x, j) => (j === i ? e.target.value : x)) })} />
        ))}
        <label className="flex items-center gap-2 pt-2 text-sm">
          <input type="checkbox" checked={kdp.isLowContent} onChange={(e) => set({ isLowContent: e.target.checked })} />
          Low-content book
        </label>
        <p className="rounded-lg bg-sun/25 px-3 py-2 text-xs text-forest">
          Low-content reminder: only blank journals, notebooks, planners and logbooks count as low-content. Coloring, line-tracing, activity books, storybooks and workbooks are not. Check the box only if your book has no authored content.
        </p>
        <p className="text-xs text-forest/60">KDP AI disclosure for this book: <b>{book.aiDisclosure}</b> (change it on tab 1).</p>
      </section>
    </div>
  );
}
