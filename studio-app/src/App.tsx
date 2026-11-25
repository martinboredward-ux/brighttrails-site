import { useCallback, useEffect, useRef, useState } from "react";
import type { Book } from "./types";
import { AuthError, clearPassword, createBook, getBook, getPassword, listBooks, removeBook, saveBook, setPassword } from "./api";
import { exportBundle, download, type ExportAssets } from "./exportZip";
import Tab1Details from "./tabs/Tab1Details";
import Tab2Builder from "./tabs/Tab2Builder";
import Tab3Kdp from "./tabs/Tab3Kdp";
import Tab4APlus from "./tabs/Tab4APlus";
import { ThemeToggle, useTheme } from "./theme";

const TABS = ["1 · Details & Style Bible", "2 · Book Builder", "3 · KDP Package", "4 · A+ Content"] as const;

function Login({ onDone }: { onDone: () => void }) {
  const [theme, toggleTheme] = useTheme();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setPassword(pw);
    try {
      await listBooks();
      onDone();
    } catch (ex) {
      clearPassword();
      setErr(ex instanceof AuthError ? "That password is not right." : ex instanceof Error ? ex.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-forest">KDP Book Studio</h1>
            <p className="text-sm text-muted">Bright Trails Publishing · private</p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <div>
          <label className="label" htmlFor="pw">Password</label>
          <input id="pw" type="password" autoFocus className="field" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <p className="text-sm text-accent">{err}</p>}
        <button className="btn w-full" disabled={busy || !pw}>{busy ? "Checking…" : "Sign in"}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [authed, setAuthed] = useState(!!getPassword());
  const [books, setBooks] = useState<Book[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const assets = useRef<ExportAssets>({ pdf: null });
  const bookRef = useRef<Book | null>(null);
  bookRef.current = book;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const fail = useCallback((e: unknown) => {
    if (e instanceof AuthError) { clearPassword(); setAuthed(false); return; }
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  useEffect(() => {
    if (!authed) return;
    listBooks().then((bs) => { setBooks(bs); setBook((cur) => cur ?? bs[0] ?? null); }).catch(fail);
  }, [authed, fail]);

  // Change something and save straight away (used for picture choices, which should not wait for the Save button).
  const commit = async (patch: Partial<Book>) => {
    const cur = bookRef.current;
    if (!cur) return;
    const next = { ...cur, ...patch };
    bookRef.current = next;
    setBook(next);
    setDirty(true);
    await save();
  };

  const update = (patch: Partial<Book>) => {
    setBook((b) => (b ? { ...b, ...patch } : b));
    setDirty(true);
  };

  const save = useCallback(async (): Promise<Book | null> => {
    const b = bookRef.current;
    if (!b) return null;
    setSaving(true);
    try {
      const saved = await saveBook(b);
      setBook((cur) => (cur && cur.id === saved.id ? { ...cur, slug: saved.slug, updatedAt: saved.updatedAt } : cur));
      setBooks((bs) => bs.map((x) => (x.id === saved.id ? { ...x, title: saved.title } : x)));
      setDirty(false);
      return saved;
    } catch (e) { fail(e); return null; } finally { setSaving(false); }
  }, [fail]);

  // Poll while a background job is running, then pull in the finished work.
  const running = book?.jobStatus === "running";
  const bookId = book?.id;
  useEffect(() => {
    if (!running || !bookId) return;
    const t = setInterval(async () => {
      try {
        const fresh = await getBook(bookId);
        if (fresh.jobStatus !== "running") {
          setBook((cur) => (cur && cur.id === bookId ? { ...cur, ...fresh, ...(dirtyRef.current ? { title: cur.title, subtitle: cur.subtitle, audience: cur.audience, notes: cur.notes } : {}) } : cur));
        } else {
          setBook((cur) => (cur && cur.id === bookId ? { ...cur, jobStatus: fresh.jobStatus, jobAction: fresh.jobAction } : cur));
        }
      } catch (e) { fail(e); }
    }, 3000);
    return () => clearInterval(t);
  }, [running, bookId, fail]);

  const pick = async (id: string) => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    try { setBook(await getBook(id)); setDirty(false); assets.current = { pdf: null }; } catch (e) { fail(e); }
  };

  const add = async () => {
    try {
      const b = await createBook({ title: "New book", mode: "activity" });
      setBooks((bs) => [...bs, b]);
      setBook(b);
      setDirty(false);
      setTab(0);
    } catch (e) { fail(e); }
  };

  const del = async () => {
    if (!book || !confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    try {
      await removeBook(book.id);
      const rest = books.filter((b) => b.id !== book.id);
      setBooks(rest);
      setBook(rest[0] ?? null);
      setDirty(false);
    } catch (e) { fail(e); }
  };

  const exportZip = async () => {
    if (!book) return;
    if (dirty) await save();
    try {
      const { name, blob } = await exportBundle(bookRef.current!, assets.current);
      download(name, blob);
    } catch (e) { fail(e); }
  };

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 md:flex-row">
      <aside className="md:w-64 md:shrink-0">
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-extrabold text-forest">KDP Book Studio</h1>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <ul className="space-y-1">
            {books.map((b) => (
              <li key={b.id}>
                <button onClick={() => pick(b.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${book?.id === b.id ? "bg-brand text-onbrand" : "hover:bg-forest/10"}`}>
                  {b.title}
                  <span className="block text-xs opacity-70">{b.mode}</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn-alt w-full" onClick={add}>+ New book</button>
          <button className="text-xs text-muted underline" onClick={() => { clearPassword(); setAuthed(false); }}>Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-4">
        {error && (
          <div className="card flex items-start justify-between gap-3 border-accent/40 text-sm text-accent">
            <span>{error}</span>
            <button className="underline" onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {!book ? (
          <div className="card text-sm">No books yet. Create one with “New book”.</div>
        ) : (
          <>
            <div className="card flex flex-wrap items-center gap-2">
              <nav className="flex flex-wrap gap-1">
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === i ? "bg-sun text-onsun" : "hover:bg-forest/10"}`}>{t}</button>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-2">
                {dirty && <span className="text-xs text-accent">Unsaved changes</span>}
                <button className="btn-alt" onClick={save} disabled={!dirty || saving || running}>{saving ? "Saving…" : "Save"}</button>
                <button className="btn" onClick={exportZip}>Export .ZIP Bundle</button>
                <button className="btn-alt" onClick={del}>Delete</button>
              </div>
            </div>
            {tab === 0 && <Tab1Details book={book} books={books} update={update} locked={running} />}
            {tab === 1 && <Tab2Builder book={book} update={update} commit={commit} save={save} setBook={setBook} assets={assets} fail={fail} />}
            {tab === 2 && <Tab3Kdp book={book} update={update} save={save} setBook={setBook} fail={fail} />}
            {tab === 3 && <Tab4APlus book={book} update={update} setBook={setBook} fail={fail} />}
          </>
        )}
      </main>
    </div>
  );
}
