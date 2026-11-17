// terms are written like "Fall 2026". this gives each one a number to compare by,
// bigger is later. anything that doesn't look like that (the tests use "Test")
// gets 0, so it never counts as the current term.
const SEASON = { winter: 1, spring: 2, summer: 3, fall: 4 };

export function termRank(term: string): number {
  const match = term.trim().match(/^(winter|spring|summer|fall)\s+(\d{4})$/i);
  if (!match) return 0;
  return Number(match[2]) * 10 + SEASON[match[1].toLowerCase() as keyof typeof SEASON];
}

// the latest term in the list, or null if none of them are real terms
export function latestTerm(terms: string[]): string | null {
  let best: string | null = null;
  for (const term of terms) {
    if (termRank(term) > 0 && (best === null || termRank(term) > termRank(best))) best = term;
  }
  return best;
}
