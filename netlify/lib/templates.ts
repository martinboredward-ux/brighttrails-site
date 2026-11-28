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
  { id: "quotes", label: "Quote strips (cut-out)", modes: ["planner"], ai: "8 short affirmation lines for cut-out quote strips, one per line, each under 9 words, confident and professional.",
    fields: [{ key: "lines", label: "Quotes (one per line)", lines: 8, hint: "I build with clarity and calm." }] },
  { id: "letter", label: "Letter spread (A + B)", modes: ["tracing"], ai: "For one letter of a preschool tracing book (ages 4-6): a one-sentence story cue about Dash the bunny acting out the stroke, and a calm parent prompt of at most 2 sentences. Use ONLY these stroke phrases for directions: Pull down, Slide right, Hop over, Loop around.",
    fields: [{ key: "cue", label: "Story cue (1 sentence)", lines: 2, hint: "Dash pulls down a long line for the letter." }, { key: "parent", label: "Parent prompt (max 2 sentences)", lines: 2, hint: "Trace with your finger first." }] },
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
  { title: "Cut-Out Sheet 3: Quote Strips", tpl: "quotes", kind: "template", summary: "Affirmation strips to cut out." },
];

/** Stroke order for the letter spreads. Each stroke is a polyline in a 0-100 box (y down). Phrases are the four allowed cues. */
export interface Stroke { cue: "Pull down" | "Slide right" | "Hop over" | "Loop around"; pts: [number, number][] }
const L = (...s: Stroke[]) => s;
const D = (pts: [number, number][]): Stroke => ({ cue: "Pull down", pts });
const R = (pts: [number, number][]): Stroke => ({ cue: "Slide right", pts });
const H = (pts: [number, number][]): Stroke => ({ cue: "Hop over", pts });
const O = (pts: [number, number][]): Stroke => ({ cue: "Loop around", pts });
const circ = (cx: number, cy: number, rx: number, ry: number, from = 330, to = 30): [number, number][] => {
  const out: [number, number][] = [];
  const n = 18, a0 = (from * Math.PI) / 180, span = (((to - from + 360) % 360) || 360) * Math.PI / 180;
  for (let i = 0; i <= n; i++) { const a = a0 - (i / n) * span; out.push([cx + rx * Math.cos(a), cy - ry * Math.sin(a)]); }
  return out;
};
export const LETTER_STROKES: Record<string, Stroke[]> = {
  A: L(D([[50, 8], [18, 92]]), D([[50, 8], [82, 92]]), R([[28, 62], [72, 62]])),
  B: L(D([[25, 8], [25, 92]]), O([[25, 8], [62, 12], [66, 30], [25, 48]]), O([[25, 48], [68, 54], [72, 74], [25, 92]])),
  C: L(O(circ(55, 50, 32, 42, 40, 320))),
  D: L(D([[25, 8], [25, 92]]), O([[25, 8], [70, 24], [76, 50], [70, 76], [25, 92]])),
  E: L(D([[28, 8], [28, 92]]), R([[28, 8], [74, 8]]), R([[28, 50], [66, 50]]), R([[28, 92], [74, 92]])),
  F: L(D([[28, 8], [28, 92]]), R([[28, 8], [74, 8]]), R([[28, 50], [64, 50]])),
  G: L(O(circ(52, 50, 32, 42, 40, 330)), R([[54, 54], [80, 54]])),
  H: L(D([[26, 8], [26, 92]]), D([[74, 8], [74, 92]]), R([[26, 50], [74, 50]])),
  I: L(R([[32, 8], [68, 8]]), D([[50, 8], [50, 92]]), R([[32, 92], [68, 92]])),
  J: L(D([[62, 8], [62, 70], [50, 90], [30, 84]])),
  K: L(D([[26, 8], [26, 92]]), D([[74, 8], [26, 52]]), D([[40, 40], [76, 92]])),
  L: L(D([[30, 8], [30, 92]]), R([[30, 92], [74, 92]])),
  M: L(D([[20, 92], [20, 8]]), D([[20, 8], [50, 60]]), D([[50, 60], [80, 8]]), D([[80, 8], [80, 92]])),
  N: L(D([[26, 92], [26, 8]]), D([[26, 8], [74, 92]]), D([[74, 92], [74, 8]])),
  O: L(O(circ(50, 50, 34, 42, 90, 90))),
  P: L(D([[28, 8], [28, 92]]), O([[28, 8], [66, 12], [70, 32], [28, 50]])),
  Q: L(O(circ(48, 48, 32, 40, 90, 90)), H([[58, 62], [80, 92]])),
  R: L(D([[28, 8], [28, 92]]), O([[28, 8], [66, 12], [70, 32], [28, 50]]), D([[44, 50], [76, 92]])),
  S: L(O([[72, 18], [50, 8], [28, 20], [32, 38], [50, 50], [72, 64], [70, 82], [48, 92], [26, 82]])),
  T: L(R([[22, 8], [78, 8]]), D([[50, 8], [50, 92]])),
  U: L(D([[26, 8], [26, 66], [38, 88], [50, 92], [62, 88], [74, 66], [74, 8]])),
  V: L(D([[20, 8], [50, 92]]), D([[50, 92], [80, 8]])),
  W: L(D([[12, 8], [30, 92]]), D([[30, 92], [50, 30]]), D([[50, 30], [70, 92]]), D([[70, 92], [88, 8]])),
  X: L(D([[24, 8], [76, 92]]), D([[76, 8], [24, 92]])),
  Y: L(D([[24, 8], [50, 50]]), D([[76, 8], [50, 50]]), D([[50, 50], [50, 92]])),
  Z: L(R([[24, 8], [76, 8]]), D([[76, 8], [24, 92]]), R([[24, 92], [76, 92]])),
};

export const LETTER_WORDS: Record<string, string> = { A: "apple", B: "ball", C: "cat", D: "duck", E: "egg", F: "fish", G: "goat", H: "hat", I: "igloo", J: "jam", K: "kite", L: "leaf", M: "moon", N: "nest", O: "orange", P: "pig", Q: "queen", R: "rain", S: "sun", T: "tree", U: "umbrella", V: "van", W: "web", X: "box", Y: "yo-yo", Z: "zebra" };

export function letterPack(): PackItem[] {
  return Object.keys(LETTER_STROKES).map((ch) => ({ title: `Letter ${ch}${ch.toLowerCase()}`, tpl: "letter", kind: "template" as const, summary: `Trace ${ch} and ${ch.toLowerCase()}. Picture word: ${LETTER_WORDS[ch]}.`, data: { letter: ch } }));
}

/** Words that must never appear in a preschool tracing book's drafts or KDP text (no medical or therapy claims). */
export const CLAIM_WORDS = /\b(adhd|autis\w*|dyslexi\w*|cure[sd]?|therap\w*|treat(?:s|ed|ment)?|clinical(?:ly)?|heal(?:s|ed|ing)?|diagnos\w*|disorder|medical|remedy|proven to)\b/i;
export const STROKE_VERBS = /\b(pull down|slide right|hop over|loop around)\b/ig;
export const OTHER_DIRECTION = /\b(go (?:up|down|left|right|across)|swoop|zigzag|draw (?:up|down)|move (?:up|down|left|right)|trace (?:up|down)|curve (?:up|down)|slide (?:left|up|down)|hop (?:up|down))\b/i;
