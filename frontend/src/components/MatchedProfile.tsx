import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { Id, MatchedProfile as Profile } from '../types/api';
import { GOAL_LABEL, STYLE_LABEL, interval } from './CandidateCard';

// the full profile of someone you matched with, with the contact detail that
// stays hidden before a match (srs request.fullviewaftermatch). the server only
// answers if there is an accepted request between you.
export function MatchedProfile({ courseId, studentId }: { courseId: Id; studentId: Id }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMatchedProfile(courseId, studentId)
      .then(setProfile)
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.'));
  }, [courseId, studentId]);

  if (error) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }
  if (!profile) return <p className="muted">Loading profile...</p>;

  return (
    <div className="matched-profile">
      <p>
        <strong>{profile.name}</strong>
      </p>
      <p className="muted">{profile.schoolEmail}</p>
      <p className="tags">
        {profile.gradeGoal && <span>{GOAL_LABEL[profile.gradeGoal]}</span>}
        {profile.workStyle && <span>{STYLE_LABEL[profile.workStyle]}</span>}
        <span>{profile.reviewAverage === 'Not yet rated' ? 'Not yet rated' : `Rated ${profile.reviewAverage} out of 5`}</span>
      </p>
      <p className="label">Weekly free time</p>
      <ul className="intervals">
        {profile.blocks.map((b) => (
          <li key={`${b.weekday}-${b.startMinute}`}>{interval(b)}</li>
        ))}
      </ul>
    </div>
  );
}
