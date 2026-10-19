import { AvailabilityBlock } from './types';

// Bounds from sdd 5.1 / 6.2. Profiles can use this when saving too.
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

// Clipped overlap of two blocks (sdd 8.2), or null if they don't share any time.
export function intersect(a: AvailabilityBlock, b: AvailabilityBlock): AvailabilityBlock | null {
  if (a.weekday !== b.weekday) return null;

  const start = Math.max(a.startMinute, b.startMinute);
  const end = Math.min(a.endMinute, b.endMinute);

  // 9-10 and 10-11 only touch, so start == end counts as no overlap
  if (start >= end) return null;

  return { weekday: a.weekday, startMinute: start, endMinute: end };
}

// Cleans up a student's saved blocks before counting: duplicates removed and
// overlapping blocks on the same day merged. Touching blocks (9:00-9:30 and
// 9:30-10:00) are kept separate on purpose so each 30 min block counts toward
// the overlap count. NOTE: the sdd glossary ("canonical availability") says to
// merge touching blocks too, we decided not to. Profiles should use this same
// function when saving (sdd 5.3).
export function normalizeBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return mergeIntervals(blocks);
}

// Merges overlapping intervals on the same day (sdd 8.2). Touching ones stay separate.
export function mergeIntervals(intervals: AvailabilityBlock[]): AvailabilityBlock[] {
  const sorted = [...intervals].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);

  const merged: AvailabilityBlock[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.weekday === cur.weekday && cur.startMinute < last.endMinute) {
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

// overlapCount is the number of requester blocks that hit at least one
// candidate block. A requester block overlapping two candidate blocks still
// only counts once (sdd 8.2, glossary "overlap count").
// Expects requesterBlocks to already be normalized.
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
    if (hit) overlapCount++;
  }

  return { intervals: mergeIntervals(intervals), overlapCount };
}
