import { useEffect, useRef, useState, type RefObject } from "react";
import type { Book, KdpPackage } from "../types";
import { scanBanned } from "../banned";
import { SPECS, canvasToPng, drawBanner, loadImage, type Spec } from "../aplus";
import { download, type ExportAssets } from "../exportZip";

interface Props {
  book: Book;
  update: (p: Partial<Book>) => void;
  assets: RefObject<ExportAssets>;
}

function Module({ spec, headline, body, onChange, assets, book }: {
  spec: Spec; headline: string; body: string; onChange: (h: string, b: string) => void;
  assets: RefObject<ExportAssets>; book: Book;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(assets.current.images[spec.size] ?? null);
  const [err, setErr] = useState("");
  const hits = scanBanned(`${headline} ${body}`);

  useEffect(() => {
    if (canvas.current) drawBanner(canvas.current, spec, headline, body, img);
  }, [spec, headline, body, img]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const i = await loadImage(f);
      assets.current.images[spec.size] = i;
      setImg(i);
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Bad image"); }
  };

  const png = async () => {
    if (canvas.current) download(`${book.slug}-aplus-${spec.size}.png`, await canvasToPng(canvas.current));
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold text-forest">Module {spec.size}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div>
            <label className="label">Headline ({headline.length}/60)</label>
            <input className="field" maxLength={60} value={headline} onChange={(e) => onChange(e.target.value, body)} />
          </div>
          <div>
            <label className="label">Body ({body.length}/200)</label>
            <textarea className="field min-h-24" maxLength={200} value={body} onChange={(e) => onChange(headline, e.target.value)} />
          </div>
          {hits.length > 0 ? (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">Banned in Amazon A+ content: {hits.join(", ")}. Reword before uploading.</p>
          ) : (
            <p className="text-xs text-green">No banned A+ words found.</p>
          )}
          <div>
            <label className="label">Cover or interior page image</label>
            <input type="file" accept="image/*" className="text-sm" onChange={(e) => pick(e.target.files?.[0])} />
            {err && <p className="text-xs text-accent">{err}</p>}
          </div>
          <button className="btn-alt" onClick={png}>Download {spec.size} PNG</button>
        </div>
        <div className="self-start overflow-auto rounded-lg border border-forest/10 bg-white p-2">
          <canvas ref={canvas} className="block h-auto" style={{ width: "100%", maxWidth: spec.w, aspectRatio: `${spec.w} / ${spec.h}` }} />
        </div>
      </div>
    </section>
  );
}

export default function Tab4APlus({ book, update, assets }: Props) {
  const modules = book.kdp?.aPlusModules ?? [];
  const setModule = (size: Spec["size"], headline: string, body: string) => {
    const base: KdpPackage = book.kdp ?? {
      titleIdeas: [], htmlDescription: "", keywords: ["", "", "", "", "", "", ""], categories: ["", "", ""], isLowContent: false, aPlusModules: [],
    };
    const have = base.aPlusModules.some((m) => m.size === size);
    const next = have
      ? base.aPlusModules.map((m) => (m.size === size ? { ...m, headline, body } : m))
      : [...base.aPlusModules, { size, headline, body }];
    update({ kdp: { ...base, aPlusModules: next } });
  };
  const all = modules.map((m) => `${m.headline} ${m.body}`).join(" ");
  const total = scanBanned(all);

  return (
    <div className="space-y-4">
      <section className="card text-sm">
        <h2 className="mb-1 text-base font-bold text-forest">A+ Content Builder</h2>
        <p className="text-forest/70">Upload a cover or interior page for each module, edit the copy, and the banner is drawn in your browser as a clean opaque RGB PNG at the exact pixel size. Nothing is uploaded to a server. Generate the starting copy on tab 3.</p>
        {total.length > 0 && <p className="mt-2 font-semibold text-accent">Banned words across all modules: {total.join(", ")}</p>}
      </section>
      {SPECS.map((spec) => {
        const m = modules.find((x) => x.size === spec.size);
        return <Module key={spec.size} spec={spec} headline={m?.headline ?? ""} body={m?.body ?? ""} onChange={(h, b) => setModule(spec.size, h, b)} assets={assets} book={book} />;
      })}
    </div>
  );
}
