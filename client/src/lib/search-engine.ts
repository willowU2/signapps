/**
 * Universal search engine — searches across all SignApps modules
 */

export interface SearchResult {
  id: string;
  type: "document" | "contact" | "email" | "task" | "event" | "file";
  title: string;
  snippet: string;
  url: string;
  score: number;
  updatedAt: string;
}

/**
 * Simple client-side fuzzy search across multiple data sources
 */
export function fuzzySearch(
  query: string,
  items: SearchResult[],
): SearchResult[] {
  if (!query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .map((item) => {
      const text = (item.title + " " + item.snippet).toLowerCase();
      const matchCount = terms.filter((t) => text.includes(t)).length;
      return { ...item, score: matchCount / terms.length };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Highlight matched terms in text
 */
export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text;
  const terms = query.split(/\s+/).filter(Boolean);
  let result = text;
  terms.forEach((term) => {
    const regex = new RegExp(
      `(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    result = result.replace(regex, "<mark>$1</mark>");
  });
  return result;
}
