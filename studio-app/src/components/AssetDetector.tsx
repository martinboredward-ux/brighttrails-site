import { useMemo } from "react";
import type { Book } from "../types";
import { findCandidates, mentions, sectionText, type Candidate } from "../utils/assetDetector";
import { TooltipButton } from "./TooltipButton";
import LibraryGenerate from "./LibraryGenerate";

interface Props {
  book: Book;
  commit: (p: Partial<Book>) => Promise<void>;
  fail: (e: unknown) => void;
  pins: Record<string, string[]>;
  onPin: (sectionId: string, libId: string) => void;
}

/** Scans every section against the Library: unchecked items get a 1-click pill, missing ones get a ready prompt. */
export default function AssetDetector({ book, commit, fail, pins, onPin }: Props) {
  const lib = book.characters ?? [];
  const cands = useMemo(() => findCandidates(book), [book.styleBible, book.notes, book.sections, book.ignoredAssetNames]); // eslint-disable-line react-hooks/exhaustive-deps
  const inLib = (name: string) => lib.find((c) => c.name.toLowerCase() === name.toLowerCase() || mentions(c.name, name) && mentions(name, c.name));

  const rows = book.sections.map((s, i) => {
    const text = sectionText(book, i);
    const named = cands.filter((c) => mentions(text, c.name));
    return {
      s,
      unchecked: named.map((c) => ({ c, item: inLib(c.name) })).filter((x) => x.item && !(pins[s.id] ?? []).includes(x.item.id)) as { c: typeof named[number]; item: NonNullable<ReturnType<typeof inLib>> }[],
      ticked: named.map((c) => inLib(c.name)).filter((x): x is NonNullable<typeof x> => !!x && (pins[s.id] ?? []).includes(x.id)),
      missing: named.filter((c) => !inLib(c.name)),
    };
  });

  const allMissing = new Map<string, Candidate>();
  rows.forEach((r) => r.missing.forEach((c) => allMissing.set(c.name.toLowerCase(), c)));
  const badges = lib.filter((c) => c.kind === "badge");
  const passportMissing = Math.max(0, book.sections.length - badges.length);
  const hasWork = rows.some((r) => r.unchecked.length || r.ticked.length) || allMissing.size > 0 || passportMissing > 0;

  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Missing &amp; unchecked asset detector</h2>
      <p className="hint">Scans each section&rsquo;s text and the Style Bible against your Character &amp; Badge Library, and the Explorer Passport badge slots. Free: runs in your browser.</p>
      {!hasWork && <p className="text-sm text-green">Nothing to fix. Every named character and badge is in the Library.</p>}

      {rows.some((r) => r.unchecked.length || r.ticked.length) && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-forest">In the Library but not ticked for the picture</h3>
          <ul className="space-y-1">
            {rows.filter((r) => r.unchecked.length || r.ticked.length).map(({ s, unchecked, ticked }) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40 font-semibold">{s.title}</span>
                {ticked.map((t) => <span key={t.id} className="rounded-full bg-sun/30 px-2 py-0.5 text-xs">✓ {t.name}</span>)}
                {unchecked.map(({ item }) => (
                  <TooltipButton key={item.id} type="button" className="rounded-full border border-sun px-2 py-0.5 text-xs font-semibold hover:bg-sun/30" tip={`Ticks ${item.name} for this section's next picture.`} engine="$0 Free · Runs in your browser" onClick={() => onPin(s.id, item.id)}>
                    + Check {item.name}
                  </TooltipButton>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {allMissing.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-accent">Missing from Library ({allMissing.size})</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {[...allMissing.values()].map((c) => (
              <div key={c.name} className="space-y-2 rounded-lg border border-accent/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{c.name} <span className="text-xs font-normal text-muted">({c.kind === "badge" ? "badge" : "character"})</span></p>
                  <TooltipButton type="button" className="btn-alt !px-2 !py-1 text-xs" tip="Not a character or badge (for example a place). Hides it from this list for this book." engine="$0 Free · Runs in your browser" onClick={() => void commit({ ignoredAssetNames: [...(book.ignoredAssetNames ?? []), c.name] })}>Ignore / Dismiss</TooltipButton>
                </div>
                <p className="hint">Named in your text but not in the Library, so pictures may invent it differently each time.</p>
                <LibraryGenerate book={book} commit={commit} fail={fail} compact initial={{ name: c.name, kind: c.kind, detail: c.detail }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {(book.ignoredAssetNames ?? []).length > 0 && (
        <p className="hint">Dismissed: {(book.ignoredAssetNames ?? []).join(", ")}. <TooltipButton type="button" className="underline" onClick={() => void commit({ ignoredAssetNames: [] })}>Show them again</TooltipButton></p>
      )}

      {passportMissing > 0 && book.sections.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-bold text-forest">Explorer Passport: {badges.length} of {book.sections.length} badge slots filled from the Library</summary>
          <p className="hint mt-2">The passport page uses your Library items of type Badge, in order. Empty slots print a plain stamp. Make the rest here:</p>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {book.sections.slice(badges.length).map((s, k) => (
              <div key={s.id} className="space-y-1 rounded-lg border border-line p-3">
                <p className="text-sm font-semibold">Slot {badges.length + k + 1}: {s.title}</p>
                <LibraryGenerate book={book} commit={commit} fail={fail} compact initial={{ name: `Stamp ${badges.length + k + 1}`, kind: "badge", detail: `Icon for the section "${s.title}". ${s.summary.slice(0, 120)}` }} />
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
