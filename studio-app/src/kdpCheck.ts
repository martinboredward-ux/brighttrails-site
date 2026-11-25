const STOP = new Set(["a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "book", "books", "kids", "your", "my", "is", "it"]);

export const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

export interface KeywordIssue { overTitle: string[]; overOthers: string[]; tooLong: boolean; length: number }

export function checkKeywords(keywords: string[], title: string, subtitle: string): KeywordIssue[] {
  const titleWords = new Set(words(`${title} ${subtitle}`));
  return keywords.map((k, i) => {
    const mine = new Set(words(k));
    const overTitle = [...mine].filter((w) => titleWords.has(w));
    const overOthers = [...mine].filter((w) => keywords.some((o, j) => j !== i && new Set(words(o)).has(w)));
    return { overTitle, overOthers, tooLong: k.length > 50, length: k.length };
  });
}
