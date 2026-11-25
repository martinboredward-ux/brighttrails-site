import type { Action, Book, KdpPackage } from "./types";

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

/** Starts a background job. Netlify answers 202 at once; poll getBook for jobStatus. */
export async function startJob(payload: { bookId: string; action: Action; sectionId?: string; model?: "haiku" | "sonnet" }) {
  const res = await fetch("/.netlify/functions/book-studio-background", {
    method: "POST",
    headers: { "content-type": "application/json", "x-studio-password": getPassword() },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new AuthError("Wrong password");
  if (!res.ok && res.status !== 202) throw new Error(`Could not start the job (${res.status})`);
}
