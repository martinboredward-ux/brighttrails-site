import { useMemo } from "react";
import type { Book, GeneratedImage, RefKind, StylePreset } from "../types";
import { sectionText } from "../utils/assetDetector";
import LibraryGenerate from "./LibraryGenerate";
import PutOnPage from "./PutOnPage";
import { TooltipButton } from "./TooltipButton";

interface Props {
  book: Book;
  commit: (p: Partial<Book>) => Promise<void>;
  fail: (e: unknown) => void;
  onDone: (img: GeneratedImage) => void;
}

interface Item { name: string; kind: RefKind; re: RegExp; use: string; detail: string }

/** Art every Lanternside book needs besides the chapter scenes. Matched by name against the Library. */
const LANTERNSIDE: Item[] = [
  { name: "Mr. Santos", kind: "character", re: /santos/i, use: "Ch 1, 5, 8 and every book", detail: "Kind older lighthouse keeper, cream fisherman sweater, navy sailor cap, brass key on his belt." },
  { name: "Mrs. Dela Cruz", kind: "character", re: /dela cruz/i, use: "Garden chapter", detail: "Warm community gardener, wide straw hat, green apron with big pockets." },
  { name: "Lola Pilar", kind: "character", re: /pilar/i, use: "Certificate, Ch 8", detail: "" },
  { name: "Compass Badge", kind: "badge", re: /compass badge/i, use: "Award, certificate, cover", detail: "Four-point compass rose, a lantern on each side, star ring, blank ribbon." },
  { name: "Trail Club Emblem", kind: "badge", re: /emblem|club patch/i, use: "Every Lanternside book", detail: "Lantern with a compass needle, lighthouse behind, rope ring." },
  { name: "Detective Rank Badges", kind: "badge", re: /rank/i, use: "Corner stamps (1, 2, 3 stars)", detail: "Three shield badges with 1, 2 and 3 stars and a small magnifying glass. Same design." },
  { name: "Explorer Passport Stamps", kind: "badge", re: /passport|stamps/i, use: "Passport page (8 stamps)", detail: "Eight round stamps in two rows of four, one icon each, one per chapter." },
  { name: "Certificate Border", kind: "page", re: /certificate|border/i, use: "Certificate page", detail: "Hanging lanterns across the top, compass rose in each corner, waves along the bottom, rope frame, empty center." },
  { name: "Big Compass Rose", kind: "prop", re: /compass rose|big compass/i, use: "Ch 1 labeling page", detail: "Large four-point compass rose with an empty circle at each point, waves and a small lighthouse in one corner." },
  { name: "Map Icon Sheet", kind: "prop", re: /icon sheet|map icons/i, use: "Market map, town map, mini map", detail: "12 separate icons in a 4 by 3 grid: bakery stall, fish stall, flower stall, coat swap table, Trail Club hut, old mill, garden gate, lighthouse, oak tree, footbridge, stone steps, scarecrow." },
  { name: "Town Backdrop", kind: "prop", re: /backdrop|town map/i, use: "Draw-the-route and build-the-map pages", detail: "Top-down seaside town with NO buildings: curving coast on the east, a winding stream, dirt paths, grass patches." },
  { name: "Garden Scene", kind: "prop", re: /garden scene|spot the diff/i, use: "Spot-the-difference page", detail: "Mrs. Dela Cruz with a watering can, Lani on the fence, three scarecrows, sunflowers, tomato vines, wheelbarrow, bird, butterfly, ladybug." },
  { name: "Scarecrow Lineup", kind: "prop", re: /scarecrow/i, use: "Find the Blue Coat page", detail: "Three scarecrows in a row with clearly different coats: round patches, wide stripes, big square pocket with two buttons." },
];

type Need = { kind: RefKind; label: string; re: RegExp };
const NEEDS: Need[] = [
  { kind: "prop", label: "map or compass art", re: /\b(map|route|grid|compass|steps|footbridge)\b/i },
  { kind: "badge", label: "badge or stamp", re: /\b(badge|stamp|award|passport|rank|medal)\b/i },
  { kind: "page", label: "page design", re: /\b(certificate|border|contents|title page)\b/i },
];

