import type { Book, Section } from "../types";
import { trimDims } from "./trims";
import { fetchImageBlob } from "../api";
import { blobToDataUrl, mdToHtml } from "../printableBook";
import { pagePicture } from "./checks";
import { GO_RE, pageNumbers } from "./gamebook";
import { MATTER_CSS, matterPages } from "./matter";
import { LETTER_STROKES } from "../../../netlify/lib/templates";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lines = (t?: string) => (t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const rule = (n: number) => Array.from({ length: n }, () => `<div class="wl"></div>`).join("");

// ---------- planner pages (full color) ----------
const head = (s: Section, kicker?: string) => `<div class="band">${kicker ? `<span class="kick">${esc(kicker)}</span>` : ""}<h2>${esc(s.title)}</h2></div>`;
const intro = (s: Section) => (s.data?.intro ? `<p class="intro">${esc(s.data.intro)}</p>` : "");
const page = (cls: string, inner: string, extra = "") => `<section class="page ${cls}" ${extra}>${inner}</section>`;

function guided(s: Section): string[] {
  const prompts = lines(s.data?.prompts);
  return [page("pl", `${head(s)}${intro(s)}<ol class="prompts">${prompts.map((p) => `<li><b>${esc(p)}</b>${rule(3)}</li>`).join("")}</ol>`)];
}
function checklist(s: Section): string[] {
  const items = lines(s.data?.items), per = 16, out: string[] = [];
  for (let i = 0; i < Math.max(items.length, 1); i += per) {
    const chunk = items.slice(i, i + per);
    out.push(page("pl", `${head(s, i ? "continued" : undefined)}${i ? "" : intro(s)}<ul class="checks">${chunk.map((x) => `<li><span class="box"></span>${esc(x)}</li>`).join("")}</ul>`));
  }
  return out;
}
function thermometer(s: Section): string[] {
  const goals = lines(s.data?.goals).slice(0, 7).map((g) => g.split("|").map((x) => x.trim()));
  const n = goals.length || 1, H = 560, top = 30;
  const ticks = goals.map((g, i) => { const y = top + H - ((i + 1) / n) * H; return `<line x1="150" y1="${y}" x2="205" y2="${y}" stroke="#2c3a33" stroke-width="3"/><text x="215" y="${y + 6}" class="tt">${esc(g[0] ?? "")}</text><text x="215" y="${y + 26}" class="ts">${esc(g[1] ?? "")}</text>`; }).join("");
  const svg = `<svg viewBox="0 0 560 680" width="100%" style="max-height:6.6in"><rect x="100" y="${top}" width="50" height="${H}" rx="25" fill="#fff" stroke="#2c3a33" stroke-width="4"/><circle cx="125" cy="${top + H + 28}" r="46" fill="#f6e3df" stroke="#2c3a33" stroke-width="4"/>${ticks}</svg>`;
  return [page("pl", `${head(s)}${intro(s)}<div class="therm">${svg}</div><p class="hint">Color the thermometer up to each milestone as you reach it.</p>`)];
}
function funnel(s: Section): string[] {
  const st = lines(s.data?.stages).map((x) => x.split("|").map((y) => y.trim()));
  return [page("pl", `${head(s)}${intro(s)}<div class="funnel">${st.map((x, i) => `<div class="fn" style="width:${100 - i * (50 / Math.max(st.length, 1))}%"><b>${esc(x[0] ?? "")}</b><span>${esc(x[1] ?? "")}</span>${rule(2)}</div>`).join("")}</div>`)];
}
function sprint(s: Section): string[] {
  const focus = lines(s.data?.focus);
  const cols = [0, 1, 2].map((m) => `<div class="mcol"><div class="mh">Month ${m + 1}</div><p class="mf">${esc(focus[m] ?? "")}</p><div class="lbl">Top 3 outcomes</div>${rule(3)}<div class="lbl">Weekly milestones</div>${[1, 2, 3, 4].map((w) => `<div class="wk"><span>W${w}</span></div>`).join("")}</div>`).join("");
  return [page("pl", `${head(s)}${intro(s)}<div class="mcols">${cols}</div><div class="lbl big">Day 90 finish line: what will be true?</div>${rule(3)}`)];
}
function weekly(s: Section): string[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rev = lines(s.data?.review);
  return [page("pl", `${head(s)}${intro(s)}<div class="lbl">Week of ________  ·  Top 3 priorities</div>${[1, 2, 3].map((n) => `<div class="pri"><span class="box"></span>${n}.</div>`).join("")}<div class="days">${days.map((d) => `<div class="day"><b>${d}</b></div>`).join("")}</div><div class="lbl">Friday review</div><ul class="rv">${rev.map((r) => `<li>${esc(r)}${rule(1)}</li>`).join("")}</ul>`)];
}
function kpi(s: Section): string[] {
  const m = lines(s.data?.metrics);
  const rows = m.map((x) => `<tr><td>${esc(x)}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  return [page("pl", `${head(s)}${intro(s)}<table class="kpi"><thead><tr><th>Metric</th><th>Target</th><th>Wk 1</th><th>Wk 2</th><th>Wk 3</th><th>Wk 4</th></tr></thead><tbody>${rows}</tbody></table><div class="lbl">Pivot check: keep, change or stop?</div>${rule(3)}`)];
}
function collage(s: Section): string[] {
  const z = lines(s.data?.zones).slice(0, 6);
  return [page("pl", `${head(s)}${intro(s)}<div class="canvas">${z.map((x) => `<div class="zone"><span>${esc(x)}</span></div>`).join("")}</div><p class="hint">Cut out your favorites from the sheets at the back and glue them in the zones.</p>`)];
}
function quotes(s: Section): string[] {
  const q = lines(s.data?.lines);
  return [page("pl cut", `${head(s)}<p class="hint">✂ Cut along the dashed lines. Printed on one side only.</p><div class="strips">${q.map((x) => `<div class="strip">${esc(x)}</div>`).join("")}</div>`), `<section class="page blank"></section>`];
}

// ---------- preschool letter spreads ----------
const ARROW = (x: number, y: number, ang: number) => `<polygon points="0,-7 14,0 0,7" transform="translate(${x} ${y}) rotate(${ang})" fill="#e2603c"/>`;
function strokeSvg(ch: string): string {
  const strokes = LETTER_STROKES[ch] ?? [];
  const paths = strokes.map((st, i) => {
    const pts = st.pts.map(([x, y]) => `${(x * 4).toFixed(0)},${(y * 4.6).toFixed(0)}`);
    const [sx, sy] = pts[0].split(",").map(Number);
    const [ex, ey] = pts[pts.length - 1].split(",").map(Number), [px, py] = (pts[pts.length - 2] ?? pts[0]).split(",").map(Number);
    const ang = (Math.atan2(ey - py, ex - px) * 180) / Math.PI;
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="#2c3a33" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 24" opacity=".9"/>${ARROW(ex, ey, ang)}<circle cx="${sx}" cy="${sy}" r="19" fill="#7fb069"/><text x="${sx}" y="${sy + 7}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="Fredoka, sans-serif">${i + 1}</text>`;
  }).join("");
  return `<svg viewBox="0 0 400 460" width="100%" style="max-height:5.2in"><rect x="6" y="6" width="388" height="448" rx="26" fill="#fff" stroke="#2c3a33" stroke-width="4"/>${paths}</svg>`;
}
const traceLetters = (txt: string, size: number) => `<svg viewBox="0 0 800 130" width="100%"><line x1="10" y1="100" x2="790" y2="100" stroke="#2c3a33" stroke-width="3"/><line x1="10" y1="30" x2="790" y2="30" stroke="#9db4a0" stroke-width="2" stroke-dasharray="8 8"/><text x="20" y="100" font-size="${size}" font-family="Fredoka, 'Nunito', sans-serif" font-weight="600" fill="none" stroke="#2c3a33" stroke-width="3.5" stroke-dasharray="6 7" letter-spacing="14">${txt}</text></svg>`;
function letter(s: Section, mascot?: string): string[] {
  const ch = (s.data?.letter ?? s.title.replace(/^Letter\s+/i, "")[0] ?? "A").toUpperCase();
  const cues = [...new Set((LETTER_STROKES[ch] ?? []).map((x) => x.cue))].join(" · ");
  const A = page("tr", `<div class="trhead"><span class="bigl">${ch}${ch.toLowerCase()}</span><span class="trcue">${esc(s.data?.cue ?? "")}</span></div><div class="trbody"><div class="trglyph">${strokeSvg(ch)}</div><div class="trmas">${mascot ? `<img src="${mascot}" alt="Dash">` : `<div class="none">Dash pose</div>`}<p class="strokes">${esc(cues)}</p></div></div><div class="parent"><b>Parent prompt:</b> ${esc(s.data?.parent ?? "")}</div>`);
  const L = [`${ch} ${ch} ${ch} ${ch}`, `${ch.toLowerCase()} ${ch.toLowerCase()} ${ch.toLowerCase()} ${ch.toLowerCase()}`, `${ch}${ch.toLowerCase()} ${ch}${ch.toLowerCase()}`];
  const B = page("tr", `<div class="trhead"><span class="bigl">${ch}${ch.toLowerCase()}</span><span class="trcue">Your turn. Three short lines.</span></div>${L.map((x) => `<div class="tline">${traceLetters(x, 96)}</div>`).join("")}<div class="target"><span>My letter</span></div>`);
  return [A, B];
}

