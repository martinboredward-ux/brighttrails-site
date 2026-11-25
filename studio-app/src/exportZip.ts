import JSZip from "jszip";
import type { Book } from "./types";
import { SPECS, canvasToPng, drawBanner } from "./aplus";

export interface ExportAssets {
  pdf: Blob | null;
  images: Partial<Record<string, HTMLImageElement | null>>;
}

const manuscript = (b: Book) => b.sections.map((s) => `## ${s.title}\n\n${s.draft || s.summary}\n`).join("\n");

export async function exportBundle(book: Book, assets: ExportAssets): Promise<{ name: string; blob: Blob }> {
  const zip = new JSZip();
  const ws = zip.folder("01_Book_Workspace")!;
  const kdpDir = zip.folder("02_KDP_Package")!;
  const ap = zip.folder("03_A_Plus_Package")!;

  ws.file("book.json", JSON.stringify({ ...book, jobStatus: undefined, jobAction: undefined, jobError: undefined }, null, 2));
  ws.file("style-bible.md", book.styleBible || "");
  ws.file("manuscript.md", `# ${book.title}\n\n${manuscript(book)}`);
  if (book.review) ws.file("developmental-review.md", book.review);
  if (book.workbook) ws.file("companion-workbook.md", book.workbook);
  if (assets.pdf) ws.file(`${book.slug}-activity-interior.pdf`, assets.pdf);

  const k = book.kdp;
  const aiNote = { none: "No AI-generated content.", assisted: "AI-assisted (author edited/created the content).", generated: "AI-generated: disclose to KDP when publishing." }[book.aiDisclosure];
  kdpDir.file("kdp-package.json", JSON.stringify({ title: book.title, subtitle: book.subtitle, trim: book.trim, aiDisclosure: book.aiDisclosure, ...(k ?? {}) }, null, 2));
  kdpDir.file("listing.md", [
    `# ${book.title}`, book.subtitle ? `## ${book.subtitle}` : "", "",
    `Trim size: ${book.trim}`, `AI disclosure: ${book.aiDisclosure}. ${aiNote}`,
    `Low-content: ${k?.isLowContent ? "yes" : "no"}`, "",
    "### Keywords", ...(k?.keywords ?? []).map((x, i) => `${i + 1}. ${x}`), "",
    "### Categories", ...(k?.categories ?? []).map((x) => `- ${x}`),
  ].join("\n"));
  kdpDir.file("description.html", k?.htmlDescription ?? "");
  kdpDir.file("keywords.txt", (k?.keywords ?? []).join("\n"));

  ap.file("a-plus-copy.json", JSON.stringify(k?.aPlusModules ?? [], null, 2));
  for (const spec of SPECS) {
    const m = k?.aPlusModules.find((x) => x.size === spec.size);
    const img = assets.images[spec.size] ?? null;
    if (!m && !img) continue;
    const canvas = document.createElement("canvas");
    drawBanner(canvas, spec, m?.headline ?? "", m?.body ?? "", img);
    ap.file(`module-${spec.size}.png`, await canvasToPng(canvas));
  }

  return { name: `${book.slug}-kdp-aplus-bundle.zip`, blob: await zip.generateAsync({ type: "blob" }) };
}

export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
