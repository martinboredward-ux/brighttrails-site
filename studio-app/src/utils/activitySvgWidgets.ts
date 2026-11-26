import type { WidgetKind } from "../types";

export const WIDGETS: { id: WidgetKind; label: string }[] = [
  { id: "wordbank", label: "Word Bank (default)" },
  { id: "compass", label: "Compass Rose Labeling (N/E/S/W)" },
  { id: "mapgrid", label: "4x4 Map Key Grid" },
  { id: "steps", label: "Directional Step Grid" },
  { id: "dots", label: "Dot-to-Dot (1–30)" },
  { id: "tracing", label: "Line Tracing & Counting" },
];

const F = `font-family="Fredoka, Nunito, Arial, sans-serif"`;
const wrap = (inner: string, h = 320) => `<svg viewBox="0 0 600 ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" style="display:block;max-height:100%">${inner}</svg>`;
const rnd = (seed: number) => { let s = (seed * 9301 + 49297) % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

function compass(): string {
  const cx = 300, cy = 172;
  const star = [0, 90, 180, 270].map((deg) => {
    const a = (deg - 90) * Math.PI / 180, a1 = a - 0.32, a2 = a + 0.32;
    const pts = [[cx + 120 * Math.cos(a), cy + 120 * Math.sin(a)], [cx + 28 * Math.cos(a1), cy + 28 * Math.sin(a1)], [cx, cy], [cx + 28 * Math.cos(a2), cy + 28 * Math.sin(a2)]];
    return `<polygon points="${pts.map((q) => q.map((n) => n.toFixed(1)).join(",")).join(" ")}" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round"/>`;
  }).join("");
  const diag = [45, 135, 225, 315].map((deg) => { const a = (deg - 90) * Math.PI / 180; return `<line x1="${cx}" y1="${cy}" x2="${cx + 70 * Math.cos(a)}" y2="${cy + 70 * Math.sin(a)}" stroke="#000" stroke-width="3"/>`; }).join("");
  const box = (x: number, y: number) => `<rect x="${x - 26}" y="${y - 22}" width="52" height="44" rx="10" fill="#fff" stroke="#000" stroke-width="3"/>`;
  return wrap(`<circle cx="${cx}" cy="${cy}" r="128" fill="none" stroke="#000" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>${diag}${star}<circle cx="${cx}" cy="${cy}" r="9" fill="#fff" stroke="#000" stroke-width="3"/>
${box(cx, 28)}${box(cx + 168, cy)}${box(cx, 316)}${box(cx - 168, cy)}
<text x="10" y="22" font-size="14" ${F}>Write N, E, S or W in each box.</text>
<text x="10" y="42" font-size="12" ${F}>Hint: N is up. E is on the right.</text>`, 345);
}

function mapgrid(seed: number): string {
  const r = rnd(seed + 1);
  const x0 = 50, y0 = 40, cell = 58;
  const symbols = [
    (x: number, y: number) => `<polygon points="${x},${y - 18} ${x + 5},${y - 6} ${x + 18},${y - 6} ${x + 8},${y + 3} ${x + 12},${y + 16} ${x},${y + 8} ${x - 12},${y + 16} ${x - 8},${y + 3} ${x - 18},${y - 6} ${x - 5},${y - 6}" fill="#fff" stroke="#000" stroke-width="2.5"/>`,
    (x: number, y: number) => `<polygon points="${x},${y - 18} ${x + 16},${y + 14} ${x - 16},${y + 14}" fill="#fff" stroke="#000" stroke-width="2.5"/>`,
    (x: number, y: number) => `<rect x="${x - 15}" y="${y - 4}" width="30" height="20" fill="#fff" stroke="#000" stroke-width="2.5"/><polygon points="${x - 19},${y - 4} ${x},${y - 20} ${x + 19},${y - 4}" fill="#fff" stroke="#000" stroke-width="2.5"/>`,
    (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="15" fill="#fff" stroke="#000" stroke-width="2.5"/>`,
  ];
  const used = new Set<number>(); const at: { c: number; rw: number }[] = [];
  while (at.length < 4) { const c = Math.floor(r() * 4), rw = Math.floor(r() * 4); const k = c * 4 + rw; if (!used.has(k)) { used.add(k); at.push({ c, rw }); } }
  let g = "";
  for (let i = 0; i <= 4; i++) g += `<line x1="${x0 + i * cell}" y1="${y0}" x2="${x0 + i * cell}" y2="${y0 + 4 * cell}" stroke="#000" stroke-width="2.5"/><line x1="${x0}" y1="${y0 + i * cell}" x2="${x0 + 4 * cell}" y2="${y0 + i * cell}" stroke="#000" stroke-width="2.5"/>`;
  g += ["A", "B", "C", "D"].map((l, i) => `<text x="${x0 + i * cell + cell / 2}" y="${y0 - 10}" text-anchor="middle" font-size="17" font-weight="600" ${F}>${l}</text>`).join("");
  g += [1, 2, 3, 4].map((n, i) => `<text x="${x0 - 14}" y="${y0 + i * cell + cell / 2 + 6}" text-anchor="middle" font-size="17" font-weight="600" ${F}>${n}</text>`).join("");
  g += at.map((p, i) => symbols[i](x0 + p.c * cell + cell / 2, y0 + p.rw * cell + cell / 2)).join("");
  const key = symbols.map((s, i) => `<g>${s(318, 66 + i * 52)}<text x="350" y="${72 + i * 52}" font-size="14" ${F}>= </text><line x1="372" y1="${74 + i * 52}" x2="570" y2="${74 + i * 52}" stroke="#000" stroke-width="2"/></g>`).join("");
  return wrap(`${g}<text x="318" y="30" font-size="16" font-weight="600" ${F}>MAP KEY: name each symbol</text>${key}<text x="50" y="305" font-size="14" ${F}>Which square has the star? ______</text>`);
}

function steps(seed: number): string {
  const r = rnd(seed + 7);
  const n = 5, x0 = 40, y0 = 30, cell = 52;
  let cx = 0, cy = 0; const seq: string[] = [];
  const dirs: [string, number, number][] = [["→", 1, 0], ["↓", 0, 1], ["←", -1, 0], ["↑", 0, -1]];
  while (seq.length < 6) {
    const [a, dx, dy] = dirs[Math.floor(r() * 4)];
    if (cx + dx < 0 || cx + dx >= n || cy + dy < 0 || cy + dy >= n) continue;
    if (seq.length && ((a === "→" && seq[seq.length - 1] === "←") || (a === "←" && seq[seq.length - 1] === "→") || (a === "↓" && seq[seq.length - 1] === "↑") || (a === "↑" && seq[seq.length - 1] === "↓"))) continue;
    cx += dx; cy += dy; seq.push(a);
  }
  let g = "";
  for (let i = 0; i <= n; i++) g += `<line x1="${x0 + i * cell}" y1="${y0}" x2="${x0 + i * cell}" y2="${y0 + n * cell}" stroke="#000" stroke-width="2.5"/><line x1="${x0}" y1="${y0 + i * cell}" x2="${x0 + n * cell}" y2="${y0 + i * cell}" stroke="#000" stroke-width="2.5"/>`;
  const start = `<circle cx="${x0 + cell / 2}" cy="${y0 + cell / 2}" r="16" fill="#000"/><text x="${x0 + cell / 2}" y="${y0 + cell / 2 + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" ${F}>S</text>`;
  const gx = x0 + cx * cell + cell / 2, gy = y0 + cy * cell + cell / 2;
  const goal = `<polygon points="${gx},${gy - 18} ${gx + 5},${gy - 6} ${gx + 18},${gy - 6} ${gx + 8},${gy + 3} ${gx + 12},${gy + 16} ${gx},${gy + 8} ${gx - 12},${gy + 16} ${gx - 8},${gy + 3} ${gx - 18},${gy - 6} ${gx - 5},${gy - 6}" fill="#fff" stroke="#000" stroke-width="2.5"/>`;
  return wrap(`${g}${start}${goal}<text x="330" y="52" font-size="16" font-weight="600" ${F}>Follow the steps:</text><text x="330" y="104" font-size="30" letter-spacing="4" ${F}>${seq.join(" ")}</text><text x="330" y="150" font-size="15" ${F}>Start at S. One box per arrow.</text><text x="330" y="176" font-size="15" ${F}>Draw your path.</text><text x="330" y="222" font-size="15" ${F}>Do you end on the star?</text>`, 300);
}

function dots(seed: number): string {
  const N = 30, cx = 300, cy = 165, ph = seed * 1.3;
  const pts = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    const rad = 1 + 0.28 * Math.sin(3 * t + ph) + 0.12 * Math.sin(5 * t);
    return { x: cx + 105 * rad * Math.cos(t) * 1.55, y: cy + 105 * rad * Math.sin(t) };
  });
  const el = pts.map((p, i) => {
    const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#000"/><text x="${(p.x + (dx / l) * 16).toFixed(1)}" y="${(p.y + (dy / l) * 16 + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" ${F}>${i + 1}</text>`;
  }).join("");
  return wrap(`${el}<text x="10" y="22" font-size="14" ${F}>Connect the dots from 1 to 30.</text>`, 330);
}

function tracing(seed: number): string {
  const r = rnd(seed + 3);
  let rows = "";
  for (let i = 0; i < 3; i++) {
    const y = 42 + i * 52, amp = i === 0 ? 0 : 14 + i * 3;
    let d = `M 50 ${y}`;
    for (let x = 50; x < 550; x += 50) d += amp ? ` q 12.5 ${-amp} 25 0 t 25 0` : ` L ${x + 50} ${y}`;
    rows += `<circle cx="50" cy="${y}" r="7" fill="#000"/><path d="${d}" fill="none" stroke="#000" stroke-width="3" stroke-dasharray="3 10" stroke-linecap="round"/><text x="570" y="${y + 6}" font-size="22" ${F}>→</text>`;
  }
  const count = 3 + Math.floor(r() * 6);
  const star = (x: number, y: number) => `<polygon points="${x},${y - 14} ${x + 4},${y - 4} ${x + 14},${y - 4} ${x + 6},${y + 3} ${x + 9},${y + 13} ${x},${y + 7} ${x - 9},${y + 13} ${x - 6},${y + 3} ${x - 14},${y - 4} ${x - 4},${y - 4}" fill="#fff" stroke="#000" stroke-width="2.5"/>`;
  const stars = Array.from({ length: count }, (_, i) => star(60 + i * 42, 238)).join("");
  return wrap(`${rows}<text x="10" y="205" font-size="15" font-weight="600" ${F}>Count the stars:</text>${stars}<text x="400" y="244" font-size="16" ${F}>How many?</text><rect x="490" y="218" width="70" height="40" rx="10" fill="#fff" stroke="#000" stroke-width="3"/>`, 280);
}

/** Crisp inline SVG puzzle for one worksheet. Black on white, so it prints cleanly. Returns "" for the word bank. */
export function widgetSvg(kind: WidgetKind | undefined, seed: number): string {
  switch (kind) {
    case "compass": return compass();
    case "mapgrid": return mapgrid(seed);
    case "steps": return steps(seed);
    case "dots": return dots(seed);
    case "tracing": return tracing(seed);
    default: return "";
  }
}

export const RANKS: { id: 0 | 1 | 2 | 3; label: string }[] = [
  { id: 0, label: "No rank badge" }, { id: 1, label: "Rank 1 ★☆☆" }, { id: 2, label: "Rank 2 ★★☆" }, { id: 3, label: "Rank 3 ★★★" },
];
export const rankText = (r: number | undefined) => (r === 1 ? "Rank 1 ★☆☆" : r === 2 ? "Rank 2 ★★☆" : r === 3 ? "Rank 3 ★★★" : "");
