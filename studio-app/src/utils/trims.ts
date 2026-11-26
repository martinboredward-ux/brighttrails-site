/** Every KDP trim size the Studio supports. One list, used by every tab and exporter. */
export type Trim = "8.5x8.5" | "8x10" | "8.5x11" | "6x9" | "5.5x8.5";

export const TRIMS: { id: Trim; w: number; h: number; label: string; use: string }[] = [
  { id: "8.5x8.5", w: 8.5, h: 8.5, label: "8.5 × 8.5 in", use: "Square Children's Picture Book" },
  { id: "8x10", w: 8, h: 10, label: "8 × 10 in", use: "Picture Book / Activity" },
  { id: "8.5x11", w: 8.5, h: 11, label: "8.5 × 11 in", use: "Coloring / Activity / Workbook" },
  { id: "6x9", w: 6, h: 9, label: "6 × 9 in", use: "Non-Fiction / Trade / Companion Workbook" },
  { id: "5.5x8.5", w: 5.5, h: 8.5, label: "5.5 × 8.5 in", use: "Digest / Short Guide" },
];

export const isTrim = (t: unknown): t is Trim => TRIMS.some((x) => x.id === t);
export const trimDims = (t: Trim | string | undefined): { w: number; h: number } => {
  const f = TRIMS.find((x) => x.id === t) ?? TRIMS[2];
  return { w: f.w, h: f.h };
};
export const trimLabel = (t: Trim | string | undefined) => {
  const f = TRIMS.find((x) => x.id === t) ?? TRIMS[2];
  return `${f.label} (${f.use})`;
};
/** Image shape that best fits a trim, for AI pictures. */
export const trimAspect = (t: Trim | string | undefined): "portrait" | "square" | "landscape" => {
  const { w, h } = trimDims(t);
  return w === h ? "square" : "portrait";
};
