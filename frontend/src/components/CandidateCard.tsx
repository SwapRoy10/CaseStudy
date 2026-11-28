// collaborative code by the group and claude sonnet 5.5
// some parts are original code by swap, written by hand

import type { AvailabilityBlock, CandidateSummary, RequestRecord } from '../types/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const GOAL_LABEL = { A_TRACK: 'Aiming for an A', PASS_TRACK: 'Aiming to pass' };
export const STYLE_LABEL = { SOLO: 'Prefers solo work', GROUP: 'Prefers group work' };

function time(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export function interval(b: AvailabilityBlock) {
  return `${DAYS[b.weekday]} ${time(b.startMinute)}-${time(b.endMinute)}`;
}

// limited summary for cards and request lists, no name or contact yet
export function SummaryDetails({ summary }: { summary: CandidateSummary }) {
  return (
    <>
      <p className="tags">
        <span>{GOAL_LABEL[summary.gradeGoal]}</span>
        <span>{STYLE_LABEL[summary.workStyle]}</span>
        <span>
          {summary.reviewAverage === null ? 'Not yet rated' : `Rated ${summary.reviewAverage.toFixed(1)} out of 5`}
        </span>
      </p>
      <p className="label">Shared free time</p>
      <ul className="intervals">
        {summary.sharedIntervals.map((b) => (
          <li key={`${b.weekday}-${b.startMinute}`}>{interval(b)}</li>
        ))}
      </ul>
    </>
  );
}

interface Props {
  candidate: CandidateSummary;
  rank: number;
  studentId: string;
  // latest request with this candidate, if any
  request?: RequestRecord;
  busy: boolean;
  onSend: () => void;
  onCancel: (requestId: string) => void;
}

export function CandidateCard({ candidate, rank, studentId, request, busy, onSend, onCancel }: Props) {
  const sentByMe = request?.requesterId === studentId;

  return (
    <li className="card">
      <div className="card-head">
        <span className="rank">#{rank}</span>
        <span className="rating">
          {candidate.reviewAverage === null ? 'Not yet rated' : `Rated ${candidate.reviewAverage.toFixed(1)} out of 5`}
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

      {request?.status === 'PENDING' && sentByMe && (
        <p className="request-sent">
          Request sent{' '}
          <button disabled={busy} onClick={() => onCancel(request.requestId)}>
            Cancel
          </button>
        </p>
      )}
      {request?.status === 'PENDING' && !sentByMe && (
        <p className="request-note">This classmate sent you a request. You can answer it in the Requests tab.</p>
      )}
      {request?.status === 'ACCEPTED' && (
        <p className="request-sent">Matched. You can find them in the Group tab.</p>
      )}
      {(!request || request.status === 'DECLINED' || request.status === 'CANCELED') && (
        <>
          {request?.status === 'DECLINED' && <p className="request-note">Your last request was declined.</p>}
          <button className="request-btn" disabled={busy} onClick={onSend}>
            Send match request
          </button>
        </>
      )}
    </li>
  );
}
