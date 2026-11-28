// collaborative code by somesh and claude sonnet 5.5

import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { GradeGoal, WorkStyle } from '../types/api';
import { sharedCells, toBlocks, toCells } from '../availability';
import type { Cells } from '../availability';
import { AvailabilityGrid } from './AvailabilityGrid';
import { GOAL_LABEL, STYLE_LABEL, interval } from './CandidateCard';

// first time walkthrough (srs ud-2), help button reopens it, all data made up

const block = (weekday: number, from: number, to: number) => ({ weekday, startMinute: from * 60, endMinute: to * 60 });

const classmates = [
  { gradeGoal: 'A_TRACK' as GradeGoal, workStyle: 'GROUP' as WorkStyle, cells: toCells([block(1, 10, 12), block(3, 14, 16)]) },
  { gradeGoal: 'A_TRACK' as GradeGoal, workStyle: 'SOLO' as WorkStyle, cells: toCells([block(1, 11, 13), block(4, 9, 10)]) },
  { gradeGoal: 'PASS_TRACK' as GradeGoal, workStyle: 'GROUP' as WorkStyle, cells: toCells([block(1, 10, 12)]) },
  { gradeGoal: 'A_TRACK' as GradeGoal, workStyle: 'GROUP' as WorkStyle, cells: toCells([block(5, 15, 17)]) },
];

// same rules and order as the real matching
function practiceMatches(gradeGoal: GradeGoal, workStyle: WorkStyle, cells: Cells) {
  const sameGoal = classmates.filter((c) => c.gradeGoal === gradeGoal); // goal has to match
  const withShared = sameGoal
    .map((c) => ({ ...c, shared: toBlocks(sharedCells(cells, c.cells)) }))
    .filter((c) => c.shared.length > 0); // needs shared time
  withShared.sort((a, b) => b.shared.length - a.shared.length || Number(b.workStyle === workStyle) - Number(a.workStyle === workStyle));
  return { shown: withShared, hidden: classmates.length - withShared.length };
}

export function TutorialDialog({ onDone, replay }: { onDone: () => void; replay?: boolean }) {
  const [step, setStep] = useState(1);
  const [gradeGoal, setGradeGoal] = useState<GradeGoal>('A_TRACK');
  const [workStyle, setWorkStyle] = useState<WorkStyle>('GROUP');
  const [cells, setCells] = useState<Cells>(toCells([block(1, 10, 12)]));
  const [sent, setSent] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  // keyboard users start inside the pop up
  useEffect(() => dialog.current?.focus(), []);

  async function close() {
    // if this fails the pop up shows again next time, so don't block
    if (!replay) await api.completeTutorial().catch(() => null);
    onDone();
  }

  const { shown, hidden } = practiceMatches(gradeGoal, workStyle, cells);

  return (
    <div className="tutorial-backdrop">
      <div
        ref={dialog}
        className="tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        {step === 1 && (
          <>
            <h2 id="tutorial-title">1. Set up your profile</h2>
            <p>This is practice and nothing is saved. Pick a grade goal and a work style, then mark when you are free.</p>
            <div className="field-row">
              <div className="form-field">
                <label htmlFor="practice-goal">Grade goal</label>
                <select id="practice-goal" value={gradeGoal} onChange={(e) => setGradeGoal(e.target.value as GradeGoal)}>
                  <option value="A_TRACK">{GOAL_LABEL.A_TRACK}</option>
                  <option value="PASS_TRACK">{GOAL_LABEL.PASS_TRACK}</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="practice-style">Work style</label>
                <select id="practice-style" value={workStyle} onChange={(e) => setWorkStyle(e.target.value as WorkStyle)}>
                  <option value="GROUP">{STYLE_LABEL.GROUP}</option>
                  <option value="SOLO">{STYLE_LABEL.SOLO}</option>
                </select>
              </div>
            </div>
            <AvailabilityGrid cells={cells} onChange={setCells} compact />
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="tutorial-title">2. Find matches</h2>
            <p>These made up classmates are ranked against your practice profile. Go back and change it to see the list move.</p>
            {shown.length === 0 && <p>No classmates share your grade goal and a free time.</p>}
            <ul className="cards">
              {shown.map((c, i) => (
                <li className="card" key={i}>
                  <div className="card-head">
                    <span className="rank">{i + 1}</span>
                  </div>
                  <p className="tags">
                    <span>{GOAL_LABEL[c.gradeGoal]}</span>
                    <span>{STYLE_LABEL[c.workStyle]}</span>
                  </p>
                  <p>Shared free time: {c.shared.map(interval).join(', ')}</p>
                  {i === 0 &&
                    (sent ? (
                      <p className="request-sent">Match request sent</p>
                    ) : (
                      <button className="request-btn" onClick={() => setSent(true)}>
                        Send match request
                      </button>
                    ))}
                </li>
              ))}
            </ul>
            {hidden > 0 && <p>{hidden} left out: a different grade goal or no shared free time.</p>}
          </>
        )}

        {step === 3 && (
          <>
            <h2 id="tutorial-title">3. Groups and reviews</h2>
            <p>When a classmate accepts your match request, the two of you become a group. If they are already in a group, you join it.</p>
            <p>After you work together, rate your groupmates from the Group tab. Their average shows on their profile and never changes the match order. Open Help any time to see this again.</p>
          </>
        )}

        <div className="tutorial-actions">
          <button onClick={close}>{replay ? 'Close' : 'Skip'}</button>
          <span>
            {step > 1 && <button onClick={() => setStep(step - 1)}>Back</button>}
            {step < 3 ? (
              <button className="save-btn" onClick={() => setStep(step + 1)}>
                Next
              </button>
            ) : (
              <button className="save-btn" onClick={close}>
                Finish
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
