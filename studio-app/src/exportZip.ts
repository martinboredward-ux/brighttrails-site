import JSZip from "jszip";
import type { Book } from "./types";
import { DEFAULT_OPTIONS, SPECS, canvasToPng, drawBanner } from "./aplus";
import { getImage } from "./imageCache";
import { fetchImageBlob } from "./api";
import { buildPrintableBook } from "./printableBook";
import { certificateText } from "./utils/readiness";

export interface ExportAssets {
  pdf: Blob | null;
  ebookCover?: Blob | null;
  wrapPng?: Blob | null;
  wrapPdf?: Blob | null;
}

const manuscript = (b: Book) => b.sections.map((s) => `## ${s.title}\n\n${s.draft || s.summary}\n`).join("\n");

export async function exportBundle(book: Book, assets: ExportAssets): Promise<{ name: string; blob: Blob }> {
  const zip = new JSZip();
  const ws = zip.folder("01_Book_Workspace")!;
  const kdpDir = zip.folder("02_KDP_Package")!;
  const ap = zip.folder("03_A_Plus_Package")!;
  const covers = zip.folder("06_Covers")!;

  if (book.approvedAt) zip.file("approval-certificate.txt", certificateText(book));
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
  if (book.rescueAudit?.trim()) kdpDir.file("book-rescue-audit.md", book.rescueAudit);
  kdpDir.file("keywords.txt", (k?.keywords ?? []).join("\n"));

  ap.file("a-plus-copy.json", JSON.stringify(k?.aPlusModules ?? [], null, 2));
  for (const spec of SPECS) {
    const m = k?.aPlusModules.find((x) => x.size === spec.size);
    if (!m) continue;
    const img = m.imageId ? await getImage(m.imageId).catch(() => null) : null;
    const canvas = document.createElement("canvas");
    drawBanner(canvas, spec, m.headline, m.body, img, { fit: m.fit ?? DEFAULT_OPTIONS.fit, textBar: m.textBar ?? DEFAULT_OPTIONS.textBar });
    ap.file(`module-${spec.size}.png`, await canvasToPng(canvas));
  }

  if (book.cover && !assets.ebookCover) {
    try {
      const { coverDefaults, renderEbookCover, renderWrapPng, renderWrapPdf } = await import("./utils/coverComposer");
      const { blobToImage } = await import("./imageTools");
      const cs = coverDefaults(book);
      const art = cs.frontArtId ? await fetchImageBlob(cs.frontArtId).then(blobToImage).catch(() => null) : null;
      assets = { ...assets, ebookCover: await renderEbookCover(cs, art), wrapPng: await renderWrapPng(cs, book.trim, art), wrapPdf: renderWrapPdf(cs, book.trim, art) };
    } catch { /* cover files are optional */ }
  }
  if (assets.ebookCover) covers.file(`${book.slug}-ebook-cover-1600x2560.png`, assets.ebookCover);
  if (assets.wrapPng) covers.file(`${book.slug}-paperback-wrap.png`, assets.wrapPng);
  if (assets.wrapPdf) covers.file(`${book.slug}-paperback-wrap.pdf`, assets.wrapPdf);

  if (book.images.length) {
    const gi = zip.folder("04_Generated_Images")!;
    const index: unknown[] = [];
    let n = 0;
    for (const img of book.images) {
      n++;
      const blob = await fetchImageBlob(img.id).catch(() => null);
      if (!blob) continue;
      const section = book.sections.find((s) => s.id === img.sectionId)?.title ?? "";
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const file = `${String(n).padStart(3, "0")}${section ? `-${section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}` : ""}.${ext}`;
      gi.file(file, blob);
      index.push({ file, section, prompt: img.prompt, engine: img.provider, model: img.modelUsed, style: img.stylePreset, aspect: img.aspect, quality: img.quality, createdAt: img.createdAt, characterReference: (book.characters ?? []).some((c) => c.id === img.id) });
    }
    gi.file("index.json", JSON.stringify(index, null, 2));
  }

  if ((book.mode === "activity" || book.mode === "storybook") && book.sections.length) {
    const html = await buildPrintableBook(book, { backingPages: false });
    zip.folder("05_Printable_Book")!.file("printable-book.html", html);
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
