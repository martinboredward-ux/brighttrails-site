import type { Action, Book, GeneratedImage, ImageAspect, ImageProvider, KdpPackage, StylePreset, CoverIdeas } from "./types";

const KEY = "studio-password";
export const getPassword = () => sessionStorage.getItem(KEY) ?? "";
export const setPassword = (p: string) => sessionStorage.setItem(KEY, p);
export const clearPassword = () => sessionStorage.removeItem(KEY);

export class AuthError extends Error {}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", "x-studio-password": getPassword(), ...(init.headers ?? {}) },
  });
  if (res.status === 401) throw new AuthError("Wrong password");
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const listBooks = () => call<{ books: Book[] }>("/api/studio/books").then((r) => r.books);
export const getBook = (id: string) => call<{ book: Book }>(`/api/studio/books/${id}`).then((r) => r.book);
export const createBook = (b: Partial<Book>) =>
  call<{ book: Book }>("/api/studio/books", { method: "POST", body: JSON.stringify(b) }).then((r) => r.book);
export const saveBook = (b: Book) =>
  call<{ book: Book }>(`/api/studio/books/${b.id}`, { method: "PUT", body: JSON.stringify(b) }).then((r) => r.book);
export const removeBook = (id: string) => call<{ ok: boolean }>(`/api/studio/books/${id}`, { method: "DELETE" });
export const generateKdp = (bookId: string) =>
  call<{ kdp: KdpPackage }>("/api/studio/generate-kdp-package", { method: "POST", body: JSON.stringify({ bookId }) }).then((r) => r.kdp);

export const generateRescueAudit = (bookId: string) =>
  call<{ rescueAudit: string }>("/api/studio/rescue-audit", { method: "POST", body: JSON.stringify({ bookId }) }).then((r) => r.rescueAudit);

