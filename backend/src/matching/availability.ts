import { AvailabilityBlock } from './types';

// Clipped overlap of two blocks (sdd 8.2), or null if they don't share any time.
export function intersect(a: AvailabilityBlock, b: AvailabilityBlock): AvailabilityBlock | null {
  if (a.weekday !== b.weekday) return null;

  const start = Math.max(a.startMinute, b.startMinute);
  const end = Math.min(a.endMinute, b.endMinute);

  // 9-10 and 10-11 only touch, so start == end counts as no overlap
  if (start >= end) return null;

  return { weekday: a.weekday, startMinute: start, endMinute: end };
}

// "Canonical availability" from the sdd glossary: duplicates removed and
// overlapping or touching blocks on the same day merged. sdd 5.3 says profile
// save and matching use the same rule, so profiles can import this too.
// (midnight splitting happens before this, a block here can't go past 1440)
export function normalizeBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return merge(blocks, true);
}

// Merges shared intervals for display (sdd 8.2). Unlike normalizeBlocks,
// touching intervals stay separate here.
export function mergeIntervals(intervals: AvailabilityBlock[]): AvailabilityBlock[] {
  return merge(intervals, false);
}

function merge(list: AvailabilityBlock[], joinTouching: boolean): AvailabilityBlock[] {
  const sorted = [...list].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);

  const merged: AvailabilityBlock[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    const joins =
      last !== undefined &&
      last.weekday === cur.weekday &&
      (cur.startMinute < last.endMinute || (joinTouching && cur.startMinute === last.endMinute));

    if (joins) {
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
// Expects both lists to already be normalized.
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
