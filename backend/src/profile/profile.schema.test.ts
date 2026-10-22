import { describe, it, expect } from 'vitest';
import { normalizeBlocks } from './profile.schema';

describe('normalizeBlocks', () => {
  it('keeps a normal block as is', () => {
    expect(normalizeBlocks([{ weekday: 1, startMinute: 600, endMinute: 720 }]))
      .toEqual([{ weekday: 1, startMinute: 600, endMinute: 720 }]);
  });

  it('splits a block that crosses midnight', () => {
    expect(normalizeBlocks([{ weekday: 6, startMinute: 1380, endMinute: 60 }])).toEqual([
      { weekday: 6, startMinute: 1380, endMinute: 1440 },
      { weekday: 0, startMinute: 0, endMinute: 60 },
    ]);
  });
});
