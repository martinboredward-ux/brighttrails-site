import { getStore } from "@netlify/blobs";

export type Mode = "activity" | "storybook" | "nonfiction";
export type JobStatus = "idle" | "running" | "done" | "error";

/** A named character picture in the book's Character Library (the picture is in the image store). */
export type RefKind = "character" | "badge" | "prop" | "cover" | "page" | "puzzle";
export interface CharacterRef {
  id: string;
  name: string;
  /** Characters keep their look; badges and props are redrawn exactly as designed. */
  kind: RefKind;
}

export interface Section {
  id: string;
  title: string;
  summary: string;
  draft: string;
}

export interface APlusModule {
  size: "970x600" | "970x300" | "300x300";
  headline: string;
  body: string;
  /** Uploaded cover/page image, stored in the kdp-book-images store (not in the book JSON). */
  imageId?: string;
  fit?: "fit" | "fill";
  /** 300x300 only: show a compact caption bar under the image. */
  textBar?: boolean;
}

export interface KdpPackage {
  titleIdeas: string[];
  htmlDescription: string;
  keywords: string[];
  categories: string[];
  isLowContent: boolean;
  aPlusModules: APlusModule[];
  warnings?: string[];
}

export interface GeneratedImage {
  id: string;
  sectionId?: string;
  prompt: string;
  provider: ImageProvider;
  modelUsed: string;
  aspect: ImageAspect;
  stylePreset: StylePreset;
  quality: "low" | "medium";
  createdAt: string;
  /** "puzzle": the picture fills the worksheet box instead of being the page picture. */
  slot?: "puzzle";
}

export type ImageProvider = "openai-mini" | "openai-1.5" | "nano-banana" | "upload";
export type ImageAspect = "portrait" | "square" | "landscape";
export type StylePreset = "coloring" | "storybook" | "cover" | "aplus" | "library_bw" | "library_color";

export interface ReviewFix { id: string; title: string; detail: string; target: "notes" | "styleBible" | "sections" }

export interface Book {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  mode: Mode;
  audience: string;
  seriesName: string;
  linkedBookIds: string[];
  trim: "8.5x8.5" | "8x10" | "8.5x11" | "6x9" | "5.5x8.5";
  aiDisclosure: "none" | "assisted" | "generated";
  notes: string;
  styleBible: string;
  sections: Section[];
  review: string;
  workbook: string;
  kdp: KdpPackage | null;
  /** Metadata only. The pictures themselves are in the kdp-book-images store. Written by the server. */
  images: GeneratedImage[];
  characterRefId: string;
  /** Character Library: several named reference pictures sent to the image engines. */
  characters: CharacterRef[];
  /** Tab 1: market research, pre-outline review and the safe-undo backups. */
  research: string;
  preReview: string;
  reviewQuestion: string;
  reviewDirection: string;
  polishDirection: string;
  previousNotesBackup: string | null;
  previousStyleBibleBackup: string | null;
  previousSectionsBackup: Section[] | null;
  /** Printable book: the small label on each page (for example "HAPPY TRAILS COLLECTION"). */
  nameplateLabel: string;
  /** Cover Studio settings (title, author, series pill, page count, picture ids). */
  cover: Record<string, unknown>;
  /** Markdown proposal from the Book Rescue Audit. Editable in the Studio. */
  rescueAudit: string;
  preReviewFixes: ReviewFix[];
  preReviewSelected: string[];
  reviewFixes: ReviewFix[];
  reviewSelected: string[];
  lastApplied: { kind: "idea" | "qa"; at: string; changes: string[] } | null;
  approvedAt: string;
  /** Where the book is in the work: idea, writing, art, interior, cover, proof, published. */
  stage: string;
  ignoredAssetNames: string[];
  cornerPropId: string;
  jobStatus: JobStatus;
  jobAction: string;
  jobError: string;
  jobUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const JOB_FIELDS = ["jobStatus", "jobAction", "jobError", "jobUpdatedAt"] as const;

export function studioStore() {
  return getStore({ name: "kdp-book-studio", consistency: "strong" });
}

/** Generated and uploaded pictures live here, never inside the book JSON. */
export function imageStore() {
  return getStore({ name: "kdp-book-images", consistency: "strong" });
}

export const IMAGE_ID_RE = /^[0-9a-f-]{36}__[0-9a-f-]{36}$/;

export async function deleteBookImages(bookId: string): Promise<void> {
  const store = imageStore();
  const { blobs } = await store.list({ prefix: `${bookId}__` });
  await Promise.all(blobs.map((b) => store.delete(b.key)));
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "book"
  );
}