/** Starts a background job. Netlify answers 202 at once; poll getBook for jobStatus. */
export async function startJob(payload: { bookId: string; action: Action; sectionId?: string; model?: "haiku" | "sonnet"; onlyEmpty?: boolean }) {
  const res = await fetch("/.netlify/functions/book-studio-background", {
    method: "POST",
    headers: { "content-type": "application/json", "x-studio-password": getPassword() },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new AuthError("Wrong password");
  if (!res.ok && res.status !== 202) throw new Error(`Could not start the job (${res.status})`);
}

// Pictures live in their own store and are fetched with the password header, then shown from a
// blob: URL, so the password never appears in an address.
export async function uploadImage(bookId: string, blob: Blob): Promise<string> {
  const res = await fetch(`/api/studio/image?bookId=${encodeURIComponent(bookId)}`, {
    method: "POST",
    headers: { "content-type": blob.type || "image/jpeg", "x-studio-password": getPassword() },
    body: blob,
  });
  if (res.status === 401) throw new AuthError("Wrong password");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data.id as string;
}

/** Attach a picture made elsewhere (for example ChatGPT) to one page. The server adds it to that section's pictures. */
export async function uploadSectionImage(bookId: string, sectionId: string, blob: Blob, aspect: ImageAspect, preset: StylePreset, slot?: "puzzle"): Promise<GeneratedImage> {
  const res = await fetch(`/api/studio/image?bookId=${encodeURIComponent(bookId)}&sectionId=${encodeURIComponent(sectionId)}&aspect=${aspect}&preset=${preset}${slot ? "&slot=puzzle" : ""}`, {
    method: "POST",
    headers: { "content-type": blob.type || "image/jpeg", "x-studio-password": getPassword() },
    body: blob,
  });
  if (res.status === 401) throw new AuthError("Wrong password");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  if (!data.image) throw new Error("The picture uploaded but could not be attached to this page. Try again.");
  return data.image as GeneratedImage;
}

/** Put a Library picture on one page. The server copies it, so the Library item stays untouched. */
export async function copyLibraryToSection(bookId: string, sectionId: string, fromId: string, label: string, aspect: ImageAspect, preset: StylePreset, slot?: "puzzle"): Promise<GeneratedImage> {
  const res = await fetch(`/api/studio/image?bookId=${encodeURIComponent(bookId)}&sectionId=${encodeURIComponent(sectionId)}&copyFrom=${encodeURIComponent(fromId)}&label=${encodeURIComponent(label)}&aspect=${aspect}&preset=${preset}${slot ? "&slot=puzzle" : ""}`, {
    method: "POST",
    headers: { "x-studio-password": getPassword() },
  });
  if (res.status === 401) throw new AuthError("Wrong password");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Could not put it on the page (${res.status})`);
  if (!data.image) throw new Error("The picture could not be attached to this page. Try again.");
  return data.image as GeneratedImage;
}

export async function fetchImageBlob(id: string): Promise<Blob> {
  const res = await fetch(`/api/studio/image?id=${encodeURIComponent(id)}`, { headers: { "x-studio-password": getPassword() } });
  if (res.status === 401) throw new AuthError("Wrong password");
  if (!res.ok) throw new Error(`Could not load image (${res.status})`);
  return res.blob();
}

export const deleteImage = (id: string) =>
  fetch(`/api/studio/image?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-studio-password": getPassword() } }).catch(() => undefined);

export interface ImageJobRequest {
  bookId: string;
  provider: ImageProvider;
  quality: "low" | "medium";
  aspect: ImageAspect;
  stylePreset: StylePreset;
  prompt: string;
  referenceImageIds?: string[];
  sectionId?: string;
}
export interface ImageJob { id: string; status: "queued" | "running" | "done" | "error"; imageId?: string; image?: GeneratedImage; notes?: string[]; error?: string }

/** Starts an image job and waits for it, checking every few seconds (up to 6 minutes). */
export async function generateImage(req: ImageJobRequest, onTick?: (status: string) => void): Promise<{ job: ImageJob; image: GeneratedImage }> {
  const { jobId } = await call<{ jobId: string }>("/api/studio/generate-image", { method: "POST", body: JSON.stringify(req) });
  const started = Date.now();
  let misses = 0;
  while (Date.now() - started < 6 * 60_000) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const { job } = await call<{ job: ImageJob }>(`/api/studio/generate-image?jobId=${jobId}`);
      onTick?.(job.status);
      if (job.status === "error") throw new Error(job.error || "Image generation failed");
      if (job.status === "done" && job.image) return { job, image: job.image };
    } catch (e) {
      if (e instanceof AuthError) throw e;
      // The job record can take a moment to appear. Anything else is a real failure.
      if (e instanceof Error && /Not found/i.test(e.message) && misses++ < 8) continue;
      throw e;
    }
  }
  throw new Error("The picture is taking too long. Check the gallery in a minute; it may still appear.");
}

export const coverIdeas = (payload: Record<string, unknown>) =>
  call<CoverIdeas>("/api/studio/cover-ideas", { method: "POST", body: JSON.stringify(payload) });

export interface CoverCheck { ok: boolean; summary: string; checks: { name: string; pass: boolean; note: string }[] }
export const checkCover = (payload: Record<string, unknown>) =>
  call<CoverCheck>("/api/studio/cover-check", { method: "POST", body: JSON.stringify(payload) });

export interface ReservedItem { name: string; owner?: string; note?: string }
export interface Reserved { names: ReservedItem[]; animals: ReservedItem[]; allowed: string[] }
export interface UsageDay { day: string; images: number; byKey: Record<string, number> }
export interface StudioSettings { reserved: Reserved; limits: { imagesPerDay: number }; usage: UsageDay[] }
export const getSettings = () => call<StudioSettings>("/api/studio/settings");
export const putSettings = (p: { reserved?: Reserved; limits?: { imagesPerDay: number } }) =>
  call<StudioSettings>("/api/studio/settings", { method: "PUT", body: JSON.stringify(p) });
