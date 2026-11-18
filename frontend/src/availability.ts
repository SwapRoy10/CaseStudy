import type { AvailabilityBlock } from './types/api';

// the grid works in half hours. a cell is day * 48 + slot, and a set of cells
// is everything the student marked as free

export const SLOTS_PER_DAY = 48;
const SLOT_MINUTES = 30;

export type Cells = Set<number>;

export function cellOf(day: number, slot: number) {
  return day * SLOTS_PER_DAY + slot;
}

// a block fills every half hour it touches
export function toCells(blocks: AvailabilityBlock[]): Cells {
  const cells: Cells = new Set();
  for (const b of blocks) {
    const first = Math.floor(b.startMinute / SLOT_MINUTES);
    const last = Math.ceil(b.endMinute / SLOT_MINUTES) - 1;
    for (let slot = first; slot <= last; slot++) cells.add(cellOf(b.weekday, slot));
  }
  return cells;
}

// runs of free half hours become blocks. a block never runs past midnight
export function toBlocks(cells: Cells): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];
  for (let day = 0; day < 7; day++) {
    let start = -1;
    for (let slot = 0; slot <= SLOTS_PER_DAY; slot++) {
      const free = slot < SLOTS_PER_DAY && cells.has(cellOf(day, slot));
      if (free && start < 0) start = slot;
      if (!free && start >= 0) {
        blocks.push({ weekday: day, startMinute: start * SLOT_MINUTES, endMinute: slot * SLOT_MINUTES });
        start = -1;
      }
    }
  }
  return blocks;
}

// 0 is 12 am, 18 is 9 am
export function slotLabel(slot: number) {
  const hour = Math.floor(slot / 2);
  const minutes = slot % 2 === 0 ? '00' : '30';
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minutes} ${hour < 12 ? 'am' : 'pm'}`;
}

// the cells both sets have in common, used by the tutorial's practice matching
export function sharedCells(a: Cells, b: Cells): Cells {
  return new Set([...a].filter((cell) => b.has(cell)));
}