/** Shows which extra art a series needs, which pieces are made, and which pages could use a Library picture. */
export default function ArtChecklist({ book, commit, fail, onDone }: Props) {
  const lib = book.characters ?? [];
  const isLantern = /lanternside/i.test(`${book.title} ${book.seriesName} ${book.notes.slice(0, 600)}`);
  const preset: StylePreset = book.mode === "activity" ? "coloring" : "storybook";

  const rows = useMemo(() => book.sections.map((s, i) => {
    const text = sectionText(book, i);
    const needs = NEEDS.filter((n) => n.re.test(text));
    const placed = book.images.filter((im) => im.sectionId === s.id && im.prompt.startsWith("Library: ")).map((im) => im.prompt.slice(9));
    return { s, needs, placed };
  }).filter((r) => r.needs.length), [book.sections, book.images, book.notes, book.styleBible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLantern && !rows.length) return null;
  const ignored = new Set((book.ignoredAssetNames ?? []).map((n) => n.toLowerCase()));
  const items = isLantern ? LANTERNSIDE.filter((it) => !ignored.has(it.name.toLowerCase())).map((it) => ({ it, have: lib.find((c) => it.re.test(c.name)) })) : [];
  const dismissed = isLantern ? LANTERNSIDE.filter((it) => ignored.has(it.name.toLowerCase())).map((it) => it.name) : [];
  const missing = items.filter((x) => !x.have).length;

  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Art checklist: maps, badges, stamps and page designs</h2>
      <p className="hint">Free: runs in your browser. It shows what the book needs besides the chapter scenes, what is already in your Library, and which pages could use it.</p>

      {isLantern && (
        <details className="rounded-lg border border-line p-3" open={missing > 0}>
          <summary className="cursor-pointer text-sm font-bold text-forest">Lanternside series art: {items.length - missing} of {items.length} in the Library</summary>
          <ul className="mt-2 space-y-2">
            {items.map(({ it, have }) => (
              <li key={it.name} className="rounded-lg border border-line p-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className={have ? "text-green" : "text-accent"}>{have ? "✓" : "✗"}</span> {it.name}
                    <span className="text-xs font-normal text-muted"> · {it.use}{have ? ` · in Library as “${have.name}”` : ""}</span>
                  </p>
                  {!have && <TooltipButton type="button" className="btn-alt !px-2 !py-1 text-xs" tip="This book does not need it. Hides it from this checklist for this book." engine="$0 Free · Runs in your browser" onClick={() => void commit({ ignoredAssetNames: [...(book.ignoredAssetNames ?? []), it.name] })}>Ignore / Dismiss</TooltipButton>}
                </div>
                {!have && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs underline">Make it or copy a free prompt</summary>

                    <div className="mt-2">
                      <LibraryGenerate book={book} commit={commit} fail={fail} compact initial={{ name: it.name, kind: it.kind, detail: it.detail }} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {dismissed.length > 0 && (
            <p className="hint mt-2">Dismissed: {dismissed.join(", ")}. <TooltipButton type="button" className="underline" onClick={() => void commit({ ignoredAssetNames: (book.ignoredAssetNames ?? []).filter((n) => !dismissed.some((d) => d.toLowerCase() === n.toLowerCase())) })}>Show them again</TooltipButton></p>
          )}
        </details>
      )}

      {rows.length > 0 && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-bold text-forest">Pages that mention a map, badge or page design ({rows.length})</summary>
          <p className="hint mt-2">Based on the words in each page&rsquo;s text. Pick a Library picture and put it on that page; the newest picture on a page is the one printed.</p>
          <ul className="mt-2 space-y-3">
            {rows.map(({ s, needs, placed }) => (
              <li key={s.id} className="space-y-1 rounded-lg border border-line p-2">
                <p className="text-sm font-semibold">{s.title}
                  {needs.map((n) => <span key={n.kind} className="ml-2 rounded-full bg-sun/30 px-2 py-0.5 text-xs font-normal">{n.label}</span>)}
                  {placed.length > 0 && <span className="ml-2 text-xs font-normal text-green">✓ on page: {placed.join(", ")}</span>}
                </p>
                <PutOnPage book={book} sectionId={s.id} kinds={needs.map((n) => n.kind)} preset={preset} onDone={onDone} fail={fail} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
