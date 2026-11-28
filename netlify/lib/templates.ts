// Template sections for planner and preschool tracing books. Pure data: no imports, used by the browser AND the server.

export interface TplField { key: string; label: string; lines?: number; hint: string }
export interface TplDef { id: string; label: string; modes: string[]; fields: TplField[]; ai: string }

export const TEMPLATES: TplDef[] = [
  { id: "guided", label: "Guided prompt page", modes: ["planner"], ai: "A reflective writing page: a short warm intro and 6 sharp journaling prompts for a female entrepreneur.",
    fields: [{ key: "intro", label: "Intro (1-2 sentences)", lines: 2, hint: "Short intro under the title" }, { key: "prompts", label: "Prompts (one per line, 6 lines)", lines: 7, hint: "One question per line" }] },
  { id: "checklist", label: "Checklist page", modes: ["planner"], ai: "A milestone checklist: 14 concrete, checkable milestones, one per line, each under 12 words.",
    fields: [{ key: "intro", label: "Intro (1 sentence)", lines: 2, hint: "Short intro" }, { key: "items", label: "Checklist items (one per line)", lines: 14, hint: "One item per line. Over 14 lines flows to extra pages." }] },
  { id: "thermometer", label: "Revenue thermometer", modes: ["planner"], ai: "A revenue goal thermometer: 5 milestones from small to big, each formatted as 'amount | what it means', for example '$1,000 | First paying clients'.",
    fields: [{ key: "intro", label: "Intro (1 sentence)", lines: 2, hint: "Short intro" }, { key: "goals", label: "Milestones (amount | meaning, one per line)", lines: 6, hint: "$1,000 | First paying clients" }] },
  { id: "funnel", label: "Offer suite & funnel map", modes: ["planner"], ai: "An offer funnel map: 4 stages from awareness to loyalty, one per line, each formatted as 'Stage | question to answer'.",
    fields: [{ key: "intro", label: "Intro (1 sentence)", lines: 2, hint: "Short intro" }, { key: "stages", label: "Stages (name | question, one per line)", lines: 5, hint: "Attract | Where do my ideal clients already spend time?" }] },
  { id: "sprint", label: "90-day sprint", modes: ["planner"], ai: "A 90-day sprint planner page: an intro and 3 monthly focus questions, one per line.",
    fields: [{ key: "intro", label: "Intro (1 sentence)", lines: 2, hint: "Short intro" }, { key: "focus", label: "Monthly focus prompts (one per line, 3 lines)", lines: 4, hint: "Month 1: ..." }] },
  { id: "weekly", label: "Weekly priority sheet", modes: ["planner"], ai: "A weekly priorities sheet: intro and 4 short reflection prompts for Friday review, one per line.",
    fields: [{ key: "intro", label: "Intro (1 sentence)", lines: 2, hint: "Short intro" }, { key: "review", label: "Friday review prompts (one per line)", lines: 4, hint: "What moved the needle?" }] },
  { id: "kpi", label: "KPI / pivot audit", modes: ["planner"], ai: "A KPI and pivot audit table: 8 metric names a solo founder tracks, one per line (for example 'Discovery calls booked').",
    fields: [{ key: "intro", label: "Intro (1 sentence)", lines: 2, hint: "Short intro" }, { key: "metrics", label: "Metrics (one per line)", lines: 8, hint: "Leads this month" }] },
  { id: "collage", label: "Vision collage canvas", modes: ["planner"], ai: "A vision collage page: a one-sentence instruction and 4 theme labels for areas of the board (for example 'Wealth', 'Impact').",
    fields: [{ key: "intro", label: "Instruction (1-2 sentences)", lines: 2, hint: "Glue your cut-outs here" }, { key: "zones", label: "Zone labels (one per line, up to 6)", lines: 5, hint: "Wealth" }] },
  { id: "quotes", label: "Quote boxes (cut-out)", modes: ["planner"], ai: "12 short affirmation lines for cut-out quote boxes, one per line. Mix 1-3 word labels (like Choose joy, Money flows, Own your power) with short phrases under 9 words. Confident, warm and professional, never childish.",
    fields: [{ key: "lines", label: "Quotes (one per line)", lines: 8, hint: "I build with clarity and calm." }] },
  { id: "letter", label: "Letter spread (A + B)", modes: ["tracing"], ai: "For one letter of a preschool tracing book (ages 4-6): a one-sentence story cue (under 14 words) about the book's mascot (named in the Style Bible) acting out the letter, and a calm parent prompt of at most 2 sentences (under 30 words). The page already lists the numbered stroke steps next to the picture, so do not list them again; the cue is just a friendly line. If you mention a direction, use ONLY these phrases: Pull down, Slide right, Hop over, Loop around.",
    fields: [{ key: "cue", label: "Story cue (1 sentence)", lines: 2, hint: "The mascot pulls down a long line for the letter." }, { key: "parent", label: "Parent prompt (max 2 sentences)", lines: 2, hint: "Trace with your finger first." }] },
];
export const tplDef = (id?: string) => TEMPLATES.find((t) => t.id === id);

