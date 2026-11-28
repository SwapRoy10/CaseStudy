// original code by somesh, written by hand

import { AvailabilityBlock } from './types';

// bounds from sdd 5.1 and 6.2, profile saving uses it too
export function isValidBlock(b: AvailabilityBlock): boolean {
  return (
    Number.isInteger(b.weekday) &&
    b.weekday >= 0 &&
    b.weekday <= 6 &&
    Number.isInteger(b.startMinute) &&
    Number.isInteger(b.endMinute) &&
    b.startMinute >= 0 &&
    b.startMinute < b.endMinute &&
    b.endMinute <= 1440
  );
}

// overlap of two blocks (sdd 8.2), null if they share no time
export function intersect(a: AvailabilityBlock, b: AvailabilityBlock): AvailabilityBlock | null {
  if (a.weekday !== b.weekday) return null;

  const start = Math.max(a.startMinute, b.startMinute);
  const end = Math.min(a.endMinute, b.endMinute);

  // 9-10 and 10-11 only touch, no overlap
  if (start >= end) return null;

  return { weekday: a.weekday, startMinute: start, endMinute: end };
}

// dedupes and merges overlapping blocks before counting (sdd 5.3)
export function normalizeBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return mergeIntervals(blocks);
}

// merges overlapping intervals on a day (sdd 8.2), touching stay separate
export function mergeIntervals(intervals: AvailabilityBlock[]): AvailabilityBlock[] {
  const sorted = [...intervals].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);

  const merged: AvailabilityBlock[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.weekday === cur.weekday && cur.startMinute < last.endMinute) {
      // overlaps the last one, so stretch it
      last.endMinute = Math.max(last.endMinute, cur.endMinute);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export interface SharedResult {
  intervals: AvailabilityBlock[];
  overlapCount: number;
}

// overlapCount: requester blocks hitting any candidate block (sdd 8.2)
export function sharedIntersections(
  requesterBlocks: AvailabilityBlock[],
  candidateBlocks: AvailabilityBlock[]
): SharedResult {
  const intervals: AvailabilityBlock[] = [];
  let overlapCount = 0;

  for (const r of requesterBlocks) {
    let hit = false;
    for (const c of candidateBlocks) {
      const overlap = intersect(r, c);
      if (overlap) {
        intervals.push(overlap);
        hit = true;
      }
    }
    if (hit) overlapCount++; // once per requester block
  }

  return { intervals: mergeIntervals(intervals), overlapCount };
}