export function newBook(partial: Partial<Book>): Book {
  const now = new Date().toISOString();
  const title = partial.title?.trim() || "Untitled book";
  return {
    id: partial.id || crypto.randomUUID(),
    slug: partial.slug || slugify(title),
    title,
    subtitle: partial.subtitle ?? "",
    mode: partial.mode ?? "activity",
    audience: partial.audience ?? "",
    seriesName: partial.seriesName ?? "",
    linkedBookIds: partial.linkedBookIds ?? [],
    trim: partial.trim ?? "8.5x11",
    aiDisclosure: partial.aiDisclosure ?? "none",
    notes: partial.notes ?? "",
    styleBible: partial.styleBible ?? "",
    sections: partial.sections ?? [],
    review: partial.review ?? "",
    workbook: partial.workbook ?? "",
    kdp: partial.kdp ?? null,
    images: [],
    characterRefId: "",
    characters: [],
    research: "",
    preReview: "",
    reviewQuestion: "",
    reviewDirection: "",
    polishDirection: "",
    previousNotesBackup: null,
    previousStyleBibleBackup: null,
    previousSectionsBackup: null,
    nameplateLabel: "",
    cover: {},
    rescueAudit: "",
    preReviewFixes: [],
    preReviewSelected: [],
    reviewFixes: [],
    reviewSelected: [],
    lastApplied: null,
    approvedAt: "",
    stage: "idea",
    ignoredAssetNames: [],
    cornerPropId: "",
    jobStatus: "idle",
    jobAction: "",
    jobError: "",
    jobUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

const key = (id: string) => `books/${id}.json`;

/** Books saved before series memory existed get the new fields filled in. */
function normalise(b: Book | null): Book | null {
  if (!b) return b;
  b.seriesName ??= "";
  b.linkedBookIds ??= [];
  b.images ??= [];
  b.characterRefId ??= "";
  b.characters ??= [];
  b.research ??= "";
  b.preReview ??= "";
  b.reviewQuestion ??= "";
  b.reviewDirection ??= "";
  b.polishDirection ??= "";
  b.previousNotesBackup ??= null;
  b.previousStyleBibleBackup ??= null;
  b.previousSectionsBackup ??= null;
  b.nameplateLabel ??= "";
  b.cover ??= {};
  b.preReviewFixes ??= [];
  b.preReviewSelected ??= [];
  b.reviewFixes ??= [];
  b.reviewSelected ??= [];
  b.lastApplied ??= null;
  b.approvedAt ??= "";
  b.stage ??= "idea";
  b.ignoredAssetNames ??= [];
  b.cornerPropId ??= "";
  if (!["8.5x8.5", "8x10", "8.5x11", "6x9", "5.5x8.5"].includes(b.trim)) b.trim = "8.5x11";
  // The old single reference becomes the first library entry.
  if (b.characterRefId && !b.characters.some((c) => c.id === b.characterRefId)) b.characters.push({ id: b.characterRefId, name: "Main character", kind: "character" });
  for (const c of b.characters) c.kind ??= "character";
  b.characterRefId = "";
  b.rescueAudit ??= "";
  return b;
}

export async function getBook(id: string): Promise<Book | null> {
  return normalise((await studioStore().get(key(id), { type: "json" })) as Book | null);
}

export async function putBook(book: Book): Promise<void> {
  await studioStore().setJSON(key(book.id), book);
}

export async function deleteBook(id: string): Promise<void> {
  await studioStore().delete(key(id));
}

export async function listBooks(): Promise<Book[]> {
  const store = studioStore();
  const { blobs } = await store.list({ prefix: "books/" });
  const books = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Book | null>));
  return books.map(normalise).filter((b): b is Book => !!b).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Pre-seed the two Steady Under Pressure books when the store is empty. */
export async function seedIfEmpty(): Promise<Book[]> {
  const existing = await listBooks();
  if (existing.length) return existing;
  const book = newBook({
    title: "Steady Under Pressure",
    mode: "nonfiction",
    audience: "IT professionals and help desk teams",
    trim: "6x9",
    notes: "IT book. Edit the subtitle, audience and notes to match the published edition.",
  });
  const workbook = newBook({
    title: "Steady Under Pressure: Companion Workbook",
    mode: "nonfiction",
    audience: "IT professionals and help desk teams",
    trim: "8.5x11",
    notes: "Companion workbook for Steady Under Pressure. Use the Extract Workbook action to build takeaways, scenario prompts and checklists from the book.",
  });
  await putBook(book);
  await putBook(workbook);
  return [book, workbook];
}
