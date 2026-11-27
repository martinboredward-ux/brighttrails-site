import http from "node:http";
import fs from "node:fs";
import path from "node:path";
process.env.APP_PASSWORD = "test";
const R = "/home/claude/brighttrails-site";
const books = (await import(`${R}/netlify/functions/studio-books.ts`)).default;
const image = (await import(`${R}/netlify/functions/studio-image.ts`)).default;
const store = await import(`${R}/netlify/lib/studio-store.ts`);
const png = (p) => fs.readFileSync(p);
// seed: one activity book with 3 sections and a library
const bookId = "11111111-1111-1111-1111-111111111111";
const b = store.newBook({ id: bookId, slug: "lanternside-test", title: "Lanternside Test", mode: "activity", trim: "8.5x11", seriesName: "Lanternside Mysteries", notes: "Mika Reyes (10, leader). Compass Badge", styleBible: "", sections: [
  { id: "s1", title: "Finding North", summary: "Compass map of the town", draft: "" },
  { id: "s2", title: "Market Map", summary: "Map with a route", draft: "" },
  { id: "s3", title: "Compass Badge Award", summary: "Badge certificate", draft: "" }], });
await store.putBook(b);
const seed = async (name, file, kind) => { const id = `${bookId}__${crypto.randomUUID()}`; await store.imageStore().set(id, png(file), { metadata: { contentType: "image/png" } }); const bk = await store.getBook(bookId); bk.characters.push({ id, name, kind }); await store.putBook(bk); };
await seed("Compass Badge", "/tmp/e2e/badge.png", "badge");
await seed("Maze Puzzle", "/tmp/e2e/puzzle.png", "puzzle");
const toReq = async (req) => { const chunks = []; for await (const c of req) chunks.push(c); const body = chunks.length ? Buffer.concat(chunks) : undefined; return new Request(`http://localhost:8888${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }); };
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    if (u.pathname.startsWith("/api/studio/books")) return send(res, await books(await toReq(req)));
    if (u.pathname === "/api/studio/image") return send(res, await image(await toReq(req)));
    if (u.pathname.startsWith("/studio")) {
      let f = path.join(R, u.pathname); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(R, "studio/index.html");
      const ext = path.extname(f); res.writeHead(200, { "content-type": { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[ext] ?? "application/octet-stream" }); return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end("no");
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(8888, () => console.log("ready"));
async function send(res, r) { res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); }
