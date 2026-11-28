// collaborative code by the group and claude sonnet 5.5

const SEASON = { winter: 1, spring: 2, summer: 3, fall: 4 };

// number to compare terms like "Fall 2026" by, bigger is later
export function termRank(term: string): number {
  const match = term.trim().match(/^(winter|spring|summer|fall)\s+(\d{4})$/i);
  if (!match) return 0; // odd terms like "Test" never count as current
  return Number(match[2]) * 10 + SEASON[match[1].toLowerCase() as keyof typeof SEASON]; // year first, then season
}

// latest term in the list, null if none are real terms
export function latestTerm(terms: string[]): string | null {
  let best: string | null = null;
  for (const term of terms) {
    if (termRank(term) > 0 && (best === null || termRank(term) > termRank(best))) best = term;
  }
  return best;
}