// ---------- gamebook ----------
const miniMd = (t: string, nums: Map<string, number>) => mdToHtml(t.replace(GO_RE, (_m, id) => (nums.has(id) ? `**turn to page ${nums.get(id)}**` : `**(missing page ${id})**`)).replace(/\[END\]/gi, "**THE END**"));

const CSS = (w: number, h: number) => `
@page { size: ${w}in ${h}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #e9e9e9; }
body { font-family: 'Nunito','Segoe UI',Arial,sans-serif; color: #2c3a33; font-variant-ligatures: none; }
.tip { max-width: ${w}in; margin: 12px auto; padding: 10px 14px; background: #fff8dc; border: 1px solid #c9a400; border-radius: 8px; font: 14px/1.4 Arial, sans-serif; }
.page { width: ${w}in; height: ${h}in; padding: 0.75in; margin: 0 auto 12px; background: #fbf6ee; position: relative; overflow: hidden; page-break-after: always; break-after: page; display: flex; flex-direction: column; gap: 0.16in; }
.page.blank { background: #fff; }
h1,h2,h3,.kick,.lbl,.mh,.bigl,.trcue { font-family: 'Fredoka','Nunito',sans-serif; }
.band { background: #b9c9b5; border-radius: 0.2in; padding: 0.14in 0.25in; display: flex; flex-direction: column; }
.band h2 { margin: 0; font-size: 24pt; color: #22352b; }
.kick { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #8a6d1f; }
.intro { font-size: 13pt; line-height: 1.45; margin: 0; font-style: italic; }
.wl { border-bottom: 1.5px solid #9db4a0; height: 0.3in; }
.prompts { margin: 0; padding-left: 0.3in; display: flex; flex-direction: column; gap: 0.1in; font-size: 12.5pt; }
.checks { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 0.4in; font-size: 12pt; }
.checks li { display: flex; gap: 0.12in; align-items: flex-start; margin-bottom: 0.14in; break-inside: avoid; }
.box { flex: 0 0 auto; width: 0.2in; height: 0.2in; border: 2px solid #c9a24b; border-radius: 4px; background: #fff; display: inline-block; }
.therm { flex: 1; display: flex; justify-content: center; }
.tt { font: 600 24px Fredoka, sans-serif; fill: #22352b; } .ts { font: 18px Nunito, sans-serif; fill: #55645b; }
.hint { font-size: 10.5pt; text-align: center; color: #6a7a70; margin: 0; }
.funnel { display: flex; flex-direction: column; align-items: center; gap: 0.12in; flex: 1; }
.fn { background: #f6e3df; border: 2px solid #c9a24b; border-radius: 0.15in; padding: 0.12in 0.2in; display: flex; flex-direction: column; font-size: 12pt; }
.fn b { font-family: Fredoka, sans-serif; font-size: 15pt; }
.mcols { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.15in; flex: 1; }
.mcol { background: #fff; border: 2px solid #b9c9b5; border-radius: 0.15in; padding: 0.12in; display: flex; flex-direction: column; gap: 0.06in; }
.mh { background: #f6e3df; border-radius: 0.1in; text-align: center; padding: 0.04in; font-size: 13pt; }
.mf { font-size: 10.5pt; margin: 0; font-style: italic; min-height: 0.5in; }
.lbl { font-size: 11pt; letter-spacing: 1px; text-transform: uppercase; color: #8a6d1f; } .lbl.big { margin-top: 0.1in; }
.wk { border: 1.5px solid #c9a24b; border-radius: 0.08in; height: 0.55in; padding: 0.03in 0.06in; font-size: 9pt; color: #8a6d1f; }
.pri { display: flex; align-items: center; gap: 0.12in; border-bottom: 1.5px solid #9db4a0; height: 0.38in; font-size: 12pt; }
.days { display: grid; grid-template-columns: repeat(7,1fr); gap: 0.06in; flex: 1; }
.day { background: #fff; border: 1.5px solid #b9c9b5; border-radius: 0.08in; padding: 0.05in; font-size: 10pt; text-align: center; }
.rv { list-style: none; margin: 0; padding: 0; font-size: 11.5pt; }
.kpi { width: 100%; border-collapse: collapse; font-size: 11.5pt; flex: 1; }
.kpi th { background: #b9c9b5; padding: 0.07in; border: 1.5px solid #fff; font-family: Fredoka, sans-serif; }
.kpi td { border: 1.5px solid #b9c9b5; background: #fff; height: 0.52in; padding: 0 0.08in; }
.canvas { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.14in; border: 3px dashed #c9a24b; border-radius: 0.2in; padding: 0.14in; background: #fff; }
.zone { border: 2px dotted #b9c9b5; border-radius: 0.14in; padding: 0.08in; } .zone span { font: 600 12pt Fredoka, sans-serif; color: #8a6d1f; }
.strips { display: flex; flex-direction: column; gap: 0.18in; flex: 1; justify-content: space-around; }
.strip { border: 2.5px dashed #c9a24b; border-radius: 0.12in; background: #fff; text-align: center; font: 600 18pt Fredoka, sans-serif; padding: 0.2in 0.1in; color: #22352b; }
.cutpic { align-items: center; justify-content: center; padding: 0.4in; } .cutpic img { max-width: 100%; max-height: 100%; object-fit: contain; }
.title-page { align-items: center; justify-content: center; text-align: center; gap: 0.25in; background: #f6e3df; }
.title-page h1 { font-size: 40pt; margin: 0; line-height: 1.05; color: #22352b; } .title-page .sub { font-size: 16pt; margin: 0; } .title-page .by { font-size: 13pt; letter-spacing: 2px; }
.cpy { margin: auto 0 0.5in; font-size: 11pt; line-height: 1.5; text-align: center; } .cpy p { margin: 0 0 0.12in; }
.pgno { position: absolute; bottom: 0.3in; left: 0; right: 0; text-align: center; font: 600 12pt Fredoka, sans-serif; color: #8a6d1f; }
${MATTER_CSS}
/* preschool tracing: high contrast, 0.75in margins, bold 3-4pt lines */
.page.tr { background: #fff; gap: 0.14in; }
.trhead { display: flex; align-items: center; gap: 0.25in; } .bigl { font-size: 54pt; line-height: 1; color: #2c3a33; } .trcue { font-size: 15pt; flex: 1; line-height: 1.3; }
.trbody { display: grid; grid-template-columns: 1.35fr 1fr; gap: 0.22in; flex: 1; min-height: 0; } .trglyph { min-height: 0; }
.trmas { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1in; border: 3px solid #2c3a33; border-radius: 0.2in; padding: 0.1in; } .trmas img { max-width: 100%; max-height: 3.4in; object-fit: contain; } .trmas .none { color: #888; font-size: 12pt; }
.strokes { font: 600 12pt Fredoka, sans-serif; text-align: center; margin: 0; }
.parent { border: 3px solid #2c3a33; border-radius: 0.15in; padding: 0.12in 0.2in; font-size: 13pt; }
.tline { border-bottom: 0; } .target { flex: 0 0 auto; height: 1.5in; border: 4px solid #2c3a33; border-radius: 0.2in; display: flex; align-items: flex-start; padding: 0.1in 0.2in; font: 600 14pt Fredoka, sans-serif; }
/* gamebook */
.gb h2 { font-size: 22pt; margin: 0; } .gb .txt { font-size: 13pt; line-height: 1.45; } .gb .txt p { margin: 0 0 0.1in; } .gb .txt strong { color: #b4411f; }
.gb.detour { border: 0.28in solid transparent; border-image: repeating-linear-gradient(45deg, #f2c200 0 0.22in, #222 0.22in 0.44in) 40; padding: 0.55in; }
.gb .tag { display: inline-block; align-self: flex-start; background: #f2c200; color: #222; font: 700 11pt Fredoka, sans-serif; padding: 0.04in 0.14in; border-radius: 999px; letter-spacing: 1px; }
.gb img { max-width: 100%; max-height: 3in; object-fit: contain; align-self: center; }
@media print { html, body { background: #fff; } .page { margin: 0; } .tip { display: none; } }
`;

