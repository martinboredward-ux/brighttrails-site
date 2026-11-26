import { useMemo } from "react";
import type { Book, RefKind } from "../types";
import { parseTagged } from "../printableBook";
import { TooltipButton } from "./TooltipButton";
import LibraryGenerate from "./LibraryGenerate";

const STOP = new Set(["Series", "Setting", "Cast", "Tone", "Format", "Book", "Ages", "Supporting", "Visual", "Voice", "Layout", "Notes", "Option", "Style", "Mode", "Audience", "Skill", "Trim", "Page", "Pages", "Chapter", "Part", "Never", "Avoid", "Story", "Case"]);
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Candidate { name: string; kind: RefKind; detail: string }

/** Characters are names followed by a bracket (Mika Reyes (10, leader…)); badges end in Badge, Award, Stamp… */
export function findCandidates(book: Book): Candidate[] {
  const src = `${book.styleBible}\n${book.notes}`;
  const out = new Map<string, Candidate>();
  const chars = src.matchAll(/(?:^|[\s,.;:])((?:Mr|Mrs|Ms|Dr)\.? [A-Z][a-z]+(?: [A-Z][a-z]+)?|[A-Z][a-z]+(?: [A-Z][a-z]+)?) \(([^)]{0,200})\)/g);
  for (const m of chars) {
    const name = m[1].trim();
    if (STOP.has(name.split(" ")[0]) || name.length < 3) continue;
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name, kind: "character", detail: m[2].trim() });
  }
  const sections = book.sections.map((s) => `${s.title} ${s.summary} ${s.draft}`).join("\n");
  const badges = `${src}\n${sections}`.matchAll(/\b((?:[A-Z][a-z]+ ){1,2}(?:Badge|Award|Stamp|Patch|Emblem|Medal))\b/g);
  for (const m of badges) {
    const name = m[1].trim();
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name, kind: "badge", detail: "" });
  }
  return [...out.values()];
}

function sectionText(book: Book, i: number): string {
  const s = book.sections[i];
  const t = parseTagged(s.draft);
  return `${s.title}\n${s.summary}\n${t ? Object.values(t).join("\n") : s.draft}`;
}

const mentions = (text: string, name: string) => {
  const first = name.replace(/^(Mr|Mrs|Ms|Dr)\.? /, "").split(" ")[0];
  return new RegExp(`\\b${esc(name)}\\b`, "i").test(text) || (first.length > 2 && new RegExp(`\\b${esc(first)}\\b`, "i").test(text));
};

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
  const cands = useMemo(() => findCandidates(book), [book.styleBible, book.notes, book.sections]); // eslint-disable-line react-hooks/exhaustive-deps
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
                <p className="text-sm font-semibold">{c.name} <span className="text-xs font-normal text-muted">({c.kind === "badge" ? "badge" : "character"})</span></p>
                <p className="hint">Named in your text but not in the Library, so pictures may invent it differently each time.</p>
                <LibraryGenerate book={book} commit={commit} fail={fail} compact initial={{ name: c.name, kind: c.kind, detail: c.detail }} />
              </div>
            ))}
          </div>
        </div>
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
