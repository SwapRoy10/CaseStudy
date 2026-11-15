import { describe, it, expect } from 'vitest';
import { normalizeBlocks } from './profile.schema';

describe('normalizeBlocks', () => {
  it('keeps a normal block as is', () => {
    expect(normalizeBlocks([{ weekday: 1, startMinute: 600, endMinute: 720 }]))
      .toEqual([{ weekday: 1, startMinute: 600, endMinute: 720 }]);
  });

  it('splits a block that crosses midnight', () => {
    // sat 11pm to sun 1am, output comes back sorted by day so sunday is first
    expect(normalizeBlocks([{ weekday: 6, startMinute: 1380, endMinute: 60 }])).toEqual([
      { weekday: 0, startMinute: 0, endMinute: 60 },
      { weekday: 6, startMinute: 1380, endMinute: 1440 },
    ]);
  });

  it('merges duplicate and overlapping blocks the same way matching does', () => {
    expect(normalizeBlocks([
      { weekday: 1, startMinute: 600, endMinute: 720 },
      { weekday: 1, startMinute: 600, endMinute: 720 },
      { weekday: 1, startMinute: 660, endMinute: 780 },
    ])).toEqual([{ weekday: 1, startMinute: 600, endMinute: 780 }]);
  });

  it('keeps touching 30 min blocks separate so each one counts', () => {
    expect(normalizeBlocks([
      { weekday: 2, startMinute: 570, endMinute: 600 },
      { weekday: 2, startMinute: 540, endMinute: 570 },
    ])).toEqual([
      { weekday: 2, startMinute: 540, endMinute: 570 },
      { weekday: 2, startMinute: 570, endMinute: 600 },
    ]);
  });
});
