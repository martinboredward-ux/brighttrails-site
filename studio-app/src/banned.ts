const WORDS = ["free", "bonus", "affordable", "cheap", "discount", "sale", "buy now", "order now", "add to cart", "best seller", "best-seller", "bestseller", "#1", "guarantee", "new", "latest", "review", "5 star", "5-star", "five star"];

const PATTERNS = WORDS.map((label) => {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return { label, re: label.startsWith("#") ? new RegExp(`(^|\\s)${esc}(?![0-9])`, "i") : new RegExp(`\\b${esc}\\b`, "i") };
});

export function scanBanned(text: string): string[] {
  const hits = new Set<string>();
  for (const { label, re } of PATTERNS) if (re.test(text)) hits.add(label);
  return [...hits];
}