export interface PackItem { title: string; tpl?: string; kind?: "template" | "cutout" | "coloring"; summary?: string; data?: Record<string, string> }

/** Planner "template pack": the four phases in order. Words are filled by AI afterwards; Studio draws the pages. */
export const PLANNER_PACK: PackItem[] = [
  { title: "Phase 1: Vision & Revenue Goals", tpl: "guided", kind: "template", summary: "Define the 2027 vision and revenue targets." },
  { title: "Revenue Thermometer", tpl: "thermometer", kind: "template", summary: "Color in the revenue milestones." },
  { title: "Phase 2: Strategic Pillars", tpl: "guided", kind: "template", summary: "Pick the pillars that carry the year." },
  { title: "Milestone Checklist 1", tpl: "checklist", kind: "template", summary: "First half of the milestones." },
  { title: "Milestone Checklist 2", tpl: "checklist", kind: "template", summary: "Second half of the milestones." },
  { title: "Offer Suite & Funnel Map", tpl: "funnel", kind: "template", summary: "Map offers from first touch to loyal client." },
  { title: "Weekly Priority Sheet", tpl: "weekly", kind: "template", summary: "One page per week, copy as needed." },
  { title: "Phase 3: Vision Board Studio", tpl: "collage", kind: "template", summary: "Build the collage with the cut-outs at the back." },
  { title: "KPI & Pivot Audit", tpl: "kpi", kind: "template", summary: "Track the numbers that matter." },
  { title: "Phase 4: 90-Day Sprint 1", tpl: "sprint", kind: "template", summary: "Quarter one sprint." },
  { title: "Phase 4: 90-Day Sprint 2", tpl: "sprint", kind: "template", summary: "Quarter two sprint." },
  { title: "Phase 4: 90-Day Sprint 3", tpl: "sprint", kind: "template", summary: "Quarter three sprint." },
  { title: "Phase 4: 90-Day Sprint 4", tpl: "sprint", kind: "template", summary: "Quarter four sprint." },
  { title: "Cut-Out Sheet 1: Icons & Badges", kind: "cutout", summary: "Full-color cut-out icons and badges, single-sided." },
  { title: "Cut-Out Sheet 2: Thermometers & Banners", kind: "cutout", summary: "Full-color cut-out progress thermometers and banners, single-sided." },
  { title: "Cut-Out Sheet 3: Quote Boxes", tpl: "quotes", kind: "template", summary: "Affirmation boxes to cut out." },
];