export interface TemplateBookOptions { copyrightPage?: boolean; evenPages?: boolean }

/** Printable HTML for planner, preschool tracing and gamebook books (full color, built from the section templates). */
export async function buildTemplateBook(book: Book, opts: TemplateBookOptions = {}): Promise<string> {
  const { w, h } = trimDims(book.trim);
  const imgs = new Map<string, string>();
  for (const s of book.sections) { const p = pagePicture(book, s); if (p) { try { imgs.set(s.id, await blobToDataUrl(await fetchImageBlob(p.id))); } catch { /* skip */ } } }
  const mat = matterPages(book);
  const who = ((book.cover as { author?: string } | undefined)?.author ?? "").trim() || "Bright Trails Publishing";
  const front: string[] = [
    page("title-page", `<h1>${esc(book.title)}</h1>${book.subtitle ? `<p class="sub">${esc(book.subtitle)}</p>` : ""}<p class="by">${esc(who)}</p>`),
  ];
  if (opts.copyrightPage !== false) {
    const ai = book.aiDisclosure === "generated" ? "Illustrations and text were created with AI tools and reviewed by the publisher." : book.aiDisclosure === "assisted" ? "Created with the assistance of AI tools, then reviewed and edited by the author." : "";
    front.push(page("", `<div class="cpy"><p><b>${esc(book.title)}</b></p><p>Copyright &copy; ${new Date().getFullYear()} ${esc(who)}. All rights reserved.</p><p>No part of this book may be reproduced without written permission of the publisher, except for personal use.</p>${ai ? `<p>${esc(ai)}</p>` : ""}<p>Published by Bright Trails Publishing</p></div>`));
  }
  front.push(...mat.front);
  const nums = book.mode === "gamebook" ? pageNumbers(book, front.length) : new Map<string, number>();

  const body: string[] = [];
  for (const s of book.sections) {
    const pic = imgs.get(s.id);
    if (s.kind === "cutout") { body.push(page("cutpic", pic ? `<img src="${pic}" alt="${esc(s.title)}">` : `<div class="hint">Cut-out picture not added yet for: ${esc(s.title)}</div>`), `<section class="page blank" aria-label="Blank back of cut-out sheet"></section>`); continue; }
    if (book.mode === "gamebook") {
      const n = nums.get(s.id) ?? 0;
      body.push(page(`gb${s.kind === "detour" ? " detour" : ""}`, `${s.kind === "detour" ? `<span class="tag">DETOUR</span>` : ""}<h2>${esc(s.title)}</h2>${pic ? `<img src="${pic}" alt="">` : ""}<div class="txt">${miniMd(s.draft || s.summary, nums)}</div><div class="pgno">${n}</div>`));
      continue;
    }
    switch (s.tpl) {
      case "guided": body.push(...guided(s)); break;
      case "checklist": body.push(...checklist(s)); break;
      case "thermometer": body.push(...thermometer(s)); break;
      case "funnel": body.push(...funnel(s)); break;
      case "sprint": body.push(...sprint(s)); break;
      case "weekly": body.push(...weekly(s)); break;
      case "kpi": body.push(...kpi(s)); break;
      case "collage": body.push(...collage(s)); break;
      case "quotes": body.push(...quotes(s)); break;
      case "letter": body.push(...letter(s, pic)); break;
      default: body.push(page("pl", `${head(s)}<div class="txt">${mdToHtml(s.draft || s.summary)}</div>${pic ? `<img src="${pic}" alt="" style="max-height:5in;align-self:center">` : ""}`));
    }
  }
  const all = [...front, ...body, ...mat.back];
  if (opts.evenPages !== false && all.length % 2) all.push(`<section class="page blank" aria-label="Blank page to make the page count even"></section>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(book.title)} (${w} x ${h} in interior)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS(w, h)}</style></head><body>
<div class="tip">Press Ctrl+P (Cmd+P on Mac), choose Save as PDF, paper size ${w} × ${h} in, Margins None, Background graphics ON. ${all.length} pages. This note does not print.</div>
${all.join("\n")}
</body></html>`;
}
