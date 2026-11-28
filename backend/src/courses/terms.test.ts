// collaborative code by the group and claude sonnet 5.5

import { describe, expect, it } from 'vitest';
import { latestTerm, termRank } from './terms';

describe('termRank', () => {
  it('puts a later year after an earlier one', () => {
    expect(termRank('Spring 2027')).toBeGreaterThan(termRank('Fall 2026'));
  });

  it('puts the seasons in order within a year', () => {
    const ranks = ['Winter 2026', 'Spring 2026', 'Summer 2026', 'Fall 2026'].map(termRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('ignores case and extra spaces', () => {
    expect(termRank('  fall   2026 ')).toBe(termRank('Fall 2026'));
  });

  it('gives 0 to anything that is not a term', () => {
    for (const odd of ['Test', '', 'Fall', '2026', 'Autumn 2026', 'Fall 26']) expect(termRank(odd)).toBe(0);
  });
});

describe('latestTerm', () => {
  it('picks the newest term', () => {
    expect(latestTerm(['Spring 2026', 'Fall 2026', 'Fall 2025'])).toBe('Fall 2026');
  });

  it('does not mind the order', () => {
    expect(latestTerm(['Fall 2026', 'Spring 2026'])).toBe('Fall 2026');
    expect(latestTerm(['Spring 2026', 'Fall 2026'])).toBe('Fall 2026');
  });

  it('skips terms that are not real, like Test', () => {
    expect(latestTerm(['Test', 'Spring 2026', 'Test'])).toBe('Spring 2026');
  });

  it('is null when there is nothing real', () => {
    expect(latestTerm([])).toBeNull();
    expect(latestTerm(['Test'])).toBeNull();
  });
});
