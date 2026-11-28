// collaborative code by somesh and claude sonnet 5.5

import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { Id, MatchedProfile as Profile } from '../types/api';
import { GOAL_LABEL, STYLE_LABEL, interval } from './CandidateCard';

// full profile of a match with contact detail, only after an accepted request
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
        <span>{GOAL_LABEL[profile.gradeGoal]}</span>
        <span>{STYLE_LABEL[profile.workStyle]}</span>
        <span>{profile.reviewAverage === null ? 'Not yet rated' : `Rated ${profile.reviewAverage.toFixed(1)} out of 5`}</span>
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
