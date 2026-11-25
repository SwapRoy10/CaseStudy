import { FormEvent, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { GroupMember, Id } from '../types/api';

interface Props {
  groupId: Id;
  member: GroupMember;
  criteria: string[];
  // runs after a review is saved so the group screen marks it reviewed
  onReviewed: (studentId: Id) => void;
}

// rate one groupmate 1 to 5 on each criterion (srs review.scale)
export function ReviewForm({ groupId, member, criteria, onReviewed }: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [average, setAverage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allRated = criteria.every((c) => ratings[c] !== undefined); // send stays off until all are rated

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.submitReview(
        groupId,
        member.studentId,
        criteria.map((c) => ({ criteriaName: c, rating: ratings[c] }))
      );
      setAverage(res.revieweeAverage);
      onReviewed(member.studentId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (member.reviewedByMe) {
    return (
      <div className="review-done">
        <p className="request-sent">You reviewed {member.name}.</p>
        {average !== null && <p className="muted">Their average rating is now {average.toFixed(1)} out of 5.</p>}
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <p className="label">Review {member.name}</p>
      {criteria.map((c) => (
        <fieldset className="rating-row" key={c}>
          <legend>{c}</legend>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n}>
              <input
                type="radio"
                name={`${member.studentId}-${c}`}
                value={n}
                checked={ratings[c] === n}
                onChange={() => setRatings({ ...ratings, [c]: n })}
              />
              {n}
            </label>
          ))}
        </fieldset>
      ))}
      <p className="muted">1 is the lowest and 5 is the highest. Rate every one to send.</p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="save-btn" type="submit" disabled={!allRated || busy}>
        {busy ? 'Sending...' : 'Send review'}
      </button>
    </form>
  );
}
