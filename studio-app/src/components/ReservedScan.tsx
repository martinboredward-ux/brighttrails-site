import { useEffect, useState } from "react";
import type { Book } from "../types";
import { getSettings, type Reserved } from "../api";
import { scanReserved } from "../utils/reserved";

/** Warns when this book uses a name or lead animal that another Bright Trails book already owns. */
export default function ReservedScan({ book }: { book: Book }) {
  const [reserved, setReserved] = useState<Reserved | null>(null);
  useEffect(() => { let live = true; getSettings().then((s) => { if (live) setReserved(s.reserved); }).catch(() => undefined); return () => { live = false; }; }, []);
  if (!reserved) return null;
  const hits = scanReserved(book, reserved);
  if (!hits.length) return null;
  const grouped = new Map<string, string[]>();
  for (const h of hits) grouped.set(`${h.word} (${h.kind})`, [...(grouped.get(`${h.word} (${h.kind})`) ?? []), h.where]);
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
      <p className="font-bold text-accent">Reserved name or animal found</p>
      <p className="hint">Another Bright Trails book already uses these. Rename them, or change the list in Studio settings if this is on purpose.</p>
      <ul className="mt-1 list-disc pl-5">{[...grouped].map(([k, w]) => <li key={k}><b>{k}</b>: {[...new Set(w)].slice(0, 6).join("; ")}</li>)}</ul>
    </div>
  );
}