/** Stroke order for the letter spreads. Each stroke is a polyline in a 0-100 box (y down). Phrases are the four allowed cues. */
export interface Stroke { cue: "Pull down" | "Slide right" | "Hop over" | "Loop around"; pts: [number, number][] }
const L = (...s: Stroke[]) => s;
const D = (pts: [number, number][]): Stroke => ({ cue: "Pull down", pts });
const R = (pts: [number, number][]): Stroke => ({ cue: "Slide right", pts });
const H = (pts: [number, number][]): Stroke => ({ cue: "Hop over", pts });
const O = (pts: [number, number][]): Stroke => ({ cue: "Loop around", pts });
type Pt = [number, number];
/** Points on an ellipse. Angles are in degrees, counter-clockwise from the right (like a clock run backwards); a falling angle goes clockwise. */
const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n = 26): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = ((from + (to - from) * (i / n)) * Math.PI) / 180; out.push([+(cx + rx * Math.cos(a)).toFixed(1), +(cy - ry * Math.sin(a)).toFixed(1)]); }
  return out;
};
const join = (...parts: Pt[][]): Pt[] => parts.flat();
const ln = (...p: Pt[]): Pt[] => p;
/** Capital letters: cap height 8 to 92, width about 10 to 90. Every stroke starts at the top or the left. */
export const LETTER_STROKES: Record<string, Stroke[]> = {
  A: L(D(ln([50, 8], [20, 92])), D(ln([50, 8], [80, 92])), R(ln([32, 64], [68, 64]))),
  B: L(D(ln([28, 8], [28, 92])), O(join(ln([28, 8], [50, 8]), arc(50, 29, 22, 21, 90, -90), ln([50, 50], [28, 50]))), O(join(ln([28, 50], [54, 50]), arc(54, 71, 24, 21, 90, -90), ln([54, 92], [28, 92])))),
  C: L(O(arc(56, 50, 34, 42, 45, 315))),
  D: L(D(ln([28, 8], [28, 92])), O(join(ln([28, 8], [44, 8]), arc(44, 50, 38, 42, 90, -90), ln([44, 92], [28, 92])))),
  E: L(D(ln([28, 8], [28, 92])), R(ln([28, 8], [76, 8])), R(ln([28, 50], [68, 50])), R(ln([28, 92], [76, 92]))),
  F: L(D(ln([28, 8], [28, 92])), R(ln([28, 8], [76, 8])), R(ln([28, 50], [66, 50]))),
  G: L(O(arc(54, 50, 34, 42, 45, 350)), R(ln([56, 56], [88, 56]))),
  H: L(D(ln([28, 8], [28, 92])), D(ln([72, 8], [72, 92])), R(ln([28, 50], [72, 50]))),
  I: L(R(ln([30, 8], [70, 8])), D(ln([50, 8], [50, 92])), R(ln([30, 92], [70, 92]))),
  J: L(D(join(ln([64, 8], [64, 66]), arc(44, 66, 20, 26, 0, -150)))),
  K: L(D(ln([28, 8], [28, 92])), D(ln([76, 8], [30, 54])), D(ln([44, 42], [78, 92]))),
  L: L(D(ln([30, 8], [30, 92])), R(ln([30, 92], [76, 92]))),
  M: L(D(ln([20, 8], [20, 92])), D(ln([20, 8], [50, 58])), D(ln([80, 8], [50, 58])), D(ln([80, 8], [80, 92]))),
  N: L(D(ln([26, 8], [26, 92])), D(ln([26, 8], [74, 92])), D(ln([74, 8], [74, 92]))),
  O: L(O(arc(50, 50, 36, 42, 90, 450, 40))),
  P: L(D(ln([28, 8], [28, 92])), O(join(ln([28, 8], [46, 8]), arc(46, 29, 26, 21, 90, -90), ln([46, 50], [28, 50])))),
  Q: L(O(arc(48, 48, 34, 40, 90, 450, 40)), D(ln([56, 62], [84, 94]))),
  R: L(D(ln([28, 8], [28, 92])), O(join(ln([28, 8], [46, 8]), arc(46, 29, 26, 21, 90, -90), ln([46, 50], [28, 50]))), D(ln([46, 50], [78, 92]))),
  S: L(O(join(arc(50, 29, 24, 21, 35, 270), arc(50, 71, 26, 21, 90, -145)))),
  T: L(R(ln([22, 8], [78, 8])), D(ln([50, 8], [50, 92]))),
  U: L(D(join(ln([26, 8], [26, 64]), arc(50, 64, 24, 28, 180, 360))), D(ln([74, 8], [74, 64]))),
  V: L(D(ln([20, 8], [50, 92])), D(ln([80, 8], [50, 92]))),
  W: L(D(ln([10, 8], [28, 92])), D(ln([50, 30], [28, 92])), D(ln([50, 30], [72, 92])), D(ln([90, 8], [72, 92]))),
  X: L(D(ln([24, 8], [76, 92])), D(ln([76, 8], [24, 92]))),
  Y: L(D(ln([24, 8], [50, 50])), D(ln([76, 8], [50, 50])), D(ln([50, 50], [50, 92]))),
  Z: L(R(ln([24, 8], [76, 8])), D(ln([76, 8], [24, 92])), R(ln([24, 92], [76, 92]))),
};
/** Small letters: ascender line 8, x-height line 50, baseline 92, descender line 122. Single-story a and g, as taught in preschool. */
export const LOWER_STROKES: Record<string, Stroke[]> = {
  a: L(O(arc(50, 71, 24, 21, 45, 405, 34)), D(ln([74, 50], [74, 92]))),
  b: L(D(ln([30, 8], [30, 92])), O(arc(54, 71, 24, 21, 180, -180, 34))),
  c: L(O(arc(54, 71, 24, 21, 45, 315))),
  d: L(O(arc(46, 71, 24, 21, 45, 405, 34)), D(ln([70, 8], [70, 92]))),
  e: L(R(ln([26, 71], [74, 71])), O(arc(50, 71, 24, 21, 0, 320))),
  f: L(D(join(arc(66, 28, 20, 18, 25, 180), ln([46, 28], [46, 92]))), R(ln([28, 52], [68, 52]))),
  g: L(O(arc(50, 71, 24, 21, 45, 405, 34)), D(join(ln([74, 50], [74, 100]), arc(52, 100, 22, 18, 0, -150)))),
  h: L(D(ln([28, 8], [28, 92])), O(join(arc(50, 66, 22, 16, 180, 0), ln([72, 66], [72, 92])))),
  i: L(D(ln([50, 50], [50, 92])), H(ln([50, 22], [50, 32]))),
  j: L(D(join(ln([56, 50], [56, 104]), arc(38, 104, 18, 14, 0, -130))), H(ln([56, 22], [56, 32]))),
  k: L(D(ln([28, 8], [28, 92])), D(ln([72, 50], [30, 72])), D(ln([44, 64], [74, 92]))),
  l: L(D(ln([50, 8], [50, 92]))),
  m: L(D(ln([18, 50], [18, 92])), O(join(arc(34, 66, 16, 16, 180, 0), ln([50, 66], [50, 92]))), O(join(arc(66, 66, 16, 16, 180, 0), ln([82, 66], [82, 92])))),
  n: L(D(ln([26, 50], [26, 92])), O(join(arc(49, 66, 23, 16, 180, 0), ln([72, 66], [72, 92])))),
  o: L(O(arc(50, 71, 24, 21, 90, 450, 34))),
  p: L(D(ln([30, 50], [30, 122])), O(arc(54, 71, 24, 21, 180, -180, 34))),
  q: L(O(arc(46, 71, 24, 21, 45, 405, 34)), D(ln([70, 50], [70, 122]))),
  r: L(D(ln([34, 50], [34, 92])), O(arc(56, 66, 22, 16, 160, 40))),
  s: L(O(join(arc(50, 60, 22, 10, 35, 270), arc(50, 81, 24, 11, 90, -145)))),
  t: L(D(join(ln([46, 18], [46, 80]), arc(60, 80, 14, 12, 180, 270))), R(ln([28, 52], [68, 52]))),
  u: L(D(join(ln([26, 50], [26, 72]), arc(50, 72, 24, 20, 180, 360))), D(ln([74, 50], [74, 92]))),
  v: L(D(ln([24, 50], [50, 92])), D(ln([76, 50], [50, 92]))),
  w: L(D(ln([12, 50], [30, 92])), D(ln([50, 62], [30, 92])), D(ln([50, 62], [70, 92])), D(ln([88, 50], [70, 92]))),
  x: L(D(ln([26, 50], [74, 92])), D(ln([74, 50], [26, 92]))),
  y: L(D(ln([24, 50], [48, 92])), D(ln([76, 50], [38, 118]))),
  z: L(R(ln([26, 50], [74, 50])), D(ln([74, 50], [26, 92])), R(ln([26, 92], [74, 92]))),
};

