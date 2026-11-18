import { describe, expect, it } from 'vitest';
import { cellOf, sharedCells, slotLabel, toBlocks, toCells } from './availability';

const block = (weekday: number, from: number, to: number) => ({ weekday, startMinute: from * 60, endMinute: to * 60 });

describe('toCells and toBlocks', () => {
  it('gives the same blocks back', () => {
    const blocks = [block(1, 9, 11), block(3, 13, 15)];
    expect(toBlocks(toCells(blocks))).toEqual(blocks);
  });

  it('keeps half hours', () => {
    const blocks = [{ weekday: 1, startMinute: 510, endMinute: 570 }];
    expect(toBlocks(toCells(blocks))).toEqual(blocks);
  });

  it('keeps the first and last half hour of the week', () => {
    const blocks = [block(0, 0, 1), block(6, 23, 24)];
    expect(toBlocks(toCells(blocks))).toEqual(blocks);
  });

  it('keeps saturday night and sunday morning as two blocks', () => {
    const blocks = toBlocks(new Set([cellOf(6, 46), cellOf(6, 47), cellOf(0, 0), cellOf(0, 1)]));
    expect(blocks).toEqual([block(0, 0, 1), block(6, 23, 24)]);
  });

  it('draws touching or overlapping blocks as one', () => {
    expect(toBlocks(toCells([block(1, 9, 11), block(1, 10, 12), block(1, 12, 13)]))).toEqual([block(1, 9, 13)]);
  });

  it('keeps blocks on other days apart', () => {
    expect(toBlocks(toCells([block(1, 9, 11), block(2, 9, 11)]))).toEqual([block(1, 9, 11), block(2, 9, 11)]);
  });

  it('fills every half hour a block touches when it does not line up', () => {
    const cells = toCells([{ weekday: 2, startMinute: 545, endMinute: 575 }]);
    expect([...cells].sort()).toEqual([cellOf(2, 18), cellOf(2, 19)]);
  });

  it('is empty when nothing is free', () => {
    expect(toBlocks(new Set())).toEqual([]);
  });
});

describe('sharedCells', () => {
  it('keeps only the half hours both have', () => {
    expect(toBlocks(sharedCells(toCells([block(1, 9, 12)]), toCells([block(1, 11, 13)])))).toEqual([block(1, 11, 12)]);
  });
});

describe('slotLabel', () => {
  it('writes half hours the way a student would', () => {
    expect(slotLabel(0)).toBe('12:00 am');
    expect(slotLabel(19)).toBe('9:30 am');
    expect(slotLabel(24)).toBe('12:00 pm');
    expect(slotLabel(47)).toBe('11:30 pm');
  });
});
