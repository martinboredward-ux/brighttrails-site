import { getStore } from "@netlify/blobs";

export type Mode = "activity" | "storybook" | "nonfiction";
export type JobStatus = "idle" | "running" | "done" | "error";

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

export interface Book {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  mode: Mode;
  audience: string;
  trim: "8.5x11" | "6x9";
  aiDisclosure: "none" | "assisted" | "generated";
  notes: string;
  styleBible: string;
  sections: Section[];
  review: string;
  workbook: string;
  kdp: KdpPackage | null;
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
    trim: partial.trim ?? "8.5x11",
    aiDisclosure: partial.aiDisclosure ?? "none",
    notes: partial.notes ?? "",
    styleBible: partial.styleBible ?? "",
    sections: partial.sections ?? [],
    review: partial.review ?? "",
    workbook: partial.workbook ?? "",
    kdp: partial.kdp ?? null,
    jobStatus: "idle",
    jobAction: "",
    jobError: "",
    jobUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

const key = (id: string) => `books/${id}.json`;

export async function getBook(id: string): Promise<Book | null> {
  return (await studioStore().get(key(id), { type: "json" })) as Book | null;
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
  return books.filter((b): b is Book => !!b).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
