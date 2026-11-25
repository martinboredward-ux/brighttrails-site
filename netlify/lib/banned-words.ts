// Amazon A+ Content words and phrases to avoid in module copy.
export const BANNED_PATTERNS: { label: string; re: RegExp }[] = [
  "free", "bonus", "affordable", "cheap", "discount", "sale", "buy now", "order now",
  "add to cart", "best seller", "best-seller", "bestseller", "#1", "guarantee", "new", "latest",
  "review", "5 star", "5-star", "five star",
].map((label) => {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  const re = label.startsWith("#")
    ? new RegExp(`(^|\\s)${esc}(?![0-9])`, "i")
    : new RegExp(`\\b${esc}\\b`, "i");
  return { label, re };
});

export function scanBanned(text: string): string[] {
  const hits = new Set<string>();
  for (const { label, re } of BANNED_PATTERNS) if (re.test(text)) hits.add(label);
  return [...hits];
}
