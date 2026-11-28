import { useState } from "react";
import type { Book } from "../types";
import { fetchImageBlob } from "../api";
import { useBlobUrl } from "../blobUrl";
import { estimatePages, modeChecks, pagePicture, picFindings, picStats, promiseCheck, structureCheck, type Finding } from "../utils/checks";
import { TooltipButton } from "./TooltipButton";

function Row({ f }: { f: Finding }) {
  return <li className={f.level === "fix" ? "text-accent" : "text-muted"}>{f.level === "fix" ? "✗" : "○"} <b>{f.where}:</b> {f.text}</li>;
}

function Thumb({ id }: { id?: string }) {
  const { url } = useBlobUrl(id ?? "");
  return <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded border border-line bg-white">{id && url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-muted">{id ? "…" : "no picture"}</span>}</div>;
}

/** One panel: promise check, KDP file checks, picture scan, and a page-by-page preview sheet. All free (no AI). */
export default function BookChecks({ book }: { book: Book }) {
  const [open, setOpen] = useState(false);
  const [scan, setScan] = useState<Finding[] | null>(null);
  const [busy, setBusy] = useState("");
  const promises = promiseCheck(book);
  const pages = estimatePages(book);
  const structure = structureCheck(book, pages);
  const all = [...structure, ...modeChecks(book), ...promises, ...(scan ?? [])];
  const fixes = all.filter((f) => f.level === "fix").length;

  const scanPics = async () => {
    const found: Finding[] = [];
    for (let i = 0; i < book.sections.length; i++) {
      const s = book.sections[i], pic = pagePicture(book, s);
      if (!pic) continue;
      setBusy(`Looking at picture ${i + 1} of ${book.sections.length}…`);
      try { found.push(...picFindings(book, s, await picStats(await fetchImageBlob(pic.id), book.trim), i)); }
      catch { found.push({ sectionId: s.id, where: `Section ${i + 1}: ${s.title}`, level: "note", text: "Could not read this picture." }); }
    }
    setScan(found); setBusy("");
  };

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold text-forest">Checks &amp; preview <span className={`text-sm ${fixes ? "text-accent" : "text-green"}`}>{fixes ? `${fixes} to fix` : "all clear"}</span></h2>
        <TooltipButton className="btn-alt" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</TooltipButton>
      </div>
      {open && (
        <>
          <p className="hint">Free checks, no AI. Promise check: does every “count / trace / press” on a page have something that delivers it. About {pages} printed pages.</p>
          <ul className="space-y-1 text-sm">{all.length ? all.map((f, i) => <Row key={i} f={f} />) : <li className="text-green">✓ Nothing to fix.</li>}</ul>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipButton className="btn-alt" onClick={scanPics} disabled={!!busy}>{busy || "Scan my pictures (resolution, black fills, white background)"}</TooltipButton>
            {scan && <span className="hint">Scanned. {scan.length ? `${scan.length} findings above.` : "No picture problems found."}</span>}
          </div>
          <div>
            <p className="label">Page-by-page preview</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {book.sections.map((s, i) => {
                const pic = pagePicture(book, s);
                // Template pages keep their words in fields (cue, prompts, items...), not in the draft text, so count both.
                const text = `${s.draft} ${s.data ? Object.values(s.data).join(" ") : ""}`;
                const words = text.trim().split(/\s+/).filter(Boolean).length;
                const picOnly = s.kind === "coloring" || s.kind === "cutout" || s.kind === "picture";
                const flag = !picOnly && book.mode !== "nonfiction" && !words ? "empty" : words > 330 ? "long" : "";
                return (
                  <li key={s.id} className={`space-y-1 rounded p-1 text-[11px] ${flag ? "bg-accent/10" : ""}`}>
                    <Thumb id={pic?.id} />
                    <p className="line-clamp-2 font-semibold">{i + 1}. {s.title}</p>
                    <p className="text-muted">{s.kind === "coloring" ? "coloring page" : s.kind === "cutout" ? "cut-out sheet" : s.kind === "picture" ? "full-page picture" : `${words} words`}{flag === "empty" ? " · empty" : flag === "long" ? " · may overflow" : ""}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
