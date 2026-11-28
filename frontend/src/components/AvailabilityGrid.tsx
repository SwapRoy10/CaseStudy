// collaborative code by the group and claude sonnet 5.5

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { SLOTS_PER_DAY, cellOf, slotLabel } from '../availability';
import type { Cells } from '../availability';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
// grid opens at 8 am, 16 is the row height in index.css
const FIRST_SLOT_SHOWN = 16;
const ROW_HEIGHT = 16;

const clamp = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high);

// own weekly free time: drag to mark or clear, arrows move, space toggles
export function AvailabilityGrid({ cells, onChange, compact }: { cells: Cells; onChange: (cells: Cells) => void; compact?: boolean }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(cells);
  latest.current = cells;
  // what a drag paints, null when no drag
  const painting = useRef<boolean | null>(null);
  const touch = useRef(false);
  const keyMoved = useRef(false);
  const [cursor, setCursor] = useState({ day: 1, slot: 18 });

  useEffect(() => {
    if (box.current) box.current.scrollTop = FIRST_SLOT_SHOWN * ROW_HEIGHT;
    const stop = () => {
      painting.current = null;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  // scroll the cursor into view when arrows move it off screen
  useEffect(() => {
    if (!keyMoved.current) return;
    keyMoved.current = false;
    document.getElementById(`${id}-${cellOf(cursor.day, cursor.slot)}`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor, id]);

  function setCell(cell: number, free: boolean) {
    const next = new Set(latest.current);
    if (free) next.add(cell);
    else next.delete(cell);
    latest.current = next;
    onChange(next);
  }

  function cellUnder(e: { target: EventTarget }) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    return el ? Number(el.dataset.cell) : null;
  }

  const moveTo = (cell: number) => setCursor({ day: Math.floor(cell / SLOTS_PER_DAY), slot: cell % SLOTS_PER_DAY });

  function handlePointerDown(e: PointerEvent) {
    touch.current = e.pointerType === 'touch';
    const cell = cellUnder(e);
    if (touch.current || cell === null || e.button !== 0) return;
    painting.current = !latest.current.has(cell);
    setCell(cell, painting.current);
    moveTo(cell);
  }

  function handlePointerOver(e: PointerEvent) {
    // button let go outside the window, drag is over
    if (e.buttons === 0) painting.current = null;
    const cell = cellUnder(e);
    if (painting.current === null || cell === null) return;
    setCell(cell, painting.current);
    moveTo(cell);
  }

  // finger drag scrolls the grid, so on touch a tap toggles one half hour
  function handleClick(e: { target: EventTarget }) {
    const cell = cellUnder(e);
    if (!touch.current || cell === null) return;
    setCell(cell, !latest.current.has(cell));
    moveTo(cell);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const here = cellOf(cursor.day, cursor.slot);
    const arrow = ARROWS[e.key];
    if (arrow) {
      e.preventDefault();
      const day = clamp(cursor.day + arrow[0], 0, 6);
      const slot = clamp(cursor.slot + arrow[1], 0, SLOTS_PER_DAY - 1);
      if (e.shiftKey) setCell(cellOf(day, slot), latest.current.has(here));
      keyMoved.current = true;
      setCursor({ day, slot });
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setCell(here, !latest.current.has(here));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setCell(here, false);
    }
  }

  function clearAll() {
    latest.current = new Set();
    onChange(latest.current);
  }

  return (
    <div className={compact ? 'week compact' : 'week'}>
      <div
        ref={box}
        className="week-body"
        role="grid"
        aria-label="Weekly free time in Eastern time. Arrow keys move, space marks or clears."
        aria-multiselectable="true"
        aria-activedescendant={`${id}-${cellOf(cursor.day, cursor.slot)}`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className="week-row week-head" role="row">
          <span aria-hidden="true" />
          {DAYS.map((day) => (
            <span key={day} role="columnheader" aria-label={day}>
              {day.slice(0, 3)}
            </span>
          ))}
        </div>
        {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => (
          <div key={slot} className={slot % 2 === 0 ? 'week-row hour' : 'week-row'} role="row">
            <span className="week-time" aria-hidden="true">
              {slot % 2 === 0 ? slotLabel(slot).replace(':00', '') : ''}
            </span>
            {DAYS.map((day, d) => {
              const cell = cellOf(d, slot);
              const free = cells.has(cell);
              const here = cursor.day === d && cursor.slot === slot;
              return (
                <div
                  key={day}
                  id={`${id}-${cell}`}
                  data-cell={cell}
                  role="gridcell"
                  aria-selected={free}
                  aria-label={`${day} ${slotLabel(slot)}`}
                  className={`week-cell${free ? ' free' : ''}${here ? ' cursor' : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="week-help">
        <span>Drag to mark or clear. Eastern time.</span>
        <button type="button" onClick={clearAll}>
          Clear all
        </button>
      </p>
    </div>
  );
}