export const LETTER_WORDS: Record<string, string> = { A: "apple", B: "ball", C: "cat", D: "duck", E: "egg", F: "fish", G: "goat", H: "hat", I: "igloo", J: "jam", K: "kite", L: "leaf", M: "moon", N: "nest", O: "orange", P: "pig", Q: "queen", R: "rain", S: "sun", T: "tree", U: "umbrella", V: "van", W: "web", X: "xylophone", Y: "yo-yo", Z: "zebra" };

export function letterPack(): PackItem[] {
  return Object.keys(LETTER_STROKES).map((ch) => ({ title: `Letter ${ch}${ch.toLowerCase()}`, tpl: "letter", kind: "template" as const, summary: `Trace ${ch} and ${ch.toLowerCase()}. Picture word: ${LETTER_WORDS[ch]}.`, data: { letter: ch } }));
}

/** Words that must never appear in a preschool tracing book's drafts or KDP text (no medical or therapy claims). */
export const CLAIM_WORDS = /\b(adhd|autis\w*|dyslexi\w*|cure[sd]?|therap\w*|treat(?:s|ed|ment)?|clinical(?:ly)?|heal(?:s|ed|ing)?|diagnos\w*|disorder|medical|remedy|proven to)\b/i;
export const STROKE_VERBS = /\b(pull down|slide right|hop over|loop around)\b/ig;
export const OTHER_DIRECTION = /\b(go (?:up|down|left|right|across)|swoop|zigzag|draw (?:up|down)|move (?:up|down|left|right)|trace (?:up|down)|curve (?:up|down)|slide (?:left|up|down)|hop (?:up|down))\b/i;
