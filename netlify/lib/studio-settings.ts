import { getStore } from "@netlify/blobs";

/** Studio-wide settings (not per book): the reserved names/animals list, daily limits and the usage log. */
export interface ReservedItem {
  name: string;
  /** Keyword of the book or series that owns this name. That book may use it; every other book may not. */
  owner?: string;
  note?: string;
}
export interface Reserved {
  /** Character names no other book may use. */
  names: ReservedItem[];
  /** Species no other book may use as its lead or mascot. */
  animals: ReservedItem[];
  /** Supporting animals deliberately left open (information only). */
  allowed: string[];
}
export interface Limits { imagesPerDay: number }

export const DEFAULT_RESERVED: Reserved = {
  names: [
    { name: "Pip", owner: "", note: "also Pippa" },
    { name: "Pippa", owner: "" },
    { name: "Maveric", owner: "maveric", note: "the fox" },
    { name: "Dot", owner: "winter dot", note: "Winter Dot" },
    { name: "Barnaby", owner: "barnaby", note: "the bumblebee" },
    { name: "Ollie", owner: "ollie", note: "the otter" },
    { name: "Dash", owner: "dash", note: "the bunny rabbit, preschool tracing book" },
  ],
  animals: [
    { name: "fox", owner: "maveric" },
    { name: "beaver" },
    { name: "hedgehog" },
    { name: "otter", owner: "ollie" },
    { name: "bumblebee", owner: "barnaby" },
    { name: "bunny rabbit", owner: "dash" },
  ],
  allowed: ["mama rabbit", "mama fox", "owl"],
};
export const DEFAULT_LIMITS: Limits = { imagesPerDay: 40 };

const store = () => getStore({ name: "kdp-studio-settings", consistency: "strong" });

const clean = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function cleanItems(raw: unknown, max: number): ReservedItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReservedItem[] = [];
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = clean(typeof r === "string" ? r : o.name, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, owner: clean(o.owner, 60).toLowerCase(), note: clean(o.note, 120) || undefined });
    if (out.length >= max) break;
  }
  return out;
}

export function cleanReserved(raw: unknown): Reserved {
  const o = (raw ?? {}) as Record<string, unknown>;
  const allowed = Array.isArray(o.allowed) ? [...new Set(o.allowed.map((a) => clean(a, 60)).filter(Boolean))].slice(0, 60) : [];
  return { names: cleanItems(o.names, 200), animals: cleanItems(o.animals, 100), allowed };
}

export async function getReserved(): Promise<Reserved> {
  const saved = await store().get("reserved", { type: "json" }).catch(() => null);
  return saved ? cleanReserved(saved) : DEFAULT_RESERVED;
}
export async function setReserved(r: Reserved): Promise<void> { await store().setJSON("reserved", r); }

export async function getLimits(): Promise<Limits> {
  const saved = (await store().get("limits", { type: "json" }).catch(() => null)) as Partial<Limits> | null;
  const n = Number(saved?.imagesPerDay);
  return { imagesPerDay: Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 1000) : DEFAULT_LIMITS.imagesPerDay };
}
export async function setLimits(l: Limits): Promise<void> { await store().setJSON("limits", l); }

/** Reserved items that apply to one book: everything except the items that book owns. */
export function reservedFor(r: Reserved, book: { title?: string; seriesName?: string; slug?: string }): { names: string[]; animals: string[]; allowed: string[] } {
  const hay = `${book.title ?? ""} ${book.seriesName ?? ""} ${book.slug ?? ""}`.toLowerCase();
  const applies = (i: ReservedItem) => !i.owner || !hay.includes(i.owner);
  return { names: r.names.filter(applies).map((i) => i.name), animals: r.animals.filter(applies).map((i) => i.name), allowed: r.allowed };
}

/** The sentence added to every writing prompt. Empty when nothing applies. */
export function reservedPromptBlock(r: Reserved, book: { title?: string; seriesName?: string; slug?: string }): string {
  const f = reservedFor(r, book);
  if (!f.names.length && !f.animals.length) return "";
  return `RESERVED (other Bright Trails books already use these, so never use them in this book): character names: ${f.names.join(", ") || "none"}. Do not make any of these animals the lead character or mascot: ${f.animals.join(", ") || "none"}.${f.allowed.length ? ` Supporting animals that ARE allowed: ${f.allowed.join(", ")}.` : ""}`;
}

// ---- usage log: one JSON per day, counts by key ("image:openai-1.5", "text:gemini-3.8-flash:review_book") ----
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export interface UsageDay { day: string; images: number; byKey: Record<string, number> }

export async function getUsage(day = dayKey()): Promise<UsageDay> {
  const u = (await store().get(`usage__${day}`, { type: "json" }).catch(() => null)) as UsageDay | null;
  return u ?? { day, images: 0, byKey: {} };
}

/** Best effort: a logging failure must never stop real work. */
export async function logUsage(key: string, opts: { image?: boolean } = {}): Promise<void> {
  try {
    const u = await getUsage();
    u.byKey[key] = (u.byKey[key] ?? 0) + 1;
    if (opts.image) u.images += 1;
    await store().setJSON(`usage__${u.day}`, u);
  } catch { /* ignore */ }
}

export async function imageCap(): Promise<{ ok: boolean; used: number; cap: number }> {
  const [u, l] = await Promise.all([getUsage(), getLimits()]);
  return { ok: u.images < l.imagesPerDay, used: u.images, cap: l.imagesPerDay };
}

export async function recentUsage(days = 7): Promise<UsageDay[]> {
  const out: UsageDay[] = [];
  for (let i = 0; i < days; i++) out.push(await getUsage(dayKey(new Date(Date.now() - i * 86400000))));
  return out;
}
