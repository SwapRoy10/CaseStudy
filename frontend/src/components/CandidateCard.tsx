import { useState } from 'react';
import type { AvailabilityBlock, CandidateSummary } from '../types/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GOAL_LABEL = { A_TRACK: 'Aiming for an A', PASS_TRACK: 'Aiming to pass' };
const STYLE_LABEL = { SOLO: 'Prefers solo work', GROUP: 'Prefers group work' };

function time(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function interval(b: AvailabilityBlock) {
  return `${DAYS[b.weekday]} ${time(b.startMinute)}–${time(b.endMinute)}`;
}

// Limited view only: no name or contact details until a match is accepted.
export function CandidateCard({ candidate, rank }: { candidate: CandidateSummary; rank: number }) {
    const [requested, setRequested] = useState(false);
  return (
    <li className="card">
      <div className="card-head">
        <span className="rank">#{rank}</span>
        <span className="rating">
          {candidate.reviewAverage === null ? 'Not yet rated' : `★ ${candidate.reviewAverage.toFixed(1)}`}
        </span>
      </div>
      <p className="tags">
        <span>{GOAL_LABEL[candidate.gradeGoal]}</span>
        <span>{STYLE_LABEL[candidate.workStyle]}</span>
      </p>
      <p className="label">Shared free time</p>
      <ul className="intervals">
        {candidate.sharedIntervals.map((b) => (
          <li key={`${b.weekday}-${b.startMinute}`}>{interval(b)}</li>
        ))}
      </ul>
            {requested ? (
        <p className="request-sent">
          Request sent ✓{' '}
          <button onClick={() => setRequested(false)}>Cancel</button>
        </p>
      ) : (
        <button className="request-btn" onClick={() => setRequested(true)}>
          Request to study together
        </button>
      )}
    </li>
  );
}
